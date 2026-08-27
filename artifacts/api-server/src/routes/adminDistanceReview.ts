import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  categoriesTable, db, itemDistanceProposalsTable, itemsTable, sectionsTable, tenantsTable,
} from "@workspace/db";
import {
  ApproveDistanceReviewBulkBody, GetDistanceReviewResponse, RunDistanceReviewBody,
  RunDistanceReviewResponse, SetDistanceReviewRowLinkBody, SetDistanceReviewRowValueBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logChange } from "../lib/changelog";
import { approveDistanceProposal, revertDistanceProposal, runDistanceComputation } from "../lib/distanceEngine";
import { invalidateTenantCache } from "./publicTenants";

const router: IRouter = Router();
router.use("/admin", requireAdmin);
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const serialize = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export async function review(tenantId: string) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const data = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable, category: categoriesTable })
    .from(itemsTable)
    .leftJoin(itemDistanceProposalsTable, eq(itemDistanceProposalsTable.itemId, itemsTable.id))
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(eq(sectionsTable.tenantId, tenantId), eq(categoriesTable.layout, "poi"), isNull(itemsTable.deletedAt)));
  const counts = { link: 0, coordinates: 0, geocoded: 0, failed: 0, manual: 0, pending: 0, approved: 0, skipped: 0 };
  const rows = data.map(({ proposal, item, category }) => {
    // An item value that matches its approved proposal was written BY the
    // review — show it as "approved", not "manual". Any other stored value
    // is a manual host decision (typed in Uredi or in the item editor).
    const approvedByReview = item.distanceMeters !== null &&
      proposal?.status === "approved" && proposal.distanceMeters === item.distanceMeters;
    const manual = item.distanceMeters !== null && !approvedByReview;
    const status = approvedByReview ? "approved" : manual ? "manual" : proposal?.status ?? "new";
    if (status in counts) counts[status as keyof typeof counts]++;
    if (proposal?.source) counts[proposal.source as "link" | "coordinates" | "geocoded"]++;
    return {
      id: proposal?.id ?? null, itemId: item.id, itemTitle: item.title, categoryLabel: category.label,
      status, source: proposal?.source ?? null, confidence: proposal?.confidence ?? null,
      latitude: proposal?.latitude ?? null, longitude: proposal?.longitude ?? null, distanceMeters: item.distanceMeters ?? proposal?.distanceMeters ?? null,
      durationMinutes: proposal?.durationMinutes ?? null, resolvedAddress: proposal?.resolvedAddress ?? null,
      error: proposal?.error ?? null,
      mapsCheckUrl: proposal?.latitude !== null && proposal?.latitude !== undefined && proposal.longitude !== null
        ? `https://www.google.com/maps/search/?api=1&query=${proposal.latitude},${proposal.longitude}` : null,
      manual,
    };
  }).sort((a, b) => {
    const rank = (row: typeof a) => row.status === "failed" ? 0 : row.status === "pending" && row.confidence === "low" ? 1 : row.status === "pending" ? 2 : row.status === "new" ? 3 : row.status === "skipped" ? 4 : row.status === "approved" ? 5 : 6;
    return rank(a) - rank(b) || ((b.distanceMeters ?? Infinity) - (a.distanceMeters ?? Infinity));
  });
  return { tenantReady: Boolean(tenant?.latitude !== null && tenant?.longitude !== null), originLatitude: tenant?.latitude ?? null, originLongitude: tenant?.longitude ?? null, rows, counts };
}

function auditLabel(value: string | null | undefined): string {
  return (value ?? "Vnos").replace(/\s+/g, " ").trim().slice(0, 120) || "Vnos";
}

async function changed(tenantId: string, detail: string, summary: string) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) return;
  invalidateTenantCache();
  await logChange({ tenantId, tenantName: tenant.name, action: "update", entity: "distance-review", detail, summary });
}

router.get("/admin/tenants/:id/distance-review", async (req, res) => {
  res.json(GetDistanceReviewResponse.parse(serialize(await review(first(req.params["id"])))));
});
router.post("/admin/tenants/:id/distance-review", async (req, res) => {
  const parsed = RunDistanceReviewBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  try {
    const tenantId = first(req.params["id"]);
    const result = await runDistanceComputation(tenantId, parsed.data);
    await changed(tenantId, `Izračun predlogov razdalj: ${result.processed} obdelanih.`, "Izračunani predlogi razdalj");
    res.json(RunDistanceReviewResponse.parse(serialize(result)));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Izračun ni uspel." }); }
});
router.post("/admin/tenants/:id/distance-review/rows/:rowId/approve", async (req, res) => {
  const tenantId = first(req.params["id"]); const rowId = first(req.params["rowId"]);
  const [row] = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable }).from(itemDistanceProposalsTable).innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId)).where(and(eq(itemDistanceProposalsTable.id, rowId), eq(itemDistanceProposalsTable.tenantId, tenantId)));
  if (!row) return void res.status(404).json({ error: "Predlog ni najden." });
  try {
    await approveDistanceProposal(rowId);
  } catch (error) {
    return void res.status(row.item.distanceMeters !== null ? 409 : 400).json({ error: error instanceof Error ? error.message : "Predloga ni mogoče potrditi." });
  }
  await changed(tenantId, `Potrjena predlagana razdalja · ${row.item.title ?? "Item"}.`, `Potrjena razdalja · ${auditLabel(row.item.title)}`);
  res.json((await review(tenantId)).rows.find((v) => v.id === rowId));
});
router.post("/admin/tenants/:id/distance-review/rows/:rowId/skip", async (req, res) => {
  const tenantId = first(req.params["id"]); const rowId = first(req.params["rowId"]);
  const [row] = await db.select({ item: itemsTable }).from(itemDistanceProposalsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId))
    .where(and(eq(itemDistanceProposalsTable.id, rowId), eq(itemDistanceProposalsTable.tenantId, tenantId)));
  if (!row) return void res.status(404).json({ error: "Predlog ni najden." });
  await db.update(itemDistanceProposalsTable).set({ status: "skipped" }).where(eq(itemDistanceProposalsTable.id, rowId));
  await changed(tenantId, `Preskočen predlog razdalje · ${row.item.title ?? "Item"}.`, `Preskočen predlog razdalje · ${auditLabel(row.item.title)}`);
  res.json((await review(tenantId)).rows.find((v) => v.id === rowId));
});
router.post("/admin/tenants/:id/distance-review/rows/:rowId/value", async (req, res) => {
  const parsed = SetDistanceReviewRowValueBody.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const tenantId = first(req.params["id"]); const rowId = first(req.params["rowId"]);
  const [row] = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable }).from(itemDistanceProposalsTable).innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId)).where(and(eq(itemDistanceProposalsTable.id, rowId), eq(itemDistanceProposalsTable.tenantId, tenantId)));
  if (!row) return void res.status(404).json({ error: "Predlog ni najden." });
  await db.transaction(async (tx) => { await tx.update(itemsTable).set({ distanceMeters: parsed.data.distanceMeters }).where(eq(itemsTable.id, row.proposal.itemId)); await tx.update(itemDistanceProposalsTable).set({ status: "approved" }).where(eq(itemDistanceProposalsTable.id, rowId)); });
  await changed(tenantId, `Ročno popravljena razdalja · ${row.item.title ?? "Item"}.`, `Ročno spremenjena razdalja · ${auditLabel(row.item.title)}`); res.json((await review(tenantId)).rows.find((v) => v.id === rowId));
});
router.post("/admin/tenants/:id/distance-review/rows/:rowId/link", async (req, res) => {
  const parsed = SetDistanceReviewRowLinkBody.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const tenantId = first(req.params["id"]); const rowId = first(req.params["rowId"]);
  const [row] = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable }).from(itemDistanceProposalsTable).innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId)).where(and(eq(itemDistanceProposalsTable.id, rowId), eq(itemDistanceProposalsTable.tenantId, tenantId)));
  if (!row) return void res.status(404).json({ error: "Predlog ni najden." });
  await db.update(itemsTable).set({ mapQuery: parsed.data.mapUrl }).where(eq(itemsTable.id, row.proposal.itemId));
  await runDistanceComputation(tenantId, { limit: 100 });
  await changed(tenantId, `Posodobljena povezava in ponovno izračunana razdalja · ${row.item.title ?? "Item"}.`, `Ponovno izračunana razdalja · ${auditLabel(row.item.title)}`);
  res.json((await review(tenantId)).rows.find((v) => v.id === rowId));
});
router.post("/admin/tenants/:id/distance-review/rows/:rowId/revert", async (req, res) => {
  const tenantId = first(req.params["id"]); const rowId = first(req.params["rowId"]);
  const [row] = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable }).from(itemDistanceProposalsTable).innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId)).where(and(eq(itemDistanceProposalsTable.id, rowId), eq(itemDistanceProposalsTable.tenantId, tenantId)));
  if (!row) return void res.status(404).json({ error: "Predlog ni najden." });
  await revertDistanceProposal(rowId);
  await changed(tenantId, `Razveljavljena odločitev pregleda razdalje · ${row.item.title ?? "Item"}.`, `Razveljavljena razdalja · ${auditLabel(row.item.title)}`);
  res.json((await review(tenantId)).rows.find((v) => v.id === rowId));
});
router.post("/admin/tenants/:id/distance-review/approve-bulk", async (req, res) => {
  const parsed = ApproveDistanceReviewBulkBody.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const tenantId = first(req.params["id"]);
  const rows = await db.select({ proposal: itemDistanceProposalsTable, item: itemsTable }).from(itemDistanceProposalsTable).innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId)).where(and(eq(itemDistanceProposalsTable.tenantId, tenantId), eq(itemDistanceProposalsTable.status, "pending"), eq(itemDistanceProposalsTable.confidence, "high"), isNull(itemsTable.distanceMeters)));
  for (const { proposal } of rows) {
    if (proposal.distanceMeters === null) continue;
    try {
      await approveDistanceProposal(proposal.id);
    } catch {
      // A concurrent manual value wins; continue approving independent rows.
    }
  }
  await changed(tenantId, `Potrjene zanesljive predlagane razdalje: ${rows.length}.`, "Potrjene zanesljive razdalje"); res.json(GetDistanceReviewResponse.parse(serialize(await review(tenantId))));
});
export default router;