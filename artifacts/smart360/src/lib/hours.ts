// "Danes 12:00–22:00" pod postavko — beseda sledi jeziku gosta.
const TODAY: Record<string, string> = { sl: "Danes", en: "Today", de: "Heute", it: "Oggi" };
const CLOSED: Record<string, string> = { sl: "Danes zaprto", en: "Closed today", de: "Heute geschlossen", it: "Oggi chiuso" };

export function formatTodayHours(hoursJson?: string | null, lang = "sl"): string | null {
  if (!hoursJson) return null;
  try {
    const hours = JSON.parse(hoursJson);
    if (!Array.isArray(hours) || hours.length !== 7) return null;
    
    // JS Date.getDay() -> 0 = Sun, 1 = Mon ... 6 = Sat
    // hoursJson -> 0 = Mon, 1 = Tue ... 6 = Sun
    const jsDay = new Date().getDay();
    const targetIdx = jsDay === 0 ? 6 : jsDay - 1;
    
    const today = hours[targetIdx];
    if (!today) return CLOSED[lang] ?? CLOSED.sl!;
    
    const [openMin, closeMin] = today;
    const formatMin = (m: number) => {
      const clockMinutes = ((Math.trunc(m) % 1440) + 1440) % 1440;
      const h = Math.floor(clockMinutes / 60);
      const min = clockMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };
    
    return `${TODAY[lang] ?? TODAY.sl} ${formatMin(openMin)}–${formatMin(closeMin)}`;
  } catch (e) {
    return null;
  }
}
