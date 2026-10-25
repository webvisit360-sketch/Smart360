// Per-tenant visibility of the fixed system tiles (Enostaven grid + Trend equivalents).
// Missing object or missing key means visible (default true).
export const SYSTEM_TILE_KEYS = ["notices", "weather", "sos", "contact", "install", "about"] as const;
export type SystemTileKey = (typeof SYSTEM_TILE_KEYS)[number];
export type SystemTileVisibility = Partial<Record<SystemTileKey, boolean>>;

export function normalizeSystemTileVisibility(raw: unknown): Record<SystemTileKey, boolean> {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<SystemTileKey, boolean>;
  for (const key of SYSTEM_TILE_KEYS) out[key] = src[key] !== false;
  return out;
}

export function systemTileVisible(tenant: any, key: SystemTileKey): boolean {
  return normalizeSystemTileVisibility(tenant?.systemTileVisibility)[key];
}
