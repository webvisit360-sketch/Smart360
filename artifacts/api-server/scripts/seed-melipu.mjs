// Seed the demo tenant "meli-pu" from the binding prototype HTML.
// Usage: node scripts/seed-melipu.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const require = createRequire(path.join(root, "lib", "db", "package.json"));
const pg = require("pg");
const htmlPath = path.join(
  root,
  "attached_assets",
  "smart360-melipu-sredozemsko_1786756569191.html",
);
const imagesDir = path.join(root, "artifacts", "smart360", "public", "images");

const html = fs.readFileSync(htmlPath, "utf8");

// --- extract IMG map (JSON object on one line) ---
const imgStart = html.indexOf("const IMG = {");
const imgJsonStart = html.indexOf("{", imgStart);
let depth = 0;
let imgEnd = imgJsonStart;
for (let i = imgJsonStart; i < html.length; i++) {
  if (html[i] === "{") depth++;
  else if (html[i] === "}") {
    depth--;
    if (depth === 0) {
      imgEnd = i + 1;
      break;
    }
  }
}
const IMG = JSON.parse(html.slice(imgJsonStart, imgEnd));

// write images to public/images
fs.mkdirSync(imagesDir, { recursive: true });
const urlFor = {};
for (const [name, dataUri] of Object.entries(IMG)) {
  const m = /^data:image\/(\w+);base64,(.*)$/s.exec(dataUri);
  if (!m) continue;
  const file = name;
  fs.writeFileSync(path.join(imagesDir, file), Buffer.from(m[2], "base64"));
  urlFor[name] = `/images/${file}`;
}
const img = (n) => urlFor[n] ?? urlFor["hero_pool.jpg"] ?? null;

// --- extract CONFIG and DATA via vm ---
function extractObject(varName) {
  const start = html.indexOf(`const ${varName} = {`);
  const objStart = html.indexOf("{", start);
  let d = 0;
  let inStr = null;
  for (let i = objStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
    else if (ch === "{") d++;
    else if (ch === "}") {
      d--;
      if (d === 0) return html.slice(objStart, i + 1);
    }
  }
  throw new Error(`Could not extract ${varName}`);
}
const CONFIG = vm.runInNewContext(`(${extractObject("CONFIG")})`);
const DATA = vm.runInNewContext(`(${extractObject("DATA")})`);
const SECMETA = vm.runInNewContext(`(${extractObject("SECMETA")})`);

// --- DB ---
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const q = (text, params) => client.query(text, params);

// wipe existing demo tenant
const existing = await q("select id from tenants where slug = $1", ["meli-pu"]);
if (existing.rows.length) {
  await q("delete from tenants where slug = $1", ["meli-pu"]);
  console.log("Removed existing meli-pu tenant");
}

const tenantRes = await q(
  `insert into tenants (slug, name, subtitle, rating, reviews_count, logo_url, hero_url, tour_url,
     phone, whatsapp, viber, instagram, address, map_query, wifi_ssid, wifi_pass, theme, languages,
     is_template, is_published)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
   returning id`,
  [
    "meli-pu",
    CONFIG.name,
    CONFIG.subtitle,
    CONFIG.rating,
    CONFIG.reviews,
    img(CONFIG.logo),
    img(CONFIG.hero),
    CONFIG.tourUrl || null,
    CONFIG.phone,
    CONFIG.whatsapp,
    CONFIG.viber,
    CONFIG.instagram,
    CONFIG.address,
    CONFIG.mapQuery,
    CONFIG.wifi.ssid,
    CONFIG.wifi.pass,
    "mediterran",
    ["sl", "en", "it", "de"],
    false,
    true,
  ],
);
const tenantId = tenantRes.rows[0].id;

async function insertSection(key, title, subtitle, icon, position) {
  const r = await q(
    `insert into sections (tenant_id, key, title, subtitle, icon, position)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [tenantId, key, title, subtitle, icon, position],
  );
  return r.rows[0].id;
}
async function insertCategory(sectionId, label, icon, layout, position) {
  const r = await q(
    `insert into categories (section_id, label, icon, layout, position)
     values ($1,$2,$3,$4,$5) returning id`,
    [sectionId, label, icon, layout, position],
  );
  return r.rows[0].id;
}
async function insertItem(categoryId, fields, position) {
  const r = await q(
    `insert into items (category_id, title, body, price, price_unit, phone, website, map_query,
       difficulty, duration, distance, open24, hours_json, note_type, note_text, bullets, position)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
    [
      categoryId,
      fields.title ?? null,
      fields.body ?? null,
      fields.price ?? null,
      fields.priceUnit ?? null,
      fields.phone ?? null,
      fields.website ?? null,
      fields.mapQuery ?? null,
      fields.difficulty ?? null,
      fields.duration ?? null,
      fields.distance ?? null,
      fields.open24 ?? false,
      fields.hoursJson ?? null,
      fields.noteType ?? null,
      fields.noteText ?? null,
      fields.bullets ?? [],
      position,
    ],
  );
  return r.rows[0].id;
}
async function insertMedia(itemId, url, alt, position) {
  if (!url) return;
  await q(
    `insert into media (item_id, url, alt, position) values ($1,$2,$3,$4)`,
    [itemId, url, alt ?? null, position],
  );
}

// hours: prototype uses fractions of hours (7.5 = 07:30). Convert to minutes.
function hoursToJson(h, h24) {
  if (h24) return null;
  if (!Array.isArray(h)) return null;
  return JSON.stringify(
    h.map((e) =>
      Array.isArray(e) ? [Math.round(e[0] * 60), Math.round(e[1] * 60)] : null,
    ),
  );
}

let sectionPos = 0;
for (const key of ["stay", "offer", "explore", "services"]) {
  const sec = DATA[key];
  if (!sec) continue;
  const meta = SECMETA[key] ?? {};
  const sectionId = await insertSection(
    key,
    sec.title ?? meta.t ?? key,
    meta.s ?? null,
    meta.ic ?? "sparkle",
    sectionPos++,
  );
  let catPos = 0;
  for (const cat of sec.items ?? []) {
    const layout = cat.type ?? "text";
    const categoryId = await insertCategory(
      sectionId,
      cat.label,
      cat.icon ?? "doc",
      layout,
      catPos++,
    );
    let itemPos = 0;

    if (layout === "text") {
      const itemId = await insertItem(
        categoryId,
        {
          title: cat.label,
          body: JSON.stringify(cat.body ?? []),
          mapQuery: cat.cta?.type === "map" ? cat.cta.q : null,
          noteType: cat.warn ? "info" : null,
          noteText: cat.warn ?? null,
        },
        itemPos++,
      );
      let mp = 0;
      for (const g of cat.gallery ?? []) await insertMedia(itemId, img(g), cat.label, mp++);
    } else if (layout === "apartments") {
      for (const ap of cat.items ?? []) {
        const itemId = await insertItem(
          categoryId,
          {
            title: ap.name,
            body: JSON.stringify([ap.desc]),
            noteText: ap.meta ?? null,
            noteType: ap.meta ? "info" : null,
          },
          itemPos++,
        );
        let mp = 0;
        for (const g of ap.gallery ?? []) await insertMedia(itemId, img(g), ap.name, mp++);
      }
    } else if (layout === "tabs") {
      for (const tab of cat.tabs ?? []) {
        const paras = [];
        if (tab.big) paras.push(`<b>${tab.big}</b>`);
        for (const p of tab.body ?? []) paras.push(p);
        for (const p of tab.list ?? []) paras.push(p);
        const itemId = await insertItem(
          categoryId,
          { title: tab.t, body: JSON.stringify(paras) },
          itemPos++,
        );
        if (tab.img) await insertMedia(itemId, img(tab.img), tab.t, 0);
      }
    } else if (layout === "wifi") {
      await insertItem(categoryId, { title: "WiFi" }, itemPos++);
    } else if (layout === "rules") {
      if (cat.big) {
        await insertItem(
          categoryId,
          { title: cat.big, noteType: "info" },
          itemPos++,
        );
      }
      for (const rule of cat.rules ?? []) {
        await insertItem(
          categoryId,
          { body: rule.t, noteType: rule.i ?? null },
          itemPos++,
        );
      }
    } else if (layout === "products") {
      for (const p of cat.products ?? []) {
        const itemId = await insertItem(
          categoryId,
          {
            title: p.name,
            body: JSON.stringify([p.desc, ...(p.note ? [p.note] : [])]),
            price: p.price ?? null,
            priceUnit: p.unit || null,
            bullets: p.incl ?? [],
            noteType: cat.warn ? "info" : null,
            noteText: cat.warn ?? null,
          },
          itemPos++,
        );
        if (p.img) await insertMedia(itemId, img(p.img), p.name, 0);
      }
    } else if (layout === "poi") {
      for (const p of cat.poi ?? []) {
        const itemId = await insertItem(
          categoryId,
          {
            title: p.n,
            body: p.desc ? JSON.stringify([p.desc]) : null,
            phone: p.tel ?? null,
            website: p.web && p.web !== "#" ? p.web : null,
            mapQuery: p.q ?? null,
            open24: !!p.h24,
            hoursJson: hoursToJson(p.h, p.h24),
            noteType: p.tip ? "recommendation" : null,
            noteText: p.tip ?? null,
          },
          itemPos++,
        );
        if (p.img) await insertMedia(itemId, img(p.img), p.n, 0);
      }
    } else if (layout === "routes") {
      for (const r of cat.routes ?? cat.items ?? []) {
        const itemId = await insertItem(
          categoryId,
          {
            title: r.n ?? r.name,
            body: r.desc ? JSON.stringify([r.desc]) : null,
            difficulty: r.diff ?? null,
            duration: r.time ?? r.duration ?? null,
            distance: r.len ?? r.distance ?? null,
            mapQuery: r.q ?? null,
          },
          itemPos++,
        );
        if (r.img) await insertMedia(itemId, img(r.img), r.n ?? r.name, 0);
      }
    } else if (layout === "events") {
      for (const e of cat.events ?? cat.items ?? []) {
        const itemId = await insertItem(
          categoryId,
          {
            title: e.n ?? e.name,
            body: e.desc ? JSON.stringify([e.desc]) : null,
            website: e.web && e.web !== "#" ? e.web : null,
            mapQuery: e.q ?? null,
          },
          itemPos++,
        );
        if (e.img) await insertMedia(itemId, img(e.img), e.n ?? e.name, 0);
      }
    } else {
      // unknown layout: dump generic items if present
      for (const it of cat.items ?? []) {
        await insertItem(
          categoryId,
          { title: it.n ?? it.name ?? cat.label, body: it.desc ? JSON.stringify([it.desc]) : null },
          itemPos++,
        );
      }
    }
  }
}

await q(
  `insert into changelog (tenant_id, tenant_name, action, entity, detail)
   values ($1,$2,'seed','tenant','demo vsebina uvožena iz prototipa')`,
  [tenantId, CONFIG.name],
);

const counts = await q(
  `select (select count(*) from sections where tenant_id=$1) as sections,
          (select count(*) from categories c join sections s on c.section_id=s.id where s.tenant_id=$1) as categories,
          (select count(*) from items i join categories c on i.category_id=c.id join sections s on c.section_id=s.id where s.tenant_id=$1) as items`,
  [tenantId],
);
console.log("Seeded meli-pu:", counts.rows[0]);
await client.end();
