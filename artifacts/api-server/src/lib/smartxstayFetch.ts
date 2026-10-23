import https from "node:https";
import { assertPublicCreatorDestination } from "./creatorSourceReader";

const HOSTS = new Set(["app.smartxstay.com", "assets-prod.smartxstay.com"]);
export function smartxstayUrl(value: string, guide = false): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname) || url.port || url.username || url.password)
    throw new Error("Dovoljeni so samo javni HTTPS viri smartxstay.");
  if (guide && (url.hostname !== "app.smartxstay.com" || !/^\/gen\/s\/[a-zA-Z0-9_-]+$/.test(url.pathname)))
    throw new Error("Vnesite URL vodnika https://app.smartxstay.com/gen/s/…");
  return url;
}

/** Bounded, DNS-pinned HTTPS; every redirect is independently allowlisted. */
export async function fetchSmartxstay(value: string, maxBytes: number, redirects = 0): Promise<Buffer> {
  const url = smartxstayUrl(value);
  const [pinned] = await assertPublicCreatorDestination(url);
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Smart360OperatorImport/1.0", "Accept-Encoding": "identity" },
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [pinned]);
        else callback(null, pinned.address, pinned.family as 4 | 6);
      },
    }, response => {
      const code = response.statusCode ?? 500;
      if (code >= 300 && code < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 3) return reject(new Error("Preveč preusmeritev vira."));
        fetchSmartxstay(new URL(response.headers.location, url).href, maxBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (code !== 200) { response.resume(); reject(new Error(`Vir vrne HTTP ${code}.`)); return; }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) response.destroy(new Error("Vir presega dovoljeno velikost."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("error", reject);
  });
}
