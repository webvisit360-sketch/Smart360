import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  tenantRenewalsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
  changelogTable,
  validateLivingGuideNav,
} from "@workspace/db";
import {
  GetAdminOverviewResponse,
  ListTenantsResponse,
  ListTenantOverviewResponse,
  ListTenantChangelogResponse,
  CreateTenantBody,
  CreateTenantResponse,
  GetTenantResponse,
  UpdateTenantBody,
  UpdateTenantResponse,
  DuplicateTenantBody,
  DuplicateTenantResponse,
  RenewTenantResponse,
  ListTenantRenewalsResponse,
} from "@workspace/api-zod";
import { requireAdmin, getAdminUser } from "../lib/adminAuth";
import { logChange, safeSummary } from "../lib/changelog";
import { buildTenantOverviews } from "../lib/tenantOverview";
import { seedTenantContent, TENANT_TYPES, type TenantType } from "../lib/tenantSeeds";
import { sendPublishedEmail } from "../lib/lifecycleEmails";
import { buildTenantContent } from "../lib/contentTree";
import { checkSlugAvailability } from "../lib/slug";
import { checkTenantMedia, dropBrokenReferences } from "../lib/mediaCheck";
import { invalidateTenantCache } from "./publicTenants";
import { tenantAliasesTable } from "@workspace/db";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { guestUrl, guestQrSvg } from "../lib/guestUrl";
import { WORDMARK_SVG } from "../lib/wordmark";
import {
  extractVirtualTourUrl,
  VirtualTourUrlError,
} from "../lib/virtualTour";
import {
  normalizeTenantMapUrl,
  TenantLocationError,
  validateTenantCoordinatePair,
} from "../lib/tenant-location";
import { extractCoordsFromGoogleMapsUrl } from "../lib/maps-link";

/** Public guest address for a slug (dev domain now, smart360.info later). */
function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function tenantCopyIsEnabled(): boolean {
  return false;
}

/** renewsAt default on create: exactly one year after createdAt. */
function plusOneYear(d: Date): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + 1);
  return out;
}

/** A tenant name is useful context in the audit trail, but never without a bound. */
function auditTenantName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim().slice(0, 80);
  return normalized || "neimenovana nastanitev";
}

const tenantSettingCategories: ReadonlyArray<readonly [readonly string[], string]> = [
  [["slug", "name", "subtitle", "rating", "reviewsCount"], "osnovni podatki"],
  [["customDomain"], "povezava z domeno"],
  [["logoUrl", "logoSquareUrl", "heroUrl", "livingGuideHeroUrl", "tourUrl"], "predstavitev in podoba"],
  [["phone", "whatsapp", "viber", "instagram", "email"], "kontaktni podatki"],
  [["orderNotifyEmail", "messageNotifyEmail"], "obvestila"],
  [["orderPassword"], "dostop do naročil"],
  [["address", "mapQuery", "mapUrl", "latitude", "longitude", "coordinateOverride"], "lokacija"],
  [["wifiSsid", "wifiPass", "wifiEnc"], "Wi-Fi dostop"],
  [[
    "bgColor", "theme", "coverTitle", "coverSubtitle", "coverTitleSize",
    "coverTitleOpacity", "coverTextColor", "coverSubSize", "coverSubOpacity",
    "coverMetaSize", "coverMetaOpacity", "coverVeil", "tileVeil", "textScale",
    "textFont", "textColor", "coverAlign", "coverShowRating", "logoX", "logoY",
    "logoW", "logoOpacity", "navColorCover", "navColor", "navColorOn",
  ], "videz"],
  [["guestUiMode", "languages", "livingGuideNav"], "uporabniški vmesnik za goste"],
  [["renewsAt"], "obdobje veljavnosti"],
  [["isTemplate", "mediaQuotaBytes"], "skrbniške nastavitve"],
];

function changedTenantSettingCategories(data: Record<string, unknown>): string[] {
  return tenantSettingCategories
    .filter(([keys]) => keys.some((key) => data[key] !== undefined))
    .map(([, category]) => category);
}

function tenantSettingsSummary(name: string, data: Record<string, unknown>): string {
  const categories = changedTenantSettingCategories(data);
  const label = auditTenantName(name);
  return categories.length
    ? `Posodobljene so nastavitve nastanitve »${label}«: ${categories.join(", ")}.`
    : `Posodobitev nastanitve »${label}« ni spremenila nastavitev.`;
}

function tenantSettingsSuffix(data: Record<string, unknown>): string {
  const categories = changedTenantSettingCategories(data);
  return categories.length
    ? ` Hkrati so posodobljene nastavitve: ${categories.join(", ")}.`
    : "";
}

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [tenantCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${tenantsTable.isPublished})::int`,
    })
    .from(tenantsTable);
  const [itemCounts] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(itemsTable);
  const recentChanges = await db
    .select()
    .from(changelogTable)
    .orderBy(desc(changelogTable.createdAt))
    .limit(20);
  // "Obnove v naslednjih 60 dneh" — includes ALREADY OVERDUE tenants (they
  // sort first because their date is smallest). Never hides or disables
  // anyone: payment is between the operator and the client.
  const horizon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const renewalsDue = await db
    .select({
      tenantId: tenantsTable.id,
      name: tenantsTable.name,
      slug: tenantsTable.slug,
      renewsAt: tenantsTable.renewsAt,
    })
    .from(tenantsTable)
    .where(sql`${tenantsTable.renewsAt} is not null and ${tenantsTable.renewsAt} <= ${horizon}`)
    .orderBy(asc(tenantsTable.renewsAt));
  res.json(
    GetAdminOverviewResponse.parse(serialize({
      tenantsCount: tenantCounts?.total ?? 0,
      publishedCount: tenantCounts?.published ?? 0,
      itemsCount: itemCounts?.total ?? 0,
      recentChanges: recentChanges.map((change) => ({
        ...change,
        summary: change.summary || safeSummary(change.action, change.entity),
      })),
      renewalsDue,
    })),
  );
});

router.get("/admin/tenants", async (_req, res): Promise<void> => {
  const tenants = await db
    .select()
    .from(tenantsTable)
    .orderBy(asc(tenantsTable.name));
  res.json(ListTenantsResponse.parse(serialize(tenants)));
});

// Owner's cockpit landing data (CP2b): readiness + pending work per tenant.
// NOTE: must stay declared BEFORE any /admin/tenants/:id matching.
router.get("/admin/tenants/overview", async (_req, res): Promise<void> => {
  const rows = await buildTenantOverviews();
  res.json(ListTenantOverviewResponse.parse(serialize(rows)));
});

router.post("/admin/tenants", async (req, res): Promise<void> => {
  const parsed = CreateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { slug, name, subtitle, fromTemplate } = parsed.data;
  const typeRaw = (parsed.data as Record<string, unknown>)["type"];
  const tenantType: TenantType | null =
    typeof typeRaw === "string" && (TENANT_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as TenantType)
      : null;
  if (typeRaw !== undefined && tenantType === null) {
    res.status(400).json({ error: `type must be one of: ${TENANT_TYPES.join(", ")}` });
    return;
  }
  const verdict = await checkSlugAvailability(slug);
  if (!verdict.available) {
    res.status(409).json({ error: `slug ${verdict.reason}` });
    return;
  }

  if (fromTemplate) {
    const [template] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.isTemplate, true));
    if (template) {
      const created = await copyTenant(template.id, {
        slug,
        name,
        copyContent: false,
      });
      invalidateTenantCache(); // a public 404 may have been negatively cached for this slug
      // Every new tenant starts with a renewal date one year out.
      const renewsAt = plusOneYear(new Date());
      await db
        .update(tenantsTable)
        .set({ renewsAt, ...(subtitle !== undefined ? { subtitle } : {}) })
        .where(eq(tenantsTable.id, created.id));
      created.renewsAt = renewsAt;
      if (subtitle !== undefined) created.subtitle = subtitle;
      await logChange({
        tenantId: created.id,
        tenantName: name,
        action: "create",
        entity: "tenant",
        summary: `Ustvarjena je nastanitev »${auditTenantName(name)}« iz predloge.`,
      });
      res.status(201).json(CreateTenantResponse.parse(serialize(created)));
      return;
    }
  }

  // Creation and type seeding are one transaction: a seed failure must not
  // leave a structureless tenant squatting on the slug.
  const [tenant] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(tenantsTable)
      .values({
        slug,
        name,
        subtitle: subtitle ?? null,
        tenantType,
        guestUiMode: "living-guide",
        renewsAt: plusOneYear(new Date()),
      })
      .returning();
    // The chosen type seeds the default sections, categories and groups
    // (CP2b). The bottom bar derives from sections / the Living Guide default.
    if (tenantType) await seedTenantContent(rows[0]!.id, tenantType, tx);
    return rows;
  });
  invalidateTenantCache();
  await logChange({
    tenantId: tenant!.id,
    tenantName: name,
    action: "create",
    entity: "tenant",
    summary: `Ustvarjena je nova nastanitev »${auditTenantName(name)}«.`,
  });
  res.status(201).json(CreateTenantResponse.parse(serialize(tenant)));
});

// Per-tenant changelog for the cockpit: every change inside a tenant with
// central attribution (owner acting on the host's behalf vs the host).
router.get("/admin/tenants/:id/changelog", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const rows = await db
    .select({
      id: changelogTable.id,
      tenantId: changelogTable.tenantId,
      action: changelogTable.action,
      entity: changelogTable.entity,
      summary: changelogTable.summary,
      // Derive from durable actor type as well as the new display column so
      // historic host rows (written before actor_label existed) are labelled
      // correctly without exposing the underlying role.
      actorLabel: sql<string>`case when ${changelogTable.actorType} = 'host' then 'Stranka' else 'Smart360' end`,
      // Host IPs are useful to the tenant as an audit signal. Operator and
      // background IPs are never disclosed through this endpoint.
      requestIp: sql<string | null>`case when ${changelogTable.actorType} = 'host' then ${changelogTable.requestIp} else null end`,
      createdAt: changelogTable.createdAt,
    })
    .from(changelogTable)
    .where(eq(changelogTable.tenantId, id))
    .orderBy(desc(changelogTable.createdAt));
  // This explicit projection is the API privacy boundary: actor identity and
  // legacy detail never leave it, and request IP is host-action-only.
  res.json(ListTenantChangelogResponse.parse(serialize(rows)));
});

/** Explicit owner cockpit event; GET history remains read-only. */
router.post("/admin/tenants/:id/operator-entry", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const key = req.get("Idempotency-Key")?.trim();
  if (!key || key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    res.status(400).json({ error: "Manjka veljaven Idempotency-Key." });
    return;
  }
  const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logChange({
    tenantId: id,
    action: "cockpit-entry",
    entity: "tenant",
    summary: "Smart360 je odprl pregled nastanitve.",
    operationKey: `operator-entry:${id}:${key}`,
  });
  res.sendStatus(204);
});

router.get("/admin/slug-check", async (req, res): Promise<void> => {
  const slug = String(req.query["slug"] ?? "").trim().toLowerCase();
  const tenantId = req.query["tenantId"] ? String(req.query["tenantId"]) : undefined;
  const verdict = await checkSlugAvailability(slug, tenantId);
  res.json({ slug, available: verdict.available, reason: verdict.reason });
});

router.get("/admin/tenants/:id/qr.png", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const png = await QRCode.toBuffer(guestUrl(tenant.slug), {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart360-${tenant.slug}-qr.png"`,
  );
  res.send(png);
});

// A6 label PDF — same card as the guest "Natisni nalepko" output (paket 14):
// wordmark 38 mm, QR 62 mm, name, bilingual caption, address in blue.
router.get("/admin/tenants/:id/label.pdf", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ slug: tenantsTable.slug, name: tenantsTable.name })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const MM = 72 / 25.4;
  const pageW = 105 * MM;
  const url = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(url);

  const doc = new PDFDocument({ size: [pageW, 148 * MM], margin: 8 * MM });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart360-${tenant.slug}-nalepka-a6.pdf"`,
  );
  doc.pipe(res);

  // Wordmark: 38 mm wide, aspect 4712:858.
  const wmW = 38 * MM;
  const wmH = (wmW * 858) / 4712;
  let y = 14 * MM;
  SVGtoPDF(doc, WORDMARK_SVG.replace("<svg ", '<svg fill="#3B78DC" '), (pageW - wmW) / 2, y, {
    width: wmW,
    height: wmH,
    preserveAspectRatio: "xMidYMid meet",
  });
  y += wmH + 6 * MM;

  const qrW = 62 * MM;
  SVGtoPDF(doc, qrSvg, (pageW - qrW) / 2, y, {
    width: qrW,
    height: qrW,
    preserveAspectRatio: "xMidYMid meet",
  });
  y += qrW + 5 * MM;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#14201F");
  doc.text(tenant.name, 8 * MM, y, { width: pageW - 16 * MM, align: "center" });
  y = doc.y + 2 * MM;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#14201F");
  doc.text("Skenirajte za vse o nastanitvi in okolici", 8 * MM, y, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#6B7876");
  doc.text("Scan for everything about your stay", 8 * MM, doc.y + 1, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#3B78DC");
  doc.text(url.replace(/^https?:\/\//, ""), 8 * MM, doc.y + 4 * MM, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.end();
});

router.get("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const tree = await buildTenantContent(tenant, { visibleOnly: false });
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  res.json(GetTenantResponse.parse(serialize({ ...tree, publicUrl, qrSvg })));
});

/** Enforces documented ranges/enums from ui/urejevalnik-naslovnice.md; returns error message or null. */
function validateThemeCoverFields(data: Record<string, unknown>): string | null {
  const inRange = (v: unknown, min: number, max: number) =>
    v === undefined || v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
  if (data["theme"] !== undefined && !["mediterran", "swipe"].includes(String(data["theme"])))
    return "theme must be 'mediterran' or 'swipe'";
  if (data["coverAlign"] !== undefined && data["coverAlign"] !== null && !["left", "center"].includes(String(data["coverAlign"])))
    return "coverAlign must be 'left' or 'center'";
  if (data["coverTextColor"] !== undefined && data["coverTextColor"] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data["coverTextColor"])))
    return "coverTextColor must be a hex color like #FFFFFF";
  for (const key of ["navColorCover", "navColor", "navColorOn"]) {
    if (data[key] !== undefined && data[key] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data[key])))
      return `${key} must be a hex color like #FFFFFF`;
  }
  if (!inRange(data["coverTitleSize"], 24, 84)) return "coverTitleSize must be 24-84";
  if (!inRange(data["coverTitleOpacity"], 20, 100)) return "coverTitleOpacity must be 20-100";
  if (!inRange(data["coverSubSize"], 12, 40)) return "coverSubSize must be 12-40";
  if (!inRange(data["coverSubOpacity"], 20, 100)) return "coverSubOpacity must be 20-100";
  if (!inRange(data["coverMetaSize"], 12, 32)) return "coverMetaSize must be 12-32";
  if (!inRange(data["coverMetaOpacity"], 20, 100)) return "coverMetaOpacity must be 20-100";
  if (!inRange(data["coverVeil"], 0, 60)) return "coverVeil must be 0-60";
  if (!inRange(data["tileVeil"], 0, 60)) return "tileVeil must be 0-60";
  if (!inRange(data["textScale"], 80, 200)) return "textScale must be 80-200";
  // First-screen logo placement (logotip-stranke-naslovnica.md §3).
  if (!inRange(data["logoW"], 8, 60)) return "logoW must be 8-60";
  if (!inRange(data["logoX"], 0, 100)) return "logoX must be 0-100";
  if (!inRange(data["logoY"], 0, 100)) return "logoY must be 0-100";
  if (!inRange(data["logoOpacity"], 20, 100)) return "logoOpacity must be 20-100";
  if (data["textFont"] !== undefined && data["textFont"] !== null &&
      !["figtree", "system", "georgia", "verdana", "menlo"].includes(String(data["textFont"])))
    return "textFont must be one of figtree, system, georgia, verdana, menlo";
  if (data["textColor"] !== undefined && data["textColor"] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data["textColor"])))
    return "textColor must be a hex color like #14201F";
  if (data["bgColor"] !== undefined && data["bgColor"] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data["bgColor"])))
    return "bgColor must be a hex color like #FFFFFF";
  if (data["wifiEnc"] !== undefined && data["wifiEnc"] !== null && !["WPA", "WEP", "nopass"].includes(String(data["wifiEnc"])))
    return "wifiEnc must be WPA, WEP or nopass";
  if (data["guestUiMode"] !== undefined && data["guestUiMode"] !== "living-guide")
    return "guestUiMode must be 'living-guide'";
  // livingGuideNav: null is allowed (reset to default); when set, must be valid.
  if (data["livingGuideNav"] !== undefined && data["livingGuideNav"] !== null) {
    const navResult = validateLivingGuideNav(data["livingGuideNav"]);
    if (!navResult.ok) return navResult.error;
  }
  return null;
}

router.patch("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const invalid = validateThemeCoverFields(parsed.data);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const [before] = await db
    .select({
      slug: tenantsTable.slug,
      renewsAt: tenantsTable.renewsAt,
      latitude: tenantsTable.latitude,
      longitude: tenantsTable.longitude,
      creatorDraft: tenantsTable.creatorDraft,
      creatorOriginRegion: tenantsTable.creatorOriginRegion,
      firstPublishedAt: tenantsTable.firstPublishedAt,
      isPublished: tenantsTable.isPublished,
      name: tenantsTable.name,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!before) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const requestData = parsed.data as Record<string, unknown>;
  const coordinateOverride = requestData["coordinateOverride"] === true;
  const requestedLatitude = requestData["latitude"];
  const requestedLongitude = requestData["longitude"];
  if (
    !coordinateOverride &&
    (requestedLatitude !== undefined || requestedLongitude !== undefined)
  ) {
    res.status(400).json({
      error: "Koordinate se samodejno določijo iz Google Maps povezave.",
    });
    return;
  }
  if (coordinateOverride) {
    const coordinateError = validateTenantCoordinatePair(
      requestedLatitude === undefined ? before.latitude : requestedLatitude as number | null,
      requestedLongitude === undefined ? before.longitude : requestedLongitude as number | null,
    );
    if (coordinateError) {
      res.status(400).json({ error: coordinateError });
      return;
    }
  }
  const newSlug = (parsed.data as Record<string, unknown>)["slug"];
  if (typeof newSlug === "string" && newSlug !== before.slug) {
    // The slug is editable only until the FIRST publish; printed QR codes
    // must stay valid forever after that (CP2b).
    if (before.firstPublishedAt) {
      res.status(409).json({
        error:
          "Naslov (slug) je po prvi objavi zamrznjen — natisnjene QR kode morajo ostati veljavne.",
      });
      return;
    }
    const verdict = await checkSlugAvailability(newSlug, id);
    if (!verdict.available) {
      res.status(409).json({ error: `slug ${verdict.reason}` });
      return;
    }
  }
  // renewsAt arrives as an ISO string; drizzle timestamp wants a Date.
  const {
    renewsAt: renewsAtRaw,
    orderPassword: orderPasswordRaw,
    tourUrl: tourUrlRaw,
    livingGuideNav: livingGuideNavRaw,
    mapUrl: mapUrlRaw,
    latitude: _latitude,
    longitude: _longitude,
    ...restData
  } = parsed.data;
  const updateData: Record<string, unknown> = { ...restData };
  // livingGuideNav: null resets to null; array is already validated above.
  if (livingGuideNavRaw !== undefined) {
    updateData["livingGuideNav"] = livingGuideNavRaw ?? null;
  }
  if (tourUrlRaw !== undefined) {
    try {
      updateData["tourUrl"] = extractVirtualTourUrl(tourUrlRaw);
    } catch (error) {
      if (error instanceof VirtualTourUrlError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
  if (mapUrlRaw !== undefined) {
    try {
      const mapUrl = normalizeTenantMapUrl(mapUrlRaw);
      updateData["mapUrl"] = mapUrl;
      // Location is owned by the pasted Maps URL; a short link is retained as
      // a destination, but cannot be resolved without expanding it.
      if (!coordinateOverride) {
        const coords = extractCoordsFromGoogleMapsUrl(mapUrl);
        const hasConfirmedCreatorOrigin =
          before.creatorDraft &&
          Boolean(before.creatorOriginRegion?.trim()) &&
          before.latitude !== null &&
          before.longitude !== null;
        if (coords) {
          updateData["latitude"] = coords.lat;
          updateData["longitude"] = coords.lng;
        } else if (!hasConfirmedCreatorOrigin) {
          updateData["latitude"] = null;
          updateData["longitude"] = null;
        }
      }
    } catch (error) {
      if (error instanceof TenantLocationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
  if (coordinateOverride) {
    updateData["latitude"] =
      requestedLatitude === undefined ? before.latitude : requestedLatitude;
    updateData["longitude"] =
      requestedLongitude === undefined ? before.longitude : requestedLongitude;
  }
  if (orderPasswordRaw !== undefined) {
    updateData["orderPassword"] = orderPasswordRaw?.trim() || null;
  }
  let renewsAtChanged = false;
  if (renewsAtRaw !== undefined) {
    const next = renewsAtRaw === null ? null : new Date(renewsAtRaw);
    if (next !== null && Number.isNaN(next.getTime())) {
      res.status(400).json({ error: "renewsAt must be an ISO date" });
      return;
    }
    updateData["renewsAt"] = next;
    renewsAtChanged =
      (next?.getTime() ?? null) !== (before.renewsAt?.getTime() ?? null);
  }
  const wantsPublish = updateData["isPublished"] === true;
  const slugChanging = typeof newSlug === "string" && newSlug !== before.slug;
  // When the slug changes, the update itself re-checks the freeze (first
  // publish may have landed between our read above and this write) — the
  // WHERE clause makes "rename only while never published" atomic.
  const [updated] = await db
    .update(tenantsTable)
    .set(updateData)
    .where(
      slugChanging
        ? and(eq(tenantsTable.id, id), isNull(tenantsTable.firstPublishedAt))
        : eq(tenantsTable.id, id),
    )
    .returning();
  if (!updated) {
    if (slugChanging) {
      const [still] = await db
        .select({ id: tenantsTable.id })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, id));
      if (still) {
        res.status(409).json({
          error:
            "Naslov (slug) je po prvi objavi zamrznjen — natisnjene QR kode morajo ostati veljavne.",
        });
        return;
      }
    }
    res.status(404).json({ error: "Not found" });
    return;
  }
  let tenant = updated;
  // FIRST transition to published: compare-and-set stamps first_published_at
  // exactly once — with two concurrent publishes only one wins, logs
  // "publish" and sends the e-mail; the stamp is never overwritten and
  // unpublish/republish toggles never resend.
  let firstPublish = false;
  if (wantsPublish && tenant.firstPublishedAt === null) {
    const [won] = await db
      .update(tenantsTable)
      .set({ firstPublishedAt: new Date() })
      .where(and(eq(tenantsTable.id, id), isNull(tenantsTable.firstPublishedAt)))
      .returning({ firstPublishedAt: tenantsTable.firstPublishedAt });
    if (won) {
      firstPublish = true;
      tenant = { ...tenant, firstPublishedAt: won.firstPublishedAt };
    }
  }
  if (typeof newSlug === "string" && newSlug !== before.slug) {
    // Keep the old address working forever: permanent alias -> 301.
    await db
      .insert(tenantAliasesTable)
      .values({ slug: before.slug, tenantId: id })
      .onConflictDoNothing();
    // If the tenant reclaimed one of its own old slugs, drop that alias.
    await db
      .delete(tenantAliasesTable)
      .where(eq(tenantAliasesTable.slug, newSlug));
  }
  invalidateTenantCache();
  if (renewsAtChanged) {
    // A manually moved renewal date is part of the same proof trail as the
    // renew button — record it (late payer, free months, corrections).
    const admin = await getAdminUser();
    await db.insert(tenantRenewalsTable).values({
      tenantId: tenant.id,
      prevDate: before.renewsAt,
      newDate: tenant.renewsAt ?? new Date(0),
      actor: admin?.email ?? null,
    });
  }
  const publicationTransition =
    typeof requestData["isPublished"] === "boolean" &&
    before.isPublished !== tenant.isPublished;
  const action = firstPublish
    ? "publish"
    : publicationTransition && tenant.isPublished && before.firstPublishedAt !== null
      ? "republish"
      : publicationTransition && !tenant.isPublished
        ? "unpublish"
        : "update";
  const settingSummary = tenantSettingsSummary(tenant.name, requestData);
  const settingsSuffix = tenantSettingsSuffix(requestData);
  const summary = firstPublish
    ? `Nastanitev »${auditTenantName(tenant.name)}« je prvič objavljena.${settingsSuffix}`
    : action === "republish"
      ? `Nastanitev »${auditTenantName(tenant.name)}« je ponovno objavljena.${settingsSuffix}`
      : action === "unpublish"
        ? `Nastanitev »${auditTenantName(tenant.name)}« je umaknjena iz objave.${settingsSuffix}`
        : settingSummary;
  await logChange({
    tenantId: tenant.id,
    tenantName: tenant.name,
    action,
    entity: "tenant",
    summary,
  });
  if (firstPublish && tenant.email?.trim()) {
    // Best-effort congratulation mail (template 6); idempotency key is bound
    // to the tenant so even a concurrent double-PATCH sends at most once.
    await sendPublishedEmail(
      { to: tenant.email.trim(), tenantName: tenant.name, slug: tenant.slug },
      `published-${tenant.id}`,
    ).catch(() => {
      /* logged inside; publish itself must never fail on e-mail */
    });
  }
  res.json(
    UpdateTenantResponse.parse(
      serialize({
        ...tenant,
        orderPasswordConfigured: Boolean(tenant.orderPassword?.trim()),
      }),
    ),
  );
});

router.post("/admin/tenants/:id/renew", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [before] = await db
    .select({ name: tenantsTable.name, renewsAt: tenantsTable.renewsAt, createdAt: tenantsTable.createdAt })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!before) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Exactly one year from the CURRENT value, never from today — a client who
  // pays two weeks late must not silently gain two weeks every year.
  const base = before.renewsAt ?? plusOneYear(before.createdAt);
  const next = plusOneYear(base);
  const [tenant] = await db
    .update(tenantsTable)
    .set({ renewsAt: next })
    .where(eq(tenantsTable.id, id))
    .returning();
  const admin = await getAdminUser();
  await db.insert(tenantRenewalsTable).values({
    tenantId: id,
    prevDate: before.renewsAt,
    newDate: next,
    actor: admin?.email ?? null,
  });
  await logChange({
    tenantId: id,
    tenantName: before.name,
    action: "renew",
    entity: "tenant",
    summary: `Podaljšana je veljavnost nastanitve »${auditTenantName(before.name)}«.`,
  });
  res.json(RenewTenantResponse.parse(serialize(tenant)));
});

router.get("/admin/tenants/:id/renewals", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const rows = await db
    .select()
    .from(tenantRenewalsTable)
    .where(eq(tenantRenewalsTable.tenantId, id))
    .orderBy(desc(tenantRenewalsTable.createdAt));
  res.json(ListTenantRenewalsResponse.parse(serialize(rows)));
});

router.delete("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .delete(tenantsTable)
    .where(eq(tenantsTable.id, id))
    .returning();
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  invalidateTenantCache();
  await logChange({
    tenantName: tenant.name,
    action: "delete",
    entity: "tenant",
    summary: `Odstranjena je nastanitev »${auditTenantName(tenant.name)}«.`,
  });
  res.sendStatus(204);
});

router.post("/admin/tenants/:id/duplicate", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = DuplicateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!tenantCopyIsEnabled()) {
    res.status(409).json({
      code: "TENANT_COPY_DISABLED",
      error:
        "Tenant copy is disabled until translations can be copied with the tenant.",
    });
    return;
  }
  const { slug, name, copyContent } = parsed.data;
  const dupVerdict = await checkSlugAvailability(slug);
  if (!dupVerdict.available) {
    res.status(409).json({ error: `slug ${dupVerdict.reason}` });
    return;
  }
  const [source] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!source) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const created = await copyTenant(id, {
    slug,
    name,
    copyContent: copyContent ?? true,
  });
  invalidateTenantCache(); // a public 404 may have been negatively cached for this slug
  // Duplication hygiene: the copy must not inherit references to files that
  // no longer exist or don't fit the field (e.g. opaque JPEG as transparent
  // logo). Re-check everything against the CURRENT bucket and drop misses.
  const dropped = await dropBrokenReferences(created.id);
  const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, created.id));
  await logChange({
    tenantId: created.id,
    tenantName: name,
    action: "duplicate",
    entity: "tenant",
    summary: `Ustvarjena je kopija nastanitve »${auditTenantName(name)}«.`,
  });
  res.status(201).json(
    DuplicateTenantResponse.parse({
      tenant: serialize(fresh ?? created),
      dropped: dropped.map(({ field, label, url, reason, adminPath }) => ({ field, label, url, reason, adminPath })),
    }),
  );
});

router.get("/admin/tenants/:id/media-check", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [exists] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!exists) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const issues = await checkTenantMedia(id);
  res.json({
    issues: issues.map(({ field, label, url, reason, adminPath }) => ({ field, label, url, reason, adminPath })),
  });
});

export async function copyTenant(
  sourceId: string,
  opts: { slug: string; name: string; copyContent: boolean },
): Promise<typeof tenantsTable.$inferSelect> {
  const [source] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, sourceId));
  if (!source) throw new Error("Source tenant not found");

  // Subscription dates are per-tenant, never inherited: the copy is a NEW
  // establishment, so createdAt = now (DB default) and renewal = now + 1 year.
  const {
    id: _id,
    updatedAt: _u,
    createdAt: _c,
    renewsAt: _r,
    orderPassword: _orderPassword,
    guestUiMode: _guestUiMode,
    ...rest
  } = source;
  const [created] = await db
    .insert(tenantsTable)
    .values({
      ...rest,
      slug: opts.slug,
      name: opts.name,
      guestUiMode: "living-guide",
      isTemplate: false,
      isPublished: false,
      // Security settings belong to the new establishment and must never be
      // inherited from a template or duplicated tenant.
      orderPassword: null,
      // livingGuideNav is a per-establishment navigation decision. Reset to null
      // so the frontend applies the approved default rather than silently
      // inheriting a nav layout that may not fit the new establishment's content.
      livingGuideNav: null,
      // Provenance marker (CP2b): copies must be unmistakably flagged in the
      // admin header — the owner once edited the wrong tenant.
      copiedFromTenantId: sourceId,
      // The copy has never been published; its slug stays editable.
      firstPublishedAt: null,
      renewsAt: plusOneYear(new Date()),
    })
    .returning();

  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.tenantId, sourceId))
    .orderBy(asc(sectionsTable.position));

  for (const section of sections) {
    const { id: oldSectionId, tenantId: _t, ...sectionRest } = section;
    const [newSection] = await db
      .insert(sectionsTable)
      .values({ ...sectionRest, tenantId: created!.id })
      .returning();
    const categories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.sectionId, oldSectionId))
      .orderBy(asc(categoriesTable.position));
    for (const category of categories) {
      const { id: oldCategoryId, sectionId: _s, ...categoryRest } = category;
      const [newCategory] = await db
        .insert(categoriesTable)
        .values({ ...categoryRest, sectionId: newSection!.id })
        .returning();
      if (!opts.copyContent) continue;
      const items = await db
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.categoryId, oldCategoryId))
        .orderBy(asc(itemsTable.position));
      const oldItemIds = items.map((i) => i.id);
      const media = oldItemIds.length
        ? await db
            .select()
            .from(mediaTable)
            .where(inArray(mediaTable.itemId, oldItemIds))
        : [];
      for (const item of items) {
        const { id: oldItemId, categoryId: _c, ...itemRest } = item;
        const [newItem] = await db
          .insert(itemsTable)
          .values({ ...itemRest, categoryId: newCategory!.id })
          .returning();
        const itemMedia = media.filter((m) => m.itemId === oldItemId);
        if (itemMedia.length) {
          await db.insert(mediaTable).values(
            itemMedia.map(({ id: _m, itemId: _i, ...mediaRest }) => ({
              ...mediaRest,
              itemId: newItem!.id,
            })),
          );
        }
      }
    }
  }
  return created!;
}

export default router;
