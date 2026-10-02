import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type GuideStickerSize = "large" | "small";
const mm = (value: number) => value * 72 / 25.4;
const INK = "#121A14";
const MUTED = "#66716A";
export const GUIDE_STICKER_COPY = {
  header: "YOUR DIGITAL GUIDE",
  scan: "Scan with your phone camera.",
  wordmark: "SMART360",
  slogan: "Everything about your stay, in one place.",
} as const;

/** All coordinates are PDF points. QR bounds INCLUDE four white modules per side.
 * The HTML reference has auto height; fixed trim sizes require a reserved name
 * box and fixed QR/footer anchors rather than allowing names to push the footer.
 */
export function guideStickerLayout(size: GuideStickerSize) {
  if (size !== "large" && size !== "small") throw new Error("Invalid guide sticker size");
  const large = size === "large";
  const width = mm(large ? 72.5 : 36.3);
  const qrSize = mm(large ? 55 : 27.5);
  return {
    width, height: mm(large ? 110 : 55),
    inset: mm(large ? 5.5 : 2.8),
    headerY: mm(large ? 6.6 : 3.3),
    headerSize: mm(large ? 3.1 : 1.8),
    headerTracking: mm(large ? 3.1 * 0.12 : 1.8 * 0.1),
    nameY: mm(large ? 11.2 : 6.4),
    nameHeight: mm(large ? 16.6 : 9.4),
    nameMaxSize: mm(large ? 9.3 : 4.6),
    nameMinSize: large ? 12 : 6,
    qr: {
      x: (width - qrSize) / 2, y: mm(large ? 29.8 : 18), size: qrSize, quietModules: 4,
      borderWidth: mm(0.3), borderRadius: mm(large ? 2.2 : 1.1),
    },
    scanY: mm(88.1), scanSize: mm(3.3),
    ruleY: mm(large ? 94.5 : 48),
    ruleHeight: mm(large ? 1.2 : 0.7),
    wordmarkY: mm(large ? 97.5 : 49.8),
    wordmarkSize: mm(large ? 5.1 : 2.6),
    sloganY: mm(104.4), sloganSize: mm(3.1),
  };
}

async function fontAsset(file: string): Promise<Buffer> {
  for (const root of [process.cwd(), path.resolve(process.cwd(), "../..")]) {
    try {
      return await readFile(path.join(root, "artifacts/api-server/assets", file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Required sticker font missing: ${file}`);
}

async function registerFonts(doc: PDFKit.PDFDocument) {
  const [medium, semibold, extraBold] = await Promise.all(
    ["Archivo-500.ttf", "Archivo-600.ttf", "Archivo-800.ttf"].map(fontAsset),
  );
  doc.registerFont("Archivo500", medium);
  doc.registerFont("Archivo600", semibold);
  doc.registerFont("Archivo800", extraBold);
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (item) => item.segment);
}

function wrapName(doc: PDFKit.PDFDocument, text: string, width: number) {
  const remaining = graphemes(text);
  const lines: string[] = [];
  // Stop at two lines; remaining graphemes signal that ellipsis is required.
  while (remaining.length && lines.length < 2) {
    let count = 0;
    let lastSpace = -1;
    let line = "";
    while (count < remaining.length && doc.widthOfString(line + remaining[count]) <= width) {
      line += remaining[count];
      if (remaining[count] === " ") lastSpace = count;
      count++;
    }
    if (!count) break;
    if (count < remaining.length && lastSpace > 0) count = lastSpace + 1;
    lines.push(remaining.splice(0, count).join("").trim());
    while (remaining[0] === " ") remaining.shift();
  }
  // Balance complete two-line names so short final words are not orphaned.
  if (!remaining.length && lines.length === 2) {
    const words = text.split(" ");
    let score = Math.abs(doc.widthOfString(lines[0]) - doc.widthOfString(lines[1]));
    for (let index = 1; index < words.length; index++) {
      const first = words.slice(0, index).join(" ");
      const second = words.slice(index).join(" ");
      const a = doc.widthOfString(first), b = doc.widthOfString(second);
      if (Math.max(a, b) <= width && Math.abs(a - b) < score) {
        lines[0] = first;
        lines[1] = second;
        score = Math.abs(a - b);
      }
    }
  }
  return { lines, remaining };
}

function fitName(doc: PDFKit.PDFDocument, name: string, layout: ReturnType<typeof guideStickerLayout>) {
  const width = layout.width - 2 * layout.inset;
  doc.font("Archivo800");
  let fontSize = layout.nameMaxSize;
  for (;;) {
    doc.fontSize(fontSize);
    const wrapped = wrapName(doc, name, width);
    const lineHeight = fontSize * 1.05;
    const ink = nameInkBounds(doc, wrapped.lines, fontSize, lineHeight);
    if (!wrapped.remaining.length && ink.inkHeight <= layout.nameHeight) {
      return { lines: wrapped.lines, fontSize, lineHeight, ...ink, truncated: false };
    }
    if (fontSize === layout.nameMinSize) {
      const lines = wrapped.lines;
      if (!lines.length) throw new Error("Sticker name box cannot fit a glyph");
      const last = graphemes(lines.pop()!);
      while (last.length && doc.widthOfString(last.join("") + "…") > width) last.pop();
      lines.push(last.join("").trimEnd() + "…");
      const finalInk = nameInkBounds(doc, lines, fontSize, lineHeight);
      if (finalInk.inkHeight > layout.nameHeight) throw new Error("Sticker name box is too short");
      return { lines, fontSize, lineHeight, ...finalInk, truncated: true };
    }
    fontSize = Math.max(layout.nameMinSize, fontSize - 0.25);
  }
}

/** PDFKit text y is an ascender-based origin, not the glyph's visible top.
 * Measure shaped glyphs so the reference's 1.05 advance does not clip accents.
 */
function nameInkBounds(doc: PDFKit.PDFDocument, lines: string[], fontSize: number, lineHeight: number) {
  const embedded = (doc as unknown as { _font: {
    ascender: number;
    font: {
      unitsPerEm: number;
      layout(text: string): {
        glyphs: Array<{ bbox: { minY: number; maxY: number } }>;
        positions: Array<{ yOffset: number; yAdvance: number }>;
      };
    };
  } })._font;
  const scale = fontSize / embedded.font.unitsPerEm;
  let top = Infinity, bottom = -Infinity;
  lines.forEach((line, index) => {
    const shaped = embedded.font.layout(line);
    let advance = 0;
    shaped.glyphs.forEach((glyph, glyphIndex) => {
      const position = shaped.positions[glyphIndex];
      const baseline = index * lineHeight + embedded.ascender * fontSize / 1000;
      top = Math.min(top, baseline - (glyph.bbox.maxY + position.yOffset + advance) * scale);
      bottom = Math.max(bottom, baseline - (glyph.bbox.minY + position.yOffset + advance) * scale);
      advance += position.yAdvance;
    });
  });
  return { inkTop: Number.isFinite(top) ? top : 0, inkHeight: Number.isFinite(bottom - top) ? bottom - top : 0 };
}

function normalizedName(name: string) {
  const normalized = name.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized) throw new Error("Tenant name is required for QR sticker");
  return normalized;
}

/** Uses the very same embedded-font metrics as production rendering. */
export async function guideStickerNameLayout(name: string, size: GuideStickerSize) {
  const doc = new PDFDocument({ autoFirstPage: false });
  await registerFonts(doc);
  const layout = guideStickerLayout(size);
  const result = fitName(doc, normalizedName(name), layout);
  const widths = result.lines.map((line) => doc.widthOfString(line));
  doc.resume();
  doc.end();
  return { ...result, widths, availableWidth: layout.width - 2 * layout.inset };
}

export async function makeGuideSticker(name: string, url: string, size: GuideStickerSize): Promise<Buffer> {
  name = normalizedName(name);
  if (!url || !/^https?:\/\//.test(url)) throw new Error("A public guide URL is required for QR sticker");
  // Never normalize/rebuild the URL: printed codes must encode the caller's exact URL.
  const matrix = QRCode.create(url, { errorCorrectionLevel: "H" }).modules;
  const layout = guideStickerLayout(size);
  const doc = new PDFDocument({
    size: [layout.width, layout.height], margin: 0, compress: true,
    info: { Title: `SMART360 — ${name} — ${size}` },
  });
  await registerFonts(doc);
  const fitted = fitName(doc, name, layout);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      doc.rect(0, 0, layout.width, layout.height).fill("#FFFFFF");
      const centered = (text: string, font: string, fontSize: number, y: number, color: string, tracking = 0) => {
        doc.font(font).fontSize(fontSize);
        const width = doc.widthOfString(text, { characterSpacing: tracking });
        if (width > layout.width - 2 * layout.inset + 0.01) throw new Error(`Sticker text exceeds bounds: ${text}`);
        doc.fillColor(color).text(text, (layout.width - width) / 2, y, { lineBreak: false, characterSpacing: tracking });
      };
      centered(GUIDE_STICKER_COPY.header, "Archivo600", layout.headerSize, layout.headerY, MUTED, layout.headerTracking);
      fitted.lines.forEach((line, index) => {
        const top = layout.nameY + (layout.nameHeight - fitted.inkHeight) / 2 - fitted.inkTop;
        centered(line, "Archivo800", fitted.fontSize, top + index * fitted.lineHeight, INK);
      });
      const qr = layout.qr;
      const moduleSize = qr.size / (matrix.size + 2 * qr.quietModules);
      // Expand far enough that even the rounded inner corners cannot enter
      // the square quiet zone (a half-stroke offset alone is insufficient).
      const borderOffset = qr.borderRadius * (1 - Math.SQRT1_2) + qr.borderWidth / 2;
      doc.lineWidth(qr.borderWidth).strokeColor("#E4E8E2").roundedRect(
        qr.x - borderOffset, qr.y - borderOffset,
        qr.size + 2 * borderOffset, qr.size + 2 * borderOffset, qr.borderRadius,
      ).stroke();
      doc.fillColor(INK);
      // One vector path: no image, no rounding, no enlarged cells invading quiet zone.
      for (let row = 0; row < matrix.size; row++) {
        for (let col = 0; col < matrix.size; col++) {
          if (matrix.get(row, col)) doc.rect(
            qr.x + (col + qr.quietModules) * moduleSize,
            qr.y + (row + qr.quietModules) * moduleSize, moduleSize, moduleSize,
          );
        }
      }
      doc.fill();
      if (size === "large") centered(GUIDE_STICKER_COPY.scan, "Archivo500", layout.scanSize, layout.scanY, MUTED);
      // Exact left-to-right stops from tour-summary-render.ts SUMMARY_STRIP.
      // PDFKit emits an axial vector shading, not a raster image.
      const signature = doc.linearGradient(layout.inset, layout.ruleY, layout.width - layout.inset, layout.ruleY);
      signature.stop(0, "#E8862E").stop(0.30, "#2F72C4").stop(0.55, "#3E9E4E")
        .stop(0.80, "#F5C62E").stop(1, "#E8862E");
      doc.rect(layout.inset, layout.ruleY, layout.width - 2 * layout.inset, layout.ruleHeight).fill(signature);
      centered(GUIDE_STICKER_COPY.wordmark, "Archivo800", layout.wordmarkSize, layout.wordmarkY, INK, layout.wordmarkSize * 0.02);
      if (size === "large") centered(GUIDE_STICKER_COPY.slogan, "Archivo500", layout.sloganSize, layout.sloganY, MUTED);
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}

export async function makeGuideStickers(tenantName: string, guestUrl: string): Promise<{ large: Buffer; small: Buffer }> {
  const [large, small] = await Promise.all([
    makeGuideSticker(tenantName, guestUrl, "large"),
    makeGuideSticker(tenantName, guestUrl, "small"),
  ]);
  return { large, small };
}