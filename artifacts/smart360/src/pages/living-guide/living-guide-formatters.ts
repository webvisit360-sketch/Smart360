export function itemPriceText(item: any): string | null {
  const price =
    typeof item?.price === "string" ? item.price.trim() : "";
  if (!price) return null;
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