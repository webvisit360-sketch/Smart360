import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { capturePreviewAnchor } from "../components/admin/preview-selection-anchor";

test("preview visual anchors stay on leaves across scroll, replacement and scaled iframe", async () => {
  const browser = await chromium.launch({
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.setContent('<iframe style="width:402px;height:874px;transform:scale(.684);transform-origin:top left"></iframe>');
    const frame = page.frames()[1]!;
    await frame.setContent(`<style>body{margin:0}.content{padding:20px}img{width:200px;height:130px}</style>
      <div class="content"><h2>Title</h2><p>Description</p><ul><li>Bullet</li></ul>
      <img alt="Photo"><button>Tile</button><a href="tel:123">Contact</a>
      <div style="height:2000px"></div></div>`);
    const result = await frame.evaluate((source) => {
      // tsx emits its function-name helper for nested named closures. Supply
      // that metadata-only helper when evaluating the compiled function.
      const capture = new Function("__name", `return (${source})`)(
        (fn: Function, name: string) => Object.defineProperty(fn, "name", { value: name, configurable: true }),
      ) as typeof capturePreviewAnchor;
      const checks: boolean[] = [];
      for (const selector of ["h2", "p", "li", "img", "button", "a"]) {
        const el = document.querySelector(selector)!;
        const anchor = capture(el);
        checks.push(anchor.resolve(document) === el, anchor.rect.width === el.getBoundingClientRect().width);
        const before = el.getBoundingClientRect().top;
        window.scrollBy(0, 100);
        checks.push(anchor.resolve(document)!.getBoundingClientRect().top === before - 100);
        window.scrollTo(0, 0);
        const replacement = el.cloneNode(true) as Element;
        el.replaceWith(replacement);
        checks.push(anchor.resolve(document) === replacement);
        replacement.classList.add("different-view");
        checks.push(anchor.resolve(document) === null); // never expand to parent
        replacement.classList.remove("different-view");
        // A loader/held view may insert a sibling and change the structural path.
        const sibling = document.createElement(replacement.tagName);
        sibling.className = "unrelated-sibling";
        replacement.before(sibling);
        checks.push(anchor.resolve(document) === replacement);
        sibling.remove();
      }
      return checks;
    }, capturePreviewAnchor.toString());
    assert.ok(result.every(Boolean), JSON.stringify(result));
  } finally {
    await browser.close();
  }
});
