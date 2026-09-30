/** Guest-only Explore presentation. These chips never enter the content tree. */
import { EXPLORE_ALL_CATEGORY_KEY } from "./living-guide-explore";
import type { UiLanguage } from "../guest/i18n";

export const EXPLORE_RECORDING_TAB_KEY = "__lg_recording_tab__";
const RECORDING_TAB_LABELS: Record<UiLanguage, string> = {
  sl: "Snemanje tur",
  en: "Record a tour",
  de: "Tour aufzeichnen",
  it: "Registra un tour",
};

export function recordingTabLabel(lang: UiLanguage): string {
  return RECORDING_TAB_LABELS[lang];
}

type ExploreCategoryChip = {
  key: string;
  label: string;
  empty?: boolean;
  inactive?: boolean;
};

export function exploreCategoryChips(
  categories: Array<{ id: string; key?: string; label: string; __adminGuestEmpty?: boolean; __adminInactive?: boolean }>,
  allLabel: string,
  recordingLabel: string,
  recordingEnabled: boolean,
): ExploreCategoryChip[] {
  const chips: ExploreCategoryChip[] = [
    { key: EXPLORE_ALL_CATEGORY_KEY, label: allLabel },
    ...categories.map((category) => ({
      key: category.id,
      label: category.label,
      empty: category.__adminGuestEmpty === true && !category.__adminInactive,
      inactive: category.__adminInactive === true,
    })),
  ];
  if (!recordingEnabled) return chips;

  // The published skeleton uses bike/hike keys. Never infer identity from
  // display labels: those change with the guide language and tenant copy.
  const cycling = categories.findIndex((category) => category.key === "bike" || category.id === "bike");
  const hiking = categories.findIndex((category) => category.key === "hike" || category.id === "hike");
  const after = cycling >= 0 ? cycling + 1 : hiking >= 0 ? hiking + 1 : chips.length - 1;
  chips.splice(after + 1, 0, { key: EXPLORE_RECORDING_TAB_KEY, label: recordingLabel });
  return chips;
}