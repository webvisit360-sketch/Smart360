import type { TourActivity } from './live-tour';

/** Private device-only input. Missing weight always disables the estimate. */
export type TourProfile = {
  age?: number;
  sex?: 'female' | 'male';
  weightKg?: number;
  bike?: 'road' | 'mtb' | 'trekking-city' | 'electric';
  assist?: 'low' | 'medium' | 'high';
};

export function validProfile(value: unknown): TourProfile {
  if (!value || typeof value !== 'object') return {};
  const p = value as TourProfile;
  return {
    age: Number.isInteger(p.age) && p.age! >= 1 && p.age! <= 110 ? p.age : undefined,
    sex: p.sex === 'female' || p.sex === 'male' ? p.sex : undefined,
    weightKg: typeof p.weightKg === 'number' && Number.isFinite(p.weightKg) && p.weightKg >= 20 && p.weightKg <= 350 ? p.weightKg : undefined,
    bike: ['road', 'mtb', 'trekking-city', 'electric'].includes(p.bike ?? '') ? p.bike : undefined,
    assist: p.assist === 'low' || p.assist === 'medium' || p.assist === 'high' ? p.assist : undefined,
  };
}

const PROFILE_KEY = 'smart360:tour-profile:v1';
export function loadTourProfile(storage?: Pick<Storage, 'getItem'>): TourProfile {
  try { return validProfile(JSON.parse((storage ?? window.localStorage).getItem(PROFILE_KEY) ?? 'null')); }
  catch { return {}; }
}
export function saveTourProfile(profile: TourProfile, storage?: Pick<Storage, 'setItem'>): boolean {
  try { (storage ?? window.localStorage).setItem(PROFILE_KEY, JSON.stringify(validProfile(profile))); return true; }
  catch { return false; }
}

// Minetti et al., J Appl Physiol 93 (2002), equation for running cost in J/kg/m.
export function minettiCost(grade: number): number {
  const i = Math.max(-0.35, Math.min(0.35, grade));
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
}
// Minetti et al. (2002) walking polynomial, J/kg/m.
export function minettiWalkCost(grade: number): number {
  const i = Math.max(-0.35, Math.min(0.35, grade));
  return 280.5 * i ** 5 - 58.7 * i ** 4 - 76.8 * i ** 3 + 51.9 * i ** 2 + 19.6 * i + 2.5;
}
const BIKES = {
  road: { mass: 9, crr: 0.005, cda: 0.32 },
  mtb: { mass: 14, crr: 0.012, cda: 0.45 },
  'trekking-city': { mass: 15, crr: 0.008, cda: 0.42 },
  electric: { mass: 24, crr: 0.01, cda: 0.48 },
} as const;
export const BIKE_PARAMETERS = BIKES;
export const MOTOR_SHARES = { low: 0.3, medium: 0.5, high: 0.7 } as const;

/** Net moving segment only. Caller must pass an accepted non-paused displacement. */
export function segmentCalories(activity: TourActivity, profile: TourProfile, distanceM: number, seconds: number, grade = 0): number | null {
  const p = validProfile(profile);
  if (p.weightKg === undefined) return null;
  if (!Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const slope = Number.isFinite(grade) ? Math.max(-0.35, Math.min(0.35, grade)) : 0;
  // Deliberately small PRODUCT heuristics, not individually validated physiology.
  const factor = (p.sex === 'female' ? 0.98 : 1) * (1 - Math.min(0.04, Math.max(0, (p.age ?? 40) - 40) * 0.001));
  const km = distanceM / 1000;
  if (activity === 'running') return p.weightKg * km * Math.max(0.35, minettiCost(slope) / 3.6) * factor;
  if (activity === 'hiking') {
    // ACSM walking NET horizontal 0.1 + ascent 1.8 ml/kg/m; 5 kcal/L and 200 ml/kg/km => 0.5 + 9*grade.
    const perKgKm = slope >= 0 ? 0.5 + 9 * slope : Math.max(0.3, 0.5 * minettiWalkCost(slope) / 2.5);
    return p.weightKg * km * perKgKm * factor;
  }
  const bike = BIKES[p.bike ?? 'trekking-city'];
  const speed = Math.min(45, distanceM / seconds);
  // Mechanical power = v*(rolling + still-air drag + gravity); negative means coasting, not regeneration.
  const force = (p.weightKg + bike.mass) * 9.81 * (bike.crr + slope) + 0.5 * 1.225 * bike.cda * speed ** 2;
  const humanShare = p.bike === 'electric' ? 1 - MOTOR_SHARES[p.assist ?? 'medium'] : 1;
  const watts = Math.max(5, Math.max(0, force * speed) * humanShare);
  return watts * seconds / (0.24 * 4184) * factor;
}

export function formatCalories(kcal: number | null | undefined, approx: string): string | null {
  return kcal == null || !Number.isFinite(kcal) ? null : `${approx} ${Math.round(kcal / 10) * 10} kcal`;
}