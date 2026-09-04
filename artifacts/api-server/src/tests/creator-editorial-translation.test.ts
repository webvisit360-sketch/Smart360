import assert from "node:assert/strict";
import test from "node:test";
import { translateCreatorEditorial } from "../lib/creatorEditorialTranslation";

test("editorial translation sends only operator Slovenian text and returns EN/DE/IT", async () => {
  let userContent = "";
  const translations = await translateCreatorEditorial(
    { name: "Slap", description: "Kratek opis." },
    { chat: { completions: { create: async (input: any) => {
      userContent = input.messages[1].content;
      return { choices: [{ message: { content: JSON.stringify({ translations: [
        { language: "en", name: "Waterfall", description: "Short description." },
        { language: "de", name: "Wasserfall", description: "Kurze Beschreibung." },
        { language: "it", name: "Cascata", description: "Breve descrizione." },
      ] }) } }] };
    } } } } as any,
  );
  assert.equal(userContent, JSON.stringify({ name: "Slap", description: "Kratek opis." }));
  assert.deepEqual(translations.map((translation) => translation.language), ["en", "de", "it"]);
});