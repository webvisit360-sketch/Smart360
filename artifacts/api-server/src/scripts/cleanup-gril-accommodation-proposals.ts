import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { reevaluateCreatorQueue } from "../lib/creatorQueueReevaluation";

const GRIL_TENANT_ID = "1bf40460-bca8-418a-b01d-974b436ef3b0";

export async function cleanupGrilAccommodationProposals(
  tenantId = GRIL_TENANT_ID,
  options: { apply?: boolean } = {},
) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Gril accommodation cleanup is development-only.");
  }
  return {
    tenantId,
    mode: options.apply ? "apply" : "dry-run",
    ...await reevaluateCreatorQueue(tenantId, { dryRun: !options.apply }),
    preservation: "Run reports, source facts, candidates, verification attempts, items, and publication are untouched.",
  };
}

if (process.argv[1]?.endsWith("cleanup-gril-accommodation-proposals.ts")) {
  const apply = process.argv.includes("--apply");
  const tenantArg = process.argv.find((value) => value.startsWith("--tenant="));
  const tenantId = tenantArg?.slice("--tenant=".length) || GRIL_TENANT_ID;
  const report = await cleanupGrilAccommodationProposals(tenantId, { apply });
  const path = resolve(process.cwd(), "../../reports/creator-queue-reevaluation.json");
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report));
}