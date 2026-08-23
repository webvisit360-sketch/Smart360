/**
 * Minimal production static server for the Smart360 SPA.
 *
 * It exists to control cache headers: the platform's built-in static host
 * serves everything with "cache-control: private" and no max-age, which lets
 * guest devices keep running a pre-publish bundle for hours (heuristic
 * caching). Guests keep the guide open for a week, so this matters.
 *
 *   /assets/*      -> public, max-age=1y, immutable  (content-hashed names)
 *   index.html "/" -> no-cache                        (revalidate every load)
 *   /version.json  -> no-store                        (stale-bundle check)
 *   other files    -> public, max-age=3600
 *
 * SPA fallback: any unknown GET path serves index.html (replaces the
 * platform rewrite rule). Conditional requests answered with 304 via
 * Last-Modified so "no-cache" stays cheap.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist/public", import.meta.url)));
const port = Number(process.env.PORT);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".webmanifest"]);

function cacheControlFor(pathname) {
  if (pathname === "/version.json") return "no-store";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.endsWith(".html") || pathname === "/") return "no-cache";
  return "public, max-age=3600";
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("ok");
      return;
    }
    let filePath = normalize(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    let st = await stat(filePath).then((s) => (s.isFile() ? s : null)).catch(() => null);
    if (!st) {
      // SPA fallback — client-side routing owns every unknown path.
      pathname = "/index.html";
      filePath = join(root, "index.html");
      st = await stat(filePath).catch(() => null);
      if (!st) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
    }
    const ext = extname(filePath).toLowerCase();
    const headers = {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": cacheControlFor(pathname),
      "last-modified": st.mtime.toUTCString(),
      "x-content-type-options": "nosniff",
    };
    const ims = req.headers["if-modified-since"];
    if (ims) {
      const since = Date.parse(ims);
      if (Number.isFinite(since) && Math.floor(st.mtimeMs / 1000) * 1000 <= since) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
    }
    const wantsGzip =
      COMPRESSIBLE.has(ext) && /\bgzip\b/i.test(String(req.headers["accept-encoding"] ?? ""));
    if (wantsGzip) {
      headers["content-encoding"] = "gzip";
      headers["vary"] = "accept-encoding";
    } else {
      headers["content-length"] = st.size;
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(filePath);
    stream.on("error", () => res.destroy());
    if (wantsGzip) {
      stream.pipe(createGzip({ level: 6 })).pipe(res);
    } else {
      stream.pipe(res);
    }
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`smart360 static server listening on :${port}, serving ${root}`);
});
