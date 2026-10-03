import type { Announcement } from "@workspace/api-client-react";

/** Admin wall-clock inputs are always Ljubljana time, never browser-local time. */
export const ANNOUNCEMENT_TIME_ZONE = "Europe/Ljubljana";
import { GUIDE_LANGUAGES, type GuideLanguage } from "@workspace/guide-languages";
export const ANNOUNCEMENT_LANGUAGES = GUIDE_LANGUAGES.map(lang => lang[0].toUpperCase() + lang.slice(1)) as Capitalize<GuideLanguage>[];
export type AnnouncementLanguage = typeof ANNOUNCEMENT_LANGUAGES[number];
export type AnnouncementFields = Partial<Record<`title${AnnouncementLanguage}` | `body${AnnouncementLanguage}`, string | null>>;
export type AdminAnnouncement = Announcement;
export type WallClockOccurrence = "earlier" | "later";
export type AnnouncementDraft = Record<`title${AnnouncementLanguage}` | `body${AnnouncementLanguage}`, string> & {
  imageUrl: string;
  validFrom: string;
  validTo: string;
  fromOccurrence: WallClockOccurrence;
  toOccurrence: WallClockOccurrence;
};
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANNOUNCEMENT_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function announcementWallClock(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Zero candidates during the spring gap, two during the autumn repeated hour. */
export function announcementWallClockCandidates(value: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return [];
  const [, year, month, day, hour, minute] = match.map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return [];
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(nominal);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return [];
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const probe = nominal + hours * 3_600_000;
    const wall = announcementWallClock(new Date(probe).toISOString());
    offsets.add(Date.parse(`${wall}:00Z`) - probe);
  }
  return [...offsets].map((offset) => new Date(nominal - offset).toISOString())
    .filter((iso) => announcementWallClock(iso) === value).sort();
}

export function announcementWallClockToIso(value: string, occurrence: WallClockOccurrence): string {
  const candidates = announcementWallClockCandidates(value);
  if (!candidates.length) throw new Error("Čas ni veljaven v Europe/Ljubljana. Ob prehodu na poletni čas ura med 02.00 in 03.00 ne obstaja.");
  return occurrence === "later" ? candidates[candidates.length - 1]! : candidates[0]!;
}

function occurrenceFor(iso: string | null | undefined): WallClockOccurrence {
  if (!iso) return "earlier";
  const candidates = announcementWallClockCandidates(announcementWallClock(iso));
  return candidates.length > 1 && Date.parse(iso) >= Date.parse(candidates[1]!) ? "later" : "earlier";
}

export function announcementDraft(row?: AdminAnnouncement, now = new Date().toISOString()): AnnouncementDraft {
  const fields = Object.fromEntries(ANNOUNCEMENT_LANGUAGES.flatMap((lang) =>
    [["title" + lang, row?.[`title${lang}`] ?? ""], ["body" + lang, row?.[`body${lang}`] ?? ""]],
  )) as Pick<AnnouncementDraft, keyof AnnouncementFields>;
  return {
    ...fields, imageUrl: row?.imageUrl ?? "",
    validFrom: announcementWallClock(row?.validFrom ?? now),
    validTo: row?.validTo ? announcementWallClock(row.validTo) : "",
    fromOccurrence: occurrenceFor(row?.validFrom), toOccurrence: occurrenceFor(row?.validTo),
  };
}

export function announcementSavePayload(draft: AnnouncementDraft, previous?: AdminAnnouncement) {
  // Keep the original instant/seconds when an existing minute-granularity input
  // has not changed, including the selected occurrence of the repeated hour.
  const convert = (wall: string, occurrence: WallClockOccurrence, original?: string | null) =>
    original && announcementWallClock(original) === wall && occurrenceFor(original) === occurrence
      ? original : announcementWallClockToIso(wall, occurrence);
  const validFrom = convert(draft.validFrom, draft.fromOccurrence, previous?.validFrom);
  const validTo = draft.validTo ? convert(draft.validTo, draft.toOccurrence, previous?.validTo) : null;
  if (validTo && Date.parse(validTo) < Date.parse(validFrom)) throw new Error("Velja do ne sme biti pred začetkom veljavnosti.");
  const fields = Object.fromEntries(ANNOUNCEMENT_LANGUAGES.flatMap((lang) =>
    [`title${lang}`, `body${lang}`].map((key) => [key, draft[key as keyof AnnouncementFields].trim() || null]),
  )) as AnnouncementFields;
  if (!ANNOUNCEMENT_LANGUAGES.some((lang) => fields[`title${lang}`])) throw new Error("Vnesite naslov v vsaj enem jeziku.");
  if (!ANNOUNCEMENT_LANGUAGES.some((lang) => fields[`body${lang}`])) throw new Error("Vnesite besedilo v vsaj enem jeziku.");
  return { ...fields, imageUrl: draft.imageUrl.trim() || null, validFrom, validTo };
}

export function announcementAdminTitle(row: AnnouncementFields): string {
  return ANNOUNCEMENT_LANGUAGES.map((lang) => row[`title${lang}`]?.trim()).find(Boolean) ?? "Obvestilo";
}

export function announcementAdminStatus(row: Pick<AdminAnnouncement, "validFrom" | "validTo" | "deletedAt">, now = Date.now()): string {
  if (row.deletedAt) return "Izbrisano";
  if (Date.parse(row.validFrom) > now) return "Načrtovano";
  if (row.validTo && Date.parse(row.validTo) < now) return "Poteklo";
  return "Aktivno";
}