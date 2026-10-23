import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, smartxstayImportRunsTable } from "@workspace/db";
import { requireOperator } from "../lib/actorGate";
import { startSmartxstayImport } from "../lib/smartxstayImport";

const router = Router();
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
