import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { classifyCreatorAccommodationProvider } from "../lib/creatorAccommodationClassifier";

const GRIL_TENANT_ID = "1bf40460-bca8-418a-b01d-974b436ef3b0";
const INITIAL_CUMULATIVE_DROPPED = [
  "Apartma Skala", "Glamping Savinja", "Gostilna Kamp Menina", "Herbal glamping Ljubno",
  "Hotel Golte", "Hotel Logarjevih sester", "hotel Montis Golte", "Hotel Montis****",
  "Hotel Paka", "Hotel Plesnik", "Kamp Menina", "restavracija Hotela Montis Golte",
  "Turistična kmetija Govc Vršnik", "Turistična kmetija Gradišnik",
  "Turistični kmetiji Govc Vršnik", "Linasi resort Slovenija ***", "Penzion Na razpotju",
  "pravljični gozd pri penzionu Na razpotju", "Turistična kmetija Visočnik",
].map((name) => ({ name, reasons: ["historical-accommodation-cleanup"] }));

export async function cleanupGrilAccommodationProposals() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Gril accommodation cleanup is development-only.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM creator_place_proposals
       WHERE tenant_id = $1 AND content_ready = true`,
      [GRIL_TENANT_ID],
    );
    const rows = await client.query<{
      proposal_id: string;
      proposed_name: string;
      category_key: string;
      place_name: string;
    }>(
      `SELECT DISTINCT p.id AS proposal_id, p.proposed_name,
              f.category_key, f.place_name
       FROM creator_place_proposals p
       JOIN creator_source_candidates c ON c.proposal_id = p.id
       JOIN creator_source_candidate_facts cf ON cf.candidate_id = c.id
       JOIN creator_source_facts f ON f.id = cf.fact_id
       WHERE p.tenant_id = $1 AND p.content_ready = true`,
      [GRIL_TENANT_ID],
    );
    const dropped = new Map<string, { name: string; reasons: Set<string> }>();
    for (const row of rows.rows) {
      const classification = classifyCreatorAccommodationProvider({
        name: row.proposed_name,
        categoryKey: row.category_key,
        evidence: row.place_name,
      });
      if (!classification.excluded) continue;
      const entry = dropped.get(row.proposal_id) ?? {
        name: row.proposed_name,
        reasons: new Set<string>(),
      };
      entry.reasons.add(classification.reason ?? "accommodation-provider");
      dropped.set(row.proposal_id, entry);
    }
    if (dropped.size) {
      await client.query(
        `UPDATE creator_place_proposals
         SET content_ready = false, updated_at = now()
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [GRIL_TENANT_ID, [...dropped.keys()]],
      );
    }
    const after = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM creator_place_proposals
       WHERE tenant_id = $1 AND content_ready = true`,
      [GRIL_TENANT_ID],
    );
    await client.query("COMMIT");
    return {
      tenantId: GRIL_TENANT_ID,
      beforeQueueCount: before.rows[0]?.count ?? 0,
      afterQueueCount: after.rows[0]?.count ?? 0,
      droppedCount: dropped.size,
      dropped: [...dropped.values()]
        .map((entry) => ({ name: entry.name, reasons: [...entry.reasons].sort() }))
        .sort((left, right) => left.name.localeCompare(right.name, "sl")),
      preservation: "Only content_ready was cleared; source facts, candidates, translations, items, and publication were untouched.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith("cleanup-gril-accommodation-proposals.ts")) {
  const path = resolve(process.cwd(), "../../reports/gril-accommodation-cleanup.json");
  let prior: {
    originalBeforeQueueCount?: number;
    beforeQueueCount?: number;
    dropped?: unknown[];
    cumulativeDropped?: unknown[];
  } = {};
  try {
    prior = JSON.parse(await readFile(path, "utf8")) as typeof prior;
  } catch {
    // First bounded pass has no prior report.
  }
  const pass = await cleanupGrilAccommodationProposals();
  const originalBeforeQueueCount = prior.originalBeforeQueueCount ?? prior.beforeQueueCount ?? pass.beforeQueueCount;
  const report = {
    tenantId: GRIL_TENANT_ID,
    originalBeforeQueueCount,
    visibleBeforeThisPass: pass.beforeQueueCount,
    afterQueueCount: pass.afterQueueCount,
    newlyDroppedThisPass: pass.dropped,
    newlyDroppedCount: pass.droppedCount,
    cumulativeDroppedCount: originalBeforeQueueCount - pass.afterQueueCount,
    cumulativeDropped: [
      ...((prior.cumulativeDropped?.length ? prior.cumulativeDropped : prior.dropped?.length ? prior.dropped : INITIAL_CUMULATIVE_DROPPED)),
      ...pass.dropped,
    ],
    preservation: pass.preservation,
  };
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report));
}