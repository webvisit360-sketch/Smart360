import { writeFile, readFile, unlink } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import { db, pool, tenantsTable, tenantCopyJobsTable } from "@workspace/db";
import { objectStorageClient } from "../../lib/objectStorage";
import { assertDev, seedDuplicateFixture, cleanupDuplicateFixture } from "./duplicate-project-fixture";

assertDev();
const path = "/tmp/copy-recovery-browser.json";
if (process.argv[2] === "seed") {
  const fixture = await seedDuplicateFixture();
  const slug = `dup-${fixture.key}-browser`;
  // Save immediately so even a failed worker can be cleaned.
  await writeFile(path, JSON.stringify({ fixture, slug }), { mode: 0o600 });
  const worker = fork(new URL("./interrupted-copy-worker.ts", import.meta.url),
    [fixture.sourceId, slug, "1"], { execArgv: ["--import", "tsx/esm"], stdio: ["ignore", "ignore", "inherit", "ipc"] });
  try {
    await Promise.race([
      once(worker, "message"),
      once(worker, "exit").then(() => { throw new Error("Worker exited too soon"); }),
      new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("Worker timeout")), 45000); timer.unref(); }),
    ]);
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) {
      const exited = once(worker, "exit"); worker.kill("SIGKILL"); await exited;
    }
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  const [job] = await db.select().from(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, tenant.id));
  await writeFile(path, JSON.stringify({ fixture, slug, tenantId: tenant.id, manifest: job.objectManifest }), { mode: 0o600 });
  console.log(JSON.stringify({ slug, tenantId: tenant.id, state: tenant.copyState }));
} else if (process.argv[2] === "cleanup") {
  const { fixture, tenantId, manifest = [] } = JSON.parse(await readFile(path, "utf8"));
  const remainingBeforeCleanup = tenantId
    ? (await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId))).length : null;
  let objectsBeforeCleanup = 0;
  for (const object of manifest) if ((await objectStorageClient.bucket(object.bucket).file(object.name).exists())[0]) objectsBeforeCleanup++;
  const proof = await cleanupDuplicateFixture(fixture);
  console.log(JSON.stringify({ remainingBeforeFixtureCleanup: remainingBeforeCleanup, objectsBeforeFixtureCleanup: objectsBeforeCleanup, ...proof }));
  await unlink(path);
} else throw new Error("Expected seed or cleanup");
await pool.end();