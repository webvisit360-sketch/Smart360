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
import { _setReadyDeliveryOverride, defaultReadyMessage, makeReadySticker, renderReadyNotice, sendReadyNotice } from "../lib/guideReadyNotice";
import { parseLifecycleHistory } from "../lib/lifecycleHistory";
import { HOST_NOTIFICATION_REPLY_TO } from "../lib/businessContact";
import { ADMIN_ROUTE_REGISTRY } from "../lib/actorGate";

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
    assert.match(rendered.html, /src="https:\/\/smart360\.info\/brand\/smart360-znak-40\.png" width="46" height="46"/);
    assert.ok(rendered.html.includes("background:#157347"));
    assert.ok(rendered.html.includes("background:#F4F6F2"));
    assert.ok(rendered.html.includes("border-radius:16px;border-collapse:separate"));
    assert.equal((rendered.html.match(/border-radius:999px/g) ?? []).length, mode === "self_service" ? 2 : 1);
    assert.match(rendered.html, /color:#157347[^>]*>SMART360/);
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

test("intercepted recipient and independent archive each contain vector PDF + CID QR; failures remain redacted", async () => {
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
    assert.equal(attachments[0].filename, "nalepka-qr-glamping-gril.pdf");
    assert.equal(attachments[1].content_id, "guide-ready-qr");
    const pdf = Buffer.from(attachments[0].content, "base64");
    assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
    const dir = mkdtempSync(path.join(os.tmpdir(), "ready-pdf-"));
    try {
      const file = path.join(dir, "sticker.pdf");
      writeFileSync(file, pdf);
      const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
      assert.match(info, /Page size:\s+419\.53 x 297\.64 pts/);
      const fonts = execFileSync("pdffonts", [file], { encoding: "utf8" });
      assert.match(fonts, /Archivo-ExtraBold/);
      assert.match(fonts, /Archivo-SemiBold/);
      execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1600", "-png", file, path.join(dir, "screen")]);
      const screenshot = await sharp(path.join(dir, "screen.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(jsQR(new Uint8ClampedArray(screenshot.data), screenshot.info.width, screenshot.info.height)?.data, url);
      const atBorder = screenshot.data.subarray(Math.floor(screenshot.info.width / 2) * 4, Math.floor(screenshot.info.width / 2) * 4 + 3);
      assert.deepEqual([...atBorder], [232, 235, 230], "0.5 pt A6 hairline must use #E8EBE6 inside the page");
      let blackPixels = 0;
      for (let i = 0; i < screenshot.data.length; i += 4) {
        if (screenshot.data[i] === 0 && screenshot.data[i + 1] === 0 && screenshot.data[i + 2] === 0) blackPixels++;
      }
      assert.ok(blackPixels > 30000, "the PDF QR modules are true black, not CGP dark green");
      const raw = readFileSync(file).toString("latin1");
      assert.match(raw, /\/Font/);
      assert.match(raw, /\/Image/); // original official znak; QR itself is vector shapes
      assert.ok(pdf.length > 1000);
    } finally { rmSync(dir, { recursive: true, force: true }); }
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
  const pdf = await makeReadySticker({ ...base, mode: "concierge", tenantName: name });
  const dir = mkdtempSync(path.join(os.tmpdir(), "ready-long-name-"));
  try {
    const file = path.join(dir, "long-name.pdf");
    writeFileSync(file, pdf);
    assert.match(execFileSync("pdftotext", [file, "-"], { encoding: "utf8" }).replace(/\s+/g, " "), /Apartmaji in počitniške hiše Zeleni grič pod gorami/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("owner approval reports: self-contained mode-specific HTML and A6 print PDF, never send", async () => {
  const reports = path.join(root, "reports");
  mkdirSync(reports, { recursive: true });
  const mark = readFileSync(path.join(root, "artifacts/smart360/public/brand/smart360-znak-40.png")).toString("base64");
  const archivo = readFileSync(path.join(root, "artifacts/api-server/assets/Archivo.ttf")).toString("base64");
  for (const mode of ["self_service", "concierge"] as const) {
    const rendered = await renderReadyNotice({ ...base, mode });
    const html = rendered.html.replaceAll("https://smart360.info/brand/smart360-znak-40.png", `data:image/png;base64,${mark}`)
      .replace("</head>", `<style>@font-face{font-family:Archivo;src:url(data:font/ttf;base64,${archivo}) format('truetype');font-weight:100 900}</style></head>`);
    const name = mode === "self_service" ? "samostojno" : "ureja-smart360";
    writeFileSync(path.join(reports, `gril-vodnik-pripravljen-${name}.html`), html);
    assert.ok(!html.includes('src="https:'));
  }
  const pdf = await makeReadySticker({ ...base, mode: "self_service" });
  writeFileSync(path.join(reports, "nalepka-qr-glamping-gril.pdf"), pdf);
});