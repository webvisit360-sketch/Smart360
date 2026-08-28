import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { SendPublicEnquiryBody } from "@workspace/api-zod";
import { db, enquiriesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ProcessLocalRateLimiter } from "../lib/orderHelpers";
import { sendEnquiry } from "../lib/enquiryEmail";

const router: IRouter = Router();
const ipLimiter = new ProcessLocalRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });
const emailLimiter = new ProcessLocalRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });
const limiterCleanup = setInterval(() => {
  ipLimiter.cleanup();
  emailLimiter.cleanup();
}, 60 * 60 * 1000);
limiterCleanup.unref();

function rateKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function singleLine(value: string): string {
  return value.trim().replace(/[\r\n]+/g, " ");
}

router.get("/admin/enquiries", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(enquiriesTable)
    .orderBy(desc(enquiriesTable.submittedAt));
  res.json(rows.map((row) => ({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    deliveryAttemptedAt: row.deliveryAttemptedAt?.toISOString() ?? null,
    providerEventAt: row.providerEventAt?.toISOString() ?? null,
  })));
});

router.post("/public/enquiries", async (req: Request, res: Response): Promise<void> => {
  const parsed = SendPublicEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Preverite vnesene podatke." });
    return;
  }
  const normalized = {
    ...parsed.data,
    name: singleLine(parsed.data.name),
    email: parsed.data.email.trim().toLowerCase(),
    propertyName: singleLine(parsed.data.propertyName),
    address: singleLine(parsed.data.address),
    message: parsed.data.message?.trim() || undefined,
  };
  if (
    normalized.name.length < 2 ||
    normalized.propertyName.length < 2 ||
    normalized.address.length < 3 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
  ) {
    res.status(400).json({ error: "Preverite vnesene podatke." });
    return;
  }

  // A filled hidden field is treated as a bot success so it cannot tune itself.
  if (normalized.website) {
    res.status(200).json({ sent: true });
    return;
  }

  const ipKey = rateKey(req.ip || "unknown");
  if (!ipLimiter.allow(ipKey) || !emailLimiter.allow(rateKey(normalized.email))) {
    res.status(429).json({ error: "Preveč poskusov. Poskusite znova pozneje." });
    return;
  }

  const { website: _website, ...enquiry } = normalized;
  const deleteAfter = new Date();
  deleteAfter.setUTCMonth(deleteAfter.getUTCMonth() + 24);
  let captured: { id: string };
  try {
    [captured] = await db
      .insert(enquiriesTable)
      .values({ ...enquiry, deleteAfter })
      .returning({ id: enquiriesTable.id });
    if (!captured) throw new Error("Insert returned no row");
  } catch (error) {
    req.log.error({ errName: error instanceof Error ? error.name : "Error" }, "Enquiry capture failed");
    res.status(503).json({ error: "Oddaja trenutno ni mogoča. Poskusite znova." });
    return;
  }

  const delivery = await sendEnquiry(enquiry);
  try {
    await db
      .update(enquiriesTable)
      .set({
        deliveryStatus: delivery.status,
        providerMessageId: delivery.providerMessageId,
        deliveryAttemptedAt: new Date(),
      })
      .where(eq(enquiriesTable.id, captured.id));
  } catch (error) {
    req.log.error(
      { enquiryId: captured.id, errName: error instanceof Error ? error.name : "Error" },
      "Enquiry delivery outcome update failed",
    );
  }
  res.status(200).json({ sent: true });
});

export default router;