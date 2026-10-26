import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, smartxstayImportRunsTable } from "@workspace/db";
import { requireOperator } from "../lib/actorGate";
import { startSmartxstayImport, stepSmartxstayImport } from "../lib/smartxstayImport";
import { cleanupSmartxstayDrafts } from "../lib/smartxstayCleanup";
import { ApplySmartxstayCleanupBody, ApplySmartxstayCleanupResponse, PreviewSmartxstayCleanupResponse } from "@workspace/api-zod";

const router = Router();
router.get("/admin/tenants/:id/smartxstay-cleanup", requireOperator, async (req, res) => {
  try {
    res.json(PreviewSmartxstayCleanupResponse.parse(await cleanupSmartxstayDrafts(String(req.params.id))));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Pregled ni uspel." });
  }
});
router.post("/admin/tenants/:id/smartxstay-cleanup", requireOperator, async (req, res) => {
  const parsed = ApplySmartxstayCleanupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Neveljavna potrditev. Ponovno preglejte razlike." }); return; }
  try {
    res.json(ApplySmartxstayCleanupResponse.parse(await cleanupSmartxstayDrafts(String(req.params.id), parsed.data.approvals, parsed.data.action === "restoreAddresses")));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Čiščenje ni uspelo. Ponovno preglejte razlike." });
  }
});
for (const action of ["step", "cancel"]) {
  router.post(`/admin/tenants/:id/smartxstay-imports/:runId/${action}`, requireOperator, async (req, res) => {
    try {
      res.json(await stepSmartxstayImport(String(req.params.runId), String(req.params.id), action === "cancel"));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Korak uvoza ni uspel. Poskusite znova." });
    }
  });
}
router.post("/admin/tenants/:id/smartxstay-imports", requireOperator, async (req, res) => {
  if (typeof req.body?.url !== "string" || req.body.url.length > 2048) {
    res.status(400).json({ error: "Vnesite veljaven URL vodnika." }); return;
  }
  try {
    const id = await startSmartxstayImport(String(req.params.id), req.body.url);
    res.status(202).json({ id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Uvoz ni uspel." });
  }
});
router.get("/admin/tenants/:id/smartxstay-imports", requireOperator, async (req, res) => {
  const rows = await db.select({
    id: smartxstayImportRunsTable.id, sourceUrl: smartxstayImportRunsTable.sourceUrl,
    status: smartxstayImportRunsTable.status, report: smartxstayImportRunsTable.report,
    createdAt: smartxstayImportRunsTable.createdAt,
  }).from(smartxstayImportRunsTable)
    .where(eq(smartxstayImportRunsTable.tenantId, String(req.params.id)))
    .orderBy(desc(smartxstayImportRunsTable.createdAt)).limit(20);
  res.json(rows);
});
export default router;
