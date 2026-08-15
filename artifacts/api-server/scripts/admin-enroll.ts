/**
 * Prints a single-use admin passkey enrolment link (valid 15 minutes).
 * Run from the workspace root:  pnpm --filter @workspace/api-server run admin:enroll
 */
import { pool } from "@workspace/db";
import { createEnrollToken, ensureAdminAccount } from "../src/lib/adminAuth";

async function main() {
  await ensureAdminAccount();
  const token = await createEnrollToken("shell");
  const domain = process.env["REPLIT_DEV_DOMAIN"];
  const base = process.env["RP_ORIGIN"] || (domain ? `https://${domain}` : "http://localhost:80");
  console.log("\nEnkratna povezava za registracijo passkeyja (velja 15 minut):\n");
  console.log(`${base}/admin/enroll?token=${token}\n`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
