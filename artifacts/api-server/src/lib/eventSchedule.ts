import { sanitizePlain } from "./sanitizeBody";
import type { EventSchedule } from "@workspace/db";

const weekdays = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const keys = new Set(["type", "date", "days", "timeFrom", "timeTo", "validFrom", "validTo", "locationText", "ageText", "inCamp"]);

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y!, m! - 1, d!);
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

/** Reject malformed or unknown schedule data rather than letting Zod strip it silently. */
export function validateEventSchedule(value: unknown): { success: true; data: EventSchedule | null } | { success: false; error: string } {
  if (value === null) return { success: true, data: null };
  const fail = (error: string) => ({ success: false as const, error: `Neveljaven termin: ${error}` });
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("pričakovan je objekt.");
  const schedule = value as Record<string, unknown>;
  if (Object.keys(schedule).some((key) => !keys.has(key))) return fail("neznano polje.");
  if (schedule.type !== "once" && schedule.type !== "weekly") return fail("vrsta mora biti once ali weekly.");
  if (schedule.type === "once") {
    if (!validDate(schedule.date) || "days" in schedule) return fail("enkratni dogodek zahteva veljaven datum brez dni.");
  } else {
    if ("date" in schedule || !Array.isArray(schedule.days) || !schedule.days.length ||
      schedule.days.some((day) => typeof day !== "string" || !weekdays.has(day)) ||
      new Set(schedule.days).size !== schedule.days.length) return fail("tedenski dogodek zahteva vsaj en različen dan brez datuma.");
  }
  const validTime = (time: unknown): time is string => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!validTime(schedule.timeFrom) || !validTime(schedule.timeTo) || schedule.timeTo <= schedule.timeFrom) {
    return fail("obvezni čas od–do mora biti HH:MM, konec pa isti dan pozneje od začetka.");
  }
  if (("validFrom" in schedule && !validDate(schedule.validFrom)) ||
    ("validTo" in schedule && !validDate(schedule.validTo)) ||
    (typeof schedule.validFrom === "string" && typeof schedule.validTo === "string" && schedule.validFrom > schedule.validTo)) {
    return fail("sezona mora imeti veljavna datuma v pravilnem vrstnem redu.");
  }
  if (schedule.type === "once" && ((typeof schedule.validFrom === "string" && (schedule.date as string) < schedule.validFrom) ||
    (typeof schedule.validTo === "string" && (schedule.date as string) > schedule.validTo))) return fail("datum je izven sezone.");
  for (const [key, max] of [["locationText", 500], ["ageText", 200]] as const) {
    if (key in schedule && (typeof schedule[key] !== "string" || (schedule[key] as string).length > max)) {
      return fail(`${key} mora biti besedilo do ${max} znakov.`);
    }
  }
  if ("inCamp" in schedule && typeof schedule.inCamp !== "boolean") return fail("inCamp mora biti boolean.");
  const data = { ...schedule };
  for (const key of ["locationText", "ageText"]) {
    if (typeof data[key] === "string") data[key] = sanitizePlain(data[key] as string);
  }
  return { success: true, data: data as EventSchedule };
}