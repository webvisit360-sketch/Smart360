import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
export type { PoolClient } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Explicit pool ceiling (was the node-postgres default of 10, undocumented).
// One pool per api-server process; autoscale multiplies this by instance
// count, so keep instances × max well under the managed-Postgres cap (~100).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export type Db = NodePgDatabase<typeof schema>;
const baseDb: Db = drizzle(pool, { schema });

/**
 * Host request scoping (Instruction #28, Ring 3).
 *
 * A host request must run EVERY query on one dedicated connection whose
 * session sets app.role='host' and app.tenant_id=<their tenant>, so the
 * fail-closed row-level-security policies apply to whatever the handlers do —
 * including handlers that were never written with tenancy in mind. The
 * context lives in AsyncLocalStorage; the exported `db` transparently routes
 * to the scoped connection inside the context and to the shared pool outside
 * it (guest, public, owner and background work — zero overhead there).
 *
 * Poisoned-connection safety: the settings are cleared with RESET ALL before
 * the client returns to the pool, and if ANYTHING about that cleanup is in
 * doubt the client is DESTROYED (release(err)) rather than reused. A pooled
 * connection can therefore never carry a host's tenant setting into a public
 * or another tenant's query.
 */
type HostDbContext = {
  db: Db;
  released: boolean;
};

const hostDbStorage = new AsyncLocalStorage<HostDbContext>();

export type HostDbHandle = {
  /** Runs fn inside the scoped context (queries route to the scoped client). */
  enter: <T>(fn: () => T) => T;
  /** Cleans the connection and returns it to the pool (or destroys it). Idempotent. */
  release: () => Promise<void>;
};

export async function openHostDbContext(tenantId: string): Promise<HostDbHandle> {
  const client = await pool.connect();
  const ctx: HostDbContext = {
    db: drizzle(client, { schema }),
    released: false,
  };
  try {
    // SET ROLE to the dedicated NOBYPASSRLS role (created at startup by the
    // api-server's RLS ensure): the pool's own user is a superuser on managed
    // Postgres and would bypass row-level security entirely.
    await client.query("SET ROLE smart360_host");
    await client.query(
      "SELECT set_config('app.role', 'host', false), set_config('app.tenant_id', $1, false)",
      [tenantId],
    );
  } catch (err) {
    ctx.released = true;
    client.release(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
  let released = false;
  return {
    enter: (fn) => hostDbStorage.run(ctx, fn),
    release: async () => {
      if (released) return;
      released = true;
      ctx.released = true;
      try {
        await client.query("RESET ROLE");
        await client.query("RESET ALL");
        client.release();
      } catch (err) {
        // Never return a client we could not clean — destroy it.
        client.release(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };
}

/** Convenience wrapper for tests and short scoped work. */
export async function runWithHostDbContext<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const handle = await openHostDbContext(tenantId);
  try {
    return await handle.enter(fn);
  } finally {
    await handle.release();
  }
}

/** True while running inside a host-scoped DB context (used by tests/logging). */
export function inHostDbContext(): boolean {
  const ctx = hostDbStorage.getStore();
  return !!ctx && !ctx.released;
}

export const db: Db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const ctx = hostDbStorage.getStore();
    // FAIL CLOSED: work that inherited a host context but outlives its
    // release (fire-and-forget promises, timers) must NOT silently fall back
    // to the privileged pool — that would run without row-level security and
    // could leak foreign tenants' data. Such code must either finish before
    // the response or explicitly opt out via escapeHostDbContext().
    if (ctx?.released) {
      throw new Error(
        "host db context released: refusing privileged fallback — finish queries before the response or use escapeHostDbContext()",
      );
    }
    const active = ctx ? ctx.db : target;
    const value = Reflect.get(active as object, prop, active === target ? receiver : active);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as Db;

/**
 * Runs fn OUTSIDE any host DB context, on the shared privileged pool.
 * The explicit, greppable escape hatch for deliberate system-level work
 * spawned from a host request (there is intentionally no implicit fallback).
 */
export function escapeHostDbContext<T>(fn: () => T): T {
  return hostDbStorage.exit(fn);
}

export * from "./schema";
