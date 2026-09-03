import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  creatorPhotoProposalsTable,
  creatorPhotoThrottleTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  db,
  itemsTable,
  mediaTable,
  tenantsTable,
} from "@workspace/db";
import { deletePhotoVariants, mediaBaseName, storePhotoVariants } from "../routes/storage";
import { orientedImageDimensions } from "./mediaDimensions";

const USER_AGENT = "Smart360-Creator-Wikimedia/1.0 (photo attribution; contact: support@smart360.si)";
const JSON_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const OSM_API = "https://api.openstreetmap.org/api/0.6";
const ALLOWED_JSON_HOSTS = new Set(["commons.wikimedia.org", "www.wikidata.org", "api.openstreetmap.org"]);
const ALLOWED_IMAGE_HOSTS = new Set(["upload.wikimedia.org"]);

export type WikimediaFetch = typeof fetch;
export type PhotoCandidate = {
  commonsFile: string;
  thumbnailUrl: string;
  originalUrl: string;
  sourcePageUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
};

export class CreatorPhotoError extends Error {
  constructor(message: string, readonly kind: "not-found" | "conflict" | "upstream" | "unsafe") {
    super(message);
  }
}

const cleanText = (value: unknown) => String(value ?? "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

export function normalizePlaceName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/\b(file|image|slika|photo|photograph)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const GENERIC_WATER_TOKENS = new Set([
  "slap", "slapovi", "waterfall", "waterfalls", "fall", "falls",
]);

export function commonsNameMatchesPlace(placeName: string, commonsFile: string): boolean {
  const wanted = normalizePlaceName(placeName)
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_WATER_TOKENS.has(token));
  const candidate = new Set(
    normalizePlaceName(commonsFile)
      .split(" ")
      .filter((token) => token.length >= 3 && !GENERIC_WATER_TOKENS.has(token)),
  );
  return wanted.length > 0 && wanted.every((token) => candidate.has(token));
}

export function normalizeFreeLicense(value: string): string | null {
  const v = cleanText(value).toLowerCase().replace(/[_\s]+/g, " ").replace(/[–—]/g, "-");
  if (/^(cc0|cc zero)(\b|$)/.test(v)) return "CC0";
  if (/^(public domain|pd)(\b|$)/.test(v)) return "Public domain";
  const bySa = v.match(/^cc(?: |-)?by(?: |-)?sa(?: |-)?([1-4](?:\.0)?)\b/);
  if (bySa) return `CC BY-SA ${bySa[1]}`;
  const by = v.match(/^cc(?: |-)?by(?: |-)?([1-4](?:\.0)?)\b/);
  if (by) return `CC BY ${by[1]}`;
  return null;
}

function safeWikimediaImageUrl(
  raw: string,
  options: { thumbnail?: boolean } = {},
): URL {
  const url = new URL(raw);
  const allowed = url.hostname === "upload.wikimedia.org" ||
    (options.thumbnail === true && url.hostname === "thumb.wikimedia.org");
  if (url.protocol !== "https:" || url.username || url.password ||
      !allowed) {
    throw new CreatorPhotoError("Wikimedia image URL is not safe.", "unsafe");
  }
  return url;
}

function safeExternalUrl(raw: URL | string, binary: boolean): URL {
  const url = raw instanceof URL ? raw : new URL(raw);
  const allowed = binary ? ALLOWED_IMAGE_HOSTS : ALLOWED_JSON_HOSTS;
  if (url.protocol !== "https:" || url.username || url.password || !allowed.has(url.hostname)) {
    throw new CreatorPhotoError("External URL is not an approved HTTPS Wikimedia/OSM endpoint.", "unsafe");
  }
  return url;
}

export function creatorPhotoReservedAt(last: Date | null, now: Date): Date {
  const earliest = last ? last.getTime() + 300 : now.getTime();
  return new Date(Math.max(now.getTime(), earliest));
}

/** DB is the cross-autoscale authority. The UPDATE locks its singleton row,
 * reserves the next 300ms slot, commits, then the caller waits for that slot. */
export async function reserveCreatorPhotoUpstreamSlot(): Promise<Date> {
  return db.transaction(async (tx) => {
    await tx.insert(creatorPhotoThrottleTable).values({ id: 1 }).onConflictDoNothing();
    const result = await tx.execute(sql`
      UPDATE creator_photo_throttle
      SET last_request_at = GREATEST(
        clock_timestamp(),
        COALESCE(last_request_at + interval '300 milliseconds', clock_timestamp())
      )
      WHERE id = 1
      RETURNING last_request_at
    `) as { rows?: Array<{ last_request_at: Date | string }> };
    const value = result.rows?.[0]?.last_request_at;
    if (!value) throw new CreatorPhotoError("Could not reserve Wikimedia request slot.", "upstream");
    return value instanceof Date ? value : new Date(value);
  });
}

async function pacedUpstream<T>(run: () => Promise<T>, reserveSlot = reserveCreatorPhotoUpstreamSlot): Promise<T> {
  const reservedAt = await reserveSlot();
  const remaining = reservedAt.getTime() - Date.now();
  if (remaining > 0) await wait(remaining);
  return run();
}

async function boundedFetch(
  url: URL | string,
  options: { fetchFn: WikimediaFetch; maxBytes: number; binary?: boolean; reserveSlot?: () => Promise<Date> },
): Promise<Buffer | unknown> {
  const safeUrl = safeExternalUrl(url, Boolean(options.binary));
  return pacedUpstream(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await options.fetchFn(safeUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: options.binary ? "image/*" : "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new CreatorPhotoError(`Wikimedia request failed (${response.status}).`, "upstream");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > options.maxBytes) throw new CreatorPhotoError("Remote response is too large.", "unsafe");
    if (!response.body) throw new CreatorPhotoError("Remote response had no body.", "upstream");
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel();
        throw new CreatorPhotoError("Remote response is too large.", "unsafe");
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (options.binary) return body;
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      throw new CreatorPhotoError("Remote service returned invalid JSON.", "upstream");
    }
  } finally {
    clearTimeout(timer);
  }
  }, options.reserveSlot);
}

function queryUrl(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function commonsFileCandidate(
  file: string,
  fetchFn: WikimediaFetch = fetch,
  reserveSlot: () => Promise<Date> = reserveCreatorPhotoUpstreamSlot,
): Promise<PhotoCandidate | null> {
  const title = file.startsWith("File:") ? file : `File:${file}`;
  const data: any = await boundedFetch(queryUrl(COMMONS_API, {
    action: "query", format: "json", formatversion: "2", prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "620", titles: title,
  }), { fetchFn, maxBytes: JSON_LIMIT, reserveSlot });
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info?.url || !info?.thumburl) return null;
  const metadata = info.extmetadata ?? {};
  const license = normalizeFreeLicense(metadata.LicenseShortName?.value ?? metadata.License?.value ?? "");
  const author = cleanText(metadata.Artist?.value ?? metadata.Credit?.value);
  if (!license || !author) return null;
  safeWikimediaImageUrl(info.url);
  safeWikimediaImageUrl(info.thumburl, { thumbnail: true });
  const canonical = String(page.title).replace(/^File:/i, "");
  return {
    commonsFile: canonical,
    thumbnailUrl: info.thumburl,
    originalUrl: info.url,
    sourcePageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(canonical.replace(/ /g, "_"))}`,
    author,
    license,
    licenseUrl: metadata.LicenseUrl?.value ? cleanText(metadata.LicenseUrl.value) : null,
  };
}

async function osmWikidata(osmType: string, osmId: number, fetchFn: WikimediaFetch): Promise<string | null> {
  if (!["node", "way", "relation"].includes(osmType)) return null;
  const data: any = await boundedFetch(`${OSM_API}/${osmType}/${osmId}.json`, { fetchFn, maxBytes: JSON_LIMIT });
  const value = data?.elements?.[0]?.tags?.wikidata;
  return typeof value === "string" && /^Q\d+$/.test(value) ? value : null;
}

async function wikidataP18(id: string, fetchFn: WikimediaFetch): Promise<string | null> {
  const data: any = await boundedFetch(queryUrl(WIKIDATA_API, {
    action: "wbgetentities", format: "json", props: "claims", ids: id,
  }), { fetchFn, maxBytes: JSON_LIMIT });
  const value = data?.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value : null;
}

async function geosearchCandidate(
  name: string, lat: number, lon: number, fetchFn: WikimediaFetch,
): Promise<PhotoCandidate | null> {
  const data: any = await boundedFetch(queryUrl(COMMONS_API, {
    action: "query", format: "json", formatversion: "2", generator: "geosearch",
    ggsprimary: "all", ggsnamespace: "6", ggslimit: "10", ggsradius: "1200",
    ggscoord: `${lat}|${lon}`, prop: "info",
  }), { fetchFn, maxBytes: JSON_LIMIT });
  for (const page of data?.query?.pages ?? []) {
    const file = String(page.title ?? "").replace(/^File:/i, "");
    // Proximity alone is never sufficient. Require every distinctive place
    // token; generic waterfall words may differ across languages.
    if (!commonsNameMatchesPlace(name, file.replace(/\.[a-z0-9]+$/i, ""))) continue;
    const candidate = await commonsFileCandidate(file, fetchFn);
    if (candidate) return candidate;
  }
  return null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function discoverCreatorPhotos(
  tenantId: string,
  options: { fetchFn?: WikimediaFetch; paceMs?: number } = {},
) {
  const fetchFn = options.fetchFn ?? fetch;
  const paceMs = Math.max(300, options.paceMs ?? 300);
  const places = await db.select({
    materializationId: creatorPlaceMaterializationsTable.id,
    itemId: creatorPlaceMaterializationsTable.itemId,
    name: itemsTable.title,
    latitude: creatorPlaceMaterializationsTable.latitude,
    longitude: creatorPlaceMaterializationsTable.longitude,
    osmType: creatorPlaceProposalsTable.osmType,
    osmId: creatorPlaceProposalsTable.osmId,
  }).from(creatorPlaceMaterializationsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, creatorPlaceMaterializationsTable.itemId))
    .innerJoin(creatorPlaceProposalsTable, eq(creatorPlaceProposalsTable.id, creatorPlaceMaterializationsTable.proposalId))
    .leftJoin(mediaTable, eq(mediaTable.itemId, itemsTable.id))
    .where(and(
      eq(creatorPlaceMaterializationsTable.tenantId, tenantId),
      eq(creatorPlaceMaterializationsTable.isActive, true),
      isNull(itemsTable.deletedAt),
      isNull(mediaTable.id),
    )).orderBy(asc(creatorPlaceMaterializationsTable.createdAt));
  const outcomes: Array<{ itemId: string; name: string; outcome: "wikidata" | "geosearch" | "nothing"; reason?: string }> = [];
  for (const place of places) {
    try {
      let candidate: PhotoCandidate | null = null;
      let wikidataId: string | null = null;
      let method: "wikidata" | "geosearch" = "wikidata";
      if (place.osmType && place.osmId !== null) {
        wikidataId = await osmWikidata(place.osmType, place.osmId, fetchFn);
        await wait(paceMs);
        if (wikidataId) {
          const p18 = await wikidataP18(wikidataId, fetchFn);
          await wait(paceMs);
          if (p18) candidate = await commonsFileCandidate(p18, fetchFn);
        }
      }
      if (!candidate) {
        method = "geosearch";
        await wait(paceMs);
        candidate = await geosearchCandidate(place.name ?? "", place.latitude, place.longitude, fetchFn);
      }
      if (!candidate) {
        outcomes.push({ itemId: place.itemId, name: place.name ?? "", outcome: "nothing" });
        continue;
      }
      await db.insert(creatorPhotoProposalsTable).values({
        tenantId, materializationId: place.materializationId, itemId: place.itemId,
        ...candidate, confidence: method === "wikidata" ? "high" : "low",
        discoveryMethod: method, wikidataId,
      }).onConflictDoNothing();
      outcomes.push({ itemId: place.itemId, name: place.name ?? "", outcome: method });
      await wait(paceMs);
    } catch (error) {
      outcomes.push({ itemId: place.itemId, name: place.name ?? "", outcome: "nothing",
        reason: error instanceof Error ? error.message.slice(0, 240) : "Upstream request failed." });
    }
  }
  return {
    eligiblePlaces: places.length,
    foundViaWikidata: outcomes.filter((x) => x.outcome === "wikidata").length,
    foundViaGeosearch: outcomes.filter((x) => x.outcome === "geosearch").length,
    nothingFreeFound: outcomes.filter((x) => x.outcome === "nothing").length,
    outcomes,
  };
}

export async function listCreatorPhotoProposals(tenantId: string) {
  return db.select().from(creatorPhotoProposalsTable)
    .where(eq(creatorPhotoProposalsTable.tenantId, tenantId))
    .orderBy(asc(creatorPhotoProposalsTable.createdAt));
}

export async function rejectCreatorPhotoProposal(input: {
  tenantId: string; proposalId: string; actorId: string; reason?: string;
}) {
  const [row] = await db.update(creatorPhotoProposalsTable).set({
    status: "rejected", reviewedBy: input.actorId, reviewedAt: new Date(),
    rejectionReason: input.reason?.trim() || null, updatedAt: new Date(),
  }).where(and(
    eq(creatorPhotoProposalsTable.id, input.proposalId),
    eq(creatorPhotoProposalsTable.tenantId, input.tenantId),
    eq(creatorPhotoProposalsTable.status, "pending"),
  )).returning();
  if (!row) throw new CreatorPhotoError("Pending photo proposal not found.", "not-found");
  return row;
}

export async function approveCreatorPhotoProposal(input: {
  tenantId: string; proposalId: string; actorId: string; fetchFn?: WikimediaFetch;
}) {
  // Validate and process untrusted network bytes before opening the short
  // write transaction. The row is re-read under the item lock below.
  const [initial] = await db.select().from(creatorPhotoProposalsTable).where(and(
    eq(creatorPhotoProposalsTable.id, input.proposalId),
    eq(creatorPhotoProposalsTable.tenantId, input.tenantId),
  )).limit(1);
  if (!initial) throw new CreatorPhotoError("Photo proposal not found.", "not-found");
  if (initial.status === "approved" && initial.approvedMediaId) {
    const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, initial.approvedMediaId)).limit(1);
    if (media) return { proposal: initial, media };
  }
  if (initial.status !== "pending") throw new CreatorPhotoError("Pending photo proposal not found.", "not-found");
  const candidate = await commonsFileCandidate(initial.commonsFile, input.fetchFn ?? fetch);
  if (!candidate || candidate.originalUrl !== initial.originalUrl) {
    throw new CreatorPhotoError("Commons attribution or source changed; run discovery again.", "unsafe");
  }
  const bytes = await boundedFetch(safeWikimediaImageUrl(candidate.originalUrl), {
    fetchFn: input.fetchFn ?? fetch, maxBytes: IMAGE_LIMIT, binary: true,
  }) as Buffer;
  const metadata = await sharp(bytes).metadata();
  const dimensions = orientedImageDimensions(metadata);
  if (!dimensions || dimensions.width * dimensions.height > 60_000_000 ||
      dimensions.width > 12_000 || dimensions.height > 12_000) {
    throw new CreatorPhotoError("Commons image dimensions exceed the safe limit.", "unsafe");
  }
  const compensation: { namedVariant: { slug: string; name: string } | null } = { namedVariant: null };
  try {
  return await db.transaction(async (tx) => {
    // Match the existing multipart upload and metadata-media writer exactly:
    // the item row lock is the cross-writer serialization invariant.
    await tx.execute(sql`SELECT 1 FROM ${itemsTable} WHERE ${itemsTable.id} = ${initial.itemId} FOR UPDATE`);
    const [proposal] = await tx.select().from(creatorPhotoProposalsTable).where(and(
      eq(creatorPhotoProposalsTable.id, input.proposalId),
      eq(creatorPhotoProposalsTable.tenantId, input.tenantId),
    )).limit(1);
    if (!proposal) {
      throw new CreatorPhotoError("Pending photo proposal not found.", "not-found");
    }
    if (proposal.status === "approved" && proposal.approvedMediaId) {
      const [media] = await tx.select().from(mediaTable).where(eq(mediaTable.id, proposal.approvedMediaId)).limit(1);
      if (media) return { proposal, media };
    }
    if (proposal.status !== "pending") throw new CreatorPhotoError("Pending photo proposal not found.", "not-found");
    const [existing] = await tx.select({ id: mediaTable.id }).from(mediaTable)
      .where(eq(mediaTable.itemId, proposal.itemId)).limit(1);
    if (existing) throw new CreatorPhotoError("The place already has media.", "conflict");
    const [tenant] = await tx.select({ slug: tenantsTable.slug }).from(tenantsTable)
      .where(eq(tenantsTable.id, input.tenantId)).limit(1);
    const [item] = await tx.select({ title: itemsTable.title }).from(itemsTable)
      .where(eq(itemsTable.id, proposal.itemId)).limit(1);
    if (!tenant || !item) throw new CreatorPhotoError("Materialized place not found.", "not-found");
    const name = `${mediaBaseName(tenant.slug, item.title, 1)}-${randomUUID().slice(0, 6)}.jpg`;
    compensation.namedVariant = { slug: tenant.slug, name };
    try {
      await storePhotoVariants(tenant.slug, name, bytes);
      const [media] = await tx.insert(mediaTable).values({
      itemId: proposal.itemId,
      url: `/api/storage/img/${tenant.slug}/${name}`,
      alt: item.title,
      position: 0,
      kind: "image",
      width: dimensions.width,
      height: dimensions.height,
      provisional: true,
      attributionAuthor: candidate.author,
      attributionLicense: candidate.license,
      attributionSourceUrl: candidate.sourcePageUrl,
      provenanceProvider: "wikimedia-commons",
      provenanceFile: candidate.commonsFile,
      provenanceJson: JSON.stringify({
        proposalId: proposal.id, materializationId: proposal.materializationId,
        sourcePageUrl: candidate.sourcePageUrl, originalUrl: candidate.originalUrl,
        licenseUrl: candidate.licenseUrl, discoveryMethod: proposal.discoveryMethod,
        wikidataId: proposal.wikidataId,
      }),
      }).returning();
      const [approved] = await tx.update(creatorPhotoProposalsTable).set({
      status: "approved", reviewedBy: input.actorId, reviewedAt: new Date(),
      approvedMediaId: media!.id, updatedAt: new Date(),
      }).where(eq(creatorPhotoProposalsTable.id, proposal.id)).returning();
      return { proposal: approved!, media: media! };
    } catch (error) {
      await deletePhotoVariants(tenant.slug, name).catch(() => undefined);
      throw error;
    }
  });
  } catch (error) {
    // A transaction can fail while committing, after the callback has returned.
    // The exact name is retained outside the callback so that path is also
    // compensated (and repeated delete is harmless with ignoreNotFound).
    if (compensation.namedVariant) {
      await deletePhotoVariants(compensation.namedVariant.slug, compensation.namedVariant.name).catch(() => undefined);
    }
    throw error;
  }
}

/** Development-only manual probe: never approves/downloads media. */
export async function guardedCreatorPhotoDiscovery(tenantId: string, options: Parameters<typeof discoverCreatorPhotos>[1] = {}) {
  if (process.env.NODE_ENV === "production") {
    throw new CreatorPhotoError("Wikimedia discovery runner is disabled in production.", "unsafe");
  }
  return discoverCreatorPhotos(tenantId, options);
}