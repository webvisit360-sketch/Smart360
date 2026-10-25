import test from "node:test";
import assert from "node:assert/strict";
import { ruleBulletTexts, matchRuleIcon } from "@workspace/category-icons";

test("rich-text list with caret paragraphs uses the same cards as structured bullets", () => {
  const sentences = ["Zabave in dogodki so strogo prepovedani.", "Kajenje je v nastanitvi strogo prepovedano.", "Prosim, varčujte z vodo."];
  const list = `<ul>${sentences.map(s=>`<li><p>${s}</p></li>`).join("")}</ul>`;
  for (const blank of ["<p></p>", "<p><br></p>", '<p class="caret">&nbsp;</p>', "\n"]) {
    assert.deepEqual(ruleBulletTexts({body:blank+list+blank,bullets:[]}),sentences);
  }
  assert.deepEqual(ruleBulletTexts({bullets:sentences}),sentences);
  assert.equal(matchRuleIcon(sentences[2]).entry.id,"rule:varcevanje-z-vodo");
});

test("ordinary prose is not promoted to rule cards", () => {
  assert.deepEqual(ruleBulletTexts({body:"<p>Prosimo, varčujte z vodo.</p>"}),[]);
  assert.deepEqual(ruleBulletTexts({body:"<p></p><p>Pravi odstavek</p><p></p>"}),[]);
});

test("render extraction preserves authored links and emphasis while icon audit remains plain text", () => {
  const inline = 'Za ogled cenika <strong>2025</strong> <em>kliknite</em> <a href="https://example.org/cenik?year=2025&amp;lang=sl" target="_blank">Cenik 2025</a>';
  const item = {body:`<ul><li><p>${inline}</p></li></ul><p></p>`};
  assert.deepEqual(ruleBulletTexts(item, h=>h, true), [`<p>${inline}</p>`]);
  assert.deepEqual(ruleBulletTexts(item), ["Za ogled cenika 2025 kliknite Cenik 2025"]);
  assert.deepEqual(ruleBulletTexts({bullets:[inline]},h=>h,true), [inline]);
});
