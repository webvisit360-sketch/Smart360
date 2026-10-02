import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { renderEmail, EMAIL_SIGNATURE_URLS } from "../lib/emailTemplate";

test("all shared themes use one hosted decorative 4px signature with matching corner variant", () => {
  for (const theme of [undefined, "welcome-cgp"] as const) {
    for (const cardRadius of [14, 16] as const) {
      const spec = { theme, cardRadius, subject: "Signature contract", preheader: "", brand: "Smart360", title: "Signature contract", blocks: [], footerLines: [] };
      const result = renderEmail(spec);
      assert.equal((result.html.match(/smart360-email-signature/g) ?? []).length, 1);
      assert.ok(result.html.includes(`src="${EMAIL_SIGNATURE_URLS[cardRadius]}" width="558" height="4" alt="" role="presentation"`));
      assert.ok(result.html.includes(`border-radius:${cardRadius}px;border-collapse:separate`));
      assert.match(result.html, /display:block;width:100%;height:4px;border:0/);
      assert.doesNotMatch(result.html, /data:image|linear-gradient|#DD9A2B/);
      assert.doesNotMatch(result.text, /signature|png|https:/);
    }
  }
});

test("retina PNGs retain TOUR stops and transparent pre-clipped 14/16px corners", async () => {
  const root = new URL("../../../../", import.meta.url);
  const source = await readFile(new URL("artifacts/smart360/src/lib/tour-summary-render.ts", root), "utf8");
  const stops: Array<[number, string]> = JSON.parse(source.match(/stops:\s*(\[\[.*?\]\])/s)![1].replaceAll("'", '"'));
  const expected: Array<[number, string]> = [[0, "#E8862E"], [0.3, "#2F72C4"], [0.55, "#3E9E4E"], [0.8, "#F5C62E"], [1, "#E8862E"]];
  assert.deepEqual(stops, expected);
  const corners: number[] = [];
  for (const radius of [14, 16] as const) {
    const image = sharp(await readFile(new URL(`artifacts/smart360/public/brand/smart360-email-signature-r${radius}-1116x8.png`, root)));
    const meta = await image.metadata();
    assert.equal(meta.width, 1116); assert.equal(meta.height, 8);
    assert.equal(meta.hasAlpha, true);
    const pixels = await image.ensureAlpha().raw().toBuffer();
    assert.equal(pixels[3], 0);
    assert.equal(pixels[(1116 - 1) * 4 + 3], 0);
    corners.push([...Array(80).keys()].find(x => pixels[x * 4 + 3] === 255)!);
    for (const [offset, hex] of stops.slice(1, -1)) {
      const x = Math.floor(offset * 1116);
      const i = (4 * 1116 + x) * 4;
      const rgb = hex.match(/[a-f\d]{2}/gi)!.map((v: string) => parseInt(v, 16));
      rgb.forEach((value: number, channel: number) => assert.ok(Math.abs(pixels[i + channel] - value) <= 2, `TOUR stop ${offset}, channel ${channel}`));
      assert.equal(pixels[i + 3], 255);
    }
    // Endpoints are clipped, so compare near-edge opaque pixels with the
    // exact piecewise sRGB interpolation rather than an invented solid cap.
    for (const x of [30, 180, 450, 710, 1000, 1085]) {
      const t = (x + 0.5) / 1116;
      const end = stops.findIndex(([offset]: [number, string]) => offset >= t);
      const [a, c1] = stops[end - 1], [b, c2] = stops[end];
      const rgb = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16));
      const left = rgb(c1), right = rgb(c2);
      left.forEach((value, channel) => assert.ok(Math.abs(pixels[(7 * 1116 + x) * 4 + channel] - (value + (right[channel] - value) * (t - a) / (b - a))) <= 2));
    }
  }
  assert.ok(corners[1] > corners[0], "16px variant must be clipped more deeply");
});