import test from "node:test";
import assert from "node:assert/strict";
import { recoveryCodeCountSl } from "../lib/recovery-code-plural";

const expected = [
  "Ni več obnovitvenih kod.",
  "Na voljo je še 1 obnovitvena koda.",
  "Na voljo sta še 2 obnovitveni kodi.",
  "Na voljo so še 3 obnovitvene kode.",
  "Na voljo so še 4 obnovitvene kode.",
  "Na voljo je še 5 obnovitvenih kod.",
];

test("Slovenian recovery-code plural forms for 0 through 5", () => {
  expected.forEach((text, count) => assert.equal(recoveryCodeCountSl(count), text));
});