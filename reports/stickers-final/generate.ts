import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { makeGuideSticker, guideStickerNameLayout, guideStickerLayout } from "../../artifacts/api-server/src/lib/guideStickers.ts";
async function main() {
const localRequire = createRequire(pathToFileURL(`${process.cwd()}/artifacts/api-server/package.json`));
const sharp = localRequire("sharp");
const jsQR = localRequire("jsqr");
const dir = pathToFileURL(`${process.cwd()}/reports/stickers-final/`);
const production = await fetch("https://smart360.info/api/public/tenants/turizem-drobez");
if (!production.ok) throw new Error(`Production tenant lookup: ${production.status}`);
const tenant = await production.json();
if (tenant.name !== "Turizem Drobež" || tenant.slug !== "turizem-drobez" || tenant.customDomain !== null) throw new Error("Production identity mismatch");
const guest = await fetch("https://smart360.info/turizem-drobez");
if (!guest.ok) throw new Error(`Guest URL: ${guest.status}`);
const identity = { checkedAt: new Date().toISOString(), source: production.url, status: production.status, name: tenant.name, slug: tenant.slug, customDomain: tenant.customDomain, guestUrl: "https://smart360.info/turizem-drobez", guestStatus: guest.status };
const cases = [
  {id:"turizem-drobez", name:tenant.name, url:identity.guestUrl, type:"Verified production identity"},
  {id:"meli-pu", name:"Apartmaji Meli Pu", url:identity.guestUrl, type:"Typography-only test; QR deliberately targets verified Drobež URL, not Apartmaji Meli Pu"},
  {id:"very-long-name", name:"Turizem Drobež — izjemno dolgo ime nastanitve za preverjanje zmanjševanja velikosti pisave in varnega krajšanja brez prekrivanja kode QR", url:identity.guestUrl, type:"Synthetic typography stress test; QR targets verified Drobež URL"},
];
const results = [];
const cards = [];
for (const sample of cases) for (const size of ["large", "small"] as const) {
  const base = `${sample.id}-${size}`;
  const file = new URL(`${base}.pdf`, dir);
  const buffer = await makeGuideSticker(sample.name, sample.url, size);
  await fs.writeFile(file, buffer);
  const pdfInfo = execFileSync("pdfinfo", ["-box", file.pathname], {encoding:"utf8"});
  const fonts = execFileSync("pdffonts", [file.pathname], {encoding:"utf8"});
  const images = execFileSync("pdfimages", ["-list", file.pathname], {encoding:"utf8"});
  const text = execFileSync("pdftotext", ["-layout",file.pathname,"-"], {encoding:"utf8"});
  if (!/Pages:\s+1/.test(pdfInfo)) throw new Error(`${base}: page count`);
  if (images.trim().split("\n").length !== 2) throw new Error(`${base}: raster image embedded`);
  const fontRows = fonts.trim().split("\n").slice(2);
  if (!fontRows.length || fontRows.some((row:string) => !/yes\s+yes\s+yes/.test(row))) throw new Error(`${base}: unembedded font`);
  const decode = [];
  for (const dpi of [300,96]) {
    const prefix = new URL(`${base}-${dpi}dpi`, dir).pathname;
    execFileSync("pdftoppm", ["-r",String(dpi),"-singlefile","-png",file.pathname,prefix]);
    const {data,info} = await sharp(`${prefix}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const code = jsQR(new Uint8ClampedArray(data),info.width,info.height);
    if (!code || code.data !== sample.url) throw new Error(`${base} ${dpi}dpi: QR decode mismatch`);
    decode.push({dpi,width:info.width,height:info.height,url:code.data});
  }
  const layout = guideStickerLayout(size);
  const fitted = await guideStickerNameLayout(sample.name,size);
  if (fitted.widths.some(w=>w>fitted.availableWidth+0.01)) throw new Error(`${base}: overflowing title`);
  results.push({base,...sample,size,layout,fitted,decode,pdfInfo,fonts,images,text});
  const png = await fs.readFile(new URL(`${base}-96dpi.png`,dir));
  const width = size === "large" ? 72.5 : 36.3, height = size === "large" ? 110 : 55;
  cards.push(`<figure><figcaption><strong>${sample.id} · ${size}</strong><br>${width} × ${height} mm · QR ${size==="large"?55:27.5} mm including quiet zone<br>${sample.type}</figcaption><img alt="${sample.id} ${size}" style="width:${width}mm;height:${height}mm" src="data:image/png;base64,${png.toString("base64")}"></figure>`);
}
await fs.writeFile(new URL("verification.json",dir),JSON.stringify({identity,results},null,2));
await fs.writeFile(new URL("preview-100-percent.html",dir),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMART360 sticker verification — 100%</title><style>*{box-sizing:border-box}body{margin:32px;background:#d8dcd6;color:#121a14;font:15px system-ui}h1{font-size:24px}p{max-width:950px;line-height:1.5}.grid{display:grid;grid-template-columns:340px 340px;gap:32px}figure{margin:0;break-inside:avoid}figcaption{min-height:100px;max-width:300px;font-size:13px;line-height:1.5}img{display:block;max-width:none;box-shadow:0 3px 15px #0002}@media print{body{background:white}.grid{gap:10mm}img{box-shadow:none}}</style><h1>SMART360 · actual PDF raster previews</h1><p>All six PDFs rendered by Poppler at 96 DPI, embedded without external assets. Display sizes use physical CSS millimetres at browser zoom 100%. Actual physical monitor size cannot be guaranteed: OS scaling, display density and browser zoom affect it. Print the PDF at 100% / Actual size, with no Fit-to-page. The downloadable 300 DPI PNGs are print previews, not replacements for vector PDFs.</p><p>Verified production: Turizem Drobež → https://smart360.info/turizem-drobez. Meli Pu and the long-name case are typography-only tests, not deliverable tenant stickers. Their QR deliberately retains the verified Drobež URL. QR measurements include the four-module white quiet zone.</p><div class="grid">${cards.join("")}</div></html>`);
console.log(JSON.stringify({identity,generated:results.map(r=>({base:r.base,fit:r.fitted,decode:r.decode}))},null,2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });