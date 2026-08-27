import {
  pgTable,
  text,
  boolean,
  integer,
  smallint,
  timestamp,
  uuid,
  doublePrecision,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const sectionsTable = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  icon: text("icon").notNull().default("sparkle"),
  imageUrl: text("image_url"),
  position: integer("position").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
}, (t) => [
  // Guest payload render path: every guide open filters by tenant.
  index("sections_tenant_idx").on(t.tenantId),
]);

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sectionsTable.id, { onDelete: "cascade" }),
  key: text("key"),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("doc"),
  layout: text("layout").notNull().default("text"),
  // Persisted Living Guide Okolica group. Guest rendering never infers this
  // from translated labels; hosts can reassign it in the category editor.
  exploreGroup: text("explore_group").notNull().default("experiences"),
  position: integer("position").notNull().default(0),
  // "published" in the product spec: hide without deleting (seasonal offers).
  isVisible: boolean("is_visible").notNull().default(true),
  // Soft delete: rows stay (with photos and translations) for the 30-day trash.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  // Guest payload render path: categories are fetched by their sections.
  index("categories_section_idx").on(t.sectionId),
]);

export const itemsTable = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  title: text("title"),
  body: text("body"),
  // Optional ISO-8601 start used by Living Guide Program/event destinations.
  // Text keeps the public contract stable and avoids implicit timezone shifts.
  eventStart: text("event_start"),
  price: text("price"),
  priceUnit: text("price_unit"),
  phone: text("phone"),
  website: text("website"),
  mapQuery: text("map_query"),
  difficulty: text("difficulty"),
  duration: text("duration"),
  distance: text("distance"),
  distanceMeters: doublePrecision("distance_meters"),
  open24: boolean("open24").notNull().default(false),
  hoursJson: text("hours_json"),
  noteType: text("note_type"),
  noteText: text("note_text"),
  bullets: text("bullets").array().notNull().default([]),
  // Barvna ploščica: hex barva namesto fotografije na PLOŠČICI (fotografije v
  // detajlu ostanejo). Prazno = fotografija, kot doslej. (barvne-ploscice.md)
  tint: text("tint"),
  // Oblika okvirja fotografij vnosa (izrez-wifi-eposta.md §1b): null/"wide" =
  // ležeče (privzeto), "tall" = pokončno 4:5, "square" = kvadrat 1:1. Cela
  // galerija enega vnosa deli obliko (mešane višine v traku poskakujejo).
  frame: text("frame"),
  position: integer("position").notNull().default(0),
  // "published" in the product spec: hide without deleting (seasonal offers).
  isVisible: boolean("is_visible").notNull().default(true),
  // Soft delete: rows stay (with photos and translations) for the 30-day trash.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Living Guide ordering fields (naročila.md)
  orderEnabled: boolean("order_enabled").notNull().default(false),
  soldOut: boolean("sold_out").notNull().default(false),
  producerName: text("producer_name"),
  producerNote: text("producer_note"),
}, (t) => [
  // Guest payload render path: items are fetched by their categories.
  index("items_category_idx").on(t.categoryId),
]);

// Cached road-distance candidates are deliberately separate from item content:
// a distance reaches guests only after an administrator approves the proposal.
export const itemDistanceProposalsTable = pgTable(
  "item_distance_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    source: text("source"),
    confidence: text("confidence"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    distanceMeters: doublePrecision("distance_meters"),
    durationMinutes: doublePrecision("duration_minutes"),
    resolvedAddress: text("resolved_address"),
    geocodeQuery: text("geocode_query"),
    inputFingerprint: text("input_fingerprint").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("item_distance_proposals_item_idx").on(t.itemId)],
);

// Nominatim answers, including misses, are permanent to respect its rate limit
// and avoid repeatedly looking up an ambiguous legacy query.
export const geocodeCacheTable = pgTable(
  "geocode_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    displayName: text("display_name"),
    ok: boolean("ok").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("geocode_cache_query_idx").on(t.query)],
);

// Singleton lease row used to coordinate Nominatim's one-request-per-second
// policy across every API process sharing this database.
export const geocodeThrottleTable = pgTable(
  "geocode_throttle",
  {
    id: smallint("id").primaryKey().default(1),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
  },
  (t) => [check("geocode_throttle_singleton", sql`${t.id} = 1`)],
);

export const mediaTable = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").references(() => itemsTable.id, {
    onDelete: "cascade",
  }),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, {
    onDelete: "cascade",
  }),
  url: text("url").notNull(),
  alt: text("alt"),
  position: integer("position").notNull().default(0),
  // "image" | "video" — the gallery is ONE ordered list holding both.
  kind: text("kind").notNull().default("image"),
  // Video only: poster frame (JPEG, same variants as photos) and duration.
  posterUrl: text("poster_url"),
  durationSec: doublePrecision("duration_sec"),
  // Intrinsic display dimensions after EXIF orientation. These let the guest
  // app reserve the final gallery height before the image bytes arrive.
  width: integer("width"),
  height: integer("height"),
  // Žariščna točka izreza v odstotkih (izrez-wifi-eposta.md §1a): točka, ki
  // mora ostati vidna, izrisana kot object-position. Privzeto središče.
  focusX: integer("focus_x").notNull().default(50),
  focusY: integer("focus_y").notNull().default(50),
  // Purpose discriminator: "item" (default, backward-compatible) or "site-plan".
  // site-plan rows are tenant-scoped (tenantId NOT NULL, itemId NULL), image-only,
  // ordered, and carry a caption (stored in the alt column).
  // The DB CHECK below enforces tenant scope and image-only site plans.
  purpose: text("purpose").notNull().default("item"),
}, (t) => [
  check(
    "media_site_plan_scope_v2",
    sql`${t.purpose} != 'site-plan' OR (${t.tenantId} IS NOT NULL AND ${t.itemId} IS NULL AND ${t.kind} = 'image')`,
  ),
  // Guest payload render path: gallery rows are fetched by their items.
  index("media_item_idx").on(t.itemId),
]);

export const translationsTable = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // "tenant" | "section" | "category" | "item" | "ui" (interface strings,
    // recordId = tenant id, field = the UI key e.g. "UI.search.title").
    model: text("model").notNull(),
    recordId: uuid("record_id").notNull(),
    // Field name on the record; array fields use sub-indexes ("body[3]",
    // "bullets[2]") so a translation sticks to its own paragraph/bullet.
    field: text("field").notNull(),
    lang: text("lang").notNull(),
    value: text("value").notNull(),
    // The Slovene source changed after this translation was written. Stale
    // translations stay visible ("izvirnik se je spremenil") — never deleted.
    stale: boolean("stale").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("translations_ref_idx").on(t.model, t.recordId, t.field, t.lang),
    // Guest payload render path: content overlay looks translations up by
    // record + language; translations_ref_idx leads with `model`, which that
    // query does not constrain, so it needs its own index.
    index("translations_record_lang_idx").on(t.recordId, t.lang),
  ]
);

// Plural forms per language ("1 ocena / 2 oceni / 3 ocene / 5 ocen").
// Selected with Intl.PluralRules(lang) — forms are the CLDR categories.
export const pluralFormsTable = pgTable(
  "plural_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: system strings shared by every tenant have no tenant.
    tenantId: uuid("tenant_id").references(() => tenantsTable.id, {
      onDelete: "cascade",
    }),
    lang: text("lang").notNull(),
    key: text("key").notNull(), // e.g. "reviews"
    form: text("form").notNull(), // "one" | "two" | "few" | "other"
    value: text("value").notNull(), // e.g. "{n} reviews"
  },
  (t) => [index("plural_forms_lookup_idx").on(t.tenantId, t.lang, t.key)]
);

export const changelogTable = pgTable("changelog", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  tenantName: text("tenant_name"),
  // Optional durable idempotency marker for one-time operational cutovers.
  // PostgreSQL unique constraints allow multiple NULLs, so ordinary changelog
  // rows remain unaffected while a named operation can be recorded only once.
  operationKey: text("operation_key").unique(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  // A deliberately small, Slovenian audit vocabulary. Unlike the legacy
  // `detail`, this field is never derived from a submitted content value,
  // contact, password, or other personal data.
  summary: text("summary").notNull().default("Sprememba v vodniku"),
  detail: text("detail"),
  // WHO made the change (Instruction #28 CP1 §6). Existing rows predate host
  // accounts and were all made by the single operator, so the column default
  // 'owner' doubles as the backfill. Owner actions inside a tenant are shown
  // as "performed by the owner on the host's behalf".
  actorType: text("actor_type").notNull().default("owner"), // owner | host | system
  actorId: uuid("actor_id"),
  actorEmail: text("actor_email"),
  // Display-only attribution; it intentionally contains no account identity.
  actorLabel: text("actor_label").notNull().default("Smart360"),
  // Request IP is retained for incident investigation only. It is cleared,
  // rather than deleting the audit row, after twelve months.
  requestIp: text("request_ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // Tenant history is always read newest-first; this keeps the complete audit
  // list efficient without imposing an artificial response cap.
  index("changelog_tenant_created_idx").on(t.tenantId, t.createdAt),
]);

export const insertSectionSchema = createInsertSchema(sectionsTable).omit({
  id: true,
});
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
});
export const insertItemSchema = createInsertSchema(itemsTable).omit({
  id: true,
});

export type Section = typeof sectionsTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Item = typeof itemsTable.$inferSelect;
export type ItemDistanceProposal = typeof itemDistanceProposalsTable.$inferSelect;
export type GeocodeCache = typeof geocodeCacheTable.$inferSelect;
export type MediaRow = typeof mediaTable.$inferSelect;
export type TranslationRow = typeof translationsTable.$inferSelect;
export type PluralFormRow = typeof pluralFormsTable.$inferSelect;
export type ChangelogRow = typeof changelogTable.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
