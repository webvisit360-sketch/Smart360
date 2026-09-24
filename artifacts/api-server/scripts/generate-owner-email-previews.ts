// Offline approval fixtures only. Never invokes a mail delivery function.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { buildWelcomeEmailBody } from "../src/lib/lifecycleEmails";
import { renderConciergeWelcomeEmail } from "../src/lib/conciergeWelcomeEmail";
import { renderReadyNotice } from "../src/lib/guideReadyNotice";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const reportDir = path.join(root, "reports");
const oldPreviewDir = path.join(root, "previews/management-mode");
await mkdir(reportDir, { recursive: true });
const brandDir = path.join(root, "artifacts/smart360/public/brand");
const font = (await readFile(path.join(root, "artifacts/api-server/assets/Archivo.ttf"))).toString("base64");
const marks = new Map(await Promise.all([60, 138].map(async size =>
  [size, (await readFile(path.join(brandDir, `smart360-email-header-${size}.png`))).toString("base64")] as const)));
const deadLink = "https://preview.invalid/disabled-example-not-a-real-link";
const ready = { tenantName: "Piknik prostor in kamp Gril", slug: "glamping-gril", guideUrl: "https://smart360.info/glamping-gril" };
const previews = [
  ["gril-dobrodosli-samostojno", buildWelcomeEmailBody({
    to: "preview-recipient@example.invalid", propertyName: "Apartmaji Gril",
    setPasswordUrl: deadLink,
  }, "Smart360 <info@webvisit360.com>").html, "self-service.html"],
  ["gril-dobrodosli-ureja-smart360", renderConciergeWelcomeEmail({
    tenantName: "Apartmaji Gril", guideUrl: deadLink,
  }).html, "concierge.html"],
  ["gril-vodnik-pripravljen-samostojno", (await renderReadyNotice({ ...ready, mode: "self_service" })).html, null],
  ["gril-vodnik-pripravljen-ureja-smart360", (await renderReadyNotice({ ...ready, mode: "concierge" })).html, null],
] as const;
const browser = await chromium.launch({ executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  for (const [name, original, olderPath] of previews) {
    if (olderPath) await writeFile(path.join(oldPreviewDir, olderPath), original);
    let html = original;
    for (const [size, base64] of marks) {
      html = html.replaceAll(`https://smart360.info/brand/smart360-email-header-${size}.png`, `data:image/png;base64,${base64}`);
    }
    html = html.replace("</head>", `<style>@font-face{font-family:Archivo;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:100 900}</style></head>`);
    if (/src="https?:/.test(html)) throw new Error(`External image in ${name}`);
    const htmlPath = path.join(reportDir, `${name}.html`);
    await writeFile(htmlPath, html);
    const page = await browser.newPage({ viewport: { width: 720, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(reportDir, `${name}.png`), fullPage: true });
    await page.close();
    console.log(`${name}: HTML + PNG`);
  }
} finally {
  await browser.close();
}