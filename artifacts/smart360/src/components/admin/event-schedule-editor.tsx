import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type EventSchedule = {
  type: "once" | "weekly";
  date?: string;
  days?: Weekday[];
  timeFrom: string;
  timeTo: string;
  validFrom?: string;
  validTo?: string;
  locationText?: string;
  ageText?: string;
  inCamp?: boolean;
};

// Keep empty inputs in the local draft, not in the published schedule.
export type ScheduleDraft = {
  type: "once" | "weekly";
  date: string;
  days: Weekday[];
  timeFrom: string;
  timeTo: string;
  validFrom: string;
  validTo: string;
  locationText: string;
  ageText: string;
  inCamp: "yes" | "no" | "";
};

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Pon" }, { key: "tue", label: "Tor" },
  { key: "wed", label: "Sre" }, { key: "thu", label: "Čet" },
  { key: "fri", label: "Pet" }, { key: "sat", label: "Sob" },
  { key: "sun", label: "Ned" },
];

export function scheduleDraft(schedule?: EventSchedule | null, legacyStart?: string | null): ScheduleDraft {
  let date = "";
  let timeFrom = "";
  if (legacyStart) {
    // A naive timestamp represents Ljubljana wall time; an offset/Z timestamp
    // must be converted to Ljubljana before taking its calendar date and time.
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?!.*(?:Z|[+-]\d\d:?\d\d)$)/i.test(legacyStart)) {
      date = legacyStart.slice(0, 10);
      timeFrom = legacyStart.slice(11, 16);
    } else {
      const parsed = new Date(legacyStart);
      if (Number.isFinite(parsed.getTime())) {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit",
          day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(parsed);
        const part = (kind: string) => parts.find((p) => p.type === kind)?.value ?? "";
        date = `${part("year")}-${part("month")}-${part("day")}`;
        timeFrom = `${part("hour")}:${part("minute")}`;
      }
    }
  }
  return {
    type: schedule?.type ?? "once",
    date: schedule?.date ?? date,
    days: schedule?.days ?? [],
    timeFrom: schedule?.timeFrom ?? timeFrom,
    timeTo: schedule?.timeTo ?? "",
    validFrom: schedule?.validFrom ?? "",
    validTo: schedule?.validTo ?? "",
    locationText: schedule?.locationText ?? "",
    ageText: schedule?.ageText ?? "",
    inCamp: schedule?.inCamp === true ? "yes" : schedule?.inCamp === false ? "no" : "",
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateSchedule(draft: ScheduleDraft): string | null {
  if (draft.type === "once" && !validDate(draft.date)) return "Izberite veljaven datum dogodka.";
  if (draft.type === "weekly" && draft.days.length === 0) return "Izberite vsaj en dan v tednu.";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.timeFrom) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.timeTo)) {
    return "Vnesite začetek in konec dogodka (ure in minute).";
  }
  if (draft.timeTo <= draft.timeFrom) return "Konec dogodka mora biti pozneje kot začetek istega dne.";
  if (draft.type === "weekly") {
    if (draft.validFrom && !validDate(draft.validFrom)) return "Začetek sezone mora biti veljaven datum.";
    if (draft.validTo && !validDate(draft.validTo)) return "Konec sezone mora biti veljaven datum.";
    if (draft.validFrom && draft.validTo && draft.validTo < draft.validFrom) {
      return "Konec sezone mora biti po začetku sezone.";
    }
  }
  return null;
}

export function scheduleFromDraft(draft: ScheduleDraft): EventSchedule {
  return {
    type: draft.type,
    ...(draft.type === "once" ? { date: draft.date } : {
      days: WEEKDAYS.map(({ key }) => key).filter((day) => draft.days.includes(day)),
      ...(draft.validFrom ? { validFrom: draft.validFrom } : {}),
      ...(draft.validTo ? { validTo: draft.validTo } : {}),
    }),
    timeFrom: draft.timeFrom,
    timeTo: draft.timeTo,
    ...(draft.locationText.trim() ? { locationText: draft.locationText.trim() } : {}),
    ...(draft.ageText.trim() ? { ageText: draft.ageText.trim() } : {}),
    ...(draft.inCamp ? { inCamp: draft.inCamp === "yes" } : {}),
  };
}

export function EventScheduleEditor({ draft, onChange, disabled, error }: {
  draft: ScheduleDraft;
  onChange: Dispatch<SetStateAction<ScheduleDraft>>;
  disabled?: boolean;
  error?: string;
}) {
  const set = (patch: Partial<ScheduleDraft>) => onChange((current) => ({ ...current, ...patch }));
  return (
    <section data-testid="event-schedule-editor" className="space-y-4 rounded-2xl border border-[#E9D8B5] bg-[#FFFBF3] p-4">
      <div>
        <h3 className="text-base font-bold text-[#17241C]">Termin</h3>
        <p className="text-xs text-[#66716A]">Čas dogodka je po lokalnem času (Slovenija).</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vrsta dogodka">
        {([{ type: "once", label: "Enkratni dogodek" }, { type: "weekly", label: "Tedenski" }] as const).map(({ type, label }) => (
          <button key={type} type="button" aria-pressed={draft.type === type} disabled={disabled}
            className={`rounded-xl border px-2 py-2 text-sm font-semibold ${draft.type === type ? "border-[#DD9A2B] bg-[#DD9A2B] text-white" : "border-[#D7DAD3] bg-white text-[#25332A]"}`}
            onClick={() => set({ type })}>{label}</button>
        ))}
      </div>
      {draft.type === "once" ? (
        <div className="space-y-1"><Label htmlFor="event-schedule-date">Datum dogodka</Label>
          <Input id="event-schedule-date" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} disabled={disabled} /></div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Dnevi v tednu</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dnevi v tednu">
              {WEEKDAYS.map(({ key, label }) => <button key={key} type="button"
                aria-pressed={draft.days.includes(key)} disabled={disabled}
                className={`min-w-10 rounded-full border px-2 py-2 text-xs font-semibold ${draft.days.includes(key) ? "border-[#DD9A2B] bg-[#DD9A2B] text-white" : "border-[#D7DAD3] bg-white"}`}
                onClick={() => set({ days: draft.days.includes(key) ? draft.days.filter((day) => day !== key) : [...draft.days, key] })}>{label}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="event-valid-from">Sezona od (neobvezno)</Label><Input id="event-valid-from" type="date" value={draft.validFrom} onChange={(e) => set({ validFrom: e.target.value })} disabled={disabled} /></div>
            <div className="space-y-1"><Label htmlFor="event-valid-to">Sezona do (neobvezno)</Label><Input id="event-valid-to" type="date" value={draft.validTo} onChange={(e) => set({ validTo: e.target.value })} disabled={disabled} /></div>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="event-time-from">Od</Label><Input id="event-time-from" type="time" value={draft.timeFrom} onChange={(e) => set({ timeFrom: e.target.value })} disabled={disabled} /></div>
        <div className="space-y-1"><Label htmlFor="event-time-to">Do</Label><Input id="event-time-to" type="time" value={draft.timeTo} onChange={(e) => set({ timeTo: e.target.value })} disabled={disabled} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="event-location">Lokacija (neobvezno)</Label><Input id="event-location" value={draft.locationText} onChange={(e) => set({ locationText: e.target.value })} disabled={disabled} /></div>
        <div className="space-y-1"><Label htmlFor="event-age">Starost (neobvezno)</Label><Input id="event-age" placeholder="npr. 18+" value={draft.ageText} onChange={(e) => set({ ageText: e.target.value })} disabled={disabled} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="event-in-camp">Kje poteka (neobvezno)</Label>
        <select id="event-in-camp" className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={draft.inCamp} onChange={(e) => set({ inCamp: e.target.value as ScheduleDraft["inCamp"] })} disabled={disabled}>
          <option value="">Ni določeno</option><option value="yes">V kampu</option><option value="no">V okolici</option>
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}