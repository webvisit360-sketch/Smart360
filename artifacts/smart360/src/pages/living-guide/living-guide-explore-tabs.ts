/** Guest-only Explore presentation. These chips never enter the content tree. */
import { EXPLORE_ALL_CATEGORY_KEY } from "./living-guide-explore";
import type { UiLanguage } from "../guest/i18n";

export const EXPLORE_RECORDING_TAB_KEY = "__lg_recording_tab__";
import { extendCatalog } from "../../lib/guest-catalogs";
const RECORDING_TAB_LABELS = extendCatalog<string>({
  sl: "Snemanje tur",
  en: "Record a tour",
  de: "Tour aufzeichnen",
  it: "Registra un tour",
});

export function recordingTabLabel(lang: UiLanguage): string {
  return RECORDING_TAB_LABELS[lang];
}

type ExploreCategoryChip = {
  key: string;
  label: string;
  empty?: boolean;
  inactive?: boolean;
};

type ExploreCategory = {
  id: string;
  key?: string;
  label: string;
  isVisible?: boolean;
  __adminGuestEmpty?: boolean;
  __adminInactive?: boolean;
};

/** Only these stable category keys host the recorder; translated labels do not. */
function isRecordingCategory(category: ExploreCategory): boolean {
  return category.isVisible !== false &&
    ["bike", "hike", "run", "activities"].includes(category.key ?? category.id);
}

export function exploreRecorderVisible(
  categories: ExploreCategory[],
  selectedKey: string,
  recordingEnabled: boolean,
): boolean {
  if (!recordingEnabled || selectedKey === EXPLORE_ALL_CATEGORY_KEY) return false;
  if (selectedKey === EXPLORE_RECORDING_TAB_KEY) {
    return !categories.some(isRecordingCategory);
  }
  return categories.some((category) => category.id === selectedKey && isRecordingCategory(category));
}

export function exploreCategoryChips(
  categories: ExploreCategory[],
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
  // Keep the old standalone entry only when no visible eligible category exists,
  // including guides with no categories. Empty eligible categories still qualify.
  if (recordingEnabled && !categories.some(isRecordingCategory)) {
    chips.push({ key: EXPLORE_RECORDING_TAB_KEY, label: recordingLabel });
  }
  return chips;
}