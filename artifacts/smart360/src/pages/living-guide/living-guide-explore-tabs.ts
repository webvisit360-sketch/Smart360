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

function normalizedLabel(label: string): string {
  return label.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sl");
}

export function exploreCategoryChips(
  categories: Array<{ id: string; label: string; __adminGuestEmpty?: boolean; __adminInactive?: boolean }>,
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

  const cycling = chips.findIndex((chip) => normalizedLabel(chip.label) === "kolesarjenje");
  const hiking = chips.findIndex((chip) => normalizedLabel(chip.label) === "pohodništvo");
  const after = cycling >= 0 ? cycling : hiking >= 0 ? hiking : chips.length - 1;
  chips.splice(after + 1, 0, { key: EXPLORE_RECORDING_TAB_KEY, label: recordingLabel });
  return chips;
}