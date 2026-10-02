// Offline evidence runner: execute the existing preview script, changing only
// evidence destinations/instrumentation. No application sources are modified.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { transform } from "../../artifacts/api-server/node_modules/esbuild/lib/main.js";
import pg from "../../artifacts/api-server/node_modules/pg/lib/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reportDir = path.join(root, "reports/znak-final");
const sourcePath = path.join(root, "artifacts/api-server/scripts/generate-owner-email-previews.ts");
const originalScript = await readFile(sourcePath, "utf8");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(reportDir, { recursive: true });

// Fail closed if a renderer unexpectedly attempts delivery or database access.
globalThis.fetch = async () => { throw new Error("Network fetch is forbidden for offline email evidence"); };
pg.Pool.prototype.connect = async () => { throw new Error("Database connections are forbidden for offline email evidence"); };
pg.Pool.prototype.query = async () => { throw new Error("Database queries are forbidden for offline email evidence"); };

let script = originalScript;
script = script.replace('"@playwright/test"', JSON.stringify(import.meta.resolve("@playwright/test")));
for (const module of ["lifecycleEmails", "conciergeWelcomeEmail", "guideReadyNotice", "emailTemplate"]) {
  script = script.replace(`"../src/lib/${module}"`, JSON.stringify(`file://${root}/artifacts/api-server/src/lib/${module}.ts`));
}
script = script.replace(
  'const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");',
  `const root = ${JSON.stringify(root)};`,
);
script = script.replace('const reportDir = path.join(root, "reports");', 'const reportDir = path.join(root, "reports/znak-final");');
script = script.replace(
  "if (olderPath) await writeFile(path.join(oldPreviewDir, olderPath), original);",
  "// Historical evidence is intentionally not written.",
);
script = script.replace(
  'await page.goto(`file://${htmlPath}`);',
  'await page.route(/^https?:/, route => route.abort());\n    await page.goto(`file://${htmlPath}`);',
);
script = script.replace(
  'gap: title.getBoundingClientRect().top - box.bottom,',
  `gap: title.getBoundingClientRect().top - box.bottom,
        devicePixelRatio: window.devicePixelRatio,
        visualViewportScale: window.visualViewport?.scale,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        footerBottom: document.querySelector('body > table > tbody > tr > td > table > tbody > tr:last-child')?.getBoundingClientRect().bottom,
        imageSourcesAreInline: [...document.images].every(img => img.src.startsWith("data:")),
        fontLoaded: document.fonts.check("800 24px Archivo"),
        browserUserAgent: navigator.userAgent,`,
);
script = script.replace(
  "if (measurements.width !== 198",
  "if (measurements.devicePixelRatio !== 1 || measurements.visualViewportScale !== 1 || !measurements.imageSourcesAreInline || !measurements.fontLoaded || measurements.documentWidth !== 720) throw new Error(`Native capture check failed: ${JSON.stringify(measurements)}`);\n    if (measurements.width !== 198",
);
script = script.replace(
  'await page.screenshot({ path: path.join(reportDir, `${name}-header.png`), clip: { x: 75, y: 24, width: 550, height: 180 } });',
  'await writeFile(path.join(reportDir, `${name}-measurements.json`), JSON.stringify(measurements, null, 2) + "\\n");',
);
assert.ok(!script.includes("clip:"));
assert.ok(!script.includes("await writeFile(path.join(oldPreviewDir"));
const transformed = await transform(script, { loader: "ts", format: "esm", target: "node22" });
await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

const cases = [
  { name: "gril-dobrodosli-samostojno", mode: "self_service", stage: "welcome", renderer: "buildWelcomeEmailBody", fixture: { to: "preview-recipient@example.invalid", propertyName: "Apartmaji Gril", setPasswordUrl: "https://preview.invalid/disabled-example-not-a-real-link", from: "Smart360 <info@webvisit360.com>" } },
  { name: "gril-dobrodosli-ureja-smart360", mode: "concierge", stage: "welcome", renderer: "renderConciergeWelcomeEmail", fixture: { tenantName: "Apartmaji Gril", guideUrl: "https://preview.invalid/disabled-example-not-a-real-link" } },
  ...["self_service", "concierge"].map(mode => ({ name: `gril-vodnik-pripravljen-${mode === "self_service" ? "samostojno" : "ureja-smart360"}`, mode, stage: "guide-ready", renderer: "renderReadyNotice", fixture: { tenantName: "Piknik prostor in kamp Gril", slug: "glamping-gril", guideUrl: "https://smart360.info/glamping-gril", mode }, qrInlining: "data (same renderer; delivered email uses CID attachment)" })),
];
for (const item of cases) {
  item.htmlFile = `${item.name}.html`;
  item.pngFile = `${item.name}.png`;
  const png = PNG.sync.read(await readFile(path.join(reportDir, item.pngFile)));
  item.fullPngDimensions = { width: png.width, height: png.height };
  item.measurements = JSON.parse(await readFile(path.join(reportDir, `${item.name}-measurements.json`), "utf8"));
  assert.equal(png.width, item.measurements.documentWidth);
  assert.equal(png.height, item.measurements.documentHeight);
  assert.ok(item.measurements.footerBottom < png.height, "Entire footer must be inside the full-page capture");
  item.htmlSha256 = hash(await readFile(path.join(reportDir, item.htmlFile)));
  item.pngSha256 = hash(await readFile(path.join(reportDir, item.pngFile)));
}
const sourceFiles = [
  "artifacts/api-server/scripts/generate-owner-email-previews.ts",
  "artifacts/api-server/scripts/generate-email-header-marks.mjs",
  "artifacts/api-server/src/lib/lifecycleEmails.ts",
  "artifacts/api-server/src/lib/conciergeWelcomeEmail.ts",
  "artifacts/api-server/src/lib/guideReadyNotice.ts",
  "artifacts/api-server/src/lib/emailTemplate.ts",
  "artifacts/smart360/public/brand/smart360-kolobar-faceted.svg",
  "artifacts/smart360/public/brand/smart360-email-lockup-host-594x138.png",
  "artifacts/api-server/assets/Archivo.ttf",
];
const sources = [];
for (const file of sourceFiles) sources.push({ file, sha256: hash(await readFile(path.join(root, file))) });
assert.equal(sources[0].sha256, hash(originalScript), "Preview generator was unchanged during execution");
await writeFile(path.join(reportDir, "owner-emails-verification.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  evidence: "Complete CURRENT production-renderer templates with explicitly labelled offline fixture data, not sent emails or mail-client screenshots.",
  generation: "Existing generate-owner-email-previews.ts executed with evidence-only destination changes, no historical writes, no header crops, and native-size measurements.",
  rendererChanges: "None. Preview-only replacements inline the exact current faceted lockup PNG and Archivo font for self-contained HTML.",
  capture: "Chromium, viewport 720x1000 CSS px, DPR 1, visualViewport scale 1, no zoom or CSS transform, fullPage true, no image resizing.",
  safety: "No delivery functions invoked; network fetch and pg Pool connect/query forbidden; Chromium HTTP(S) requests aborted. No database reads/writes.",
  lockup: { sourcePixels: "594x138", displayedCssPixels: "198x46", sourceUrl: "https://smart360.info/brand/smart360-email-lockup-host-594x138.png?v=faceted-1", titleGapCssPixels: 48 },
  sources, cases,
}, null, 2) + "\n");
console.log(JSON.stringify(cases.map(({ mode, stage, htmlFile, pngFile, fullPngDimensions }) => ({ mode, stage, htmlFile, pngFile, fullPngDimensions })), null, 2));
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const sections = [];
for (const item of cases) {
  const png = (await readFile(path.join(reportDir, item.pngFile))).toString("base64");
  sections.push(`<section><h2>${item.stage === "welcome" ? "Dobrodošli / Welcome" : "Vodnik pripravljen / Guide ready"} — ${item.mode === "self_service" ? "Samostojno / self_service" : "Ureja Smart360 / concierge"}</h2><p>Fixture data: <code>${escape(JSON.stringify(item.fixture))}</code></p><p>Complete PNG: ${item.fullPngDimensions.width} × ${item.fullPngDimensions.height} pixels. <a href="${item.pngFile}">Original PNG</a> · <a href="${item.htmlFile}">Self-contained actual-template HTML</a></p><img src="data:image/png;base64,${png}" width="${item.fullPngDimensions.width}" height="${item.fullPngDimensions.height}" alt="Complete ${escape(item.stage)} template, mode ${escape(item.mode)}"></section>`);
}
await writeFile(path.join(reportDir, "owner-emails-native-100-percent.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Current complete owner emails — native 100%</title><style>body{margin:24px;font:16px/1.5 system-ui;color:#121a14}h1{font-size:26px}h2{font-size:21px}section{margin:40px 0}p{max-width:1000px}code{overflow-wrap:anywhere}img{display:block;max-width:none;object-fit:none}a{color:#157347}</style></head><body><h1>Current complete owner-email templates — native 100%</h1><p><strong>Offline samples from the actual current production renderers, not actual mail-client screenshots or sent emails.</strong> All four whole templates were generated using the existing generate-owner-email-previews script. No application source changes, no email delivery, no database queries, no historical evidence changes.</p><p>Chromium full-page captures at 100% / DPR 1 / visualViewport scale 1. Images below retain native dimensions: one screenshot pixel equals one CSS pixel at browser zoom 100%; no crops or responsive shrinking. Narrow screens scroll horizontally. The current faceted lockup is 594 × 138 source pixels displayed at 198 × 46 CSS pixels in every template. The full bilingual sender notes and agency footers are included.</p><p>Fixture names and URLs are samples from the existing preview script, not database-derived tenant or delivery records. Welcome links intentionally use preview.invalid; ready samples use https://smart360.info/glamping-gril and generated inline QR data. Ready email delivery uses a CID QR attachment; only the offline preview inlines it. The preview HTML also embeds the exact current lockup and Archivo font so rendering is self-contained. This does not certify Gmail, Outlook or another mail client.</p><p><a href="owner-emails-verification.json">Source hashes, measurements and fixture manifest</a></p>${sections.join("\n")}</body></html>\n`);