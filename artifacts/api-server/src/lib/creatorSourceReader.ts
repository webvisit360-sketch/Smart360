import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { and, desc, eq, gt } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import {
  creatorRobotsEvidenceTable,
  creatorSourceContentsTable,
  creatorSourcesTable,
  db,
  type CreatorRobotsEvidence,
  type CreatorSource,
  type CreatorSourceContent,
} from "@workspace/db";

export const CREATOR_CRAWLER_USER_AGENT = "Smart360Creator/1.0";
export const CREATOR_ROBOTS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const CREATOR_ROBOTS_ERROR_TTL_MS = 10 * 60 * 1000;
export const CREATOR_FETCH_TIMEOUT_MS = 8_000;
export const CREATOR_ROBOTS_MAX_BYTES = 512 * 1024;
export const CREATOR_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
export const CREATOR_CRAWL_MAX_SUBPAGES = 60;

type LookupAddress = { address: string; family: number };
type LookupFn = (hostname: string) => Promise<LookupAddress[]>;
type FetchFn = typeof fetch;
type RobotsRule = { directive: "allow" | "disallow"; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export type CreatorCrawlSkipReason =
  | CreatorSourcePolicyError["kind"]
  | "non-content-path"
  | "page-cap"
  | "source-byte-cap"
  | "duplicate-url"
  | "locale-variant";

function creatorLocaleRank(value: string): number {
  const path = new URL(value).pathname.toLocaleLowerCase("sl");
  return /^\/(?:en|de)(?:\/|$)/.test(path) ? 2 : /^\/sl(?:\/|$)/.test(path) ? 0 : 0;
}

function creatorCanonicalFamily(value: string): string {
  const url = new URL(canonicalizeCreatorSourceUrl(value));
  url.pathname = url.pathname.replace(/^\/(?:sl|en|de)(?=\/|$)/i, "") || "/";
  return url.href;
}

export class CreatorRunUrlClaims {
  private readonly exact = new Set<string>();
  private readonly slFamilies = new Set<string>();

  claim(value: string): "claimed" | "duplicate-url" | "locale-variant" {
    const canonical = canonicalizeCreatorSourceUrl(value);
    if (this.exact.has(canonical)) return "duplicate-url";
    const family = creatorCanonicalFamily(canonical);
    if (creatorLocaleRank(canonical) > 0 && this.slFamilies.has(family)) return "locale-variant";
    this.exact.add(canonical);
    if (creatorLocaleRank(canonical) === 0) this.slFamilies.add(family);
    return "claimed";
  }
}

export function rankCreatorDepthOneUrls(urls: readonly string[]): string[] {
  const contentRank = (value: string) => {
    const path = new URL(value).pathname.toLocaleLowerCase("sl");
    if (/(?:^|\/)(?:novice|news|dogodki|events?|koledar|calendar)(?:\/|$)/.test(path)) return 2;
    return 0;
  };
  return [...urls].sort((left, right) =>
    contentRank(left) - contentRank(right)
    || creatorLocaleRank(left) - creatorLocaleRank(right)
    || left.localeCompare(right));
}

export type CreatorCrawlPageResult = {
  url: string;
  depth: 0 | 1;
  status: "stored" | "skipped";
  skipReason: CreatorCrawlSkipReason | null;
  content: CreatorSourceContent | null;
  finalUrl: string | null;
  observedAt: Date | null;
  counters: {
    rawBytes: number;
    extractedTextBytes: number;
  };
};

export type CreatorSourceCrawlResult = {
  sourceId: string;
  seedUrl: string;
  pages: CreatorCrawlPageResult[];
  counters: {
    discoveredSubpages: number;
    selectedSubpages: number;
    attemptedPages: number;
    storedPages: number;
    skippedPages: number;
    rawBytes: number;
    extractedTextBytes: number;
    skipReasons: Partial<Record<CreatorCrawlSkipReason, number>>;
  };
};

export class CreatorSourcePolicyError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "not-approved"
      | "invalid-url"
      | "private-destination"
      | "redirect-not-approved"
      | "network"
      | "response-too-large"
      | "content-type"
      | "robots-disallowed"
      | "robots-uncertain"
      | "duplicate-url"
      | "locale-variant"
      | "run-budget-exhausted",
  ) {
    super(message);
    this.name = "CreatorSourcePolicyError";
  }
}

const defaultLookup: LookupFn = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export function canonicalizeCreatorSourceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CreatorSourcePolicyError("Source URL is invalid.", "invalid-url");
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || (url.port && url.port !== "443")
  ) {
    throw new CreatorSourcePolicyError(
      "Creator sources must use credential-free HTTPS on the standard port.",
      "invalid-url",
    );
  }
  url.hash = "";
  return url.href;
}

function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b] = octets as [number, number, number, number];
    return !(
      a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      return isPublicIp(normalized.slice("::ffff:".length));
    }
    // Only globally routable IPv6 unicast (2000::/3) is accepted.
    return /^[23][0-9a-f]{3}:/.test(normalized);
  }
  return false;
}

export async function assertPublicCreatorDestination(
  url: URL,
  lookupFn: LookupFn = defaultLookup,
): Promise<LookupAddress[]> {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".home")
  ) {
    throw new CreatorSourcePolicyError("Private or internal destination is blocked.", "private-destination");
  }
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) {
      throw new CreatorSourcePolicyError("Private or reserved IP destination is blocked.", "private-destination");
    }
    return [{ address: hostname, family: isIP(hostname) }];
  }
  let addresses: LookupAddress[];
  try {
    addresses = await lookupFn(hostname);
  } catch {
    throw new CreatorSourcePolicyError("Destination DNS could not be verified.", "network");
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new CreatorSourcePolicyError(
      "Destination DNS includes a private, reserved, or unverifiable address.",
      "private-destination",
    );
  }
  return addresses;
}

function pinnedHttpsFetch(
  url: URL,
  pinned: LookupAddress,
  input: { signal: AbortSignal; headers: Record<string, string> },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      signal: input.signal,
      headers: input.headers,
      // The URL hostname remains authoritative for TLS SNI/certificate checks;
      // only address selection is pinned to the already-validated DNS answer.
      lookup: (_hostname, options, callback) => {
        // Node's HTTPS agent requests lookup({ all: true }) so it can apply
        // family auto-selection. Return only the one validated/pinned address.
        if (options.all) {
          callback(null, [pinned]);
          return;
        }
        callback(null, pinned.address, pinned.family as 4 | 6);
      },
    }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(name, item);
        } else if (value !== undefined) {
          headers.set(name, String(value));
        }
      }
      resolve(new Response(
        Readable.toWeb(response) as never,
        {
          status: response.statusCode ?? 500,
          statusText: response.statusMessage,
          headers,
        },
      ));
    });
    request.once("error", reject);
    request.end();
  });
}

async function readLimitedText(response: Response, maxBytes: number, signal?: AbortSignal): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CreatorSourcePolicyError("Response exceeds the configured size limit.", "response-too-large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let rejectAbort: ((reason?: unknown) => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const part = await Promise.race([reader.read(), abortPromise]);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new CreatorSourcePolicyError("Response exceeds the configured size limit.", "response-too-large");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (signal?.aborted) {
      throw new CreatorSourcePolicyError("Source response body timed out.", "network");
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new CreatorSourcePolicyError("Response is not valid UTF-8.", "robots-uncertain");
  }
}

async function guardedFetch(
  initialUrl: string,
  options: {
    fetchFn?: FetchFn;
    lookupFn?: LookupFn;
    allowedRedirectOrigins: ReadonlySet<string>;
    accept: string;
    beforeRequest?: (url: URL, redirectIndex: number) => void;
    timeoutMs?: number;
  },
): Promise<{ response: Response; finalUrl: string; signal: AbortSignal; release: () => void }> {
  let current = new URL(canonicalizeCreatorSourceUrl(initialUrl));
  for (let redirects = 0; redirects <= 5; redirects++) {
    options.beforeRequest?.(current, redirects);
    const addresses = await assertPublicCreatorDestination(current, options.lookupFn);
    const controller = new AbortController();
    const timeoutMs = Math.min(
      CREATOR_FETCH_TIMEOUT_MS,
      Math.max(1, Math.floor(options.timeoutMs ?? CREATOR_FETCH_TIMEOUT_MS)),
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const release = () => clearTimeout(timer);
    let response: Response;
    try {
      const headers = {
        "user-agent": CREATOR_CRAWLER_USER_AGENT,
        accept: options.accept,
      };
      response = options.fetchFn
        ? await options.fetchFn(current, {
          redirect: "manual",
          signal: controller.signal,
          headers,
        })
        : await pinnedHttpsFetch(current, addresses[0]!, {
          signal: controller.signal,
          headers,
        });
    } catch {
      release();
      throw new CreatorSourcePolicyError("Source request failed or timed out.", "network");
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current.href, signal: controller.signal, release };
    }
    const location = response.headers.get("location");
    if (!location) {
      release();
      throw new CreatorSourcePolicyError("Redirect response omitted its destination.", "network");
    }
    const next = new URL(location, current);
    canonicalizeCreatorSourceUrl(next.href);
    if (!options.allowedRedirectOrigins.has(next.origin)) {
      release();
      throw new CreatorSourcePolicyError(
        `Redirect origin is not on the approved area list: ${next.origin}`,
        "redirect-not-approved",
      );
    }
    await response.body?.cancel().catch(() => undefined);
    release();
    current = next;
  }
  throw new CreatorSourcePolicyError("Source exceeded the redirect limit.", "network");
}

export function parseRobotsPolicy(policyText: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRule = false;
  const lines = policyText.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const originalLine of lines) {
    const line = originalLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      throw new CreatorSourcePolicyError("robots.txt contains an unparseable directive.", "robots-uncertain");
    }
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!value) {
        throw new CreatorSourcePolicyError("robots.txt contains an empty user-agent.", "robots-uncertain");
      }
      if (!current || sawRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (field === "allow" || field === "disallow") {
      if (!current?.agents.length) {
        throw new CreatorSourcePolicyError("robots.txt rule has no user-agent group.", "robots-uncertain");
      }
      current.rules.push({ directive: field, path: value });
      sawRule = true;
    }
  }
  return groups;
}

function robotsPatternMatches(pattern: string, pathAndQuery: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const source = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(pathAndQuery);
}

export function evaluateRobotsPolicy(
  groups: RobotsGroup[],
  targetUrl: string,
  actualUserAgent = CREATOR_CRAWLER_USER_AGENT,
): { allowed: boolean; matchedRule: string | null } {
  const userAgent = actualUserAgent.toLowerCase();
  let bestAgentLength = -1;
  const matchedGroups: RobotsGroup[] = [];
  for (const group of groups) {
    const lengths = group.agents
      .filter((agent) => agent === "*" || userAgent.includes(agent))
      .map((agent) => agent === "*" ? 0 : agent.length);
    if (!lengths.length) continue;
    const groupLength = Math.max(...lengths);
    if (groupLength > bestAgentLength) {
      bestAgentLength = groupLength;
      matchedGroups.length = 0;
      matchedGroups.push(group);
    } else if (groupLength === bestAgentLength) {
      matchedGroups.push(group);
    }
  }
  if (bestAgentLength < 0) return { allowed: true, matchedRule: null };
  const url = new URL(targetUrl);
  const pathAndQuery = `${url.pathname}${url.search}`;
  const matches = matchedGroups
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatches(rule.path, pathAndQuery))
    .sort((left, right) => {
      const lengthDelta = right.path.replace(/[*$]/g, "").length - left.path.replace(/[*$]/g, "").length;
      if (lengthDelta !== 0) return lengthDelta;
      return left.directive === "allow" ? -1 : 1;
    });
  const winner = matches[0];
  return winner
    ? { allowed: winner.directive === "allow", matchedRule: `${winner.directive}:${winner.path}` }
    : { allowed: true, matchedRule: null };
}

async function persistRobotsEvidence(input: {
  sourceId: string;
  requestedRobotsUrl: string;
  finalRobotsUrl?: string;
  decision: "allowed" | "disallowed" | "error";
  httpStatus?: number;
  policyText?: string;
  matchedRule?: string | null;
  error?: string;
}): Promise<CreatorRobotsEvidence> {
  const ttl = input.decision === "error" ? CREATOR_ROBOTS_ERROR_TTL_MS : CREATOR_ROBOTS_CACHE_TTL_MS;
  const [row] = await db.insert(creatorRobotsEvidenceTable).values({
    sourceId: input.sourceId,
    requestedRobotsUrl: input.requestedRobotsUrl,
    finalRobotsUrl: input.finalRobotsUrl,
    userAgent: CREATOR_CRAWLER_USER_AGENT,
    decision: input.decision,
    allowed: input.decision === "allowed",
    httpStatus: input.httpStatus,
    policyText: input.policyText,
    policySha256: input.policyText === undefined
      ? undefined
      : crypto.createHash("sha256").update(input.policyText).digest("hex"),
    matchedRule: input.matchedRule ?? undefined,
    error: input.error,
    expiresAt: new Date(Date.now() + ttl),
  }).returning();
  if (!row) throw new Error("Robots evidence was not persisted.");
  return row;
}

export async function retrieveRobotsEvidence(
  source: CreatorSource,
  options: {
    fetchFn?: FetchFn;
    lookupFn?: LookupFn;
    allowedRedirectOrigins?: ReadonlySet<string>;
    useCache?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<CreatorRobotsEvidence> {
  if (options.useCache !== false) {
    const [cached] = await db.select().from(creatorRobotsEvidenceTable)
      .where(and(
        eq(creatorRobotsEvidenceTable.sourceId, source.id),
        gt(creatorRobotsEvidenceTable.expiresAt, new Date()),
      ))
      .orderBy(desc(creatorRobotsEvidenceTable.fetchedAt))
      .limit(1);
    if (cached) return cached;
  }

  const sourceUrl = new URL(canonicalizeCreatorSourceUrl(source.canonicalUrl));
  const robotsUrl = new URL("/robots.txt", sourceUrl.origin).href;
  let finalRobotsUrl: string | undefined;
  let httpStatus: number | undefined;
  let releaseResponse: (() => void) | undefined;
  try {
    const result = await guardedFetch(robotsUrl, {
      fetchFn: options.fetchFn,
      lookupFn: options.lookupFn,
      allowedRedirectOrigins: options.allowedRedirectOrigins ?? new Set([sourceUrl.origin]),
      accept: "text/plain",
      timeoutMs: options.timeoutMs,
    });
    releaseResponse = result.release;
    const { response } = result;
    finalRobotsUrl = result.finalUrl;
    httpStatus = response.status;
    if (response.status === 404 || response.status === 410) {
      return persistRobotsEvidence({
        sourceId: source.id,
        requestedRobotsUrl: robotsUrl,
        finalRobotsUrl: result.finalUrl,
        decision: "allowed",
        httpStatus: response.status,
        policyText: "",
      });
    }
    if (response.status === 401 || response.status === 403) {
      return persistRobotsEvidence({
        sourceId: source.id,
        requestedRobotsUrl: robotsUrl,
        finalRobotsUrl: result.finalUrl,
        decision: "disallowed",
        httpStatus: response.status,
        error: "robots.txt access was forbidden; the source is treated as blocked.",
      });
    }
    if (!response.ok) {
      throw new CreatorSourcePolicyError(`robots.txt returned HTTP ${response.status}.`, "robots-uncertain");
    }
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "text/plain") {
      throw new CreatorSourcePolicyError("robots.txt did not return text/plain.", "content-type");
    }
    const policyText = await readLimitedText(response, CREATOR_ROBOTS_MAX_BYTES, result.signal);
    const decision = evaluateRobotsPolicy(parseRobotsPolicy(policyText), source.canonicalUrl);
    return persistRobotsEvidence({
      sourceId: source.id,
      requestedRobotsUrl: robotsUrl,
      finalRobotsUrl: result.finalUrl,
      decision: decision.allowed ? "allowed" : "disallowed",
      httpStatus: response.status,
      policyText,
      matchedRule: decision.matchedRule,
      error: decision.allowed ? undefined : "robots.txt explicitly disallows this source URL.",
    });
  } catch (error) {
    return persistRobotsEvidence({
      sourceId: source.id,
      requestedRobotsUrl: robotsUrl,
      finalRobotsUrl,
      decision: "error",
      httpStatus,
      error: error instanceof Error ? error.message : "robots.txt could not be verified.",
    });
  } finally {
    releaseResponse?.();
  }
}

async function approvedOriginsForMunicipality(municipality: string): Promise<Set<string>> {
  const rows = await db.select({ canonicalUrl: creatorSourcesTable.canonicalUrl })
    .from(creatorSourcesTable)
    .where(and(
      eq(creatorSourcesTable.municipality, municipality),
      eq(creatorSourcesTable.status, "approved"),
    ));
  return new Set(rows.map((row) => new URL(row.canonicalUrl).origin));
}

function decodeHtmlAttribute(value: string): string {
  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt);/gi,
    (entity, name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "quot") return "\"";
      if (normalized === "apos") return "'";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      const numeric = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 0x10ffff
        ? String.fromCodePoint(numeric)
        : entity;
    },
  );
}

/**
 * Extract the bounded crawl frontier from the depth-zero HTML.
 *
 * URLs are canonicalized before deduplication and sorted by their serialized
 * URL rather than document order. This keeps selection repeatable when a page
 * contains more links than the crawl budget.
 */
function collectDepthOneCreatorLinks(
  seedUrl: string,
  html: string,
): string[] {
  const seed = new URL(canonicalizeCreatorSourceUrl(seedUrl));
  const links = new Set<string>();
  const hrefPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const href = decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href) continue;
    try {
      const candidate = new URL(href, seed);
      const canonical = new URL(canonicalizeCreatorSourceUrl(candidate.href));
      // Crawling is deliberately stricter than the municipality redirect
      // allowlist: a seed can only discover pages on its exact HTTPS origin.
      if (canonical.origin !== seed.origin || canonical.href === seed.href) continue;
      links.add(canonical.href);
    } catch (error) {
      if (!(error instanceof CreatorSourcePolicyError) && !(error instanceof TypeError)) throw error;
    }
  }
  return [...links].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

/**
 * Reject URL shapes that are unambiguously utility, listing, or binary
 * resources. This intentionally does not treat broad content sections such as
 * `/attractions` or `/places` as non-content: their children commonly are the
 * attraction detail pages a guide needs.
 */
export function isObviousNonContentCreatorPath(urlValue: string): boolean {
  const url = new URL(urlValue);
  const path = url.pathname.toLowerCase()
    .replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";

  // Files that are not useful HTML/text source pages, including office
  // documents and common static assets.
  if (/\.(?:pdf|docx?|xlsx?|pptx?|csv|tsv|rtf|odt|ods|odp|zip|rar|7z|tar|gz|mp3|mp4|webm|avi|mov|wav|jpg|jpeg|png|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot)$/i.test(last)) {
    return true;
  }
  if (segments.some((segment) => [
    "login", "log-in", "signin", "sign-in", "signout", "sign-out",
    "admin", "administrator", "wp-admin", "wp-login.php",
    "asset", "assets", "static", "media", "uploads", "download", "downloads",
    "document", "documents", "docs", "files",
    "search", "iskanje",
    "tag", "tags", "category", "categories", "kategorija", "kategorije", "oznaka", "oznake",
    "feed", "feeds", "rss", "atom",
    "cookie", "cookies", "gdpr", "privacy", "politika-zasebnosti",
    "einforming", "createnew", "prijava", "qanda", "sitemap",
  ].includes(segment))) {
    return true;
  }
  if (segments.some((segment) =>
    segment.includes("window.location.pathname") || segment.includes("document.location")
  )) {
    return true;
  }
  if (/^\/objave(?:\/\d+)?$/.test(path)) return true;
  if (["/news", "/novice", "/archive", "/archives"].includes(path)
    || /\/(?:news|novice)\/(?:archive|archives|\d{4}(?:\/\d{1,2})?)$/.test(path)) {
    return true;
  }
  // Restrict pagination matching to conventional listing forms so a detail
  // slug containing a number remains crawlable.
  if (/\/page\/\d+$/.test(path) || /\/(?:page|stran)-\d+$/.test(path)) {
    return true;
  }
  return ["page", "paged", "pagination", "s", "q", "query"].some((name) =>
    url.searchParams.has(name),
  );
}

export function discoverDepthOneCreatorLinks(
  seedUrl: string,
  html: string,
  limit = CREATOR_CRAWL_MAX_SUBPAGES,
): string[] {
  const boundedLimit = Number.isInteger(limit)
    ? Math.max(0, Math.min(limit, CREATOR_CRAWL_MAX_SUBPAGES))
    : CREATOR_CRAWL_MAX_SUBPAGES;
  return collectDepthOneCreatorLinks(seedUrl, html).slice(0, boundedLimit);
}

async function persistCreatorSourceUrl(
  source: CreatorSource,
  requestedUrl: string,
  robots: CreatorRobotsEvidence,
  options: {
    fetchFn?: FetchFn;
    lookupFn?: LookupFn;
    onContentAttempt?: () => void;
    onContentRead?: (counters: { rawBytes: number; extractedTextBytes: number }) => void;
    getRemainingContentBytes?: () => number;
    onContentBudgetExceeded?: (input: { url: string; remainingBytes: number }) => void;
    shouldSkipRemainingOnContentBudgetExceeded?: () => boolean;
    urlClaims?: CreatorRunUrlClaims;
    timeoutMs?: number;
  },
): Promise<{ content: CreatorSourceContent; finalUrl: string; observedAt: Date }> {
  const sourceOrigin = new URL(source.canonicalUrl).origin;
  const parsedRobots = parseRobotsPolicy(robots.policyText ?? "");
  const requestedDecision = evaluateRobotsPolicy(parsedRobots, requestedUrl);
  if (!requestedDecision.allowed) {
    throw new CreatorSourcePolicyError(
      `robots.txt disallows source path (${requestedDecision.matchedRule ?? "matching rule"}).`,
      "robots-disallowed",
    );
  }
  options.onContentAttempt?.();
  const result = await guardedFetch(requestedUrl, {
    ...options,
    // Every crawled page and every redirect remains on the seed's exact
    // origin. Redirect destinations are checked against robots before I/O.
    allowedRedirectOrigins: new Set([sourceOrigin]),
    accept: "text/html,text/plain;q=0.9",
    beforeRequest: (url, redirectIndex) => {
      if (redirectIndex > 0) {
        const claim = options.urlClaims?.claim(url.href) ?? "claimed";
        if (claim !== "claimed") {
          throw new CreatorSourcePolicyError(
            "Redirect target was already claimed by this run.",
            claim,
          );
        }
      }
      const decision = evaluateRobotsPolicy(parsedRobots, url.href);
      if (!decision.allowed) {
        throw new CreatorSourcePolicyError(
          `robots.txt disallows redirected source path (${decision.matchedRule ?? "matching rule"}).`,
          "robots-disallowed",
        );
      }
    },
  });
  let raw: string;
  let contentType: string | undefined;
  try {
    if (!result.response.ok) {
      throw new CreatorSourcePolicyError(`Source returned HTTP ${result.response.status}.`, "network");
    }
    contentType = result.response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "text/html" && contentType !== "text/plain") {
      throw new CreatorSourcePolicyError("Source content type is not supported.", "content-type");
    }
    const remainingBytes = Math.max(
      0,
      Math.floor(options.getRemainingContentBytes?.() ?? CREATOR_SOURCE_MAX_BYTES),
    );
    const responseByteLimit = Math.min(CREATOR_SOURCE_MAX_BYTES, remainingBytes);
    const declaredLength = Number(result.response.headers.get("content-length"));
    if (
      responseByteLimit <= 0 ||
      (Number.isFinite(declaredLength) && declaredLength > responseByteLimit)
    ) {
      options.onContentBudgetExceeded?.({ url: result.finalUrl, remainingBytes });
      throw new CreatorSourcePolicyError("Run content-byte budget is exhausted.", "run-budget-exhausted");
    }
    try {
      raw = await readLimitedText(result.response, responseByteLimit, result.signal);
    } catch (error) {
      if (
        error instanceof CreatorSourcePolicyError &&
        error.kind === "response-too-large" &&
        responseByteLimit < CREATOR_SOURCE_MAX_BYTES
      ) {
        options.onContentBudgetExceeded?.({ url: result.finalUrl, remainingBytes });
        throw new CreatorSourcePolicyError("Response crosses the remaining run content-byte budget.", "run-budget-exhausted");
      }
      throw error;
    }
  } finally {
    result.release();
  }
  const titleMatch = contentType === "text/html" ? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw) : null;
  const extractedText = contentType === "text/html"
    ? sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim()
    : raw.replace(/\s+/g, " ").trim();
  if (!extractedText) {
    throw new CreatorSourcePolicyError("Source extraction produced no readable text.", "content-type");
  }
  const observedAt = new Date();
  options.onContentRead?.({
    rawBytes: Buffer.byteLength(raw, "utf8"),
    extractedTextBytes: Buffer.byteLength(extractedText, "utf8"),
  });
  const title = titleMatch
    ? sanitizeHtml(titleMatch[1] ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim()
    : null;
  const contentSha256 = crypto.createHash("sha256").update(raw).digest("hex");
  const [stored] = await db.insert(creatorSourceContentsTable).values({
    sourceId: source.id,
    robotsEvidenceId: robots.id,
    sourceUrl: requestedUrl,
    finalUrl: result.finalUrl,
    httpStatus: result.response.status,
    contentType,
    title: title || null,
    rawContent: raw,
    extractedText,
    contentSha256,
  }).onConflictDoNothing({
    target: [creatorSourceContentsTable.sourceId, creatorSourceContentsTable.contentSha256],
  }).returning();
  if (stored) return { content: stored, finalUrl: result.finalUrl, observedAt };
  const [existing] = await db.select().from(creatorSourceContentsTable)
    .where(and(
      eq(creatorSourceContentsTable.sourceId, source.id),
      eq(creatorSourceContentsTable.contentSha256, contentSha256),
    ))
    .limit(1);
  if (!existing) throw new Error("Extracted source content was not persisted.");
  return { content: existing, finalUrl: result.finalUrl, observedAt };
}

export async function readApprovedCreatorSource(
  sourceId: string,
  options: { fetchFn?: FetchFn; lookupFn?: LookupFn; timeoutMs?: number } = {},
): Promise<CreatorSourceContent> {
  const [source] = await db.select().from(creatorSourcesTable)
    .where(and(
      eq(creatorSourcesTable.id, sourceId),
      eq(creatorSourcesTable.status, "approved"),
    ))
    .limit(1);
  if (!source) {
    throw new CreatorSourcePolicyError("Source is not on an approved municipality list.", "not-approved");
  }
  const allowedRedirectOrigins = await approvedOriginsForMunicipality(source.municipality);
  const robots = await retrieveRobotsEvidence(source, {
    ...options,
    allowedRedirectOrigins,
  });
  if (!robots.allowed) {
    throw new CreatorSourcePolicyError(
      robots.error ?? "robots.txt did not authorize this source.",
      robots.decision === "disallowed" ? "robots-disallowed" : "robots-uncertain",
    );
  }
  return (await persistCreatorSourceUrl(source, source.canonicalUrl, robots, options)).content;
}

/**
 * Crawl one approved seed and a deterministic, depth-one frontier.
 *
 * The caller owns the municipality-wide approved-seed limit (15). This
 * function only enforces the per-seed page budget: the seed plus 60 subpages.
 */
export async function crawlApprovedCreatorSource(
  sourceId: string,
  options: {
    fetchFn?: FetchFn;
    lookupFn?: LookupFn;
    onContentRead?: (counters: { rawBytes: number; extractedTextBytes: number }) => void;
    getRemainingContentBytes?: () => number;
    onContentBudgetExceeded?: (input: { url: string; remainingBytes: number }) => void;
    shouldSkipRemainingOnContentBudgetExceeded?: () => boolean;
    urlClaims?: CreatorRunUrlClaims;
    timeoutMs?: number;
  } = {},
): Promise<CreatorSourceCrawlResult> {
  const [source] = await db.select().from(creatorSourcesTable)
    .where(and(
      eq(creatorSourcesTable.id, sourceId),
      eq(creatorSourcesTable.status, "approved"),
    ))
    .limit(1);
  if (!source) {
    throw new CreatorSourcePolicyError("Source is not on an approved municipality list.", "not-approved");
  }
  const seedClaim = options.urlClaims?.claim(source.canonicalUrl) ?? "claimed";
  if (seedClaim !== "claimed") {
    return {
      sourceId,
      seedUrl: source.canonicalUrl,
      pages: [{
        url: source.canonicalUrl, depth: 0, status: "skipped",
        skipReason: seedClaim, content: null, finalUrl: null, observedAt: null,
        counters: { rawBytes: 0, extractedTextBytes: 0 },
      }],
      counters: {
        discoveredSubpages: 0, selectedSubpages: 0, attemptedPages: 0,
        storedPages: 0, skippedPages: 1, rawBytes: 0, extractedTextBytes: 0,
        skipReasons: { [seedClaim]: 1 },
      },
    };
  }
  const allowedRedirectOrigins = await approvedOriginsForMunicipality(source.municipality);
  const robots = await retrieveRobotsEvidence(source, {
    ...options,
    allowedRedirectOrigins,
  });
  if (!robots.allowed) {
    throw new CreatorSourcePolicyError(
      robots.error ?? "robots.txt did not authorize this source.",
      robots.decision === "disallowed" ? "robots-disallowed" : "robots-uncertain",
    );
  }

  const pages: CreatorCrawlPageResult[] = [];
  let attemptedPages = 0;
  const persistOptions = {
    ...options,
    onContentAttempt: () => {
      attemptedPages += 1;
    },
  };
  const seedRead = await persistCreatorSourceUrl(source, source.canonicalUrl, robots, persistOptions);
  const seed = seedRead.content;
  pages.push({
    url: source.canonicalUrl,
    depth: 0,
    status: "stored",
    skipReason: null,
    content: seed,
    finalUrl: seedRead.finalUrl,
    observedAt: seedRead.observedAt,
    counters: {
      rawBytes: Buffer.byteLength(seed.rawContent ?? "", "utf8"),
      extractedTextBytes: Buffer.byteLength(seed.extractedText, "utf8"),
    },
  });

  const discovered = seed.contentType === "text/html" && seed.rawContent
    ? collectDepthOneCreatorLinks(source.canonicalUrl, seed.rawContent)
    : [];
  const eligible = rankCreatorDepthOneUrls(
    discovered.filter((url) => !isObviousNonContentCreatorPath(url)),
  );
  const selected = eligible.slice(0, CREATOR_CRAWL_MAX_SUBPAGES);
  const selectedUrls = new Set(selected);
  const orderedDiscovered = [
    ...selected,
    ...discovered.filter((url) => !selectedUrls.has(url)),
  ];
  let sourceBudgetStopped = false;
  for (const url of orderedDiscovered) {
    let prefetchSkipReason: CreatorCrawlSkipReason | null = sourceBudgetStopped && selectedUrls.has(url)
      ? "source-byte-cap"
      : isObviousNonContentCreatorPath(url)
      ? "non-content-path"
      : selectedUrls.has(url)
      ? null
      : "page-cap";
    if (!prefetchSkipReason) {
      const claim = options.urlClaims?.claim(url) ?? "claimed";
      if (claim !== "claimed") prefetchSkipReason = claim;
    }
    if (prefetchSkipReason) {
      pages.push({
        url,
        depth: 1,
        status: "skipped",
        skipReason: prefetchSkipReason,
        content: null,
        finalUrl: null,
        observedAt: null,
        counters: { rawBytes: 0, extractedTextBytes: 0 },
      });
      continue;
    }
    try {
      const pageRead = await persistCreatorSourceUrl(source, url, robots, persistOptions);
      const content = pageRead.content;
      pages.push({
        url,
        depth: 1,
        status: "stored",
        skipReason: null,
        content,
        finalUrl: pageRead.finalUrl,
        observedAt: pageRead.observedAt,
        counters: {
          rawBytes: Buffer.byteLength(content.rawContent ?? "", "utf8"),
          extractedTextBytes: Buffer.byteLength(content.extractedText, "utf8"),
        },
      });
    } catch (error) {
      if (!(error instanceof CreatorSourcePolicyError)) throw error;
      if (
        error.kind === "run-budget-exhausted" &&
        !options.shouldSkipRemainingOnContentBudgetExceeded?.()
      ) {
        throw error;
      }
      const skipReason: CreatorCrawlSkipReason =
        error.kind === "run-budget-exhausted" ? "source-byte-cap" : error.kind;
      if (skipReason === "source-byte-cap") sourceBudgetStopped = true;
      pages.push({
        url,
        depth: 1,
        status: "skipped",
        skipReason,
        content: null,
        finalUrl: null,
        observedAt: null,
        counters: { rawBytes: 0, extractedTextBytes: 0 },
      });
    }
  }
  const storedPages = pages.filter((page) => page.status === "stored").length;
  const skipReasons: Partial<Record<CreatorCrawlSkipReason, number>> = {};
  for (const page of pages) {
    if (page.skipReason) skipReasons[page.skipReason] = (skipReasons[page.skipReason] ?? 0) + 1;
  }
  return {
    sourceId: source.id,
    seedUrl: source.canonicalUrl,
    pages,
    counters: {
      discoveredSubpages: discovered.length,
      selectedSubpages: selected.length,
       attemptedPages,
      storedPages,
      skippedPages: pages.length - storedPages,
      rawBytes: pages.reduce((sum, page) => sum + page.counters.rawBytes, 0),
      extractedTextBytes: pages.reduce((sum, page) => sum + page.counters.extractedTextBytes, 0),
      skipReasons,
    },
  };
}