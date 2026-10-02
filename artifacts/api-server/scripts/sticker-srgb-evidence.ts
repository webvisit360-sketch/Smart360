import { mkdir, writeFile } from "node:fs/promises";
import { makeGuideStickers } from "../src/lib/guideStickers";

const out = "../../reports/stickers-srgb";
await mkdir(out, { recursive: true });
const pdfs = await makeGuideStickers("Turizem Drobež", "https://smart360.info/turizem-drobez");
for (const size of ["large", "small"] as const) {
  await writeFile(`${out}/turizem-drobez-${size}.pdf`, pdfs[size]);
}