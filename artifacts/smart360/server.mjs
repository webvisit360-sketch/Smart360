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
 * SPA fallback: an unknown extensionless GET path serves index.html (replaces
 * the platform rewrite rule). A missing path with a file extension always
 * returns 404. Conditional requests are answered with 304 via Last-Modified
 * so "no-cache" stays cheap.
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

/**
 * Every 4xx/5xx is logged so a broken path never fails silently — but public
 * scanners can probe missing paths at will, so log volume is bounded: at most
 * ERROR_LOG_LIMIT lines per minute, then one explicit suppression summary per
 * window. Nothing is ever dropped silently. URLs are truncated and stripped of
 * control characters before logging.
 */
const ERROR_LOG_LIMIT = 120;
let errWindowStart = 0;
let errWindowCount = 0;
let errSuppressed = 0;

function safeUrl(url) {
  return String(url ?? "?").slice(0, 200).replace(/[^\x20-\x7e]/g, "?");
}

function logError(line) {
  const now = Date.now();
  if (now - errWindowStart >= 60_000) {
    if (errSuppressed > 0) {
      console.error(`[static] ${errSuppressed} error log(s) were suppressed in the last window`);
    }
    errWindowStart = now;
    errWindowCount = 0;
    errSuppressed = 0;
  }
  errWindowCount += 1;
  if (errWindowCount <= ERROR_LOG_LIMIT) {
    console.error(line);
    if (errWindowCount === ERROR_LOG_LIMIT) {
      console.error(`[static] error-log limit (${ERROR_LOG_LIMIT}/min) reached — suppressing further error logs this window`);
    }
  } else {
    errSuppressed += 1;
  }
}

function fail(res, status, req, reason) {
  logError(`[static] ${status} ${req.method ?? "?"} ${safeUrl(req.url)} — ${reason}`);
  if (!res.headersSent) {
    res.writeHead(status, status === 405 ? { allow: "GET, HEAD" } : { "content-type": "text/plain" });
  }
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      fail(res, 405, req, "method not allowed");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      fail(res, 400, req, "malformed URL");
      return;
    }
    if (pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("ok");
      return;
    }
    let filePath = normalize(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + "/")) {
      fail(res, 403, req, "path escapes web root");
      return;
    }
    let st = await stat(filePath).then((s) => (s.isFile() ? s : null)).catch(() => null);
    if (!st) {
      // Missing file-like requests must never receive the SPA document. That
      // would turn absent images, manifests, fonts, and arbitrary extensions
      // into a misleading 200 text/html response.
      if (extname(pathname)) {
        fail(res, 404, req, "file-like path missing from dist");
        return;
      }
      // SPA fallback — client-side routing owns every other unknown path.
      pathname = "/index.html";
      filePath = join(root, "index.html");
      st = await stat(filePath).catch(() => null);
      if (!st) {
        fail(res, 404, req, "index.html missing from dist");
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
    stream.on("error", (err) => {
      logError(`[static] stream error ${req.method} ${safeUrl(req.url)} — ${err?.message ?? err}`);
      res.destroy();
    });
    if (wantsGzip) {
      stream.pipe(createGzip({ level: 6 })).pipe(res);
    } else {
      stream.pipe(res);
    }
  } catch (err) {
    logError(`[static] 500 ${req?.method ?? "?"} ${safeUrl(req?.url)} — ${err?.message ?? err}`);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`smart360 static server listening on :${port}, serving ${root}`);
});
