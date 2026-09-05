export function itemPriceText(
  item: any,
  t?: (key: string) => string,
): string | null {
  const price =
    typeof item?.price === "string" ? item.price.trim() : "";
  if (!price) return null;
  if (
    /^(po dogovoru|by agreement|nach vereinbarung|su accordo)$/i.test(price) &&
    t
  ) {
    return t("UI.lg.price.byAgreement");
  }
  const unit =
    typeof item?.priceUnit === "string" ? item.priceUnit.trim() : "";
  if (!unit) return price;
  return `${price} ${unit.startsWith("/") ? unit : `/ ${unit}`}`;
}

export function formatDistanceMeters(value: unknown): string | null {
  const meters =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim().replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  const kilometres = Math.round((meters / 1000) * 10) / 10;
  return `${String(kilometres).replace(".", ",")} km`;
}

export function itemDistanceText(item: any): string | null {
  const structured = formatDistanceMeters(item?.distanceMeters);
  if (structured) return structured;
  if (typeof item?.distance === "number") {
    return formatDistanceMeters(item.distance);
  }
  return typeof item?.distance === "string" && item.distance.trim()
    ? item.distance.trim()
    : null;
}

export function itemSupportingText(
  item: any,
  subtitle?: string | null,
  status?: string | null,
): string {
  return [itemDistanceText(item), subtitle, status].filter(Boolean).join(" · ");
}

export function normalizeGuestMedia(rows: any[] | null | undefined): any[] {
  const seen = new Set<string>();
  return (rows ?? []).filter((entry) => {
    if (entry?.isVisible === false) return false;
    const url = typeof entry?.url === "string" ? entry.url.trim() : "";
    if (!url || (entry?.kind && entry.kind !== "image")) return false;
    const key = `${entry.kind ?? "image"}:${url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}