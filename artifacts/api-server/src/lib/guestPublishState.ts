const GUEST_VISIBLE_TENANT_FIELDS = new Set([
  "slug",
  "customDomain",
  "name",
  "subtitle",
  "rating",
  "reviewsCount",
  "logoUrl",
  "logoSquareUrl",
  "heroUrl",
  "livingGuideHeroUrl",
  "tourUrl",
  "phone",
  "whatsapp",
  "viber",
  "instagram",
  "email",
  "orderPassword",
  "address",
  "mapQuery",
  "mapUrl",
  "latitude",
  "longitude",
  "wifiSsid",
  "wifiPass",
  "wifiEnc",
  "bgColor",
  "theme",
  "guestUiMode",
  "coverTitle",
  "coverSubtitle",
  "coverTitleSize",
  "coverTitleOpacity",
  "coverTextColor",
  "coverSubSize",
  "coverSubOpacity",
  "coverMetaSize",
  "coverMetaOpacity",
  "coverVeil",
  "tileVeil",
  "textScale",
  "textFont",
  "textColor",
  "coverAlign",
  "coverShowRating",
  "logoX",
  "logoY",
  "logoW",
  "logoOpacity",
  "navColorCover",
  "navColor",
  "navColorOn",
  "languages",
  "livingGuideNav",
]);

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return (left ?? null) === (right ?? null);
}

export function hasGuestVisibleTenantChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const field of GUEST_VISIBLE_TENANT_FIELDS) {
    if (!(field in patch) || patch[field] === undefined) continue;
    if (!sameValue(before[field], patch[field])) return true;
  }
  return false;
}