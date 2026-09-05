import assert from "node:assert/strict";
import test from "node:test";
import {
  translateCreatorEditorial,
  translateMissingEditorial,
  type EditorialDraft,
} from "../lib/creatorEditorialTranslation";

const drafts = (
  values: Partial<Record<EditorialDraft["language"], Partial<EditorialDraft>>>,
): EditorialDraft[] =>
  (["sl", "en", "de", "it"] as const).map((language) => ({
    language,
    title: values[language]?.title ?? "",
    description: values[language]?.description ?? "",
  }));

test("editorial translation sends only operator Slovenian text and returns EN/DE/IT", async () => {
  let userContent = "";
  const translations = await translateCreatorEditorial(
    { name: "Slap", description: "Kratek opis." },
    { chat: { completions: { create: async (input: any) => {
      userContent = input.messages[1].content;
      return { choices: [{ message: { content: JSON.stringify({ translations: [
        { language: "en", title: "Waterfall", description: "Short description." },
        { language: "de", title: "Wasserfall", description: "Kurze Beschreibung." },
        { language: "it", title: "Cascata", description: "Breve descrizione." },
      ] }) } }] };
    } } } } as any,
  );
  const payload = JSON.parse(userContent);
  assert.equal(payload.tasks[0].language, "sl");
  assert.equal(payload.tasks[0].text, "Slap");
  assert.equal(payload.tasks[1].text, "Kratek opis.");
  assert.deepEqual(translations.map((translation) => translation.language), ["en", "de", "it"]);
});

test("translation tasks use an English title source and leave source-less descriptions empty", async () => {
  let request: any;
  const client = {
    chat: { completions: { create: async (input: any) => {
      request = input;
      return { choices: [{ message: { content: JSON.stringify({
        translations: [
          { language: "sl", title: "Zunanji fitnes", description: null },
          { language: "de", title: "Outdoor-Fitnessbereich", description: null },
          { language: "it", title: "Palestra all'aperto", description: null },
        ],
      }) } }] };
    } } },
  };
  const result = await translateMissingEditorial(
    drafts({ en: { title: "Outdoor gym" } }),
    client as never,
  );
  const payload = JSON.parse(request.messages[1].content);
  assert.deepEqual(payload.tasks, [{
    field: "title",
    language: "en",
    text: "Outdoor gym",
    targetLanguages: ["sl", "de", "it"],
  }]);
  assert.equal(result.find((entry) => entry.language === "sl")?.description, null);
});

test("translation service rejects content for a field that was not requested", async () => {
  const client = {
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: JSON.stringify({
        translations: [
          { language: "sl", title: "Zunanji fitnes", description: "Izmišljeno" },
          { language: "de", title: "Outdoor-Fitnessbereich", description: null },
          { language: "it", title: "Palestra all'aperto", description: null },
        ],
      }) } }],
    }) } },
  };
  await assert.rejects(
    translateMissingEditorial(drafts({ en: { title: "Outdoor gym" } }), client as never),
    /varno preveriti/,
  );
});