import { CreateTenantAnnouncementBody, UpdateTenantAnnouncementBody } from "@workspace/api-zod";
import type { TenantAnnouncement } from "@workspace/db";

import { GUIDE_LANGUAGES, type GuideLanguage } from "@workspace/guide-languages";
export const ANNOUNCEMENT_LANG_FIELDS = GUIDE_LANGUAGES.flatMap(lang => {
  const suffix = lang[0].toUpperCase() + lang.slice(1);
  return [`title${suffix}`, `body${suffix}`];
}) as (`title${Capitalize<GuideLanguage>}` | `body${Capitalize<GuideLanguage>}`)[];

type AnnouncementWrite = ReturnType<typeof CreateTenantAnnouncementBody.parse>;
type Validation = { ok: true; data: AnnouncementWrite } | { ok: false; error: string };

/** Strict server boundary: server-owned ids/timestamps and unknown keys are never writable. */
export function parseAnnouncementWrite(raw: unknown, patch = false): Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Neveljavno obvestilo." };
  }
  for (const key of ["validFrom", "validTo"] as const) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined || (key === "validTo" && value === null)) continue;
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value))) {
      return { ok: false, error: "Čas mora biti veljaven ISO datum s časovnim pasom." };
    }
  }
  const schema = patch ? UpdateTenantAnnouncementBody : CreateTenantAnnouncementBody;
  const result = schema.strict().safeParse(raw);
  if (!result.success) return { ok: false, error: "Preverite vsebino in dovoljena polja obvestila." };
  const data = result.data;
  for (const key of ANNOUNCEMENT_LANG_FIELDS) {
    if (typeof data[key] === "string") data[key] = data[key]!.trim() || null;
  }
  if (typeof data.imageUrl === "string") {
    data.imageUrl = data.imageUrl.trim() || null;
    if (data.imageUrl && !/^\/api\/storage\/img\/[^/?#]+\/[^/?#]+$/.test(data.imageUrl) &&
        !/^https:\/\/[^/\s]+(?:\/[^\s]*)?$/.test(data.imageUrl)) {
      return { ok: false, error: "Slika mora uporabljati varen HTTPS naslov ali obstoječo shrambo." };
    }
  }
  return { ok: true, data };
}

/** Check the merged row, not only a PATCH's fields. */
export function announcementContentError(
  row: Pick<TenantAnnouncement, "validFrom" | "validTo"> &
    Partial<Pick<TenantAnnouncement, typeof ANNOUNCEMENT_LANG_FIELDS[number]>>,
): string | null {
  if (![row.titleSl, row.titleEn, row.titleDe, row.titleIt].some((x) => x?.trim())) {
    return "Vnesite naslov v vsaj enem jeziku.";
  }
  if (![row.bodySl, row.bodyEn, row.bodyDe, row.bodyIt].some((x) => x?.trim())) {
    return "Vnesite besedilo v vsaj enem jeziku.";
  }
  if (row.validTo && row.validTo < row.validFrom) return "Velja do ne sme biti pred začetkom veljavnosti.";
  return null;
}

export function announcementActiveAt(
  row: Pick<TenantAnnouncement, "validFrom" | "validTo" | "deletedAt">, at: Date,
): boolean {
  return row.deletedAt === null && row.validFrom <= at && (row.validTo === null || at <= row.validTo);
}

/** Deterministic first-filled language fallback; no translation pipeline or snapshot. */
export function announcementText(
  row: Partial<Pick<TenantAnnouncement, typeof ANNOUNCEMENT_LANG_FIELDS[number]>>,
  field: "title" | "body", lang: string,
): string {
  const suffixes = ["Sl", "En", "De", "It"] as const;
  const selected = suffixes.find((s) => s.toLowerCase() === lang) ?? "Sl";
  const keys = [selected, ...suffixes.filter((s) => s !== selected)];
  for (const suffix of keys) {
    const value = row[`${field}${suffix}`];
    if (value?.trim()) return value;
  }
  return "";
}