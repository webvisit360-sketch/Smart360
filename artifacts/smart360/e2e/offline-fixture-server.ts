/**
 * Isolated browser fixture: builds the REAL App and serves the REAL worker.
 * No database, credentials, production HTTP calls, or publication.
 * Snapshot revisions/rename and quota injection are synthetic server controls.
 */
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, extname } from "node:path";
import { build } from "vite";
import { guestOfflineConfig, renderGuestServiceWorker } from "../../api-server/src/lib/guestServiceWorker";
import { syntheticTenant, SYNTHETIC_GPX_ROUTE, syntheticWeather } from "../src/pages/living-guide/living-guide-weather-fixture-data";

const root = resolve(import.meta.dirname, "..");
const out = await mkdtemp(resolve(tmpdir(), "living-guide-offline-e2e-"));
process.env.PORT = "4193";
process.env.BASE_PATH = "/";
process.env.NODE_ENV = "production";
await build({ configFile: resolve(root, "vite.config.ts"), build: { outDir: out, emptyOutDir: true }, logLevel: "warn" });
const states = new Map<string, { revision: number; renamed?: string; quota?: boolean; limit?: number }>();
const traffic: { method: string; path: string }[] = [];
let transportDown = false;
const state = (slug: string) => {
  if (!states.has(slug)) states.set(slug, { revision: 1 });
  return states.get(slug)!;
};
function tenant(slug: string, lang = "sl") {
  const base = syntheticTenant(["sl", "en", "de", "it"].includes(lang) ? lang as "sl" : "sl");
  const route = { ...SYNTHETIC_GPX_ROUTE,
    segments: SYNTHETIC_GPX_ROUTE.segments.map(segment => segment.map(([lon, lat]) => ({ lat, lon }))),
  };
  Object.assign(base.sections[1]!.categories[1]!.items[0]!, { gpxRoute: route });
  Object.assign(base.sections[0]!.categories[0]!, { layout: "cards" });
  Object.assign(base.sections[0]!.categories[0]!.items[0]!, { orderEnabled: true, price: "5 €" });
  if (slug === "offline-gallery") {
    Object.assign(base.sections[1]!.categories[1]!.items[1]!, {
      media: [1, 2, 3].map(n => ({ id: `unviewed-${n}`, kind: "image", url: `/fixture-media/unviewed-gallery-${n}.svg` })),
    });
  }
  return {
    ...base, id: `synthetic-${slug.replace(/-renamed$/, "")}`, slug,
    name: `OFFLINE SYNTHETIC ${slug} v${state(slug).revision}`,
    guestUiMode: "living-guide", theme: "living-guide", messagesEnabled: true,
    wifiSsid: "", wifiPassword: "", heroUrl: "/fixture-media/hero.svg",
  };
}
const types: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:4193");
  const path = url.pathname;
  res.setHeader("Cache-Control", "no-store");
  const send = (body: string | Buffer, type = "application/json", status = 200) => {
    res.writeHead(status, { "Content-Type": type }); res.end(body);
  };
  const json = (value: unknown, status = 200) => send(JSON.stringify(value), "application/json", status);
  try {
    if (path === "/__fixture/health") return json({ ready: true });
    if (path === "/__fixture/traffic") return json(traffic);
    if (path === "/__fixture/transport" && req.method === "POST") {
      let body = ""; for await (const chunk of req) body += chunk;
      transportDown = Boolean(JSON.parse(body).down);
      return json({ transportDown });
    }
    if (path === "/__fixture/control" && req.method === "POST") {
      let body = ""; for await (const chunk of req) body += chunk;
      const { slug, ...changes } = JSON.parse(body);
      Object.assign(state(slug), changes);
      return json(state(slug));
    }
    // Chromium 138's page offline emulation does NOT stop SW-owned fetches.
    // Destroy actual sockets as well, so worker fetch genuinely rejects.
    // Only fixture control traffic above remains reachable by the test runner.
    if (transportDown) { req.socket.destroy(); return; }
    traffic.push({ method: req.method!, path: req.url! });
    const match = path.match(/^\/api\/public\/tenants\/([^/]+)(.*)$/);
    if (match) {
      const [, slug, suffix] = match;
      const s = state(slug!);
      if (s.renamed) {
        res.writeHead(301, { Location: `/api/public/tenants/${s.renamed}${suffix}${url.search}` }); return res.end();
      }
      if (suffix === "/sw.js") {
        const config = guestOfflineConfig(`synthetic-${slug!.replace(/-renamed$/, "")}`, slug!,
          Object.fromEntries(["sl", "en", "de", "it"].map(lang => [lang, { tree: tenant(slug!, lang) }])));
        let worker = renderGuestServiceWorker(config);
        // Test-only fault injection; production generator has no test switches.
        if (s.limit) worker = worker.replace("const LIMIT = 50 * 1024 * 1024;", `const LIMIT = ${s.limit};`);
        if (s.quota) worker = `Cache.prototype.put = async function () { throw new DOMException("Synthetic quota denial", "QuotaExceededError"); };\n${worker}`;
        res.setHeader("Service-Worker-Allowed", `/${slug}/`);
        return send(worker, "text/javascript");
      }
      if (req.method !== "GET") return json({ syntheticMutation: true }, 409);
      if (!suffix) return json(tenant(slug!, url.searchParams.get("lang") ?? "sl"));
      if (suffix!.includes("/gpx/")) return send(
        `<?xml version="1.0"?><gpx version="1.1" creator="synthetic-offline-test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Synthetic route</name><trkseg>${SYNTHETIC_GPX_ROUTE.segments[0]!.map(([lon, lat], i) => `<trkpt lat="${lat}" lon="${lon}"><ele>${312 + i * 50}</ele></trkpt>`).join("")}</trkseg></trk></gpx>`,
        "application/gpx+xml");
      if (suffix === "/weather") return json(syntheticWeather("calm"));
      if (suffix === "/messages") return json({ messages: [], isOpen: true });
      if (suffix === "/orders") return json([]);
      if (suffix === "/manifest.webmanifest") return json({ name: tenant(slug!).name, scope: `/${slug}/`, start_url: `/${slug}/` });
      return json({ error: "Unknown synthetic endpoint", path }, 404);
    }
    if (path.startsWith("/fixture-media/") || path.startsWith("/api/storage/img/")) {
      const padding = Number(url.searchParams.get("bytes") ?? 500);
      return send(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c8cec5"/><!--${"x".repeat(padding)}--></svg>`, "image/svg+xml");
    }
    if (path === "/fixture-301") {
      res.writeHead(301, { Location: "/fixture-media/redirect-target.svg" }); return res.end();
    }
    if (path.startsWith("/api/") || path.startsWith("/admin")) return json({ fixtureNetworkOnly: true });
    const slug = path.split("/")[1]!;
    if (states.get(slug)?.renamed) {
      res.writeHead(301, { Location: path.replace(`/${slug}/`, `/${states.get(slug)!.renamed}/`) }); return res.end();
    }
    const file = resolve(out, `.${path}`);
    if (file.startsWith(`${out}/`) && existsSync(file) && extname(file)) {
      return send(await readFile(file), types[extname(file)] ?? "application/octet-stream");
    }
    if (path.startsWith("/assets/") || path.startsWith("/brand/")) return json({ error: "Missing asset", path }, 404);
    return send(await readFile(resolve(out, "index.html")), "text/html");
  } catch (error) { return json({ error: String(error) }, 500); }
});
server.listen(4193, "127.0.0.1");
const close = () => server.close(() => { void rm(out, { recursive: true, force: true }).finally(() => process.exit()); });
process.on("SIGTERM", close);
process.on("SIGINT", close);