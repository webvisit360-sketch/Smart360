import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import {
  ApproveCreatorProposalResponse,
  ApproveCreatorProposalsBulkBody,
  ApproveCreatorProposalsBulkResponse,
  ListCreatorProposalsResponse,
  PreviewCreatorOriginBody,
  PreviewCreatorOriginResponse,
} from "@workspace/api-zod";
import { requireAdmin, getAdminUser } from "../lib/adminAuth";
import {
  approveCreatorProposalIndividually,
  approveCreatorProposalsBulk,
  CreatorBulkApprovalError,
  listCreatorProposalQueue,
} from "../lib/creatorProposalLedger";
import {
  expandGoogleMapsShortLink,
  GoogleMapsParseError,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrlOrThrow,
} from "../lib/maps-link";

const router: IRouter = Router();
router.use("/admin", requireAdmin);
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
const serialize = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

async function requireCreatorTenant(tenantId: string): Promise<boolean> {
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  return Boolean(tenant);
}

router.post("/admin/creator/origin-preview", async (req, res): Promise<void> => {
  const input = PreviewCreatorOriginBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vnesite Google Maps povezavo." });
    return;
  }

  try {
    const originalUrl = input.data.mapUrl.trim();
    let isShortLink = false;
    try {
      const original = new URL(originalUrl);
      isShortLink =
        original.hostname === "maps.app.goo.gl" ||
        (original.hostname === "goo.gl" &&
          (original.pathname === "/maps" || original.pathname.startsWith("/maps/")));
    } catch {
      // The strict parser below returns the user-facing invalid URL error.
    }
    const expandedUrl = isShortLink
      ? await expandGoogleMapsShortLink(originalUrl)
      : originalUrl;
    const parsed = parseGoogleMapsLocationUrlOrThrow(expandedUrl);
    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("lat", String(parsed.lat));
    reverseUrl.searchParams.set("lon", String(parsed.lng));
    reverseUrl.searchParams.set("zoom", "18");
    reverseUrl.searchParams.set("addressdetails", "1");
    const response = await fetch(reverseUrl, {
      headers: {
        "User-Agent": "Smart360 Creator origin confirmation (admin contact via replit deployment)",
      },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = (await response.json()) as { display_name?: unknown };
    const nominatimDisplayName =
      typeof data.display_name === "string" ? data.display_name : null;
    if (!nominatimDisplayName) throw new Error("Nominatim ni vrnil bližnje znane točke.");

    res.json(PreviewCreatorOriginResponse.parse({
      ...parsed,
      expandedUrl,
      nominatimDisplayName,
      referenceSource: "nominatim",
    }));
  } catch (error) {
    if (error instanceof GoogleMapsParseError || error instanceof GoogleMapsRedirectError) {
      res.status(422).json({ error: error.message, code: error.kind });
      return;
    }
    req.log.warn({ error }, "Creator origin preview failed");
    res.status(502).json({ error: "Bližnje znane točke pri Nominatimu ni bilo mogoče preveriti.", code: "nominatim-failed" });
  }
});

router.get("/admin/tenants/:id/creator/proposals", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  if (!await requireCreatorTenant(tenantId)) {
    res.status(404).json({ error: "Namestitev ni najdena." });
    return;
  }
  const rows = await listCreatorProposalQueue(tenantId);
  res.json(ListCreatorProposalsResponse.parse(serialize(rows)));
});

router.post(
  "/admin/tenants/:id/creator/proposals/:proposalId/approve",
  async (req, res): Promise<void> => {
    try {
      const tenantId = first(req.params["id"]);
      if (!await requireCreatorTenant(tenantId)) {
        res.status(404).json({ error: "Namestitev ni najdena." });
        return;
      }
      const actor = await getAdminUser();
      if (!actor) {
        res.status(403).json({ error: "Operater ni najden." });
        return;
      }
      const row = await approveCreatorProposalIndividually(
        tenantId,
        first(req.params["proposalId"]),
        actor.id,
      );
      res.json(ApproveCreatorProposalResponse.parse(serialize(row)));
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Predloga ni mogoče potrditi.",
      });
    }
  },
);

router.post(
  "/admin/tenants/:id/creator/proposals/approve-bulk",
  async (req, res): Promise<void> => {
    const input = ApproveCreatorProposalsBulkBody.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Izberite predloge za potrditev." });
      return;
    }
    try {
      const tenantId = first(req.params["id"]);
      if (!await requireCreatorTenant(tenantId)) {
        res.status(404).json({ error: "Namestitev ni najdena." });
        return;
      }
      const actor = await getAdminUser();
      if (!actor) {
        res.status(403).json({ error: "Operater ni najden." });
        return;
      }
      await approveCreatorProposalsBulk(
        tenantId,
        input.data.proposalIds,
        actor.id,
      );
      const rows = await listCreatorProposalQueue(tenantId);
      res.json(ApproveCreatorProposalsBulkResponse.parse(serialize(rows)));
    } catch (error) {
      res.status(error instanceof CreatorBulkApprovalError ? 400 : 500).json({
        error: error instanceof Error ? error.message : "Predlogov ni mogoče potrditi.",
      });
    }
  },
);

export default router;