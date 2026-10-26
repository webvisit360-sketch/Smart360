import test from "node:test";
import assert from "node:assert/strict";
import { collapseEmptyParagraphs } from "../lib/content-spacing";

test("display spacing preserves single blank lines and all nonempty typography", () => {
  const html = '<p><strong>Naslov</strong> <a href="/x">povezava</a></p><p><br></p><p><em>Konec</em></p>';
  assert.equal(collapseEmptyParagraphs(html), html);
  assert.equal(collapseEmptyParagraphs("a<br><br>b"), "a<br><br>b");
});
test("display spacing collapses consecutive empty paragraphs, including editor NBSP/BR forms", () => {
  const html = "<p>A</p><p>&nbsp;</p> \n<p><br /></p><p> </p><p>B</p>";
  const result = collapseEmptyParagraphs(html);
  assert.equal(result, "<p>A</p><p>&nbsp;</p><p>B</p>");
  assert.equal(collapseEmptyParagraphs(result), result);
});
test("legacy imported line-break runs retain one blank line", () => {
  assert.equal(collapseEmptyParagraphs("A<br /> \n<br /><br /><br />B"), "A<br /> \n<br />B");
  assert.equal(collapseEmptyParagraphs("<p>Address</p><br /><br />Hours"), "<p>Address</p><br />Hours");
  assert.equal(collapseEmptyParagraphs("<p>Address</p><br />Hours"), "<p>Address</p><br />Hours");
  assert.equal(collapseEmptyParagraphs("<p><img src='x'></p><p></p><p>text</p>"), "<p><img src='x'></p><p></p><p>text</p>");
});
