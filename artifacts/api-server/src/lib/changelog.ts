import { db, changelogTable } from "@workspace/db";
import { currentActor } from "./actorContext";

/**
 * Every changelog row records WHO made the change (Instruction #28 CP1 §6).
 * Attribution is CENTRAL: it comes from the request's actor context set by
 * the admin gate, so no route can forget it and no host can forge it.
 * Outside any request context (startup backfills, cutovers, sweeps) rows are
 * recorded as 'system'.
 */
export async function logChange(entry: {
  tenantId?: string | null;
  tenantName?: string | null;
  action: string;
  entity: string;
  /** Deprecated untrusted input. It is intentionally never persisted. */
  detail?: string | null;
  /** Server-controlled audit copy only; never pass request/content values. */
  summary?: string;
  operationKey?: string | null;
}): Promise<void> {
  const actor = currentActor();
  const actorType = actor?.kind === "host" ? "host" : actor?.kind === "owner" ? "owner" : "system";
  // Host-context rows must carry the tenant (RLS WITH CHECK enforces it);
  // fill it from the session when the caller did not pass one.
  const tenantId =
    entry.tenantId ?? (actor?.kind === "host" ? actor.tenantId : null);
  const fallbackSummary = safeSummary(entry.action, entry.entity);
  const summary = normalizeSummary(entry.summary) || fallbackSummary;
  await db.insert(changelogTable).values({
    tenantId,
    // Tenant ID supplies the relationship. Do not duplicate a submitted name
    // into the audit ledger.
    tenantName: null,
    action: entry.action,
    entity: entry.entity,
    // Do not put caller supplied values here. Older call sites pass content
    // titles, e-mail addresses and settings, none of which belong in audit.
    detail: null,
    summary,
    actorType,
    // The role label is sufficient for this tenant history; account IDs would
    // make the changelog another store of personal data.
    actorId: null,
    actorEmail: null,
    actorLabel: actorType === "host" ? "Stranka" : "Smart360",
    requestIp: actor?.requestIp ?? null,
    operationKey: entry.operationKey ?? null,
  }).onConflictDoNothing({ target: changelogTable.operationKey });
}

const AUDIT_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const AUDIT_URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const AUDIT_PHONE = /(?:\+?\d[\d\s()./-]{6,}\d)/g;

/**
 * Entity names are useful audit context, but hosts may accidentally put
 * contact data in a title. Redact recognizable contact data centrally before
 * any route-provided summary reaches the permanent ledger.
 */
export function redactAuditSummary(value: string): string {
  return value
    .replace(AUDIT_EMAIL, "[e-naslov odstranjen]")
    .replace(AUDIT_URL, "[povezava odstranjena]")
    .replace(AUDIT_PHONE, "[telefonska številka odstranjena]");
}

function normalizeSummary(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = redactAuditSummary(value).replace(/\s+/g, " ").trim().slice(0, 240);
  return normalized || null;
}

const SAFE_AUDIT_REFERENCE = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const ORDER_STATUSES = new Set(["novo", "potrjeno", "prevzeto", "zavrnjeno"]);

/** Builds the only dynamic order audit text from a server-generated UUID and enum. */
export function orderStatusSummary(orderRef: string, status: string): string {
  if (!SAFE_AUDIT_REFERENCE.test(orderRef) || !ORDER_STATUSES.has(status)) {
    return "Status naročila je bil spremenjen.";
  }
  return `Naročilo ${orderRef}: status je spremenjen v ${status}.`;
}

/** Builds the only dynamic message audit text from a server-generated UUID. */
export function hostReplySummary(threadRef: string): string {
  if (!SAFE_AUDIT_REFERENCE.test(threadRef)) return "Poslan je bil odgovor stranki.";
  return `Poslan je bil odgovor v pogovoru ${threadRef}.`;
}

/** Safe fixed-language summaries; no user-provided data may enter audit text. */
export function safeSummary(action: string, entity: string): string {
  if (action === "cockpit-entry") return "Smart360 je odprl pregled nastanitve.";
  const actions: Record<string, string> = {
    create: "je ustvaril",
    update: "je posodobil",
    delete: "je odstranil",
    restore: "je obnovil",
    purge: "je trajno odstranil",
    publish: "je objavil",
    renew: "je podaljšal",
    duplicate: "je podvojil",
    send: "je poslal",
    maintenance: "je izvedel vzdrževanje",
  };
  const entities: Record<string, string> = {
    tenant: "nastanitev",
    section: "razdelek",
    category: "kategorijo",
    item: "vnos",
    media: "predstavnost",
    translation: "prevod",
    "host-account": "dostop stranke",
    "host-account-created": "nov dostop stranke",
    "host-account-email-changed": "e-naslov dostopa stranke",
    "host-password-change": "geslo stranke",
    "host-password-reset": "ponastavitev gesla stranke",
    "host-invite": "povabilo stranki",
    "order-status": "status naročila",
    "host-message": "odgovor stranki",
    "distance-review": "pregled razdalj",
  };
  return `${actions[action] ?? "je spremenil"} ${entities[entity] ?? "vodnik"}.`;
}
