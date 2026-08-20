import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTranslationFields } from "../lib/contentTree";

test("indexed translations apply to normalized HTML paragraphs with source fallback", () => {
  const source = {
    id: "item-1",
    title: "Dobrodošli",
    body: [
      "<p><strong>Lepo, da ste tu.</strong></p>",
      "<p>Slovenski odstavek brez prevoda.</p>",
      "<p>Če boste karkoli potrebovali, smo le en klic stran.</p>",
    ].join(""),
    bullets: ["Prvo pravilo", "Drugo pravilo"],
  };

  const translated = applyTranslationFields(source, {
    title: "Welcome",
    "body[0]": "<strong>It is lovely to have you here.</strong>",
    "body[2]": "If you need anything, we are only a phone call away.",
    "bullets[0]": "First rule",
  });

  assert.equal(translated.title, "Welcome");
  assert.deepEqual(JSON.parse(translated.body), [
    "<strong>It is lovely to have you here.</strong>",
    "Slovenski odstavek brez prevoda.",
    "If you need anything, we are only a phone call away.",
  ]);
  assert.deepEqual(translated.bullets, ["First rule", "Drugo pravilo"]);
});