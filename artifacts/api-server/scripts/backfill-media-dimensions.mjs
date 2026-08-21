// Development-only reconciliation for media created before width/height were
// persisted. It reads the widest stored derivative through the public route
// and updates only rows whose dimensions are missing.
//
// Usage:
//   node scripts/backfill-media-dimensions.mjs --development-only
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");
const requireDb = createRequire(path.join(root, "lib", "db", "package.json"));
const pg = requireDb("pg");
const requireApi = createRequire(path.join(__dirname, "..", "package.json"));
const sharp = requireApi("sharp");

if (!process.argv.includes("--development-only")) {
  throw new Error(
    "Refusing to write: pass --development-only after confirming this is the development database.",
  );
}
if (
  process.env.NODE_ENV === "production" ||
  process.env.REPLIT_DEPLOYMENT === "1" ||
  process.env.REPLIT_DEPLOYMENT_ID
) {
  throw new Error("Refusing to run media dimension backfill in a deployment.");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
});

const { rows } = await pool.query(`
  select id, kind, url, poster_url
  from media
  where width is null or height is null
  order by id
`);

let cursor = 0;
let updated = 0;
let skipped = 0;
const failures = [];

async function reconcile(row) {
  const source = row.kind === "video" ? row.poster_url : row.url;
  if (!source || !source.startsWith("/") || source.startsWith("//")) {
    skipped += 1;
    return;
  }

  const url = new URL(source, "http://localhost:80");
  if (source.startsWith("/api/storage/img/")) {
    url.searchParams.set("w", "1400");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${source}`);
  }
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`No dimensions for ${source}`);
  }
  await pool.query(
    "update media set width=$1, height=$2 where id=$3",
    [metadata.width, metadata.height, row.id],
  );
  updated += 1;
}

async function worker() {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    try {
      await reconcile(row);
    } catch (error) {
      failures.push({ id: row.id, error: String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(8, rows.length) }, worker));
await pool.end();

console.log(JSON.stringify({
  scanned: rows.length,
  updated,
  skipped,
  failed: failures.length,
  failures: failures.slice(0, 20),
}, null, 2));

if (failures.length > 0) process.exitCode = 1;