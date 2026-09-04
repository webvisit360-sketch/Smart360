import { openai } from "@workspace/integrations-openai-ai-server";

export async function translateCreatorEditorial(
  source: { name: string; description: string },
  client = openai,
): Promise<Array<{ language: "en" | "de" | "it"; name: string; description: string }>> {
  const response = await client.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [{
      role: "system",
      content: "Translate only the supplied Slovenian name and description. Do not add facts, claims, names, addresses, or content. Return JSON only: {\"translations\":[{\"language\":\"en\",\"name\":\"\",\"description\":\"\"},{\"language\":\"de\",\"name\":\"\",\"description\":\"\"},{\"language\":\"it\",\"name\":\"\",\"description\":\"\"}]}.",
    }, { role: "user", content: JSON.stringify(source) }],
  });
  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { translations?: Array<{ language: "en" | "de" | "it"; name: string; description: string }> };
  const translations = parsed.translations ?? [];
  if (translations.length !== 3 || new Set(translations.map((item) => item.language)).size !== 3 ||
    !["en", "de", "it"].every((language) => translations.some((item) => item.language === language)) ||
    translations.some((item) => !item.name?.trim() || !item.description?.trim())) {
    throw new Error("Prevoda ni bilo mogoče varno preveriti.");
  }
  return translations;
}