import sharp from "sharp";
import { pool } from "@workspace/db";
import { stepSmartxstayImport, type ImportIO } from "../../lib/smartxstayImport";

export const fixtureIO: ImportIO = {
  fetch: async url => {
    if (url.includes("/assets/")) return sharp({ create: { width: 12, height: 12, channels: 3, background: "blue" } }).png().toBuffer();
    const lang = new URL(url).searchParams.get("lang") || "sl";
    return Buffer.from(`<html lang="${lang}"><head><link rel="alternate" hreflang="x-default" href="https://app.smartxstay.com/gen/s/fixture"/><link rel="alternate" hreflang="sl"/><link rel="alternate" hreflang="en"/></head><body>
    <div class="section-page" id="section-one"><nav class="section-nav"><a class="section-nav-back"><span>Camp info</span></a><a class="section-nav-item active"><span>Dobrodošli</span></a></nav><div class="section-content"><div class="component-text"><p>Fixture ${lang}</p></div><div class="component-image"><img data-src="https://app.smartxstay.com/assets/1/original"></div><div class="site-place"><h3>Kraj</h3><div id="place-modal-42"><p>Opis ${lang}</p></div></div></div></div></body></html>`);
  },
  store: async () => {},
  remove: async () => {},
  admit: async () => ({ ok: true, release() {} }),
};
if (process.argv.includes("--worker")) {
  try {
    await stepSmartxstayImport(process.argv.at(-2)!, process.argv.at(-1)!, false, fixtureIO);
  } finally { await pool.end(); }
}
