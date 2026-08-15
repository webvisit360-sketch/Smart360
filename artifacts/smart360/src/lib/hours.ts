export function formatTodayHours(hoursJson?: string | null): string | null {
  if (!hoursJson) return null;
  try {
    const hours = JSON.parse(hoursJson);
    if (!Array.isArray(hours) || hours.length !== 7) return null;
    
    // JS Date.getDay() -> 0 = Sun, 1 = Mon ... 6 = Sat
    // hoursJson -> 0 = Mon, 1 = Tue ... 6 = Sun
    const jsDay = new Date().getDay();
    const targetIdx = jsDay === 0 ? 6 : jsDay - 1;
    
    const today = hours[targetIdx];
    if (!today) return "Danes Zaprto";
    
    const [openMin, closeMin] = today;
    const formatMin = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h}:${min.toString().padStart(2, '0')}`;
    };
    
    return `Danes ${formatMin(openMin)}–${formatMin(closeMin)}`;
  } catch (e) {
    return null;
  }
}
