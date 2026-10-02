import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
import { _setReadyDeliveryOverride, defaultReadyMessage, renderReadyNotice, sendReadyNotice } from "../lib/guideReadyNotice";
import { guideStickerLayout, makeGuideStickers } from "../lib/guideStickers";
import { parseLifecycleHistory } from "../lib/lifecycleHistory";
import { HOST_NOTIFICATION_REPLY_TO } from "../lib/businessContact";
import { ADMIN_ROUTE_REGISTRY } from "../lib/actorGate";
import { GetTenantLabelPdfQueryParams } from "@workspace/api-zod";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const url = "https://smart360.info/glamping-gril";
const base = { tenantName: "Piknik prostor in kamp Gril", slug: "glamping-gril", guideUrl: url };
afterEach(() => _setReadyDeliveryOverride(null));

test("both ready email modes use exact copy, official brand and guarded owner routes", async () => {
  for (const mode of ["self_service", "concierge"] as const) {
    const rendered = await renderReadyNotice({ ...base, mode });
    assert.equal(rendered.subject, "Vaš digitalni vodnik je pripravljen");
    assert.match(rendered.text, /Spoštovani,[\s\S]*z veseljem sporočamo/);
    assert.ok(rendered.text.includes(defaultReadyMessage(url)));
    assert.match(rendered.html, /src="https:\/\/smart360\.info\/brand\/smart360-email-lockup-host-594x138\.png\?v=faceted-1" width="198" height="46" alt="Smart360" style="display:block;width:198px;height:46px;/);
    assert.ok(rendered.html.includes("background:#157347"));
    assert.ok(rendered.html.includes("max-width:560px;background:#FFFFFF"));
    assert.ok(rendered.html.includes("border-radius:16px;border-collapse:separate"));
    assert.equal((rendered.html.match(/border-radius:999px/g) ?? []).length, mode === "self_service" ? 2 : 1);
    assert.doesNotMatch(rendered.html, />SMART360<\/|>Smart360<\/div>/);
    assert.doesNotMatch(rendered.html, /#DD9A2B|#E8801B|background:#121A14/);
    assert.ok(rendered.html.includes('src="data:image/png;base64,'));
    assert.ok(rendered.html.includes(`href="${url}"`));
    assert.equal(rendered.html.includes("Uredite vodnik"), mode === "self_service");
    assert.equal(rendered.text.includes("Uredite vodnik"), mode === "self_service");
    assert.doesNotMatch(rendered.html, /portal\/povabilo|token=/);
    assert.doesNotMatch(rendered.html, /<script/i);
    assert.ok((await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H" })).includes("<svg"));
  }
  for (const [method, endpoint] of [["get", "ready-preview"], ["post", "ready-preview"], ["post", "send-ready"]]) {
    assert.equal(ADMIN_ROUTE_REGISTRY.find(r => r.method === method && r.path === `/admin/tenants/:id/host/${endpoint}`)?.binding.kind, "owner-only");
  }
});

test("intercepted recipient and independent archive each contain both vector PDFs + CID QR; failures remain redacted", async () => {
  process.env["ORDER_EMAIL_FROM"] = HOST_NOTIFICATION_REPLY_TO;
  const captured: Record<string, unknown>[] = [];
  _setReadyDeliveryOverride(async (body) => {
    captured.push(body);
    return captured.length === 1
      ? { ok: true, providerMessageId: "fixture-message" }
      : { ok: false, error: { stage: "provider", code: "unsafe private@example.test https://secret.test", message: "private@example.test", httpStatus: 400 } };
  });
  const self = { ...base, mode: "self_service" as const, recipient: "host@example.test" };
  const host = await sendReadyNotice(self, "fixture-host");
  const archive = await sendReadyNotice({ ...self, recipient: HOST_NOTIFICATION_REPLY_TO }, "fixture-archive");
  assert.equal(host.ok, true);
  assert.equal(archive.ok, false);
  assert.equal(captured.length, 2);
  for (const body of captured) {
    assert.equal(body["reply_to"], HOST_NOTIFICATION_REPLY_TO);
    const attachments = body["attachments"] as Array<{ filename: string; content: string; content_id?: string }>;
    assert.equal(attachments.length, 3);
    assert.equal(attachments[0].filename, "smart360-nalepka-velika.pdf");
    assert.equal(attachments[1].filename, "smart360-nalepka-mala.pdf");
    assert.equal(attachments[2].content_id, "guide-ready-qr");
    assert.match(body["html"] as string, /src="cid:guide-ready-qr"/);
    assert.ok(Buffer.from(attachments[2].content, "base64").subarray(1, 4).equals(Buffer.from("PNG")));
    for (const attachment of attachments.slice(0, 2)) {
    const pdf = Buffer.from(attachment.content, "base64");
    assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
    const dir = mkdtempSync(path.join(os.tmpdir(), "ready-pdf-"));
    try {
      const file = path.join(dir, "sticker.pdf");
      writeFileSync(file, pdf);
      const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
      assert.match(info, /Pages:\s+1/);
      const images = execFileSync("pdfimages", ["-list", file], { encoding: "utf8" });
      assert.equal(images.trim().split("\n").length, 2, "sticker has no logo or raster images");
      const fonts = execFileSync("pdffonts", [file], { encoding: "utf8" });
      assert.match(fonts, /Archivo-ExtraBold/);
      execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1600", "-png", file, path.join(dir, "screen")]);
      const screenshot = await sharp(path.join(dir, "screen.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(jsQR(new Uint8ClampedArray(screenshot.data), screenshot.info.width, screenshot.info.height)?.data, url);
      // Sample only module interiors, masking text, borders and antialiased
      // edges. Both trim sizes must use the binding reference's #121A14 ink.
      const layout = guideStickerLayout(attachment.filename.includes("velika") ? "large" : "small");
      const matrix = QRCode.create(url, { errorCorrectionLevel: "H" }).modules;
      const moduleSize = layout.qr.size / (matrix.size + 8);
      let inkModules = 0;
      for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) {
          const px = Math.floor((layout.qr.x + (x + 4.5) * moduleSize) / layout.width * screenshot.info.width);
          const py = Math.floor((layout.qr.y + (y + 4.5) * moduleSize) / layout.height * screenshot.info.height);
          const expected = matrix.get(y, x) ? [18, 26, 20] : [255, 255, 255];
          if (matrix.get(y, x)) inkModules++;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const offset = ((py + dy) * screenshot.info.width + px + dx) * 4;
              for (let channel = 0; channel < 3; channel++) {
                assert.ok(Math.abs(screenshot.data[offset + channel] - expected[channel]) <= 3,
                  `QR module ${x},${y} must use ${matrix.get(y, x) ? "#121A14" : "white"} (${attachment.filename})`);
              }
            }
          }
        }
      }
      assert.ok(inkModules > 100, "color mask samples the QR rather than surrounding artwork");
      const raw = readFileSync(file).toString("latin1");
      assert.match(raw, /\/Font/);
      assert.ok(pdf.length > 1000);
    } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  }
  assert.deepEqual(captured[0]["to"], ["host@example.test"]);
  assert.deepEqual(captured[1]["to"], [HOST_NOTIFICATION_REPLY_TO]);
  const row = parseLifecycleHistory(JSON.stringify({
    version: 1, kind: "guide_ready", deliveryStatus: "accepted",
    archiveStatus: "failed", deliveryFailure: null,
    archiveFailure: "private@example.test https://secret.test",
  }), new Date());
  assert.equal(row?.deliveryStatus, "accepted");
  assert.equal(row?.archiveStatus, "failed");
  assert.equal(row?.archiveFailure, null);
});

test("Archivo instances carry actual 800/600 weights; long tenant name wraps without truncation", async () => {
  function weight(buffer: Buffer): number {
    const count = buffer.readUInt16BE(4);
    for (let i = 0; i < count; i++) {
      const entry = 12 + i * 16;
      if (buffer.toString("ascii", entry, entry + 4) === "OS/2") return buffer.readUInt16BE(buffer.readUInt32BE(entry + 8) + 4);
    }
    throw new Error("OS/2 weight table missing");
  }
  assert.equal(weight(readFileSync(path.join(root, "artifacts/api-server/assets/Archivo-800.ttf"))), 800);
  assert.equal(weight(readFileSync(path.join(root, "artifacts/api-server/assets/Archivo-600.ttf"))), 600);
  const name = "Apartmaji in počitniške hiše Zeleni grič pod gorami";
  const stickers = await makeGuideStickers(name, url);
  const dir = mkdtempSync(path.join(os.tmpdir(), "ready-long-name-"));
  try {
    for (const [size, pdf] of Object.entries(stickers)) {
      const file = path.join(dir, `long-name-${size}.pdf`);
      writeFileSync(file, pdf);
      assert.match(execFileSync("pdftotext", [file, "-"], { encoding: "utf8" }).replace(/\s+/g, " "), /Apartmaji in počitniške hiše Zeleni grič pod gorami/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("owner approval reports: self-contained mode-specific HTML, never send", async () => {
  const reports = path.join(root, "reports");
  mkdirSync(reports, { recursive: true });
  const mark = readFileSync(path.join(root, "artifacts/smart360/public/brand/smart360-email-lockup-host-594x138.png")).toString("base64");
  const archivo = readFileSync(path.join(root, "artifacts/api-server/assets/Archivo.ttf")).toString("base64");
  for (const mode of ["self_service", "concierge"] as const) {
    const rendered = await renderReadyNotice({ ...base, mode });
    const html = rendered.html.replaceAll("https://smart360.info/brand/smart360-email-lockup-host-594x138.png?v=faceted-1", `data:image/png;base64,${mark}`)
      .replace("</head>", `<style>@font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivo}) format('truetype');font-weight:100 900}</style></head>`);
    const name = mode === "self_service" ? "samostojno" : "ureja-smart360";
    writeFileSync(path.join(reports, `gril-vodnik-pripravljen-${name}.html`), html);
    assert.ok(!html.includes('src="https:'));
  }
});

test("custom ready copy stays exact with both PDFs and inline CID PNG", async () => {
  let captured: Record<string, unknown> | undefined;
  _setReadyDeliveryOverride(async body => {
    captured = body;
    return { ok: true, providerMessageId: "offline-custom" };
  });
  const message = "Pozdravljeni,\n\nTo je vaše nespremenjeno besedilo.";
  const input = { ...base, mode: "concierge" as const, recipient: "offline@example.invalid", subject: "Moja zadeva", message };
  const rendered = await renderReadyNotice(input, "cid");
  assert.equal(rendered.message, message);
  assert.ok(rendered.text.includes(message));
  await sendReadyNotice(input, "offline-custom");
  assert.equal(captured?.subject, input.subject);
  assert.equal(captured?.html, rendered.html);
  assert.equal(captured?.text, rendered.text);
  assert.equal((captured?.attachments as unknown[]).length, 3);
});

test("admin PDF query validates both sizes, defaults large, rejects malformed values", () => {
  assert.equal(GetTenantLabelPdfQueryParams.parse({}).size, "large");
  for (const size of ["large", "small"]) assert.equal(GetTenantLabelPdfQueryParams.parse({ size }).size, size);
  for (const size of ["", "a6", "LARGE", ["large", "small"], { size: "small" }, null]) {
    assert.equal(GetTenantLabelPdfQueryParams.safeParse({ size }).success, false);
  }
  const route = readFileSync(path.join(root, "artifacts/api-server/src/routes/adminTenants.ts"), "utf8");
  assert.match(route, /GetTenantLabelPdfQueryParams\.safeParse\(req\.query\)/);
  assert.match(route, /makeGuideSticker\(tenant\.name, url, size\)/);
  const ui = readFileSync(path.join(root, "artifacts/smart360/src/components/admin/slug-field.tsx"), "utf8");
  assert.ok(ui.includes("label.pdf?size=large"));
  assert.ok(ui.includes("label.pdf?size=small"));
});