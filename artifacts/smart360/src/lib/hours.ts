// "Danes 12:00–22:00" pod postavko — beseda sledi jeziku gosta.
const TODAY: Record<string, string> = { sl: "Danes", en: "Today", de: "Heute", it: "Oggi" };
const CLOSED: Record<string, string> = { sl: "Danes zaprto", en: "Closed today", de: "Heute geschlossen", it: "Oggi chiuso" };

type HoursRange = [number, number] | null;

export type OpenStatus = {
  isOpen: boolean;
  closesAt: string | null;
  opensAt: string | null;
};

function parseHours(hoursJson?: string | null): HoursRange[] | null {
  if (!hoursJson) return null;
  try {
    const parsed = JSON.parse(hoursJson);
    if (!Array.isArray(parsed) || parsed.length !== 7) return null;
    return parsed.map((entry) => {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        !entry.every((part) => typeof part === "number" && Number.isFinite(part))
      ) {
        return null;
      }
      return [entry[0], entry[1]];
    });
  } catch {
    return null;
  }
}

function formatMinutes(totalMinutes: number): string {
  const clockMinutes = ((Math.trunc(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(clockMinutes / 60);
  const minutes = clockMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function effectiveClose([openMinutes, closeMinutes]: [number, number]): number {
  return closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes;
}

export function getOpenStatus(
  hoursJson?: string | null,
  now = new Date(),
): OpenStatus | null {
  const hours = parseHours(hoursJson);
  if (!hours) return null;

  const dayIndex = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = hours[dayIndex];
  if (
    today &&
    currentMinutes >= today[0] &&
    currentMinutes < effectiveClose(today)
  ) {
    return {
      isOpen: true,
      closesAt: formatMinutes(today[1]),
      opensAt: null,
    };
  }

  const previous = hours[(dayIndex + 6) % 7];
  const previousDayMinutes = currentMinutes + 1440;
  if (
    previous &&
    previousDayMinutes >= previous[0] &&
    previousDayMinutes < effectiveClose(previous)
  ) {
    return {
      isOpen: true,
      closesAt: formatMinutes(previous[1]),
      opensAt: null,
    };
  }

  if (today && currentMinutes < today[0]) {
    return {
      isOpen: false,
      closesAt: null,
      opensAt: formatMinutes(today[0]),
    };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextRange = hours[(dayIndex + offset) % 7];
    if (nextRange) {
      return {
        isOpen: false,
        closesAt: null,
        opensAt: formatMinutes(nextRange[0]),
      };
    }
  }

  return { isOpen: false, closesAt: null, opensAt: null };
}

export function formatTodayHours(hoursJson?: string | null, lang = "sl"): string | null {
  const hours = parseHours(hoursJson);
  if (!hours) return null;
  try {
    // JS Date.getDay() -> 0 = Sun, 1 = Mon ... 6 = Sat
    // hoursJson -> 0 = Mon, 1 = Tue ... 6 = Sun
    const jsDay = new Date().getDay();
    const targetIdx = jsDay === 0 ? 6 : jsDay - 1;
    
    const today = hours[targetIdx];
    if (!today) return CLOSED[lang] ?? CLOSED.sl!;
    
    const [openMin, closeMin] = today;
    return `${TODAY[lang] ?? TODAY.sl} ${formatMinutes(openMin)}–${formatMinutes(closeMin)}`;
  } catch (e) {
    return null;
  }
}
