import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeBody, sanitizePlain } from "../lib/sanitizeBody";

// sanitizePlain mora biti idempotenten — enkratna normalizacija v produkciji
// in vsako naslednje shranjevanje morata dati isti rezultat.
test("sanitizePlain is idempotent", () => {
  const cases = [
    "Takamaka Cocktails & Food",
    "Takamaka Cocktails &amp; Food",
    "&lt;script&gt;x&lt;/script&gt;",
    "&amp;lt;b&amp;gt;dvojno&amp;lt;/b&amp;gt;",
    "a < b in a > b",
    "<b>naslov</b>",
    "navadno besedilo",
    "{n} ocen &amp; mnenj",
    "cena\u00a0\u00a05 €",
  ];
  for (const c of cases) {
    const once = sanitizePlain(c);
    assert.equal(sanitizePlain(once), once, `not idempotent for: ${c}`);
  }
});

test("sanitizePlain stores literal text, not entities", () => {
  assert.equal(sanitizePlain("Pizza &amp; More"), "Pizza & More");
  assert.equal(sanitizePlain("Pizza & More"), "Pizza & More");
});

test("sanitizeBody maps legacy tags and is idempotent", () => {
  const once = sanitizeBody("<b>krepko</b> in <i>ležeče</i>");
  assert.equal(once, "<strong>krepko</strong> in <em>ležeče</em>");
  assert.equal(sanitizeBody(once), once);
});
