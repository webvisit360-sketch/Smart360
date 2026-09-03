import { pool } from "@workspace/db";
import { classifyCreatorAccommodationProvider } from "./creatorAccommodationClassifier";
import {
  backfillApprovedCreatorProposalMaterializations,
  creatorProposalProcessingReason,
  fuzzyCreatorProposalKey,
  type CreatorProposalProcessingFailure,
} from "./creatorProposalLedger";
import { storedResolutionWrongSettlementReason } from "./creatorSieve";

export const CREATOR_ACCOMMODATION_REFUSAL_REASON = "accommodation_provider";

export type ReevaluateCreatorQueueResult = {
  evaluated: number;
  changed: number;
  unchanged: number;
  accommodationsExcluded: number;
  wrongSettlementMovedToUnresolved: number;
  duplicatesMerged: number;
  approvedBackfilled: number;
  failures: CreatorProposalProcessingFailure[];
};

export type CreatorQueueReevaluationRow = {
  id: string;
  proposedName: string;
  status: "pending" | "unresolved" | "approved" | "rejected" | "superseded";
  contentReady: boolean;
  geocodingLookupHint: string | null;
  resolvedAddress: string | null;
  confirmedQuery: string | null;
  confirmationMethod: string | null;
  osmType: string | null;
  osmId: number | null;
  refusalReason: string | null;
  supersededBy: string | null;
  createdAt: Date;
};

type SourceFact = {
  proposalId: string;
  categoryKey: string;
  placeName: string;
};

export type CreatorQueueReevaluationChange = {
  id: string;
  kind: "accommodation" | "wrong_settlement" | "duplicate";
  supersededBy?: string;
  reason?: string;
};

/**
 * Pure, deterministic planner shared by the operator endpoint, tests and the
 * development report command. It only accepts currently visible unresolved or
 * pending rows, so reviewed decisions can never enter a reevaluation plan.
 */
export function planCreatorQueueReevaluation(
  rows: CreatorQueueReevaluationRow[],
  facts: SourceFact[],
): CreatorQueueReevaluationChange[] {
  const factsByProposal = new Map<string, SourceFact[]>();
  for (const fact of facts) {
    const list = factsByProposal.get(fact.proposalId) ?? [];
    list.push(fact);
    factsByProposal.set(fact.proposalId, list);
  }

  const eligible = rows.filter((row) =>
    row.contentReady && (row.status === "pending" || row.status === "unresolved"));
  const accommodations = new Set(eligible.filter((row) => {
    const evidence = factsByProposal.get(row.id) ?? [{
      proposalId: row.id,
      categoryKey: "",
      placeName: "",
    }];
    return evidence.some((fact) => classifyCreatorAccommodationProvider({
      name: row.proposedName,
      categoryKey: fact.categoryKey,
      evidence: fact.placeName,
    }).excluded);
  }).map((row) => row.id));

  const changes: CreatorQueueReevaluationChange[] = [...accommodations].map((id) => ({
    id,
    kind: "accommodation",
    reason: CREATOR_ACCOMMODATION_REFUSAL_REASON,
  }));
  const remaining = eligible.filter((row) => !accommodations.has(row.id));
  const groups = new Map<string, CreatorQueueReevaluationRow[]>();
  for (const row of remaining) {
    const key = fuzzyCreatorProposalKey(row.proposedName);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const duplicates = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    const canonical = group[0]!;
    for (const duplicate of group.slice(1)) {
      duplicates.add(duplicate.id);
      changes.push({ id: duplicate.id, kind: "duplicate", supersededBy: canonical.id });
    }
  }
  for (const row of remaining) {
    if (duplicates.has(row.id) || !row.confirmedQuery) continue;
    const reason = storedResolutionWrongSettlementReason(
      row.geocodingLookupHint,
      row.resolvedAddress,
    );
    if (!reason) continue;
    const alreadyApplied = row.status === "unresolved"
      && row.refusalReason === reason
      && row.confirmationMethod === null
      && row.osmType === null
      && row.osmId === null;
    if (!alreadyApplied) changes.push({ id: row.id, kind: "wrong_settlement", reason });
  }
  return changes;
}

export async function reevaluateCreatorQueue(
  tenantId: string,
  options: { dryRun?: boolean } = {},
): Promise<ReevaluateCreatorQueueResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `creator-queue-reevaluation:${tenantId}`,
    ]);
    const tenant = await client.query("SELECT id FROM tenants WHERE id = $1", [tenantId]);
    if (!tenant.rowCount) throw new Error("Namestitev ni najdena.");
    const result = await client.query<{
      id: string; proposed_name: string; status: "pending" | "unresolved";
      content_ready: boolean; geocoding_lookup_hint: string | null;
      resolved_address: string | null; confirmed_query: string | null;
      confirmation_method: string | null; osm_type: string | null;
      osm_id: string | null; refusal_reason: string | null;
      superseded_by: string | null; created_at: Date;
    }>(
      `SELECT id, proposed_name, status, content_ready, geocoding_lookup_hint,
              resolved_address, confirmed_query, confirmation_method, osm_type,
              osm_id, refusal_reason, superseded_by, created_at
       FROM creator_place_proposals
       WHERE tenant_id = $1 AND content_ready = true
         AND status IN ('pending', 'unresolved')
       ORDER BY created_at, id
       FOR UPDATE`,
      [tenantId],
    );
    const factRows: Array<{
      proposal_id: string; category_key: string; place_name: string;
    }> = result.rows.length === 0 ? [] : (await client.query<{
      proposal_id: string; category_key: string; place_name: string;
    }>(
      `SELECT c.proposal_id, f.category_key, f.place_name
       FROM creator_source_candidates c
       JOIN creator_source_candidate_facts cf ON cf.candidate_id = c.id
       JOIN creator_source_facts f ON f.id = cf.fact_id
       WHERE c.proposal_id = ANY($1::uuid[])`,
      [result.rows.map((row) => row.id)],
    )).rows;
    const rows: CreatorQueueReevaluationRow[] = result.rows.map((row) => ({
      id: row.id,
      proposedName: row.proposed_name,
      status: row.status,
      contentReady: row.content_ready,
      geocodingLookupHint: row.geocoding_lookup_hint,
      resolvedAddress: row.resolved_address,
      confirmedQuery: row.confirmed_query,
      confirmationMethod: row.confirmation_method,
      osmType: row.osm_type,
      osmId: row.osm_id === null ? null : Number(row.osm_id),
      refusalReason: row.refusal_reason,
      supersededBy: row.superseded_by,
      createdAt: new Date(row.created_at),
    }));
    const facts: SourceFact[] = factRows.map((row) => ({
      proposalId: row.proposal_id,
      categoryKey: row.category_key,
      placeName: row.place_name,
    }));
    const changes = planCreatorQueueReevaluation(rows, facts);
    const failures: CreatorProposalProcessingFailure[] = [];
    const appliedChanges: CreatorQueueReevaluationChange[] = [];
    const proposedNameById = new Map(rows.map((row) => [row.id, row.proposedName]));
    for (const change of changes) {
      await client.query("SAVEPOINT creator_proposal_change");
      try {
        let update;
        if (change.kind === "accommodation") {
          update = await client.query(
            `UPDATE creator_place_proposals
             SET content_ready = false, status = 'unresolved', refusal_reason = $3,
                 updated_at = now()
             WHERE tenant_id = $1 AND id = $2 AND content_ready = true
               AND status IN ('pending', 'unresolved')`,
            [tenantId, change.id, change.reason],
          );
        } else if (change.kind === "duplicate") {
          update = await client.query(
            `UPDATE creator_place_proposals
             SET content_ready = false, status = 'superseded', superseded_by = $3,
                 refusal_reason = NULL, osm_type = NULL, osm_id = NULL,
                 updated_at = now()
             WHERE tenant_id = $1 AND id = $2 AND content_ready = true
               AND status IN ('pending', 'unresolved')`,
            [tenantId, change.id, change.supersededBy],
          );
        } else {
          update = await client.query(
            `UPDATE creator_place_proposals
             SET status = 'unresolved', refusal_reason = $3,
                 confirmed_query = NULL, confirmation_method = NULL,
                 osm_type = NULL, osm_id = NULL, updated_at = now()
             WHERE tenant_id = $1 AND id = $2 AND content_ready = true
               AND status IN ('pending', 'unresolved')`,
            [tenantId, change.id, change.reason],
          );
        }
        if (update.rowCount) appliedChanges.push(change);
        await client.query("RELEASE SAVEPOINT creator_proposal_change");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT creator_proposal_change");
        await client.query("RELEASE SAVEPOINT creator_proposal_change");
        failures.push({
          proposalId: change.id,
          proposedName: proposedNameById.get(change.id) ?? change.id,
          reason: creatorProposalProcessingReason(error),
        });
      }
    }
    if (options.dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
    const approvedBackfill = await backfillApprovedCreatorProposalMaterializations(
      tenantId,
      { dryRun: options.dryRun },
    );
    failures.push(...approvedBackfill.failures);
    return {
      evaluated: rows.length,
      changed: appliedChanges.length,
      unchanged: rows.length - appliedChanges.length,
      accommodationsExcluded:
        appliedChanges.filter((change) => change.kind === "accommodation").length,
      wrongSettlementMovedToUnresolved:
        appliedChanges.filter((change) => change.kind === "wrong_settlement").length,
      duplicatesMerged: appliedChanges.filter((change) => change.kind === "duplicate").length,
      approvedBackfilled: approvedBackfill.backfilled,
      failures,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}