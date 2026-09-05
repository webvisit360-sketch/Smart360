import type {
  ItemTranslationDraftSuggestion,
  ItemTranslationLanguageDraft,
  Translation,
  TranslationInput,
} from "@workspace/api-client-react";

export const ITEM_EDITOR_LANGUAGES = ["sl", "en", "de", "it"] as const;
export type ItemEditorLanguage = typeof ITEM_EDITOR_LANGUAGES[number];

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

export function changedItemTranslationWrites(
  recordId: string,
  original: ItemTranslationLanguageDraft[],
  current: ItemTranslationLanguageDraft[],
  rows: Translation[],
): TranslationInput[] {
  const writes: TranslationInput[] = [];
  for (const language of ITEM_EDITOR_LANGUAGES.filter((value) => value !== "sl")) {
    const before = original.find((draft) => draft.language === language)!;
    const after = current.find((draft) => draft.language === language)!;
    if (before.title !== after.title) {
      writes.push({ model: "item", recordId, field: "title", lang: language, value: after.title });
    }
    if (before.description !== after.description) {
      writes.push({ model: "item", recordId, field: "body", lang: language, value: after.description });
      for (const row of rows.filter((entry) =>
        entry.lang === language && /^body\[\d+\]$/.test(entry.field))) {
        writes.push({ model: "item", recordId, field: row.field, lang: language, value: "" });
      }
    }
  }
  return writes;
}