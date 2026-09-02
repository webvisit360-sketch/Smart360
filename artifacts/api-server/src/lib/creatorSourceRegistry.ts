import {
  changelogTable,
  creatorSourceContentsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourceRunsTable,
  creatorSourcesTable,
  db,
  tenantsTable,
} from "@workspace/db";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, ne, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { currentActor } from "./actorContext";
import {
  canonicalizeCreatorSourceUrl,
  CreatorSourcePolicyError,
  retrieveRobotsEvidence,
} from "./creatorSourceReader";

export class CreatorSourceRegistryError extends Error {
  constructor(
    message: string,
    readonly kind: "not-found" | "invalid" | "approval-gate" | "conflict",
  ) {
    super(message);
    this.name = "CreatorSourceRegistryError";
  }
}

async function tenantMunicipality(tenantId: string): Promise<string> {
  const [tenant] = await db.select({
    municipality: tenantsTable.municipality,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  const municipality = tenant?.municipality
    ? normalizeCreatorMunicipality(tenant.municipality)
    : "";
  if (!municipality) {
    throw new CreatorSourceRegistryError(
      "Tenant does not have a confirmed municipality.",
      "not-found",
    );
  }
  return municipality;
}

export function normalizeCreatorMunicipality(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

const SOURCE_STATUS_LABEL_SL: Record<string, string> = {
  proposed: "predlagan",
  approved: "odobren",
  rejected: "zavrnjen",
  revoked: "preklican",
};

const SOURCE_DECISION_LABEL_SL = {
  approve: "odobren",
  reject: "zavrnjen",
  revoke: "preklican",
} as const;

function transitionNotAllowedMessage(input: {
  label: string;
  status: string;
  decision: "approve" | "reject" | "revoke";
}): string {
  const from = SOURCE_STATUS_LABEL_SL[input.status] ?? input.status;
  const to = SOURCE_DECISION_LABEL_SL[input.decision];
  const reason = input.decision === "approve"
    ? "odobriti je mogoče samo predlagan vir"
    : input.decision === "reject"
      ? "zavrniti je mogoče samo predlagan vir"
      : "odobritev je mogoče preklicati samo odobrenemu viru";
  return `Prehod vira »${input.label}« iz stanja »${from}« v stanje »${to}« ni dovoljen: ${reason}.`;
}

async function lockMunicipality(
  municipality: string,
  executor: { execute: (query: ReturnType<typeof sql>) => unknown } = db,
): Promise<void> {
  const result = await executor.execute(sql`SELECT pg_try_advisory_xact_lock(
    hashtext(${"creator-municipality:" + normalizeCreatorMunicipality(municipality)})
  ) AS acquired`) as { rows?: Array<{ acquired: boolean }> };
  if (result.rows?.[0]?.acquired !== true) {
    throw new CreatorSourceRegistryError(
      "This municipality is currently locked by a source-first run.",
      "conflict",
    );
  }
}

export function creatorSourceListFingerprint(input: {
  tenantId: string;
  municipality: string;
  sources: ReadonlyArray<{
    id: string;
    status: string;
    updatedAt: Date;
  }>;
}): string {
  const municipality = normalizeCreatorMunicipality(input.municipality);
  const rows = input.sources
    .map((source) => [source.id, source.status, source.updatedAt.toISOString()])
    .sort((left, right) => left[0].localeCompare(right[0]));
  return createHash("sha256")
    .update(JSON.stringify([input.tenantId, municipality, rows]))
    .digest("hex");
}

async function assertNoRunningMunicipalityRun(municipality: string): Promise<void> {
  const [running] = await db.select({ id: creatorSourceRunsTable.id })
    .from(creatorSourceRunsTable)
    .innerJoin(tenantsTable, eq(creatorSourceRunsTable.tenantId, tenantsTable.id))
    .where(and(
      eq(tenantsTable.municipality, normalizeCreatorMunicipality(municipality)),
      eq(creatorSourceRunsTable.status, "running"),
    )).limit(1);
  if (running) {
    throw new CreatorSourceRegistryError(
      "Source mutations are blocked while a source-first run is active.",
      "conflict",
    );
  }
}

export async function listCreatorSourcesForTenant(tenantId: string) {
  const municipality = await tenantMunicipality(tenantId);
  return db.select({
    ...getTableColumns(creatorSourcesTable),
    hasCompletedProvenance: sql<boolean>`EXISTS (
      SELECT 1 FROM creator_source_contents content
      JOIN creator_source_run_snapshots snapshot ON snapshot.source_content_id = content.id
      JOIN creator_source_runs run ON run.id = snapshot.run_id
      WHERE content.source_id = creator_sources.id AND run.status = 'completed'
    )`,
  }).from(creatorSourcesTable)
    .where(and(
      eq(creatorSourcesTable.municipality, municipality),
      isNull(creatorSourcesTable.deletedAt),
    ))
    .orderBy(asc(creatorSourcesTable.createdAt), asc(creatorSourcesTable.id));
}

async function sourceWithProvenance(sourceId: string) {
  const [source] = await db.select({
    ...getTableColumns(creatorSourcesTable),
    hasCompletedProvenance: sql<boolean>`EXISTS (
      SELECT 1 FROM creator_source_contents content
      JOIN creator_source_run_snapshots snapshot ON snapshot.source_content_id = content.id
      JOIN creator_source_runs run ON run.id = snapshot.run_id
      WHERE content.source_id = creator_sources.id AND run.status = 'completed'
    )`,
  }).from(creatorSourcesTable).where(eq(creatorSourcesTable.id, sourceId)).limit(1);
  return source;
}

export async function getCreatorSourceList(tenantId: string) {
  const municipality = await tenantMunicipality(tenantId);
  const sources = await listCreatorSourcesForTenant(tenantId);
  const approvedSourceCount = sources.filter((source) => source.status === "approved").length;
  const fingerprint = creatorSourceListFingerprint({ tenantId, municipality, sources });
  const [approval] = await db.select({ id: changelogTable.id }).from(changelogTable)
    .where(and(
      eq(changelogTable.tenantId, tenantId),
      eq(changelogTable.operationKey, `creator-source-list:${tenantId}:${fingerprint}`),
    )).limit(1);
  return {
    sources,
    approval: { approved: Boolean(approval), approvedSourceCount },
  };
}

export async function proposeCreatorSources(input: {
  tenantId: string;
  sources: Array<{ label: string; sourceKind: string; url: string }>;
}) {
  const municipality = await tenantMunicipality(input.tenantId);
  const rows = input.sources.map((source) => {
    const label = source.label.replace(/\s+/g, " ").trim();
    const sourceKind = source.sourceKind.replace(/\s+/g, " ").trim();
    if (!label || !sourceKind) {
      throw new CreatorSourceRegistryError(
        "Source label and kind must not be blank.",
        "invalid",
      );
    }
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeCreatorSourceUrl(source.url.trim());
    } catch (error) {
      if (error instanceof CreatorSourcePolicyError) {
        throw new CreatorSourceRegistryError(error.message, "invalid");
      }
      throw error;
    }
    return {
      municipality,
      label,
      sourceKind,
      url: canonicalUrl,
      canonicalUrl,
    };
  });
  if (new Set(rows.map((row) => row.canonicalUrl)).size !== rows.length) {
    throw new CreatorSourceRegistryError(
      "The proposed list contains the same canonical URL more than once.",
      "invalid",
    );
  }
  if (rows.length) {
    const inserted = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`);
      const [currentTenant] = await tx.select({ municipality: tenantsTable.municipality })
        .from(tenantsTable).where(eq(tenantsTable.id, input.tenantId)).limit(1);
      if (
        !currentTenant?.municipality
        || normalizeCreatorMunicipality(currentTenant.municipality) !== municipality
      ) throw new CreatorSourceRegistryError("Tenant municipality changed; retry the proposal.", "conflict");
      await lockMunicipality(municipality, tx);
      const [running] = await tx.select({ id: creatorSourceRunsTable.id })
        .from(creatorSourceRunsTable)
        .innerJoin(tenantsTable, eq(creatorSourceRunsTable.tenantId, tenantsTable.id))
        .where(and(
          eq(tenantsTable.municipality, municipality),
          eq(creatorSourceRunsTable.status, "running"),
        )).limit(1);
      if (running) throw new CreatorSourceRegistryError(
        "Source mutations are blocked while a source-first run is active.", "conflict",
      );
      return tx.insert(creatorSourcesTable).values(rows).onConflictDoNothing({
      target: [
        creatorSourcesTable.municipality,
        creatorSourcesTable.canonicalUrl,
      ],
      where: isNull(creatorSourcesTable.deletedAt),
      }).returning();
    });
    // Proposal-time network access is intentionally limited to robots.txt.
    // No source content URL is read until the explicit list gate permits a run.
    await Promise.all(inserted.map((source) => retrieveRobotsEvidence(source)));
  }
  return listCreatorSourcesForTenant(input.tenantId);
}

export async function decideCreatorSource(input: {
  tenantId: string;
  sourceId: string;
  decision: "approve" | "reject" | "revoke";
  actorId: string;
}) {
  const municipality = await tenantMunicipality(input.tenantId);
  const transition = {
    approve: { from: ["proposed"], to: "approved" },
    reject: { from: ["proposed"], to: "rejected" },
    revoke: { from: ["approved"], to: "revoked" },
  }[input.decision];
  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`);
    const [currentTenant] = await tx.select({ municipality: tenantsTable.municipality })
      .from(tenantsTable).where(eq(tenantsTable.id, input.tenantId)).limit(1);
    if (
      !currentTenant?.municipality
      || normalizeCreatorMunicipality(currentTenant.municipality) !== municipality
    ) throw new CreatorSourceRegistryError("Občina nastanitve se je med postopkom spremenila; poskusite znova.", "conflict");
    await lockMunicipality(municipality, tx);
    const [running] = await tx.select({ id: creatorSourceRunsTable.id })
      .from(creatorSourceRunsTable)
      .innerJoin(tenantsTable, eq(creatorSourceRunsTable.tenantId, tenantsTable.id))
      .where(and(
        eq(tenantsTable.municipality, municipality),
        eq(creatorSourceRunsTable.status, "running"),
      )).limit(1);
    if (running) throw new CreatorSourceRegistryError(
      "Virov ni mogoče spreminjati, dokler poteka branje virov za to občino.", "conflict",
    );

    const [source] = await tx.select().from(creatorSourcesTable).where(and(
      eq(creatorSourcesTable.id, input.sourceId),
      isNull(creatorSourcesTable.deletedAt),
    )).limit(1);
    if (!source) {
      throw new CreatorSourceRegistryError(
        "Prehoda vira ni mogoče izvesti: vir ne obstaja ali je bil izbrisan.",
        "not-found",
      );
    }
    if (normalizeCreatorMunicipality(source.municipality) !== municipality) {
      throw new CreatorSourceRegistryError(
        `Prehoda vira »${source.label}« ni mogoče izvesti: vir je shranjen za občino »${source.municipality}«, nastanitev pa uporablja občino »${municipality}«.`,
        "conflict",
      );
    }
    // A stale or duplicated revoke request must not turn a successful
    // approved → revoked transition into an operator-facing failure.
    if (input.decision === "revoke" && source.status === "revoked") return [source];
    if (!transition.from.includes(source.status)) {
      throw new CreatorSourceRegistryError(
        transitionNotAllowedMessage({
          label: source.label,
          status: source.status,
          decision: input.decision,
        }),
        "conflict",
      );
    }

    return tx.update(creatorSourcesTable).set(
      input.decision === "approve"
        ? { status: transition.to, approvedBy: input.actorId, approvedAt: now }
        : { status: transition.to, approvedBy: null, approvedAt: null },
    ).where(and(
      eq(creatorSourcesTable.id, input.sourceId),
      eq(creatorSourcesTable.municipality, municipality),
      inArray(creatorSourcesTable.status, transition.from),
    )).returning();
  });
  if (!updated) {
    throw new CreatorSourceRegistryError(
      "Prehoda vira ni bilo mogoče dokončati, ker se je stanje vira med postopkom spremenilo; osvežite seznam in poskusite znova.",
      "conflict",
    );
  }
  const result = await sourceWithProvenance(updated.id);
  if (!result) {
    throw new CreatorSourceRegistryError(
      "Prehoda vira ni bilo mogoče dokončati: posodobljenega vira ni bilo mogoče prebrati.",
      "not-found",
    );
  }
  return result;
}

export async function editCreatorSource(input: {
  tenantId: string;
  sourceId: string;
  label: string;
  sourceKind: string;
  url: string;
}, evidenceOptions: Parameters<typeof retrieveRobotsEvidence>[1] = {}) {
  const municipality = await tenantMunicipality(input.tenantId);
  const label = input.label.replace(/\s+/g, " ").trim();
  const sourceKind = input.sourceKind.replace(/\s+/g, " ").trim();
  if (!label || !sourceKind) throw new CreatorSourceRegistryError("Source label and kind must not be blank.", "invalid");
  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeCreatorSourceUrl(input.url.trim());
  } catch (error) {
    if (error instanceof CreatorSourcePolicyError) throw new CreatorSourceRegistryError(error.message, "invalid");
    throw error;
  }
  const [updated] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`);
    await lockMunicipality(municipality, tx);
    const [running] = await tx.select({ id: creatorSourceRunsTable.id }).from(creatorSourceRunsTable)
      .innerJoin(tenantsTable, eq(creatorSourceRunsTable.tenantId, tenantsTable.id))
      .where(and(eq(tenantsTable.municipality, municipality), eq(creatorSourceRunsTable.status, "running"))).limit(1);
    if (running) throw new CreatorSourceRegistryError("Source mutations are blocked while a source-first run is active.", "conflict");
    const [duplicate] = await tx.select({ id: creatorSourcesTable.id }).from(creatorSourcesTable).where(and(
      eq(creatorSourcesTable.municipality, municipality),
      eq(creatorSourcesTable.canonicalUrl, canonicalUrl),
      isNull(creatorSourcesTable.deletedAt),
      ne(creatorSourcesTable.id, input.sourceId),
    )).limit(1);
    if (duplicate) throw new CreatorSourceRegistryError("A source with this canonical URL already exists.", "conflict");
    return tx.update(creatorSourcesTable).set({
      label,
      sourceKind,
      url: canonicalUrl,
      canonicalUrl,
      status: "proposed",
      approvedBy: null,
      approvedAt: null,
      archivedAt: null,
    }).where(and(
      eq(creatorSourcesTable.id, input.sourceId),
      eq(creatorSourcesTable.municipality, municipality),
      isNull(creatorSourcesTable.deletedAt),
      inArray(creatorSourcesTable.status, ["proposed", "revoked"]),
      sql`NOT EXISTS (
        SELECT 1 FROM creator_source_contents content
        JOIN creator_source_run_snapshots snapshot ON snapshot.source_content_id = content.id
        JOIN creator_source_runs run ON run.id = snapshot.run_id
        WHERE content.source_id = creator_sources.id AND run.status = 'completed'
      )`,
    )).returning();
  });
  if (!updated) throw new CreatorSourceRegistryError(
    "Only proposed sources or revoked sources without completed-run provenance can be edited.",
    "conflict",
  );
  await retrieveRobotsEvidence(updated, { ...evidenceOptions, useCache: false });
  return sourceWithProvenance(updated.id);
}

export async function deleteCreatorSource(input: { tenantId: string; sourceId: string }) {
  const municipality = await tenantMunicipality(input.tenantId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`);
    await lockMunicipality(municipality, tx);
    const [source] = await tx.select().from(creatorSourcesTable).where(and(
      eq(creatorSourcesTable.id, input.sourceId),
      eq(creatorSourcesTable.municipality, municipality),
      isNull(creatorSourcesTable.deletedAt),
      inArray(creatorSourcesTable.status, ["proposed", "revoked"]),
    )).limit(1);
    if (!source) throw new CreatorSourceRegistryError("Only proposed or revoked sources can be deleted.", "conflict");
    const [provenance] = await tx.select({ id: creatorSourceRunSnapshotsTable.runId })
      .from(creatorSourceRunSnapshotsTable)
      .innerJoin(creatorSourceContentsTable, eq(creatorSourceRunSnapshotsTable.sourceContentId, creatorSourceContentsTable.id))
      .innerJoin(creatorSourceRunsTable, eq(creatorSourceRunSnapshotsTable.runId, creatorSourceRunsTable.id))
      .where(and(eq(creatorSourceContentsTable.sourceId, source.id), eq(creatorSourceRunsTable.status, "completed"))).limit(1);
    if (provenance) throw new CreatorSourceRegistryError("Completed-run provenance cannot be deleted; revoke and archive this source.", "conflict");
    // Keep all robots/page evidence immutable. A deleted ledger entry is a
    // tombstone hidden from every source list and run.
    await tx.update(creatorSourcesTable).set({ deletedAt: new Date() }).where(eq(creatorSourcesTable.id, source.id));
  });
  return { deleted: true as const };
}

export async function archiveCreatorSource(input: { tenantId: string; sourceId: string }) {
  const municipality = await tenantMunicipality(input.tenantId);
  const [updated] = await db.update(creatorSourcesTable).set({ archivedAt: new Date() }).where(and(
    eq(creatorSourcesTable.id, input.sourceId),
    eq(creatorSourcesTable.municipality, municipality),
    eq(creatorSourcesTable.status, "revoked"),
    isNull(creatorSourcesTable.archivedAt),
    isNull(creatorSourcesTable.deletedAt),
    sql`EXISTS (
      SELECT 1 FROM creator_source_contents content
      JOIN creator_source_run_snapshots snapshot ON snapshot.source_content_id = content.id
      JOIN creator_source_runs run ON run.id = snapshot.run_id
      WHERE content.source_id = creator_sources.id AND run.status = 'completed'
    )`,
  )).returning({ id: creatorSourcesTable.id });
  if (!updated) throw new CreatorSourceRegistryError("Only revoked completed-run provenance sources can be archived.", "conflict");
  return sourceWithProvenance(updated.id);
}

export function assertRunnableCreatorSourceStatuses(
  statuses: readonly string[],
): number {
  if (statuses.includes("proposed")) {
    throw new CreatorSourceRegistryError(
      "Every current municipality source must be approved, rejected, or revoked.",
      "approval-gate",
    );
  }
  const approved = statuses.filter((status) => status === "approved").length;
  if (approved === 0) {
    throw new CreatorSourceRegistryError(
      "At least one municipality source must be approved.",
      "approval-gate",
    );
  }
  if (approved > 15) {
    throw new CreatorSourceRegistryError(
      "A runnable municipality list may contain at most 15 approved sources.",
      "approval-gate",
    );
  }
  return approved;
}

export async function approveCreatorSourceList(tenantId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
    const [tenant] = await tx.select({ municipality: tenantsTable.municipality })
      .from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const municipality = tenant?.municipality
      ? normalizeCreatorMunicipality(tenant.municipality)
      : "";
    if (!municipality) throw new CreatorSourceRegistryError(
      "Tenant does not have a confirmed municipality.", "not-found",
    );
    await lockMunicipality(municipality, tx);
    const [running] = await tx.select({ id: creatorSourceRunsTable.id })
      .from(creatorSourceRunsTable)
      .innerJoin(tenantsTable, eq(creatorSourceRunsTable.tenantId, tenantsTable.id))
      .where(and(
        eq(tenantsTable.municipality, municipality),
        eq(creatorSourceRunsTable.status, "running"),
      )).limit(1);
    if (running) throw new CreatorSourceRegistryError(
      "Source mutations are blocked while a source-first run is active.", "conflict",
    );
    const sources = await tx.select().from(creatorSourcesTable)
      .where(eq(creatorSourcesTable.municipality, municipality))
      .orderBy(asc(creatorSourcesTable.createdAt), asc(creatorSourcesTable.id));
    const approvedSourceCount = assertRunnableCreatorSourceStatuses(sources.map((source) => source.status));
    const fingerprint = creatorSourceListFingerprint({ tenantId, municipality, sources });
    const actor = currentActor();
    await tx.insert(changelogTable).values({
      tenantId,
      action: "approve-list",
      entity: "creator-source-list",
      summary: "Seznam občinskih virov je bil izrecno potrjen.",
      operationKey: `creator-source-list:${tenantId}:${fingerprint}`,
      actorType: actor?.kind === "host" ? "host" : actor?.kind === "owner" ? "owner" : "system",
      actorLabel: actor?.kind === "host" ? "Stranka" : "Smart360",
      requestIp: actor?.requestIp ?? null,
    }).onConflictDoNothing({ target: changelogTable.operationKey });
    return { approved: true as const, approvedSourceCount };
  });
}

export async function requireApprovedCreatorSourceList(tenantId: string) {
  const sources = await listCreatorSourcesForTenant(tenantId);
  assertRunnableCreatorSourceStatuses(sources.map((source) => source.status));
  const municipality = await tenantMunicipality(tenantId);
  const fingerprint = creatorSourceListFingerprint({ tenantId, municipality, sources });
  const [approval] = await db.select({ id: changelogTable.id })
    .from(changelogTable)
    .where(and(
      eq(changelogTable.tenantId, tenantId),
      eq(changelogTable.operationKey, `creator-source-list:${tenantId}:${fingerprint}`),
    ))
    .orderBy(desc(changelogTable.createdAt))
    .limit(1);
  if (!approval) {
    throw new CreatorSourceRegistryError(
      "The current municipality source list requires explicit approval.",
      "approval-gate",
    );
  }
  return sources.filter((source) => source.status === "approved");
}