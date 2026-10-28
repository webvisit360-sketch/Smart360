/** Imported generic/rules categories may actually contain photo-bearing places.
 * A single house-rule document remains a document, including its cover photo. */
export function usesPhotoEntryList(layout: string, items: Array<{ media?: Array<{ url?: string; kind?: string | null }> | null }>) {
  return !["wifi", "help", "tabs"].includes(layout) && items.length > 1 &&
    items.some(item => item.media?.some(media => media.url && media.kind !== "video"));
}
