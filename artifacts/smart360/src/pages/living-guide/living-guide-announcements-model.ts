// Tenant announcements ("Obvestila") — runtime data, never part of the published snapshot.
// Pure helpers: visibility window, language fallback, device-only read state, labels.

import { GUIDE_LANGUAGES, guideLanguage, LANGUAGE_LOCALES, type GuideLanguage } from "@workspace/guide-languages";
import { extendCatalog } from "../../lib/guest-catalogs";
export type AnnouncementLang = GuideLanguage;
export const ANNOUNCEMENT_LANGS = GUIDE_LANGUAGES;

export interface GuestAnnouncement {
  id: string;
  tenantId: string;
  titleSl?: string | null; titleEn?: string | null; titleDe?: string | null; titleIt?: string | null;
  bodySl?: string | null; bodyEn?: string | null; bodyDe?: string | null; bodyIt?: string | null;
  titleFr?: string | null; titleNl?: string | null; titleHr?: string | null;
  bodyFr?: string | null; bodyNl?: string | null; bodyHr?: string | null;
  imageUrl?: string | null;
  validFrom: string;
  validTo?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

const suffix = Object.fromEntries(GUIDE_LANGUAGES.map(lang => [lang, lang[0].toUpperCase() + lang.slice(1)])) as Record<AnnouncementLang, string>;

export function normalizeLang(lang: string): AnnouncementLang {
  return guideLanguage(lang);
}

/** Requested language first, then the first filled language in SL → EN → DE → IT order. */
export function localizedField(row: GuestAnnouncement, field: "title" | "body", lang: string): string {
  const order = [normalizeLang(lang), "en", "sl"] as const;
  for (const l of order) {
    const value = (row as unknown as Record<string, unknown>)[`${field}${suffix[l]}`];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const ms = (iso?: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

export function isAnnouncementActive(row: GuestAnnouncement, now: number): boolean {
  if (row.deletedAt) return false;
  const from = ms(row.validFrom);
  if (from === null || now < from) return false;
  const to = ms(row.validTo);
  return to === null || now <= to;
}

/** Active rows, newest first (validFrom, then createdAt). */
export function activeAnnouncements(rows: GuestAnnouncement[] | null | undefined, now: number): GuestAnnouncement[] {
  return (rows ?? [])
    .filter((r) => r && isAnnouncementActive(r, now))
    .sort((a, b) => (ms(b.validFrom) ?? 0) - (ms(a.validFrom) ?? 0) || (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0));
}

/** Next instant (ms) at which visibility of any row changes, or null. */
export function nextVisibilityChange(rows: GuestAnnouncement[] | null | undefined, now: number): number | null {
  let next: number | null = null;
  for (const r of rows ?? []) {
    if (r.deletedAt) continue;
    const from = ms(r.validFrom);
    const to = ms(r.validTo);
    for (const t of [from, to === null ? null : to + 1]) {
      if (t !== null && t > now && (next === null || t < next)) next = t;
    }
  }
  return next;
}

// ---------- device-only read state ----------
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

function store(): KeyValueStore | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export const readStateKey = (tenantKey: string) => `smart360:announcements-read:v1:${tenantKey}`;

export function loadReadIds(tenantKey: string, s: KeyValueStore | null = store()): Set<string> {
  try {
    const raw = s?.getItem(readStateKey(tenantKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch { return new Set(); }
}

/** Marks id read; prunes to ids still known so storage never grows unbounded. */
export function markAnnouncementRead(tenantKey: string, id: string, knownIds: string[], s: KeyValueStore | null = store()): Set<string> {
  const ids = loadReadIds(tenantKey, s);
  ids.add(id);
  const known = new Set([...knownIds, id]);
  const pruned = [...ids].filter((x) => known.has(x));
  try { s?.setItem(readStateKey(tenantKey), JSON.stringify(pruned)); } catch { /* private mode */ }
  return new Set(pruned);
}

export function hasUnread(active: GuestAnnouncement[], readIds: Set<string>): boolean {
  return active.some((r) => !readIds.has(r.id));
}

// ---------- labels ----------
export const ANNOUNCEMENT_COPY = extendCatalog({
  sl: { title: "Obvestila", isNew: "Novo", back: "Nazaj", published: "Objavljeno", validTo: "Velja do", today: "danes", yesterday: "včeraj", empty: "Trenutno ni obvestil.", emptyNote: "Ko gostitelj objavi novico, jo najdete tukaj.", offline: "Brez povezave. Obvestila se prikažejo, ko boste spet na spletu.", error: "Obvestil ni bilo mogoče naložiti.", retry: "Poskusi znova", close: "Zapri" },
  en: { title: "Announcements", isNew: "New", back: "Back", published: "Published", validTo: "Valid until", today: "today", yesterday: "yesterday", empty: "No announcements right now.", emptyNote: "When your host posts news, you will find it here.", offline: "You are offline. Announcements will appear once you are back online.", error: "Announcements could not be loaded.", retry: "Try again", close: "Close" },
  de: { title: "Mitteilungen", isNew: "Neu", back: "Zurück", published: "Veröffentlicht", validTo: "Gültig bis", today: "heute", yesterday: "gestern", empty: "Derzeit keine Mitteilungen.", emptyNote: "Neuigkeiten Ihres Gastgebers finden Sie hier.", offline: "Keine Verbindung. Mitteilungen erscheinen, sobald Sie wieder online sind.", error: "Mitteilungen konnten nicht geladen werden.", retry: "Erneut versuchen", close: "Schließen" },
  it: { title: "Avvisi", isNew: "Nuovo", back: "Indietro", published: "Pubblicato", validTo: "Valido fino al", today: "oggi", yesterday: "ieri", empty: "Al momento non ci sono avvisi.", emptyNote: "Quando il tuo host pubblica una novità, la trovi qui.", offline: "Sei offline. Gli avvisi compariranno appena tornerai online.", error: "Impossibile caricare gli avvisi.", retry: "Riprova", close: "Chiudi" },
});
export const announcementCopy = (lang: string) => ANNOUNCEMENT_COPY[normalizeLang(lang)];

const LOCALE = LANGUAGE_LOCALES;
const TZ = "Europe/Ljubljana";

function dayKey(t: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}
function time(t: number, lang: AnnouncementLang) {
  const s = new Intl.DateTimeFormat(LOCALE[lang], { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(t);
  return lang === "sl" ? s.replace(":", ".") : s;
}

/** Card date: "danes · 8.10", "včeraj", "28. sep." */
export function formatListDate(iso: string, lang: string, now: number): string {
  const l = normalizeLang(lang);
  const t = ms(iso);
  if (t === null) return "";
  const c = ANNOUNCEMENT_COPY[l];
  if (dayKey(t) === dayKey(now)) return `${c.today} · ${time(t, l)}`;
  if (dayKey(t) === dayKey(now - 86_400_000)) return c.yesterday;
  return new Intl.DateTimeFormat(LOCALE[l], { timeZone: TZ, day: "numeric", month: "short" }).format(t);
}

export function formatFullDate(iso: string, lang: string): string {
  const l = normalizeLang(lang);
  const t = ms(iso);
  if (t === null) return "";
  const d = new Intl.DateTimeFormat(LOCALE[l], { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(t);
  return `${d}, ${time(t, l)}`;
}

export function snippet(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()} …` : flat;
}
