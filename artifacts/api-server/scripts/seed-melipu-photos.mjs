// Seed the real Meli Pu photographs from fotografije.zip (slike/ + slike.json).
// - resizes every photo to 620px (q65, tiles) and 1400px (q75, gallery)
// - uploads both widths to object storage under media/meli-pu/<w>/<name>
// - sets tenant.heroUrl / tenant.logoUrl
// - sets categories.key from slike.json and attaches media rows to the first
//   item of each category (tile at position 0, then the gallery order)
// - sets sections.image_url for the mediterran big entry cards (b_*.jpg)
// Idempotent: running it twice yields the same rows, no duplicates.
//
// Usage: node scripts/seed-melipu-photos.mjs /tmp/foto
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const requireDb = createRequire(path.join(root, "lib", "db", "package.json"));
const pg = requireDb("pg");
const requireApi = createRequire(path.join(__dirname, "..", "package.json"));
const sharp = requireApi("sharp");
const { Storage } = requireApi("@google-cloud/storage");

const fotoDir = process.argv[2] || "/tmp/foto";
const slikeDir = path.join(fotoDir, "slike");
const mapping = JSON.parse(fs.readFileSync(path.join(fotoDir, "slike.json"), "utf8"));

const SLUG = "meli-pu";
const WIDTHS = [
  { w: 620, q: 65 },
  { w: 1400, q: 75 },
];

const SIDECAR = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const searchPath = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)[0];
if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
const [, bucketName, ...prefixParts] = searchPath.split("/");
const prefix = prefixParts.join("/");
const bucket = storage.bucket(bucketName);

const urlFor = (name) => `/api/storage/img/${SLUG}/${name}`;
const dimensionsByName = new Map();

async function uploadPhoto(name) {
  const original = fs.readFileSync(path.join(slikeDir, name));
  let displayDimensions = null;
  for (const { w, q } of WIDTHS) {
    const { data: buf, info } = await sharp(original)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (w === 1400) {
      displayDimensions = { width: info.width, height: info.height };
    }
    const objectName = `${prefix}/media/${SLUG}/${w}/${name}`;
    await bucket.file(objectName).save(buf, { contentType: "image/jpeg" });
  }
  if (displayDimensions) dimensionsByName.set(name, displayDimensions);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: trows } = await client.query("select id from tenants where slug=$1", [SLUG]);
if (!trows.length) throw new Error(`tenant ${SLUG} not found`);
const tenantId = trows[0].id;

// 1) upload every photo in the folder (skip nothing; names are the contract)
const files = fs.readdirSync(slikeDir).filter((f) => /\.jpe?g$/i.test(f));
console.log(`uploading ${files.length} photos × ${WIDTHS.length} widths …`);
let done = 0;
for (const f of files) {
  await uploadPhoto(f);
  if (++done % 10 === 0) console.log(`  ${done}/${files.length}`);
}
console.log(`  ${done}/${files.length} uploaded`);

// 2) cover + host logo
const nas = mapping["_naslovnica"] || {};
if (nas.hero) {
  await client.query("update tenants set hero_url=$1 where id=$2", [urlFor(nas.hero), tenantId]);
}
if (nas.logo_gostitelja) {
  await client.query("update tenants set logo_url=$1 where id=$2", [urlFor(nas.logo_gostitelja), tenantId]);
}

// 3) big entry cards for the mediterran theme
const big = mapping["_velike_kartice_sredozemska"] || {};
for (const [secKey, img] of Object.entries(big)) {
  await client.query(
    "update sections set image_url=$1 where tenant_id=$2 and key=$3",
    [urlFor(img), tenantId, secKey],
  );
}

// 4) per-item galleries
let attached = 0, missing = [];
for (const [secKey, entries] of Object.entries(mapping)) {
  if (secKey.startsWith("_")) continue;
  for (const [key, def] of Object.entries(entries)) {
    // match the category by its stable key if set, otherwise by label; then store the key
    const { rows: crows } = await client.query(
      `select c.id from categories c
         join sections s on c.section_id=s.id
        where s.tenant_id=$1 and s.key=$2 and (c.key=$3 or (c.key is null and c.label=$4))
        limit 1`,
      [tenantId, secKey, key, def.label],
    );
    if (!crows.length) { missing.push(`${secKey}/${key} (${def.label})`); continue; }
    const catId = crows[0].id;
    await client.query("update categories set key=$1 where id=$2", [key, catId]);

    // first item of the category (create one when the category is empty)
    let { rows: irows } = await client.query(
      "select id from items where category_id=$1 order by position asc limit 1",
      [catId],
    );
    let itemId;
    if (irows.length) itemId = irows[0].id;
    else {
      const ins = await client.query(
        "insert into items (category_id, position, is_visible) values ($1,0,true) returning id",
        [catId],
      );
      itemId = ins.rows[0].id;
    }

    // tile first, then the gallery order, without duplicating the tile
    const gallery = Array.isArray(def.gallery) ? def.gallery : [];
    const photos = def.tile
      ? [def.tile, ...gallery.filter((g) => g !== def.tile)]
      : gallery;
    if (!photos.length) continue;

    await client.query("begin");
    try {
      await client.query("delete from media where item_id=$1", [itemId]);
      for (let i = 0; i < photos.length; i++) {
        const dimensions = dimensionsByName.get(photos[i]);
        await client.query(
          "insert into media (item_id, url, position, width, height) values ($1,$2,$3,$4,$5)",
          [
            itemId,
            urlFor(photos[i]),
            i,
            dimensions?.width ?? null,
            dimensions?.height ?? null,
          ],
        );
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
    attached += photos.length;
  }
}

console.log(`media rows attached: ${attached}`);
if (missing.length) console.log("NOT matched (fix manually):", missing);
await client.end();
