import { openai } from "@workspace/integrations-openai-ai-server";

export const EDITORIAL_LANGUAGES = ["sl", "en", "de", "it"] as const;
export type EditorialLanguage = typeof EDITORIAL_LANGUAGES[number];
export type EditorialDraft = {
  language: EditorialLanguage;
  title: string;
  description: string;
};
export type EditorialSuggestion = {
  language: EditorialLanguage;
  title: string | null;
  description: string | null;
};

export function hasMeaningfulEditorialText(value: string): boolean {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

function sourceFor(
  drafts: EditorialDraft[],
  field: "title" | "description",
): { language: EditorialLanguage; text: string } | null {
  for (const language of EDITORIAL_LANGUAGES) {
    const text = drafts.find((draft) => draft.language === language)?.[field]?.trim();
    if (text && hasMeaningfulEditorialText(text)) return { language, text };
  }
  return null;
}

export async function translateMissingEditorial(
  drafts: EditorialDraft[],
  client = openai,
): Promise<EditorialSuggestion[]> {
  if (drafts.length !== 4 ||
    new Set(drafts.map((draft) => draft.language)).size !== 4 ||
    !EDITORIAL_LANGUAGES.every((language) => drafts.some((draft) => draft.language === language))) {
    throw new Error("Urejevalnik nima vseh štirih jezikov.");
  }

  const tasks = (["title", "description"] as const).flatMap((field) => {
    const source = sourceFor(drafts, field);
    if (!source) return [];
    const targetLanguages = EDITORIAL_LANGUAGES.filter((language) =>
      !hasMeaningfulEditorialText(
        drafts.find((draft) => draft.language === language)?.[field] ?? "",
      ));
    return targetLanguages.length ? [{ field, ...source, targetLanguages }] : [];
  });
  if (tasks.length === 0) return [];

  const expected = new Map<EditorialLanguage, Set<"title" | "description">>();
  for (const task of tasks) {
    for (const language of task.targetLanguages) {
      const fields = expected.get(language) ?? new Set<"title" | "description">();
      fields.add(task.field);
      expected.set(language, fields);
    }
  }

  const response = await client.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [{
      role: "system",
      content: "Translate only the supplied operator-authored text into exactly the requested target languages. Preserve meaning and allowed HTML formatting. Do not add facts, claims, names, addresses, explanations, or content. A field not requested for a language must be null. Return JSON only: {\"translations\":[{\"language\":\"sl|en|de|it\",\"title\":string|null,\"description\":string|null}]}."
    }, {
      role: "user",
      content: JSON.stringify({ tasks }),
    }],
  });
  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { translations?: EditorialSuggestion[] };
  const translations = parsed.translations ?? [];

  if (translations.length !== expected.size ||
    new Set(translations.map((item) => item.language)).size !== expected.size ||
    translations.some((item) => !EDITORIAL_LANGUAGES.includes(item.language))) {
    throw new Error("Prevoda ni bilo mogoče varno preveriti.");
  }
  for (const [language, fields] of expected) {
    const translated = translations.find((item) => item.language === language);
    if (!translated) throw new Error("Prevoda ni bilo mogoče varno preveriti.");
    for (const field of ["title", "description"] as const) {
      const value = translated[field];
      if (fields.has(field)) {
        if (typeof value !== "string" || !hasMeaningfulEditorialText(value)) {
          throw new Error("Prevoda ni bilo mogoče varno preveriti.");
        }
      } else if (value != null) {
        throw new Error("Prevoda ni bilo mogoče varno preveriti.");
      }
    }
  }
  return translations;
}

export async function translateCreatorEditorial(
  source: { name: string; description: string },
  client = openai,
): Promise<Array<{ language: "en" | "de" | "it"; name: string; description: string }>> {
  const translations = await translateMissingEditorial([
    { language: "sl", title: source.name, description: source.description },
    { language: "en", title: "", description: "" },
    { language: "de", title: "", description: "" },
    { language: "it", title: "", description: "" },
  ], client);
  return translations.map((translation) => ({
    language: translation.language as "en" | "de" | "it",
    name: translation.title!,
    description: translation.description!,
  }));
}