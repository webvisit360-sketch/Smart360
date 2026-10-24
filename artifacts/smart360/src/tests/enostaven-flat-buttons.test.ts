import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { insetOnly } from "../pages/living-guide/simple/strip-outer-shadows";

const CSS = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
const rules = [...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const last = (pred: (s: string) => boolean, prop: string) =>
  rules.filter((r) => pred(r.sel) && new RegExp(`(^|;|\\s)${prop}\\s*:`).test(r.body)).map((r) => r.body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`))![1].trim()).at(-1);
const outerLayers = (v: string) => v.split(/,(?![^(]*\))/).map((p) => p.trim()).filter((p) => p && p !== "none" && !/\binset\b/.test(p));
const cq = (px: number) => +(px / 3.96).toFixed(4);
const num = (v: string | undefined) => v!.split(/\s+/).map((x) => parseFloat(x));

test("Enostaven button surfaces have no OUTER drop shadow; inset layers are kept", () => {
  for (const cls of ["lgs-tile", "lgs-open", "lgs-flag", "lgs-flagbtn"]) {
    const v = last((s) => s.includes(".lgs-root") && s.includes(cls) && !/::|:focus|:active/.test(s), "box-shadow")!;
    assert.deepEqual(outerLayers(v), [], `${cls}: ${v}`);
  }
  assert.match(last((s) => s === ".lgs-root .lgs-tile", "box-shadow")!, /^inset 0 0 0 \.2525cqw var\(--s-bg\)$/);
  assert.equal(last((s) => s === ".lgs-root .lgs-open", "box-shadow"), "inset 0 0 0 1px var(--s-bg)");
  // back circle keeps its inset gap; no blanket "none !important" suppression any more
  assert.match(CSS, /background:var\(--s-tile1, #B23476\); box-shadow:inset 0 0 0 1px var\(--s-bg, #4C2545\)/);
  assert.doesNotMatch(CSS, /box-shadow:\s*none\s*!important/);
});

test("runtime strip keeps inset layers and drops only outer layers", () => {
  assert.equal(insetOnly("rgb(76, 37, 69) 0px 0px 0px 1px inset, rgba(10, 5, 15, 0.35) 0px 4px 14px 0px"), "rgb(76, 37, 69) 0px 0px 0px 1px inset");
  assert.equal(insetOnly("rgba(0, 0, 0, 0.35) 0px 5px 16px 0px"), "none");
  assert.equal(insetOnly("none"), "none");
  assert.equal(insetOnly("inset 0 0 0 2px red, inset 0 1px 0 rgba(1,2,3,.5)"), "inset 0 0 0 2px red, inset 0 1px 0 rgba(1,2,3,.5)");
});

test("tile anatomy = master px scaled by phone width (v/3.96 cqw)", () => {
  const t = (p: string) => last((s) => s === ".lgs-root .lgs-tile", p);
  assert.equal(parseFloat(t("border-width")!), +(2.3 / 3.96).toFixed(4));
  assert.equal(parseFloat(t("border-radius")!), cq(19));
  assert.deepEqual(num(t("padding")), [cq(10), cq(5), cq(6)]);
  assert.equal(parseFloat(last((s) => s === ".lgs-root .lgs-tile svg", "width")!), cq(58));
  const g = (p: string) => last((s) => s === ".lgs-root .lgs-grid", p);
  assert.equal(parseFloat(g("column-gap")!), cq(30));
  assert.equal(parseFloat(g("row-gap")!), cq(19));
  assert.deepEqual(num(g("padding")), [0, cq(26)]);
  assert.match(CSS, /\.lgs-root \.lgs-home \{ container-type: inline-size; \}/);
  // proportional SVG-mask ring / pseudo gradient is gone
  assert.doesNotMatch(CSS, /lgs-tile::(before|after)/);
  assert.doesNotMatch(CSS, /mask:\s*url/);
  // base gradient + border anatomy from the master stays
  assert.match(CSS, /\.lgs-tile \{[^}]*background: var\(--s-grad, linear-gradient\(180deg,var\(--s-tile1\) 0%,var\(--s-tile15\) 52%,var\(--s-tile2\) 100%\)\); background-clip: padding-box;[^}]*border: 2\.3px solid var\(--s-stroke\)/);
});

test("44px circles kept with master-style 1.1px ring + 1px gap", () => {
  assert.match(CSS, /width:44px; height:44px; min-width:44px/);
  assert.match(CSS, /\.lgs-flag \{[^}]*width: 44px; height: 44px;[^}]*border: 1\.1px solid[^}]*padding: 1px/);
  assert.doesNotMatch(CSS, /calc\(44px \* \.023\)/);
});

test("daypart outline, focus outlines and Trend rules are preserved", () => {
  assert.match(CSS, /\.lgs-home\[data-weather-skin\]:not\(\[data-weather-skin="night"\]\) \.lgs-tile \{\s*outline: 1px solid var\(--daypart-ring\);\s*outline-offset: 1px;/);
  assert.match(CSS, /\.lgs-tile:focus-visible, \.lgs-open:focus-visible \{\s*outline: 2px solid/);
  assert.match(CSS, /\.lg2-app:not\(\.lgs-root\) \.lg-back-circle \{ background:var\(--glass/);
  assert.match(CSS, /\.lgs-home-controls--trend \.lgs-return360 \{\s*background:var\(--glass\); box-shadow:inset 0 0 0 1px var\(--s-bg\); color:#fff;/);
  const block = CSS.slice(CSS.indexOf("/* ---------- Template-exact Enostaven anatomy"));
  for (const m of block.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)) for (const s of m[1].split(/,(?![^(]*\))/)) assert.match(s, /\.lgs-root/, s);
});
