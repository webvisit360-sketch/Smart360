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
