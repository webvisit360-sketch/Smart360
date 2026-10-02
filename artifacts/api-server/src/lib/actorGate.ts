import type { NextFunction, Request, Response, Router } from "express";
import { openHostDbContext, pool } from "@workspace/db";
import { actorStorage, type Actor } from "./actorContext";
import { isAuthenticated } from "./adminAuth";
import { findHostActor } from "./hostAuth";
import { logger } from "./logger";
import { denyAuthorization } from "./authorizationDenial";

/**
 * Ring 1 + Ring 2 — central actor gate and deny-by-default route fence
 * (Instruction #28, CHECKPOINT 2; access model approved at CHECKPOINT 1).
 *
 * EVERY /admin request passes through here before any router:
 *  1. The actor is resolved exactly once (owner passkey session, else host
 *     session) and pinned to the request + AsyncLocalStorage.
 *  2. Owner passes everywhere (except host-self endpoints, which are
 *     meaningless for the owner). The owner NEVER impersonates a host.
 *  3. A host request must match an entry in the EXPLICIT registry below and
 *     satisfy its tenant binding — URL tenant id, or entity ownership
 *     resolved centrally against the DB. Anything unmatched is 404, so a
 *     host cannot learn which owner-only endpoints exist.
 *  4. Only then is the host's scoped DB context opened (Ring 3, RLS), held
 *     for the whole response and cleaned on finish/close.
 *
 * DENY-BY-DEFAULT FOR NEW CODE: assertAdminRoutesClassified() walks the live
 * Express router at boot and REFUSES TO START the server if any /admin route
 * is not classified here. A future route cannot silently become host-reachable
 * (or owner-only-but-forgotten) — the developer is forced to decide.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

type EntityKind = "section" | "category" | "item" | "media" | "order";

type Binding =
  /** No session required (login, session probe, reset endpoints). */
  | { kind: "anon" }
  /** Owner only. Hosts get 404 — the route's existence is not revealed. */
  | { kind: "owner-only" }
  /** Legacy names: concierge own=403, self-service allowed, foreign always=404. */
  | { kind: "operator-tenant"; param: string }
  | { kind: "operator-entity"; entity: EntityKind; param: string; selfService?: boolean }
  /** Reorder ids belong to a single tenant; foreign ids remain invisible. */
  | { kind: "operator-reorder"; entity: EntityKind }
  /** Host session endpoints about the host themself (password change, logout). */
  | { kind: "host-self" }
  /** Tenant id in the URL must equal the host's tenant. */
  | { kind: "tenant-url"; param: string; bodyDeny?: string[] }
  /** Entity id in the URL must belong to the host's tenant (central resolver). */
  | { kind: "entity"; entity: EntityKind; param: string }
  /**
   * No URL binding possible (ids arrive in body/query). Ring 3 makes foreign
   * ids invisible: reads return empty, writes match zero rows. The negative
   * test suite exercises these paths explicitly.
   */
  | { kind: "rls" };

type RouteSpec = { method: string; path: string; binding: Binding };

const OWNER: Binding = { kind: "owner-only" };
const OPERATOR_ONLY: Binding = OWNER;
const ANON: Binding = { kind: "anon" };
const SELF: Binding = { kind: "host-self" };
const RLS: Binding = { kind: "rls" };
const T_ID: Binding = { kind: "tenant-url", param: "id" };
const OP_T_ID: Binding = { kind: "operator-tenant", param: "id" };

function e(entity: EntityKind, param = "id"): Binding {
  return { kind: "entity", entity, param };
}
function opEntity(entity: EntityKind, param = "id", selfService = true): Binding {
  return { kind: "operator-entity", entity, param, selfService };
}

export const ADMIN_ROUTE_REGISTRY: RouteSpec[] = [
  // ── Owner passkey auth (adminAuth.ts) ────────────────────────────────────
  { method: "post", path: "/admin/password/login", binding: ANON },
  { method: "get", path: "/admin/password", binding: OWNER },
  { method: "put", path: "/admin/password", binding: OWNER },
  { method: "post", path: "/admin/webauthn/login/options", binding: ANON },
  { method: "post", path: "/admin/webauthn/login/verify", binding: ANON },
  { method: "post", path: "/admin/logout", binding: ANON },
  { method: "get", path: "/admin/session", binding: ANON },
  { method: "post", path: "/admin/enroll/options", binding: ANON },
  { method: "post", path: "/admin/enroll/verify", binding: ANON },
  { method: "post", path: "/admin/recovery", binding: ANON },
  { method: "get", path: "/admin/recovery-codes", binding: OWNER },
  { method: "post", path: "/admin/recovery-codes/rotate", binding: OWNER },
  { method: "get", path: "/admin/auth-events", binding: OWNER },
  { method: "get", path: "/admin/credentials", binding: OWNER },
  { method: "patch", path: "/admin/credentials/:id", binding: OWNER },
  { method: "delete", path: "/admin/credentials/:id", binding: OWNER },
  { method: "post", path: "/admin/credentials/options", binding: OWNER },
  { method: "post", path: "/admin/credentials/verify", binding: OWNER },
  { method: "get", path: "/admin/sessions/status", binding: OWNER },
  { method: "post", path: "/admin/sessions/revoke-all", binding: OWNER },

  // ── Host auth (routes/hostAuth.ts) ───────────────────────────────────────
  { method: "post", path: "/admin/host/login", binding: ANON },
  { method: "get", path: "/admin/host/session", binding: ANON },
  { method: "post", path: "/admin/host/logout", binding: ANON },
  { method: "post", path: "/admin/host/password", binding: SELF },
  { method: "post", path: "/admin/host/reset/request", binding: ANON },
  { method: "post", path: "/admin/host/reset/confirm", binding: ANON },
  { method: "post", path: "/admin/host/invite/confirm", binding: ANON },
  { method: "get", path: "/admin/tenants/:id/host", binding: OWNER },
  { method: "put", path: "/admin/tenants/:id/host", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/host/welcome-preview", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/host/ready-preview", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/ready-preview", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/send-ready", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/send-invite", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/send-reset", binding: OWNER },
  { method: "get", path: "/admin/host/onboarding", binding: SELF },
  { method: "patch", path: "/admin/host/onboarding", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/save", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/recommendations/retry", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/categories", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/submit", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/photos/upload-url", binding: SELF },
  { method: "post", path: "/admin/host/onboarding/photos/:photoId/complete", binding: SELF },
  { method: "delete", path: "/admin/host/onboarding/photos/:photoId", binding: SELF },
  { method: "get", path: "/admin/host/onboarding/photos/:photoId", binding: SELF },
  { method: "get", path: "/admin/tenants/:id/host/onboarding", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/onboarding/open", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/host/onboarding/reopen", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/host/onboarding/photos/:photoId", binding: OWNER },

  // ── Tenants (adminTenants.ts) ────────────────────────────────────────────
  { method: "get", path: "/admin/overview", binding: OWNER },
  { method: "get", path: "/admin/enquiries", binding: OWNER },
  { method: "get", path: "/admin/tenants", binding: OWNER },
  { method: "get", path: "/admin/tenants/overview", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/changelog", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/operator-entry", binding: OWNER },
  { method: "post", path: "/admin/tenants", binding: OWNER },
  { method: "delete", path: "/admin/tenants/:id/incomplete-copy", binding: OWNER },
  { method: "get", path: "/admin/slug-check", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/qr.png", binding: T_ID },
  { method: "get", path: "/admin/tenants/:id/label.pdf", binding: T_ID },
  { method: "get", path: "/admin/tenants/:id", binding: T_ID },
  {
    method: "patch",
    path: "/admin/tenants/:tenantId/management-mode",
    binding: { kind: "tenant-url", param: "tenantId" },
  },
  { method: "get", path: "/admin/tenants/:id/publish-preview", binding: T_ID },
  { method: "get", path: "/admin/tenants/:id/emergency-contacts", binding: OP_T_ID },
  { method: "put", path: "/admin/tenants/:id/emergency-contacts", binding: OP_T_ID },
  { method: "get", path: "/admin/tenants/:id/notification-configuration", binding: T_ID },
  {
    method: "patch",
    path: "/admin/tenants/:id",
    // Host writes are checked against a positive field allowlist below.
    binding: T_ID,
  },
  { method: "post", path: "/admin/tenants/:id/renew", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/renewals", binding: OWNER },
  { method: "delete", path: "/admin/tenants/:id", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/duplicate", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/align-skeleton", binding: OPERATOR_ONLY },
  { method: "get", path: "/admin/tenants/:id/media-check", binding: OWNER },
  { method: "post", path: "/admin/creator/origin-preview", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/origin", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/runs", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/creator/runs/latest", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/creator/sources", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/sources", binding: OWNER },
  { method: "patch", path: "/admin/tenants/:id/creator/sources/:sourceId", binding: OWNER },
  { method: "delete", path: "/admin/tenants/:id/creator/sources/:sourceId", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/sources/:sourceId/archive", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/sources/approve-list", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/sources/:sourceId/:decision", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/creator/catalogue", binding: OWNER },
  { method: "patch", path: "/admin/tenants/:id/creator/proposals/:proposalId", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/translate", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/reject", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/undo-rejection", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/reject-bulk", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/retry-unresolved", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/confirm-coordinates", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/creator/proposals", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/reevaluate", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/distance-backfill", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/approve", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/:proposalId/unapprove", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/proposals/approve-bulk", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/photos/discover", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/creator/photo-proposals", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/photo-proposals/:photoProposalId/approve", binding: OWNER },
  { method: "post", path: "/admin/tenants/:id/creator/photo-proposals/:photoProposalId/reject", binding: OWNER },

  // ── Content (adminContent.ts) ────────────────────────────────────────────
  { method: "post", path: "/admin/tenants/:id/sections", binding: OP_T_ID },
  { method: "post", path: "/admin/sections/:id/categories", binding: opEntity("section") },
  { method: "patch", path: "/admin/sections/:id", binding: opEntity("section") },
  { method: "delete", path: "/admin/sections/:id", binding: opEntity("section", "id", false) },
  { method: "post", path: "/admin/sections/:id/trash", binding: opEntity("section") },
  { method: "post", path: "/admin/sections/:id/restore", binding: opEntity("section") },
  { method: "post", path: "/admin/sections/reorder", binding: { kind: "operator-reorder", entity: "section" } },
  { method: "patch", path: "/admin/categories/:id", binding: opEntity("category") },
  { method: "delete", path: "/admin/categories/:id", binding: opEntity("category") },
  { method: "post", path: "/admin/categories/reorder", binding: { kind: "operator-reorder", entity: "category" } },
  { method: "post", path: "/admin/categories/:id/items", binding: e("category") },
  { method: "get", path: "/admin/categories/:id/place-search", binding: opEntity("category") },
  { method: "post", path: "/admin/categories/:id/places", binding: opEntity("category") },
  { method: "patch", path: "/admin/items/:id", binding: e("item") },
  { method: "post", path: "/admin/items/:id/gpx", binding: e("item") },
  { method: "delete", path: "/admin/items/:id/gpx", binding: e("item") },
  { method: "post", path: "/admin/items/:id/translate-missing", binding: e("item") },
  { method: "get", path: "/admin/items/:id/creator-status", binding: e("item") },
  { method: "post", path: "/admin/items/:id/distance/recompute", binding: e("item") },
  // Operator confirms a host draft's pin; the handler also validates its
  // submitted-round item linkage and tenant before modifying coordinates.
  { method: "post", path: "/admin/items/:id/coordinates", binding: OPERATOR_ONLY },
  { method: "post", path: "/admin/items/:id/creator/photos/discover", binding: OWNER },
  { method: "get", path: "/admin/items/:id/creator/photo-proposals", binding: OWNER },
  { method: "delete", path: "/admin/items/:id", binding: e("item") },
  { method: "post", path: "/admin/items/:id/duplicate", binding: e("item") },
  { method: "post", path: "/admin/items/reorder", binding: RLS },
  { method: "post", path: "/admin/items/:id/media", binding: e("item") },
  { method: "patch", path: "/admin/media/:id", binding: e("media") },
  { method: "delete", path: "/admin/media/:id", binding: e("media") },
  { method: "post", path: "/admin/media/reorder", binding: RLS },
  { method: "get", path: "/admin/translations", binding: RLS },
  { method: "put", path: "/admin/translations", binding: RLS },
  { method: "post", path: "/admin/maintenance/normalize-content", binding: OWNER },
  { method: "get", path: "/admin/tenants/:id/trash", binding: T_ID },
  { method: "post", path: "/admin/categories/:id/restore", binding: opEntity("category") },
  { method: "post", path: "/admin/items/:id/restore", binding: e("item") },
  // Permanent content removal is a Smart360-only capability. Hosts retain
  // soft-delete/restore editing, but cannot invoke the purge endpoints.
  { method: "delete", path: "/admin/categories/:id/purge", binding: OWNER },
  { method: "delete", path: "/admin/items/:id/purge", binding: OWNER },

  // ── Tenant translations bundle (adminTranslations.ts) ───────────────────
  { method: "get", path: "/admin/tenants/:id/translations", binding: T_ID },
  { method: "get", path: "/admin/tenants/:id/translations/overview", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/translations/import", binding: OP_T_ID },
  { method: "get", path: "/admin/tenants/:id/translations/export", binding: OP_T_ID },

  // ── Site plan (adminSitePlan.ts) ─────────────────────────────────────────
  { method: "get", path: "/admin/tenants/:id/site-plan-images", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/site-plan-images/upload", binding: OP_T_ID },
  { method: "post", path: "/admin/tenants/:id/site-plan-images/reorder", binding: OP_T_ID },
  { method: "patch", path: "/admin/site-plan-images/:id", binding: opEntity("media") },
  { method: "delete", path: "/admin/site-plan-images/:id", binding: opEntity("media") },

  // ── Orders ───────────────────────────────────────────────────────────────
  { method: "get", path: "/admin/tenants/:id/orders", binding: T_ID },
  { method: "patch", path: "/admin/orders/:orderRef/status", binding: e("order", "orderRef") },

  // ── Messages ─────────────────────────────────────────────────────────────
  { method: "get", path: "/admin/tenants/:tenantId/messages", binding: { kind: "tenant-url", param: "tenantId" } },
  { method: "post", path: "/admin/tenants/:tenantId/messages/:threadRef", binding: { kind: "tenant-url", param: "tenantId" } },
  // Runtime announcements: full management for the host's OWN tenant.
  { method: "get", path: "/admin/tenants/:tenantId/announcements", binding: { kind: "tenant-url", param: "tenantId" } },
  { method: "post", path: "/admin/tenants/:tenantId/announcements", binding: { kind: "tenant-url", param: "tenantId" } },
  { method: "post", path: "/admin/tenants/:tenantId/announcements/image", binding: { kind: "tenant-url", param: "tenantId" } },
  { method: "patch", path: "/admin/tenants/:tenantId/announcements/:announcementId", binding: { kind: "tenant-url", param: "tenantId" } },
  { method: "delete", path: "/admin/tenants/:tenantId/announcements/:announcementId", binding: { kind: "tenant-url", param: "tenantId" } },

  // ── Distance review (adminDistanceReview.ts) ─────────────────────────────
  { method: "get", path: "/admin/tenants/:id/distance-review", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/rows/:rowId/approve", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/rows/:rowId/skip", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/rows/:rowId/value", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/rows/:rowId/link", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/rows/:rowId/revert", binding: T_ID },
  { method: "post", path: "/admin/tenants/:id/distance-review/approve-bulk", binding: T_ID },

  // ── Uploads (storage.ts) ─────────────────────────────────────────────────
  { method: "post", path: "/admin/items/:id/media/upload", binding: e("item") },
  { method: "post", path: "/admin/tenants/:id/hero/upload", binding: OP_T_ID },
  { method: "post", path: "/admin/tenants/:id/living-guide-hero/upload", binding: OP_T_ID },
  { method: "post", path: "/admin/tenants/:id/logo/upload", binding: OP_T_ID },

  // ── Owner tooling ────────────────────────────────────────────────────────
  { method: "get", path: "/admin/storage/usage", binding: OWNER },
  { method: "get", path: "/admin/storage/cleanup", binding: OWNER },
  { method: "post", path: "/admin/storage/cleanup", binding: OWNER },
  { method: "get", path: "/admin/storage/cleanup/runs", binding: OWNER },
  { method: "post", path: "/admin/storage/cleanup/restore", binding: OWNER },
  { method: "get", path: "/admin/cutovers/part-5-meli-pu", binding: OWNER },
  { method: "post", path: "/admin/cutovers/part-5-meli-pu", binding: OWNER },
];

/** Explicit defence in depth for irreversible/operator maintenance handlers. */
export function requireOperator(req: Request, res: Response, next: NextFunction): void {
  if (req.actor?.kind === "owner") {
    next();
    return;
  }
  if (!req.actor) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  denyAuthorization(req, res, { reason: "operator_required" }).catch(next);
}

// ---------- Runtime matching ----------

type CompiledSpec = RouteSpec & { regex: RegExp; paramGroups: Record<string, number> };

function compile(spec: RouteSpec): CompiledSpec {
  const paramGroups: Record<string, number> = {};
  let group = 0;
  const pattern = spec.path
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        group += 1;
        paramGroups[seg.slice(1)] = group;
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { ...spec, regex: new RegExp(`^${pattern}$`), paramGroups };
}

const COMPILED: CompiledSpec[] = ADMIN_ROUTE_REGISTRY.map(compile);

function matchRoute(method: string, path: string): { spec: CompiledSpec; match: RegExpExecArray } | null {
  const m = method.toLowerCase();
  for (const spec of COMPILED) {
    if (spec.method !== m) continue;
    const match = spec.regex.exec(path);
    if (match) return { spec, match };
  }
  return null;
}

function paramValue(hit: { spec: CompiledSpec; match: RegExpExecArray }, param: string): string {
  const idx = hit.spec.paramGroups[param];
  return idx ? decodeURIComponent(hit.match[idx] ?? "") : "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Positive list: unknown keys must not be silently stripped by the handler. */
export const HOST_TENANT_WRITABLE_FIELDS = [
  "phone", "email", "whatsapp", "viber", "instagram",
  "orderNotifyEmail", "messageNotifyEmail", "notificationChannel",
  "notificationWhatsappPhone", "orderPassword", "wifiSsid", "wifiPass", "wifiEnc",
] as const;
const HOST_TENANT_FIELDS = new Set<string>(HOST_TENANT_WRITABLE_FIELDS);
/** Deliberately explicit: future schema fields do not grant host capabilities. */
export const SELF_SERVICE_TENANT_WRITABLE_FIELDS = [
  ...HOST_TENANT_WRITABLE_FIELDS,
  "customDomain", "name", "subtitle", "address", "mapQuery", "mapUrl",
  "latitude", "longitude", "logoUrl", "logoSquareUrl", "heroUrl",
  "livingGuideHeroUrl", "tourUrl", "tourRecordingEnabled", "bgColor", "theme",
  "guestUiMode", "coverTitle", "coverSubtitle", "coverTitleSize",
  "coverTitleOpacity", "coverTextColor", "coverSubSize", "coverSubOpacity",
  "coverMetaSize", "coverMetaOpacity", "coverVeil", "tileVeil", "textScale",
  "textFont", "textColor", "coverAlign", "coverShowRating", "logoX", "logoY",
  "logoW", "logoOpacity", "navColorCover", "navColor", "navColorOn",
  "languages", "livingGuideNav", "isPublished", "publishNow", "publishToken",
] as const;
const SELF_SERVICE_TENANT_FIELDS = new Set<string>(SELF_SERVICE_TENANT_WRITABLE_FIELDS);
export const HOST_PUBLISH_DENIAL =
  "Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene.";
const PUBLICATION_FIELDS = new Set(["isPublished", "publishNow", "publishToken"]);

/**
 * Central entity → tenant resolver. Runs on the SHARED pool (before the host
 * DB context opens), so the answer is authoritative and unaffected by RLS.
 * Soft-deleted rows resolve too — restore/purge must stay tenant-bound.
 */
async function entityTenantId(entity: EntityKind, id: string): Promise<string | null> {
  let text: string;
  switch (entity) {
    case "section":
      text = "SELECT tenant_id AS tid FROM sections WHERE id = $1";
      break;
    case "category":
      text =
        "SELECT s.tenant_id AS tid FROM categories c JOIN sections s ON s.id = c.section_id WHERE c.id = $1";
      break;
    case "item":
      text =
        "SELECT s.tenant_id AS tid FROM items i JOIN categories c ON c.id = i.category_id JOIN sections s ON s.id = c.section_id WHERE i.id = $1";
      break;
    case "media":
      text =
        "SELECT COALESCE(m.tenant_id, s.tenant_id) AS tid FROM media m LEFT JOIN items i ON i.id = m.item_id LEFT JOIN categories c ON c.id = i.category_id LEFT JOIN sections s ON s.id = c.section_id WHERE m.id = $1";
      break;
    case "order":
      text = "SELECT tenant_id AS tid FROM orders WHERE order_ref = $1";
      break;
  }
  const result = await pool.query<{ tid: string | null }>(text, [id]);
  return result.rows[0]?.tid ?? null;
}

async function resolveActor(req: Request): Promise<Actor | null> {
  // Express derives this from the configured trusted proxy. No request
  // metadata besides this retention-limited IP is carried into auditing.
  const requestIp = req.ip || null;
  if (await isAuthenticated(req)) return { kind: "owner", requestIp };
  const host = await findHostActor(req);
  if (host) {
    return { kind: "host", hostUserId: host.hostUserId, tenantId: host.tenantId,
      managementMode: host.managementMode, requestIp };
  }
  return null;
}

function notFound(res: Response): void {
  res.status(404).json({ error: "Not found" });
}

async function gate(
  req: Request,
  res: Response,
  next: NextFunction,
  actorResolver: (req: Request) => Promise<Actor | null> = resolveActor,
): Promise<void> {
  const hit = matchRoute(req.method, req.path);

  if (hit?.spec.binding.kind === "anon") {
    // No auth required; still pin the actor when one exists, so e.g. session
    // probes and logout can see it.
    const actor = await actorResolver(req);
    if (actor) {
      req.actor = actor;
      actorStorage.run(actor, () => next());
      return;
    }
    next();
    return;
  }

  const actor = await actorResolver(req);
  if (!actor) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.actor = actor;

  if (actor.kind === "owner") {
    // No ordinary editor, publication, upload, or deletion route may operate
    // on a durable copy stub. It has no children until final atomic completion.
    const target = /^\/admin\/tenants\/([0-9a-f-]{36})(?:\/|$)/i.exec(req.path)?.[1]
      ?? (typeof req.body?.tenantId === "string" ? req.body.tenantId : undefined);
    if (target && UUID_RE.test(target) &&
        !(req.method === "DELETE" && req.path === `/admin/tenants/${target}/incomplete-copy`)) {
      const state = await pool.query("SELECT copy_state FROM tenants WHERE id = $1", [target]);
      if (state.rows[0]?.copy_state === "copying") {
        res.status(409).json({ code: "TENANT_COPY_INCOMPLETE", error: "Nedokončana kopija. Počakajte na konec kopiranja ali jo odstranite." });
        return;
      }
    }
    if (hit?.spec.binding.kind === "host-self") {
      // Owner-never-impersonates: there is no host behind this session.
      notFound(res);
      return;
    }
    actorStorage.run(actor, () => next());
    return;
  }

  // ── Host: deny-by-default fence ──
  if (!hit) {
    notFound(res);
    return;
  }
  const binding = hit.spec.binding;
  const selfService = actor.managementMode === "self_service";
  switch (binding.kind) {
    case "owner-only":
      notFound(res);
      return;
    case "operator-tenant":
      if (paramValue(hit, binding.param) !== actor.tenantId) {
        notFound(res);
        return;
      }
      if (selfService) break;
      await denyAuthorization(req, res, { reason: "operator_required", route: hit.spec.path });
      return;
    case "operator-entity": {
      const id = paramValue(hit, binding.param);
      if (!UUID_RE.test(id) || (await entityTenantId(binding.entity, id)) !== actor.tenantId) {
        notFound(res);
        return;
      }
      if (selfService && binding.selfService) break;
      await denyAuthorization(req, res, { reason: "operator_required", route: hit.spec.path });
      return;
    }
    case "operator-reorder": {
      const ids = (req.body as { ids?: unknown } | undefined)?.ids;
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id !== "string" || !UUID_RE.test(id) ||
              (await entityTenantId(binding.entity, id)) !== actor.tenantId) {
            notFound(res);
            return;
          }
        }
      }
      if (selfService) break;
      await denyAuthorization(req, res, { reason: "operator_required", route: hit.spec.path });
      return;
    }
    case "tenant-url": {
      if (paramValue(hit, binding.param) !== actor.tenantId) {
        notFound(res);
        return;
      }
      if (binding.bodyDeny && req.body && typeof req.body === "object") {
        const denied = binding.bodyDeny.filter((field) =>
          Object.prototype.hasOwnProperty.call(req.body, field));
        if (denied.length) {
          await denyAuthorization(req, res, { reason: "operator_field", fields: denied, route: hit.spec.path });
          return;
        }
      }
      if (req.method === "PATCH" && hit.spec.path === "/admin/tenants/:id" &&
          req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
        const denied = Object.keys(req.body as Record<string, unknown>)
          .filter((field) => !(selfService ? SELF_SERVICE_TENANT_FIELDS : HOST_TENANT_FIELDS).has(field) ||
            (field === "isPublished" && req.body[field] !== true));
        if (denied.length) {
          const publishing = denied.some((field) => PUBLICATION_FIELDS.has(field));
          await denyAuthorization(req, res, {
            reason: publishing ? "operator_publication" : "operator_field",
            fields: denied, route: hit.spec.path,
            ...(publishing ? { message: HOST_PUBLISH_DENIAL } : {}),
          });
          return;
        }
      }
      break;
    }
    case "entity": {
      const id = paramValue(hit, binding.param);
      if (!UUID_RE.test(id)) {
        notFound(res);
        return;
      }
      const owner = await entityTenantId(binding.entity, id);
      if (!owner || owner !== actor.tenantId) {
        notFound(res);
        return;
      }
      // A site-plan image is tenant media, not item media. The generic media
      // route must not become an alternate write path for operator imagery.
      if (binding.entity === "media" && hit.spec.path === "/admin/media/:id") {
        const media = await pool.query<{ item_id: string | null }>(
          "SELECT item_id FROM media WHERE id = $1", [id]);
        if (!media.rows[0]?.item_id && !selfService) {
          await denyAuthorization(req, res, { reason: "operator_required", route: hit.spec.path });
          return;
        }
      }
      break;
    }
    case "host-self":
    case "rls":
      break;
  }

  if (hit.spec.path === "/admin/media/reorder") {
    const ids = (req.body as { ids?: unknown } | undefined)?.ids;
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id !== "string" || !UUID_RE.test(id)) continue;
        if ((await entityTenantId("media", id)) !== actor.tenantId) {
          notFound(res);
          return;
        }
        const media = await pool.query<{ item_id: string | null }>(
          "SELECT item_id FROM media WHERE id = $1", [id]);
        if (!media.rows[0]?.item_id && !selfService) {
          await denyAuthorization(req, res, { reason: "operator_required", route: hit.spec.path });
          return;
        }
      }
    }
  }

  // Ring 3: everything downstream runs on the tenant-scoped connection.
  const handle = await openHostDbContext(actor.tenantId);
  let releaseCalled = false;
  const release = () => {
    if (releaseCalled) return;
    releaseCalled = true;
    handle.release().catch((err: unknown) => {
      logger.error(
        { errName: err instanceof Error ? err.name : "Error" },
        "[actorGate] host db context release failed",
      );
    });
  };
  res.on("finish", release);
  res.on("close", release);
  handle.enter(() => actorStorage.run(actor, () => next()));
}

/** Express middleware — mount FIRST on the /api router, before all admin routers. */
export function adminGate(req: Request, res: Response, next: NextFunction): void {
  if (req.path !== "/admin" && !req.path.startsWith("/admin/")) {
    next();
    return;
  }
  gate(req, res, next).catch(next);
}

/**
 * Trusted in-process test harness only. Never mounted by the application:
 * callers pass a server-side actor, not a request header/cookie/body value.
 */
export function createAdminGateForTests(actor: Actor): typeof adminGate {
  return (req, res, next) => {
    if (req.path !== "/admin" && !req.path.startsWith("/admin/")) {
      next();
      return;
    }
    gate(req, res, next, async () => {
      if (actor.kind !== "host") return actor;
      const result = await pool.query<{ management_mode: "self_service" | "concierge" }>(
        "SELECT management_mode FROM tenants WHERE id = $1", [actor.tenantId]);
      return result.rows[0] ? { ...actor, managementMode: result.rows[0].management_mode } : null;
    }).catch(next);
  };
}

// ---------- Boot-time exhaustiveness assertion ----------

type RegisteredRoute = { method: string; path: string };

function collectRoutes(router: Router): RegisteredRoute[] {
  const out: RegisteredRoute[] = [];
  type Layer = {
    route?: { path: string | string[]; methods: Record<string, boolean> };
    handle?: { stack?: Layer[] };
  };
  const visit = (stack: Layer[] | undefined): void => {
    if (!stack) return;
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          for (const method of Object.keys(layer.route.methods)) {
            out.push({ method, path: p });
          }
        }
      } else if (layer.handle?.stack) {
        visit(layer.handle.stack);
      }
    }
  };
  visit((router as unknown as { stack: Layer[] }).stack);
  return out;
}

/**
 * Refuses to boot when any registered /admin route is missing from the
 * registry. This is what keeps the fence deny-by-default over time.
 */
export function assertAdminRoutesClassified(router: Router): void {
  const registered = collectRoutes(router).filter(
    (r) => r.path === "/admin" || r.path.startsWith("/admin/"),
  );
  const specs = new Set(ADMIN_ROUTE_REGISTRY.map((s) => `${s.method} ${s.path}`));
  const missing = registered.filter((r) => !specs.has(`${r.method} ${r.path}`));
  if (missing.length > 0) {
    throw new Error(
      `[actorGate] UNCLASSIFIED /admin routes — add them to ADMIN_ROUTE_REGISTRY with an explicit binding:\n` +
        missing.map((r) => `  ${r.method.toUpperCase()} ${r.path}`).join("\n"),
    );
  }
  const seen = new Set(registered.map((r) => `${r.method} ${r.path}`));
  const stale = ADMIN_ROUTE_REGISTRY.filter((s) => !seen.has(`${s.method} ${s.path}`));
  if (stale.length > 0) {
    logger.warn(
      { routes: stale.map((s) => `${s.method.toUpperCase()} ${s.path}`) },
      "[actorGate] registry entries with no matching route (stale?)",
    );
  }
  logger.info(
    { adminRoutes: registered.length },
    "[actorGate] all /admin routes classified",
  );
}
