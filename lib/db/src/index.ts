import { drizzle } from "drizzle-orm/node-postgres";
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
export const db = drizzle(pool, { schema });

export * from "./schema";
