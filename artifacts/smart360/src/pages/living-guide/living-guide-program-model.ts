/**
 * Living Guide guest programme model (pure, no DOM).
 * One source of truth for Home "Danes", the nav resolver and the Program view.
 * All calendar arithmetic is done on Europe/Ljubljana date keys (YYYY-MM-DD)
 * using UTC-only Date math, so the device timezone never shifts a day.
 */

export const PROGRAM_TZ = "Europe/Ljubljana";
export type DayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_CODES: DayCode[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export type ProgramLang = "sl" | "en" | "de" | "it";
export type ProgramFilter = "all" | "in" | "out";

export type EventSchedule = {
  type: "once" | "weekly";
  date?: string;
  days?: DayCode[];
  timeFrom: string;
  timeTo: string;
  validFrom?: string;
  validTo?: string;
  locationText?: string;
  ageText?: string;
  inCamp?: boolean;
};

/** Normalised programme entry: either a real schedule or a legacy eventStart. */
export type ProgramEvent = {
  kind: "schedule" | "legacy";
  type: "once" | "weekly";
  date: string | null;
  days: DayCode[];
  timeFrom: string;
  timeTo: string | null;
  validFrom: string | null;
  validTo: string | null;
  locationText: string | null;
  ageText: string | null;
  inCamp: boolean | undefined;
};

export type ProgramOccurrence = { item: any; event: ProgramEvent; date: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/* ---------- Dev-only clock override (fixture) ---------- */
let todayOverride: string | null = null;
export function setProgramTodayOverride(value: string | null): void {
  todayOverride = isDateKey(value) ? value : null;
}

/* ---------- Date keys ---------- */
const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROGRAM_TZ, year: "numeric", month: "2-digit", day: "2-digit",
});
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PROGRAM_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function ljubljanaDateKey(instant: Date): string {
  const parts = keyFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function programToday(now = new Date()): string {
  return todayOverride ?? ljubljanaDateKey(now);
}
function toUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
export function addDays(key: string, days: number): string {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function dayCodeOf(key: string): DayCode {
  return DAY_CODES[(toUtc(key).getUTCDay() + 6) % 7]!;
}
export function mondayOf(key: string): string {
  return addDays(key, -DAY_CODES.indexOf(dayCodeOf(key)));
}

/* ---------- Parsing ---------- */
export function normalizeEventSchedule(raw: unknown): EventSchedule | null {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (s.type !== "once" && s.type !== "weekly") return null;
  if (typeof s.timeFrom !== "string" || !TIME_RE.test(s.timeFrom)) return null;
  if (typeof s.timeTo !== "string" || !TIME_RE.test(s.timeTo)) return null;
  if (s.timeTo <= s.timeFrom) return null;
  const out: EventSchedule = { type: s.type, timeFrom: s.timeFrom, timeTo: s.timeTo };
  if (s.type === "once") {
    if (!isDateKey(s.date)) return null;
    out.date = s.date;
  } else {
    const days = Array.isArray(s.days)
      ? DAY_CODES.filter((code) => (s.days as unknown[]).includes(code))
      : [];
    if (days.length === 0) return null;
    out.days = days;
    if (isDateKey(s.validFrom)) out.validFrom = s.validFrom;
    if (isDateKey(s.validTo)) out.validTo = s.validTo;
  }
  const loc = text(s.locationText); if (loc) out.locationText = loc;
  const age = text(s.ageText); if (age) out.ageText = age;
  if (typeof s.inCamp === "boolean") out.inCamp = s.inCamp;
  return out;
}

/**
 * Legacy eventStart → Ljubljana date + HH:MM. Naive timestamps are Ljubljana
 * wall time; timestamps with Z/offset are converted. Never guesses an end.
 */
export function parseLegacyEventStart(value: unknown): { date: string; time: string } | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return { date: ljubljanaDateKey(value), time: clockFormatter.format(value) };
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  const naive = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/.exec(v);
  if (naive) {
    if (!isDateKey(naive[1])) return null;
    return { date: naive[1]!, time: naive[2] ? `${naive[2]}:${naive[3]}` : "" };
  }
  const instant = new Date(v);
  if (!Number.isFinite(instant.getTime())) return null;
  return { date: ljubljanaDateKey(instant), time: clockFormatter.format(instant) };
}

export function programEventOf(item: any): ProgramEvent | null {
  const schedule = normalizeEventSchedule(item?.eventSchedule);
  if (schedule) {
    return {
      kind: "schedule",
      type: schedule.type,
      date: schedule.date ?? null,
      days: schedule.type === "once" && schedule.date ? [dayCodeOf(schedule.date)] : schedule.days ?? [],
      timeFrom: schedule.timeFrom,
      timeTo: schedule.timeTo,
      validFrom: schedule.validFrom ?? null,
      validTo: schedule.validTo ?? null,
      locationText: schedule.locationText ?? null,
      ageText: schedule.ageText ?? null,
      inCamp: schedule.inCamp,
    };
  }
  const legacy = parseLegacyEventStart(
    item?.eventStart ?? item?.startsAt ?? item?.startAt ?? item?.startDate ?? null,
  );
  if (!legacy) return null;
  return {
    kind: "legacy", type: "once", date: legacy.date, days: [dayCodeOf(legacy.date)],
    timeFrom: legacy.time, timeTo: null, validFrom: null, validTo: null,
    locationText: null, ageText: null, inCamp: undefined,
  };
}

export function occursOn(event: ProgramEvent, key: string): boolean {
  if (event.type === "once") return event.date === key;
  if (event.validFrom && key < event.validFrom) return false;
  if (event.validTo && key > event.validTo) return false;
  return event.days.includes(dayCodeOf(key));
}

function visibleRows(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row && row.isVisible !== false && !row.deletedAt);
}

export function isProgramCategory(category: any, section?: any): boolean {
  return (
    category?.layout === "events" ||
    category?.key === "events" ||
    section?.key === "events" ||
    section?.key === "program"
  );
}

export function programItems(category: any): { item: any; event: ProgramEvent }[] {
  return visibleRows(category?.items)
    .map((item) => ({ item, event: programEventOf(item) }))
    .filter((row): row is { item: any; event: ProgramEvent } => row.event !== null);
}

export function matchesFilter(event: ProgramEvent, filter: ProgramFilter): boolean {
  if (filter === "in") return event.inCamp === true;
  if (filter === "out") return event.inCamp === false;
  return true;
}

export function occurrencesOn(
  rows: { item: any; event: ProgramEvent }[],
  key: string,
  filter: ProgramFilter = "all",
): ProgramOccurrence[] {
  return rows
    .filter(({ event }) => occursOn(event, key) && matchesFilter(event, filter))
    .map(({ item, event }) => ({ item, event, date: key }))
    .sort((a, b) =>
      a.event.timeFrom.localeCompare(b.event.timeFrom) ||
      String(a.item?.title ?? "").localeCompare(String(b.item?.title ?? "")),
    );
}

export type WeekCell = { date: string; code: DayCode; dayOfMonth: number; hasEvents: boolean };
export function buildWeek(
  rows: { item: any; event: ProgramEvent }[],
  anyDayInWeek: string,
  filter: ProgramFilter = "all",
): WeekCell[] {
  const monday = mondayOf(anyDayInWeek);
  return DAY_CODES.map((code, index) => {
    const date = addDays(monday, index);
    return {
      date, code, dayOfMonth: Number(date.slice(8, 10)),
      hasEvents: occurrencesOn(rows, date, filter).length > 0,
    };
  });
}

/** Next occurrence on/after `from` (bounded search), for detail without a chosen day. */
export function nextOccurrence(event: ProgramEvent, from: string, horizonDays = 400): string | null {
  if (event.type === "once") return event.date;
  // A future season must not disappear merely because it starts beyond the
  // bounded search window. Jump to its beginning before scanning weekdays.
  const start = event.validFrom && event.validFrom > from ? event.validFrom : from;
  for (let i = 0; i < horizonDays; i++) {
    const key = addDays(start, i);
    if (event.validTo && key > event.validTo) return null;
    if (occursOn(event, key)) return key;
  }
  return null;
}

/* ---------- Labels (SL/EN/DE/IT) ---------- */
export function programLang(lang: string): ProgramLang {
  return lang === "en" || lang === "de" || lang === "it" ? lang : "sl";
}
const DAY2: Record<ProgramLang, string[]> = {
  sl: ["po", "to", "sr", "če", "pe", "so", "ne"],
  en: ["mo", "tu", "we", "th", "fr", "sa", "su"],
  de: ["mo", "di", "mi", "do", "fr", "sa", "so"],
  it: ["lu", "ma", "me", "gi", "ve", "sa", "do"],
};
const DAY3: Record<ProgramLang, string[]> = {
  sl: ["pon", "tor", "sre", "čet", "pet", "sob", "ned"],
  en: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  de: ["mo", "di", "mi", "do", "fr", "sa", "so"],
  it: ["lun", "mar", "mer", "gio", "ven", "sab", "dom"],
};
export const PROGRAM_LABELS: Record<ProgramLang, Record<string, string>> = {
  sl: { title: "Program", all: "Vse", in: "V kampu", out: "V okolici", daily: "vsak dan", time: "Ura", where: "Kje", location: "Lokacija", age: "Starost", price: "Cena", signup: "Prijava prek sporočil", empty: "Ta dan ni programa.", emptyFilter: "Ni dogodkov za ta filter.", prevWeek: "Prejšnji teden", nextWeek: "Naslednji teden", back: "Nazaj", more: "več", notePrefix: "Prijava" },
  en: { title: "Programme", all: "All", in: "In camp", out: "Nearby", daily: "daily", time: "Time", where: "Where", location: "Location", age: "Age", price: "Price", signup: "Sign up via messages", empty: "No programme on this day.", emptyFilter: "No events for this filter.", prevWeek: "Previous week", nextWeek: "Next week", back: "Back", more: "more", notePrefix: "Sign-up" },
  de: { title: "Programm", all: "Alle", in: "Im Camp", out: "In der Umgebung", daily: "täglich", time: "Uhrzeit", where: "Wo", location: "Ort", age: "Alter", price: "Preis", signup: "Anmeldung per Nachricht", empty: "An diesem Tag kein Programm.", emptyFilter: "Keine Veranstaltungen für diesen Filter.", prevWeek: "Vorherige Woche", nextWeek: "Nächste Woche", back: "Zurück", more: "mehr", notePrefix: "Anmeldung" },
  it: { title: "Programma", all: "Tutti", in: "In campeggio", out: "Nei dintorni", daily: "ogni giorno", time: "Ora", where: "Dove", location: "Luogo", age: "Età", price: "Prezzo", signup: "Iscrizione tramite messaggi", empty: "Nessun programma in questo giorno.", emptyFilter: "Nessun evento per questo filtro.", prevWeek: "Settimana precedente", nextWeek: "Settimana successiva", back: "Indietro", more: "altro", notePrefix: "Iscrizione" },
};
export function programLabel(lang: string, key: string): string {
  return PROGRAM_LABELS[programLang(lang)][key] ?? PROGRAM_LABELS.sl[key] ?? key;
}
export function dayShort2(code: DayCode, lang: string): string {
  return DAY2[programLang(lang)][DAY_CODES.indexOf(code)]!;
}
export function dayShort3(code: DayCode, lang: string): string {
  return DAY3[programLang(lang)][DAY_CODES.indexOf(code)]!;
}

/** "vsak dan" for all seven, "čet–ned" for a contiguous run ≥3, else comma list. Null for once. */
export function recurrenceHint(event: ProgramEvent, lang: string): string | null {
  if (event.type !== "weekly") return null;
  const idx = event.days.map((d) => DAY_CODES.indexOf(d)).sort((a, b) => a - b);
  if (idx.length === 7) return programLabel(lang, "daily");
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
  if (contiguous && idx.length >= 3) {
    return `${dayShort3(DAY_CODES[idx[0]!]!, lang)}–${dayShort3(DAY_CODES[idx[idx.length - 1]!]!, lang)}`;
  }
  return idx.map((i) => dayShort3(DAY_CODES[i]!, lang)).join(", ");
}

export function formatClock(value: string, lang: string): string {
  if (!value) return "";
  const [h, m] = value.split(":");
  return `${Number(h)}${programLang(lang) === "sl" ? "." : ":"}${m}`;
}
export function formatTimeRange(event: ProgramEvent, lang: string): string {
  const from = formatClock(event.timeFrom, lang);
  return event.timeTo ? `${from}–${formatClock(event.timeTo, lang)}` : from;
}

const LOCALE: Record<ProgramLang, string> = { sl: "sl-SI", en: "en-GB", de: "de-DE", it: "it-IT" };
function monthName(key: string, lang: string): string {
  return new Intl.DateTimeFormat(LOCALE[programLang(lang)], { month: "long", timeZone: "UTC" }).format(toUtc(key));
}
function dayNum(key: string, lang: string): string {
  const n = String(Number(key.slice(8, 10)));
  return programLang(lang) === "sl" || programLang(lang) === "de" ? `${n}.` : n;
}
/** "18.–24. avgust" / "18–24 August"; cross-month keeps both months. */
export function weekRangeLabel(anyDayInWeek: string, lang: string): string {
  const start = mondayOf(anyDayInWeek);
  const end = addDays(start, 6);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${dayNum(start, lang)}–${dayNum(end, lang)} ${monthName(end, lang)}`;
  }
  return `${dayNum(start, lang)} ${monthName(start, lang)} – ${dayNum(end, lang)} ${monthName(end, lang)}`;
}
export function formatOccurrenceDate(key: string, lang: string): string {
  const l = programLang(lang);
  const weekday = new Intl.DateTimeFormat(LOCALE[l], { weekday: "long", timeZone: "UTC" }).format(toUtc(key));
  return `${weekday}, ${dayNum(key, lang)} ${monthName(key, lang)} ${key.slice(0, 4)}`;
}

/** Note prefilled into the existing order/message flow (no new order fields). */
export function signupNote(title: string, date: string | null, event: ProgramEvent, lang: string): string {
  const when = [date ? formatOccurrenceDate(date, lang) : null, formatTimeRange(event, lang)].filter(Boolean).join(", ");
  return `${programLabel(lang, "notePrefix")}: ${title}${when ? ` — ${when}` : ""}`;
}

/* ---------- Session UI memory (selected day/filter survive list ↔ detail) ---------- */
export const programUiState: { selectedDate: string | null; filter: ProgramFilter } = {
  selectedDate: null,
  filter: "all",
};

/** Prefill survives the sign-in detour but never leaks onto a different item. */
export function orderPrefillNoteFor(prefill: { itemId: string; note: string } | null, itemId: string): string {
  return prefill && prefill.itemId === itemId ? prefill.note : "";
}
