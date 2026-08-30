import test from "node:test";
import assert from "node:assert/strict";
import { recoveryCodeCountSl } from "../lib/recovery-code-plural";
import { formatSlovenianCount } from "../lib/slovenian-plural";

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

test("Slovenian count forms include dual, few, teen exceptions, and later decades", () => {
  const forms = {
    one: "lokacijo",
    two: "lokaciji",
    few: "lokacije",
    other: "lokacij",
  } as const;
  const cases = [
    [0, "0 lokacij"],
    [1, "1 lokacijo"],
    [2, "2 lokaciji"],
    [3, "3 lokacije"],
    [4, "4 lokacije"],
    [5, "5 lokacij"],
    [11, "11 lokacij"],
    [12, "12 lokacij"],
    [13, "13 lokacij"],
    [14, "14 lokacij"],
    [21, "21 lokacijo"],
    [22, "22 lokaciji"],
    [101, "101 lokacijo"],
    [102, "102 lokaciji"],
  ] as const;

  for (const [count, expectedText] of cases) {
    assert.equal(formatSlovenianCount(count, forms), expectedText);
  }
});