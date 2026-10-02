// Executes the existing real renderer fixtures, never delivery or DB access.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { transform } from "../../artifacts/api-server/node_modules/esbuild/lib/main.js";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "reports/trak-signature");
await mkdir(dir, { recursive: true });
globalThis.fetch = async () => { throw new Error("Offline evidence forbids network fetch"); };
pg.Pool.prototype.connect = pg.Pool.prototype.query = async () => { throw new Error("Offline evidence forbids DB access"); };
let script = await readFile(path.join(root, "artifacts/api-server/scripts/generate-owner-email-previews.ts"), "utf8");
script = script.replace('"@playwright/test"', JSON.stringify(import.meta.resolve("@playwright/test")));
for (const module of ["lifecycleEmails", "conciergeWelcomeEmail", "guideReadyNotice", "emailTemplate"]) {
  script = script.replace(`"../src/lib/${module}"`, JSON.stringify(`file://${root}/artifacts/api-server/src/lib/${module}.ts`));
}
script = script.replace('const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");', `const root = ${JSON.stringify(root)};`);
script = script.replace('const reportDir = path.join(root, "reports");', 'const reportDir = path.join(root, "reports/trak-signature");');
script = script.replace("if (olderPath) await writeFile(path.join(oldPreviewDir, olderPath), original);", "// Do not overwrite historical previews.");
script = script.replace("let html = original;", `let html = original;
    await writeFile(path.join(reportDir, name + "-production.html"), original);
    for (const radius of [14, 16]) {
      const bytes = await readFile(path.join(brandDir, "smart360-email-signature-r" + radius + "-1116x8.png"));
      html = html.replaceAll("https://smart360.info/brand/smart360-email-signature-r" + radius + "-1116x8.png?v=tour-1", "data:image/png;base64," + bytes.toString("base64"));
    }`);
script = script.replace('await page.goto(`file://${htmlPath}`);', 'await page.route(/^https?:/, route => route.abort()); await page.goto(`file://${htmlPath}`); await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));');
script = script.replace('gap: title.getBoundingClientRect().top - box.bottom,', `gap: title.getBoundingClientRect().top - box.bottom,
        dpr: devicePixelRatio, scale: visualViewport.scale,
        allImagesLoaded: [...document.images].every(img => img.complete && img.naturalWidth > 0 && img.src.startsWith("data:")),
        signature: (() => {
          const img = document.querySelector('img[role="presentation"]');
          const rect = img.getBoundingClientRect();
          const card = img.closest("table").getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, sourceWidth: img.naturalWidth, sourceHeight: img.naturalHeight, cardWidth: card.width, cardY: card.y, radius: getComputedStyle(img.closest("table")).borderTopLeftRadius };
        })(),
        documentHeight: document.documentElement.scrollHeight,
        footerBottom: document.querySelector("body > table > tbody > tr > td > table > tbody > tr:last-child").getBoundingClientRect().bottom,`);
script = script.replace("if (measurements.width !== 198", `if (measurements.dpr !== 1 || measurements.scale !== 1 || !measurements.allImagesLoaded ||
      measurements.signature.height !== 4 || measurements.signature.width !== measurements.signature.cardWidth - 2 ||
      measurements.signature.y !== measurements.signature.cardY + 1 ||
      measurements.signature.sourceWidth !== 1116 || measurements.signature.sourceHeight !== 8) throw new Error(JSON.stringify(measurements));
    if (measurements.width !== 198`);
script = script.replace('await page.screenshot({ path: path.join(reportDir, `${name}-header.png`), clip: { x: 75, y: 24, width: 550, height: 180 } });', 'await writeFile(path.join(reportDir, `${name}-measurements.json`), JSON.stringify(measurements, null, 2));');
assert.ok(!script.includes("clip:"));
const transformed = await transform(script, { loader: "ts", format: "esm", target: "node22" });
await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);
const assets = [];
for (const radius of [14, 16]) {
  const file = `smart360-email-signature-r${radius}-1116x8.png`;
  const bytes = await readFile(path.join(root, "artifacts/smart360/public/brand", file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const name = radius === 14 ? "gril-dobrodosli-samostojno" : "gril-vodnik-pripravljen-samostojno";
  const html = await readFile(path.join(dir, name + ".html"), "utf8");
  assert.ok(html.includes(bytes.toString("base64")), "Offline HTML must embed exact hosted PNG bytes");
  assets.push({ radius, file, url: `https://smart360.info/brand/${file}?v=tour-1`, sha256, bytes: bytes.length, sourceWidth: 1116, sourceHeight: 8, displayHeight: 4 });
}
await writeFile(path.join(dir, "email-assets.json"), JSON.stringify({
  stops: [[0,"#E8862E"],[0.3,"#2F72C4"],[0.55,"#3E9E4E"],[0.8,"#F5C62E"],[1,"#E8862E"]],
  capture: "Full existing owner-email fixture renders, Chromium 100%, DPR 1, offline actual assets. No auth, DB or delivery.",
  fixtureSource: "artifacts/api-server/scripts/generate-owner-email-previews.ts",
  publication: "Assets committed to public/brand beside existing logo. Not published by this script; production availability must be verified separately.",
  assets,
}, null, 2));