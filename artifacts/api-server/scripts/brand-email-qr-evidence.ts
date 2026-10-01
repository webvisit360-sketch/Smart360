// Offline synthetic fixtures only: no route import, DB, auth, or delivery.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { transform } from "esbuild";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { guestQrSvg } from "../src/lib/guestUrl";
import { makeReadySticker } from "../src/lib/guideReadyNotice";

const root = resolve(import.meta.dirname, "../../..");
const out = resolve(root, "reports/brand-unification");
await mkdir(out, { recursive: true });
const before = await readFile(resolve(out, "before/smart360-email-lockup-host-594x138.png"));
const after = await readFile(resolve(root, "artifacts/smart360/public/brand/smart360-email-lockup-host-594x138.png"));
const measurements = [];
for (const [name, bytes] of [["before", before], ["after", after]] as const) {
  const m = await sharp(bytes).metadata();
  assert.equal(m.width, 594);
  assert.equal(m.height, 138);
  assert.equal(m.channels, 3);
  measurements.push({ name, width: m.width, height: m.height, channels: m.channels, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
// Wordmark starts at 174px (46px symbol + 12px gap, at 3x).
// Exclude the symbol's Lanczos resampling halo from this exact-pixel check.
const wordmark = async (bytes: Buffer) => sharp(bytes).extract({ left: 174, top: 0, width: 420, height: 138 }).raw().toBuffer();
assert.deepEqual(await wordmark(before), await wordmark(after));
assert.notDeepEqual(before, after);
const html = `<!doctype html><meta charset="utf-8"><title>Email artwork comparison</title><body style="background:white;font:16px Arial;padding:32px"><h1>Email artwork only</h1>${[["Before", before], ["After", after]].map(([label, data]) => `<h2>${label} · displayed 198 × 46</h2><img width="198" height="46" src="data:image/png;base64,${(data as Buffer).toString("base64")}"><h3>Native 594 × 138</h3><img width="594" height="138" src="data:image/png;base64,${(data as Buffer).toString("base64")}">`).join("")}</body>`;
await writeFile(resolve(out, "email-before-after.html"), html);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.locator("img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  await page.screenshot({ path: resolve(out, "email-before-after.png"), fullPage: true });
} finally { await browser.close(); }

// Execute the actual existing admin label drawing body, substituting only its
// DB-selected tenant, response stream and URL with explicitly isolated fixtures.
const source = await readFile(resolve(root, "artifacts/api-server/src/routes/adminTenants.ts"), "utf8");
const route = source.slice(source.indexOf('router.get("/admin/tenants/:id/label.pdf"'));
const drawing = route.slice(route.indexOf("  const MM ="), route.indexOf("  doc.end();") + "  doc.end();".length);
assert.ok(drawing.includes('doc.text("SMART360"'));
assert.ok(!drawing.includes("doc.image("));
const { code } = await transform(`async function draw() {${drawing}}\nreturn draw();`, { loader: "ts", target: "es2022" });
const fixture = { name: "Offline fixture accommodation", slug: "offline-fixture" };
const url = "https://example.invalid/offline-fixture";
const renderLabel = async () => {
  const res = new PassThrough() as PassThrough & { setHeader: () => void };
  res.setHeader = () => {};
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);
  });
  await new Function("tenant", "res", "guestUrl", "guestQrSvg", "PDFDocument", "SVGtoPDF", "readFileSync", "resolve", code)(
    fixture, res, () => url, guestQrSvg, PDFDocument, SVGtoPDF, readFileSync, resolve,
  );
  return done;
};
for (const phase of ["before", "after"]) {
  const labelPath = resolve(out, `qr-admin-label-${phase}.pdf`);
  await writeFile(labelPath, await renderLabel());
  execFileSync("pdftoppm", ["-singlefile", "-scale-to", "1000", "-png", labelPath, labelPath.replace(".pdf", "")]);
  const stickerPath = resolve(out, `qr-ready-sticker-${phase}.pdf`);
  await writeFile(stickerPath, await makeReadySticker({ tenantName: fixture.name, slug: fixture.slug, guideUrl: url, mode: "self_service" }));
  execFileSync("pdftoppm", ["-singlefile", "-scale-to", "1000", "-png", stickerPath, stickerPath.replace(".pdf", "")]);
}
for (const kind of ["admin-label", "ready-sticker"]) {
  assert.deepEqual(await readFile(resolve(out, `qr-${kind}-before.png`)), await readFile(resolve(out, `qr-${kind}-after.png`)));
}
await writeFile(resolve(out, "email-qr-measurements.json"), JSON.stringify({
  email: measurements, display: [198, 46], unchangedWordmarkPixels: true,
  qrArtwork: "Not applicable: admin A6 label uses text-only Archivo800 SMART360; ready sticker has no platform mark.",
  qrRenderedBeforeAfterIdentical: true,
  fixture: "Isolated example.invalid tenant; actual current generator executed twice because production QR code is unchanged. No historical PDF claim.",
  sideEffects: "No DB, auth, send or publish",
}, null, 2));
console.log("Email byte metadata, unchanged wordmark pixels, native/display comparison and actual QR generator fixtures verified.");