import { splitPanoramaMedia } from "./panorama-media";

/** Panoramas have their own strip: only ordinary media reserve a hero. */
export function detailSheetClass(media: Parameters<typeof splitPanoramaMedia>[0], fullHeight = false): string {
  return `lg2-detail-sheet${fullHeight || splitPanoramaMedia(media).regular.length === 0 ? " lg2-detail-sheet--full-height" : ""}`;
}
