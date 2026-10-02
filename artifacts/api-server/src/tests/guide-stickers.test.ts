import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import jsQR from "jsqr";
import {
  guideStickerLayout, guideStickerNameLayout, makeGuideSticker, makeGuideStickers,
} from "../lib/guideStickers";

const names = [
  "Turizem Drobež",
  "Apartmaji Meli Pu",
  "Deliberately long accommodation name with panoramic mountain views and exceptionally welcoming family apartments",
  "ČŽŠé".repeat(120),
  "A\u0301".repeat(120),
];
const url = "https://guide.smart360.si/g/meli-pu?lang=sl&source=print";

test("Archivo fonts have authentic 500/600/800 weights and expected metrics", () => {
  for (const weight of [500, 600, 800]) {
    const doc = new PDFDocument({ autoFirstPage: false });
    const root = process.cwd().endsWith("api-server") ? process.cwd() : path.resolve("artifacts/api-server");
    doc.font(path.join(root, "assets", `Archivo-${weight}.ttf`));
    // PDFKit's embedded font object exposes fontkit's OS/2 table.
    const embedded = (doc as unknown as {
      _font: { ascender: number; descender: number; font: { familyName: string; "OS/2": { usWeightClass: number } } };
    })._font;
    assert.match(embedded.font.familyName, /Archivo/);
    assert.equal(embedded.font["OS/2"].usWeightClass, weight);
    assert.equal(embedded.ascender, 878);
    assert.equal(embedded.descender, -210);
    doc.resume();
    doc.end();
  }
});

test("name layout uses two measured lines at most, bounded sizes, and grapheme-safe ellipsis", async () => {
  for (const size of ["large", "small"] as const) {
    const layout = guideStickerLayout(size);
    for (const name of names) {
      const result = await guideStickerNameLayout(name, size);
      assert.ok(result.lines.length >= 1 && result.lines.length <= 2);
      assert.ok(result.fontSize >= layout.nameMinSize && result.fontSize <= layout.nameMaxSize);
      assert.ok(result.widths.every((width) => width <= result.availableWidth));
      assert.equal(result.lineHeight, result.fontSize * 1.05);
      assert.ok(result.inkHeight <= layout.nameHeight);
      if (name === "Turizem Drobež") assert.deepEqual(result.lines, ["Turizem", "Drobež"]);
      assert.ok(layout.nameY + layout.nameHeight < layout.qr.y);
      if (name.length > 100) {
        assert.equal(result.fontSize, layout.nameMinSize);
        assert.equal(result.truncated, true);
        assert.match(result.lines.at(-1)!, /…$/u);
      } else {
        assert.equal(result.truncated, false);
        assert.equal(result.lines.join(" "), name);
      }
      assert.ok(!result.lines.some((line) => /^[\u0300-\u036f]/u.test(line)));
    }
  }
});

test("both PDFs have one RGB strip, vector text/QR, exact geometry, and decode after print rasterization", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guide-stickers-"));
  try {
    for (const [index, name] of names.entries()) {
      const pdfs = await makeGuideStickers(name, url);
      for (const size of ["large", "small"] as const) {
        const pdf = pdfs[size];
        const file = path.join(directory, `${index}-${size}.pdf`);
        await writeFile(file, pdf);
        const raw = pdf.toString("latin1");
        const bounds = raw.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
        assert.ok(bounds);
        const expected = size === "large" ? [72.5, 110, 55] : [36.3, 55, 27.5];
        assert.ok(Math.abs(Number(bounds[1]) * 25.4 / 72 - expected[0]) < 0.00001);
        assert.ok(Math.abs(Number(bounds[2]) * 25.4 / 72 - expected[1]) < 0.00001);
        const layout = guideStickerLayout(size);
        assert.ok(Math.abs(layout.qr.size * 25.4 / 72 - expected[2]) < 0.00001);
        assert.equal(layout.qr.quietModules, 4);
        assert.equal([...raw.matchAll(/\/Subtype \/Image\b/g)].length, 1);
        assert.doesNotMatch(raw, /\/Shading/);
        assert.doesNotMatch(raw, /\/SMask|\/DCTDecode/);
        assert.match(raw, /\/ColorSpace \/DeviceRGB/);
        const streams = [...raw.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gs)]
          .filter((match) => /\/FlateDecode/.test(match[1]) && !/\/Subtype \/Image/.test(match[1]))
          .map((match) => inflateSync(Buffer.from(match[2], "latin1")).toString("latin1"));
        const content = streams.find((stream) => /\/I\d+ Do/.test(stream))!;
        assert.ok(content, "Page has an image draw operation");
        assert.ok([...content.matchAll(/\bre\b/g)].length > 100, "QR remains vector rectangles");
        assert.match(content, /\bBT\b/);
        assert.doesNotMatch(content, /0\.4 0\.443137 0\.415686/);
        const fills = [...content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) scn/g)];
        assert.ok(fills.length > 3);
        fills.forEach((fill) => {
          const rgb = fill.slice(1).map(Number);
          assert.ok(rgb.every((c) => c === 1) ||
            rgb.every((c, i) => Math.abs(c * 255 - [18, 26, 20][i]) < 0.001),
          "All foreground text/QR fills are INK");
        });
        const placement = content.match(/([\d.]+) 0 0 (-[\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/)!;
        assert.ok(placement);
        [layout.width - 2 * layout.inset, -layout.ruleHeight, layout.inset, layout.ruleY + layout.ruleHeight]
          .forEach((value, i) => assert.ok(Math.abs(Number(placement[i + 1]) - value) < 0.00001));
        const stripPrefix = path.join(directory, `strip-${index}-${size}`);
        execFileSync("pdfimages", ["-png", file, stripPrefix], { stdio: "pipe" });
        const strip = await sharp(`${stripPrefix}-000.png`).raw().toBuffer({ resolveWithObject: true });
        assert.equal(strip.info.width, Math.ceil((layout.width - 2 * layout.inset) * 600 / 72));
        assert.equal(strip.info.height, Math.ceil(layout.ruleHeight * 600 / 72));
        assert.equal(strip.info.channels, 3);
        const expectedColors = [
          [232, 134, 46], [47, 114, 196], [62, 158, 78], [245, 198, 46], [232, 134, 46],
        ];
        const positions = [0, 0.30, 0.55, 0.80, 1];
        for (let y = 0; y < strip.info.height; y++) {
          for (let x = 0; x < strip.info.width; x++) {
            const at = x / (strip.info.width - 1);
            const end = positions.findIndex((p, i) => i > 0 && at <= p);
            const fraction = (at - positions[end - 1]) / (positions[end] - positions[end - 1]);
            for (let c = 0; c < 3; c++) {
              const expected = Math.round(expectedColors[end - 1][c] + fraction * (expectedColors[end][c] - expectedColors[end - 1][c]));
              assert.equal(strip.data[(y * strip.info.width + x) * 3 + c], expected);
            }
          }
        }
        assert.ok(Math.abs(layout.ruleHeight * 25.4 / 72 - (size === "large" ? 1.2 : 0.7)) < 0.00001);
        assert.ok(Math.abs(layout.ruleY * 25.4 / 72 - (size === "large" ? 94.5 : 48)) < 0.00001);
        assert.match(raw, /\/FontFile2/);
        assert.match(raw, /\/Count 1\b/);
        const text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
        assert.match(text.replace(/\s+/g, ""), /YOURDIGITALGUIDE/);
        assert.match(text, /SMART360/);
        assert.doesNotMatch(text, /https?:/);
        if (size === "large") {
          assert.match(text, /Scan with your phone camera\./);
          assert.match(text, /Everything about your stay, in one place\./);
        } else {
          assert.doesNotMatch(text, /Scan with|Everything about/);
        }
        const prefix = path.join(directory, `${index}-${size}`);
        execFileSync("pdftoppm", ["-singlefile", "-r", "300", "-png", file, prefix], { stdio: "pipe" });
        const image = await sharp(await readFile(`${prefix}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const decoded = jsQR(new Uint8ClampedArray(image.data), image.info.width, image.info.height);
        assert.equal(decoded?.data, url, `${name}: ${size} print must decode exact public URL`);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid inputs fail explicitly", async () => {
  await assert.rejects(makeGuideSticker(" ", url, "large"), /Tenant name/);
  await assert.rejects(makeGuideSticker("Name", "", "small"), /public guide URL/);
});