import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { makeGuideSticker } from "../../artifacts/api-server/src/lib/guideStickers.ts";

async function main() {
  const require = createRequire(`${process.cwd()}/artifacts/api-server/package.json`);
  const sharp = require("sharp");
  const jsQR = require("jsqr");
  const url = "https://smart360.info/turizem-drobez";
  const response = await fetch("https://smart360.info/api/public/tenants/turizem-drobez");
  assert.equal(response.status, 200);
  const tenant = await response.json();
  assert.equal(tenant.name, "Turizem Drobež");
  assert.equal(tenant.slug, "turizem-drobez");
  assert.equal((await fetch(url)).status, 200);
  const directory = "reports/trak-signature";
  const results = [];
  for (const size of ["large", "small"] as const) {
    const base = `${directory}/turizem-drobez-${size}`;
    const buffer = await makeGuideSticker(tenant.name, url, size);
    await fs.writeFile(`${base}.pdf`, buffer);
    const pdfInfo = execFileSync("pdfinfo", ["-box", `${base}.pdf`], { encoding: "utf8" });
    const images = execFileSync("pdfimages", ["-list", `${base}.pdf`], { encoding: "utf8" });
    assert.equal(images.trim().split("\n").length, 2);
    const dimensions = pdfInfo.match(/Page size:\s+([\d.]+) x ([\d.]+)/)!;
    const expected = size === "large" ? [72.5, 110] : [36.3, 55];
    expected.forEach((mm, i) => assert.ok(Math.abs(Number(dimensions[i + 1]) * 25.4 / 72 - mm) < 0.001));
    const decodes = [];
    for (const dpi of [96, 300]) {
      execFileSync("pdftoppm", ["-singlefile", "-r", String(dpi), "-png", `${base}.pdf`, `${base}-${dpi}dpi`]);
      const { data, info } = await sharp(`${base}-${dpi}dpi.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      assert.equal(decoded?.data, url);
      decodes.push({ dpi, width: info.width, height: info.height, url: decoded.data });
    }
    results.push({ size, pdfInfo, images, decodes });
  }
  await fs.writeFile(`${directory}/verification.json`, JSON.stringify({ checkedAt: new Date().toISOString(), url, name: tenant.name, results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });