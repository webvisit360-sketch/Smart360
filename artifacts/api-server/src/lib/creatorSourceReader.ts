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

type LookupAddress = { address: string; family: number };
type LookupFn = (hostname: string) => Promise<LookupAddress[]>;
type FetchFn = typeof fetch;
type RobotsRule = { directive: "allow" | "disallow"; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

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
      | "robots-uncertain",
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

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CreatorSourcePolicyError("Response exceeds the configured size limit.", "response-too-large");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new CreatorSourcePolicyError("Response exceeds the configured size limit.", "response-too-large");
    }
    chunks.push(part.value);
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
    beforeRequest?: (url: URL) => void;
  },
): Promise<{ response: Response; finalUrl: string }> {
  let current = new URL(canonicalizeCreatorSourceUrl(initialUrl));
  for (let redirects = 0; redirects <= 5; redirects++) {
    options.beforeRequest?.(current);
    const addresses = await assertPublicCreatorDestination(current, options.lookupFn);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CREATOR_FETCH_TIMEOUT_MS);
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
      throw new CreatorSourcePolicyError("Source request failed or timed out.", "network");
    } finally {
      clearTimeout(timer);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current.href };
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new CreatorSourcePolicyError("Redirect response omitted its destination.", "network");
    }
    const next = new URL(location, current);
    canonicalizeCreatorSourceUrl(next.href);
    if (!options.allowedRedirectOrigins.has(next.origin)) {
      throw new CreatorSourcePolicyError(
        `Redirect origin is not on the approved area list: ${next.origin}`,
        "redirect-not-approved",
      );
    }
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
  try {
    const result = await guardedFetch(robotsUrl, {
      fetchFn: options.fetchFn,
      lookupFn: options.lookupFn,
      allowedRedirectOrigins: options.allowedRedirectOrigins ?? new Set([sourceUrl.origin]),
      accept: "text/plain",
    });
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
    const policyText = await readLimitedText(response, CREATOR_ROBOTS_MAX_BYTES);
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

export async function readApprovedCreatorSource(
  sourceId: string,
  options: { fetchFn?: FetchFn; lookupFn?: LookupFn } = {},
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
  const sourceOrigin = new URL(source.canonicalUrl).origin;
  const parsedRobots = parseRobotsPolicy(robots.policyText ?? "");
  const result = await guardedFetch(source.canonicalUrl, {
    ...options,
    // A content redirect never borrows another domain's robots evidence.
    // Same-origin redirect paths are re-evaluated before their request.
    allowedRedirectOrigins: new Set([sourceOrigin]),
    accept: "text/html,text/plain;q=0.9",
    beforeRequest: (url) => {
      const decision = evaluateRobotsPolicy(parsedRobots, url.href);
      if (!decision.allowed) {
        throw new CreatorSourcePolicyError(
          `robots.txt disallows redirected source path (${decision.matchedRule ?? "matching rule"}).`,
          "robots-disallowed",
        );
      }
    },
  });
  if (!result.response.ok) {
    throw new CreatorSourcePolicyError(`Source returned HTTP ${result.response.status}.`, "network");
  }
  const contentType = result.response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "text/html" && contentType !== "text/plain") {
    throw new CreatorSourcePolicyError("Source content type is not supported.", "content-type");
  }
  const raw = await readLimitedText(result.response, CREATOR_SOURCE_MAX_BYTES);
  const titleMatch = contentType === "text/html" ? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw) : null;
  const extractedText = contentType === "text/html"
    ? sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim()
    : raw.replace(/\s+/g, " ").trim();
  if (!extractedText) {
    throw new CreatorSourcePolicyError("Source extraction produced no readable text.", "content-type");
  }
  const title = titleMatch
    ? sanitizeHtml(titleMatch[1] ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim()
    : null;
  const contentSha256 = crypto.createHash("sha256").update(extractedText).digest("hex");
  const [stored] = await db.insert(creatorSourceContentsTable).values({
    sourceId: source.id,
    robotsEvidenceId: robots.id,
    sourceUrl: source.canonicalUrl,
    finalUrl: result.finalUrl,
    httpStatus: result.response.status,
    contentType,
    title: title || null,
    extractedText,
    contentSha256,
  }).onConflictDoUpdate({
    target: [creatorSourceContentsTable.sourceId, creatorSourceContentsTable.contentSha256],
    set: {
      robotsEvidenceId: robots.id,
      finalUrl: result.finalUrl,
      httpStatus: result.response.status,
      contentType,
      title: title || null,
      extractedText,
      retrievedAt: new Date(),
    },
  }).returning();
  if (!stored) throw new Error("Extracted source content was not persisted.");
  return stored;
}