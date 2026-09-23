import type {
  ItemTranslationDraftSuggestion,
  ItemTranslationLanguageDraft,
  Translation,
  TranslationInput,
} from "@workspace/api-client-react";

export const ITEM_EDITOR_LANGUAGES = ["sl", "en", "de", "it"] as const;
export type ItemEditorLanguage = typeof ITEM_EDITOR_LANGUAGES[number];
export type ItemTranslationTargetLanguage = Exclude<ItemEditorLanguage, "sl">;
export type ItemTranslationDraftField = "title" | "description";

export type ItemTranslationRefreshField = {
  language: ItemTranslationTargetLanguage;
  field: ItemTranslationDraftField;
  missing: boolean;
  stale: boolean;
};

export function hasMeaningfulItemDraftText(value: string): boolean {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

function asRichParagraph(value: string): string {
  return /^\s*<(?:p|ul|ol|blockquote|h[1-6])[\s>]/i.test(value)
    ? value
    : `<p>${value}</p>`;
}

function storedDescription(rows: Translation[], language: string): string {
  const direct = rows.find((row) =>
    row.lang === language && row.field === "body")?.value?.trim();
  if (direct) {
    try {
      const parsed = JSON.parse(direct);
      if (Array.isArray(parsed)) {
        return parsed.filter((part) => part != null && String(part).trim())
          .map((part) => asRichParagraph(String(part))).join("");
      }
    } catch {
      // Stored rich HTML continues unchanged.
    }
    return direct;
  }
  return rows
    .filter((row) => row.lang === language && /^body\[\d+\]$/.test(row.field) && row.value.trim())
    .sort((a, b) => Number(a.field.match(/\d+/)?.[0] ?? 0) - Number(b.field.match(/\d+/)?.[0] ?? 0))
    .map((row) => asRichParagraph(row.value))
    .join("");
}

export function buildItemLanguageDrafts(
  source: { title: string; description: string },
  rows: Translation[],
): ItemTranslationLanguageDraft[] {
  return ITEM_EDITOR_LANGUAGES.map((language) => language === "sl"
    ? { language, title: source.title, description: source.description }
    : {
        language,
        title: rows.find((row) =>
          row.lang === language && row.field === "title")?.value ?? "",
        description: storedDescription(rows, language),
      });
}

export function mergeMissingItemLanguageDrafts(
  current: ItemTranslationLanguageDraft[],
  suggestions: ItemTranslationDraftSuggestion[],
): ItemTranslationLanguageDraft[] {
  return current.map((draft) => {
    const suggestion = suggestions.find((entry) => entry.language === draft.language);
    if (!suggestion) return draft;
    return {
      ...draft,
      title: hasMeaningfulItemDraftText(draft.title)
        ? draft.title
        : suggestion.title ?? draft.title,
      description: hasMeaningfulItemDraftText(draft.description)
        ? draft.description
        : suggestion.description ?? draft.description,
    };
  });
}

export function hasTranslatableMissingItemField(
  drafts: ItemTranslationLanguageDraft[],
): boolean {
  return (["title", "description"] as const).some((field) =>
    drafts.some((draft) => hasMeaningfulItemDraftText(draft[field])) &&
    drafts.some((draft) => !hasMeaningfulItemDraftText(draft[field])));
}

function storedFieldIsStale(
  rows: Translation[],
  language: ItemTranslationTargetLanguage,
  field: ItemTranslationDraftField,
): boolean {
  return rows.some((row) =>
    row.lang === language &&
    row.stale &&
    (field === "title"
      ? row.field === "title"
      : row.field === "body" || /^body\[\d+\]$/.test(row.field)));
}

/**
 * A changed, not-yet-saved Slovenian field makes its targets stale
 * immediately. Persisted stale flags cover the same state after reopen.
 */
export function itemTranslationRefreshFields(
  storedSource: { title: string; description: string },
  currentDrafts: ItemTranslationLanguageDraft[],
  rows: Translation[],
): ItemTranslationRefreshField[] {
  const sl = currentDrafts.find((draft) => draft.language === "sl")!;
  const sourceChanged = {
    title: sl.title !== storedSource.title,
    description: sl.description !== storedSource.description,
  };
  const refresh: ItemTranslationRefreshField[] = [];
  for (const language of ITEM_EDITOR_LANGUAGES.filter(
    (value): value is ItemTranslationTargetLanguage => value !== "sl",
  )) {
    const target = currentDrafts.find((draft) => draft.language === language)!;
    for (const field of ["title", "description"] as const) {
      if (!hasMeaningfulItemDraftText(sl[field])) continue;
      const missing = !hasMeaningfulItemDraftText(target[field]);
      const stale = sourceChanged[field] || storedFieldIsStale(rows, language, field);
      if (missing || stale) refresh.push({ language, field, missing, stale });
    }
  }
  return refresh;
}

export function draftsForItemTranslationRefresh(
  drafts: ItemTranslationLanguageDraft[],
  refresh: ItemTranslationRefreshField[],
): ItemTranslationLanguageDraft[] {
  return drafts.map((draft) => {
    if (draft.language === "sl") return draft;
    const next = { ...draft };
    for (const entry of refresh.filter((candidate) => candidate.language === draft.language)) {
      next[entry.field] = "";
    }
    return next;
  });
}

export function mergeItemTranslationRefresh(
  current: ItemTranslationLanguageDraft[],
  suggestions: ItemTranslationDraftSuggestion[],
  refresh: ItemTranslationRefreshField[],
): ItemTranslationLanguageDraft[] {
  return current.map((draft) => {
    if (draft.language === "sl") return draft;
    const suggestion = suggestions.find((entry) => entry.language === draft.language);
    if (!suggestion) return draft;
    const next = { ...draft };
    for (const entry of refresh.filter((candidate) => candidate.language === draft.language)) {
      const value = suggestion[entry.field];
      if (value != null) next[entry.field] = value;
    }
    return next;
  });
}

export function changedItemTranslationWrites(
  recordId: string,
  original: ItemTranslationLanguageDraft[],
  current: ItemTranslationLanguageDraft[],
  rows: Translation[],
  refreshed: ItemTranslationRefreshField[] = [],
): TranslationInput[] {
  const writes: TranslationInput[] = [];
  for (const language of ITEM_EDITOR_LANGUAGES.filter((value) => value !== "sl")) {
    const before = original.find((draft) => draft.language === language)!;
    const after = current.find((draft) => draft.language === language)!;
    if (before.title !== after.title ||
      refreshed.some((entry) => entry.language === language && entry.field === "title")) {
      writes.push({ model: "item", recordId, field: "title", lang: language, value: after.title });
    }
    if (before.description !== after.description ||
      refreshed.some((entry) => entry.language === language && entry.field === "description")) {
      writes.push({ model: "item", recordId, field: "body", lang: language, value: after.description });
      for (const row of rows.filter((entry) =>
        entry.lang === language && /^body\[\d+\]$/.test(entry.field))) {
        writes.push({ model: "item", recordId, field: row.field, lang: language, value: "" });
      }
    }
  }
  return writes;
}