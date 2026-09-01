import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  releaseMunicipalityRunLease,
  startCreatorSourceRun,
  tryAcquireMunicipalityRunLease,
  type MunicipalityRunLease,
} from "../lib/creatorSourceRunService";

test("one municipality lease excludes a cross-tenant run and source mutation", async () => {
  const municipality = `Lease test ${randomUUID()}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const slugA = `lease-a-${randomUUID()}`;
  const slugB = `lease-b-${randomUUID()}`;
  let firstLease = await tryAcquireMunicipalityRunLease(municipality);
  assert.ok(firstLease);
  let secondLease: MunicipalityRunLease | null = null;
  const mutationClient = await pool.connect();
  try {
    await pool.query(
      `INSERT INTO tenants (id, slug, name, municipality)
       VALUES ($1, $2, 'Lease A', $3), ($4, $5, 'Lease B', $3)`,
      [tenantA, slugA, municipality, tenantB, slugB],
    );
    await pool.query(
      `INSERT INTO creator_source_runs (tenant_id, report_json)
       VALUES ($1, $2)`,
      [tenantA, JSON.stringify({ capturedSourceIds: [randomUUID()], municipality })],
    );

    secondLease = await tryAcquireMunicipalityRunLease(municipality);
    assert.equal(secondLease, null, "a second tenant cannot acquire the run lease");

    await mutationClient.query("BEGIN");
    const mutationLock = await mutationClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
      [`creator-municipality:${municipality}`],
    );
    assert.equal(
      mutationLock.rows[0]?.acquired,
      false,
      "registry/origin mutation fails immediately while the run lease is held",
    );
    await mutationClient.query("ROLLBACK");

    await releaseMunicipalityRunLease(firstLease);
    firstLease = null;
    secondLease = await tryAcquireMunicipalityRunLease(municipality);
    assert.ok(secondLease, "the other tenant can proceed once the run lease releases");
  } finally {
    await mutationClient.query("ROLLBACK").catch(() => undefined);
    mutationClient.release();
    await releaseMunicipalityRunLease(firstLease ?? undefined);
    await releaseMunicipalityRunLease(secondLease ?? undefined);
    await pool.query("DELETE FROM creator_source_runs WHERE tenant_id = ANY($1::uuid[])", [
      [tenantA, tenantB],
    ]);
    await pool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [[tenantA, tenantB]]);
  }
});

test("three dedicated municipality leases do not exhaust the pool and cap a fourth run", async () => {
  const tenantIds = Array.from({ length: 4 }, () => randomUUID());
  const municipalities = Array.from({ length: 3 }, () => `Lease cap ${randomUUID()}`);
  const leases: MunicipalityRunLease[] = [];
  try {
    await pool.query(
      `INSERT INTO tenants (id, slug, name, municipality)
       VALUES
       ($1, $5, 'Cap A', $9),
       ($2, $6, 'Cap B', $10),
       ($3, $7, 'Cap C', $11),
       ($4, $8, 'Cap D', $12)`,
      [
        ...tenantIds,
        ...tenantIds.map((id) => `lease-cap-${id}`),
        ...municipalities,
        `Lease cap fourth ${randomUUID()}`,
      ],
    );
    for (const municipality of municipalities) {
      const lease = await tryAcquireMunicipalityRunLease(municipality);
      assert.ok(lease);
      leases.push(lease);
    }
    for (let index = 0; index < 3; index++) {
      await pool.query(
        `INSERT INTO creator_source_runs (tenant_id, report_json)
         VALUES ($1, $2)`,
        [tenantIds[index], JSON.stringify({
          capturedSourceIds: [randomUUID()],
          municipality: municipalities[index],
        })],
      );
    }

    const responsive = await Promise.race([
      pool.query("SELECT 1 AS healthy").then((result) => result.rows[0]?.healthy),
      new Promise<never>((_, reject) => setTimeout(
        () => reject(new Error("shared pool SELECT timed out")),
        1_000,
      )),
    ]);
    assert.equal(responsive, 1);
    await assert.rejects(
      () => startCreatorSourceRun(tenantIds[3]!),
      /At most three source-first runs may be active/,
    );
  } finally {
    for (const lease of leases) await releaseMunicipalityRunLease(lease);
    await pool.query("DELETE FROM creator_source_runs WHERE tenant_id = ANY($1::uuid[])", [
      tenantIds,
    ]);
    await pool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [tenantIds]);
  }
});