import {
  pgTable,
  text,
  boolean,
  bigint,
  doublePrecision,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Permanent 301 redirects for renamed tenant slugs. Every slug a tenant has
 * ever had stays here forever, so old QR codes keep working.
 */
export const tenantAliasesTable = pgTable("tenant_aliases", {
  slug: text("slug").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantsTable = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain").unique(),
  name: text("name").notNull(),
  subtitle: text("subtitle"),
  rating: text("rating"),
  reviewsCount: text("reviews_count"),
  // Two derivatives of ONE logo upload. logoUrl is the source of truth:
  // transparent PNG trimmed to the artwork (first-screen logo on a photo).
  // logoSquareUrl is derived on save: 384x384 on white, artwork at 72 %
  // (round host avatar and tip thumbnail — circles crop nothing).
  logoUrl: text("logo_url"),
  logoSquareUrl: text("logo_square_url"),
  heroUrl: text("hero_url"),
  tourUrl: text("tour_url"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  viber: text("viber"),
  instagram: text("instagram"),
  address: text("address"),
  mapQuery: text("map_query"),
  wifiSsid: text("wifi_ssid"),
  wifiPass: text("wifi_pass"),
  // WiFi encryption for the join-by-scan QR: "WPA" | "WEP" | "nopass".
  // NULL = WPA (the sensible default; almost every router is WPA2/WPA3).
  wifiEnc: text("wifi_enc"),
  // One page background colour for the WHOLE guest app (wifi-in-barva-ozadja.md).
  // NULL = theme default white. Dark text/line tokens are DERIVED from its
  // luminance client-side — never stored separately.
  bgColor: text("bg_color"),
  theme: text("theme").notNull().default("mediterran"),
  coverTitle: text("cover_title"),
  coverSubtitle: text("cover_subtitle"),
  // Cover editor overrides: NULL = inherit the active theme's default (see ui/urejevalnik-naslovnice.md)
  coverTitleSize: doublePrecision("cover_title_size"),
  coverTitleOpacity: doublePrecision("cover_title_opacity"),
  coverTextColor: text("cover_text_color"),
  coverSubSize: doublePrecision("cover_sub_size"),
  coverSubOpacity: doublePrecision("cover_sub_opacity"),
  coverMetaSize: doublePrecision("cover_meta_size"),
  coverMetaOpacity: doublePrecision("cover_meta_opacity"),
  coverVeil: doublePrecision("cover_veil"),
  tileVeil: doublePrecision("tile_veil"),
  // Small-text controls (ui paket 13): multiplier %, curated font key, colour.
  // NULL = theme default (scale 140 %, app typeface, original grey hierarchy).
  textScale: doublePrecision("text_scale"),
  textFont: text("text_font"),
  textColor: text("text_color"),
  coverAlign: text("cover_align"),
  coverShowRating: boolean("cover_show_rating"),
  // Swipe theme bottom icon row colours (see ui/tema-poteg.css .tabdock)
  // Cover/nav fields: NULL means "use the theme default" (html[data-theme=...]
  // block in CSS). Never write defaults into the DB — empty is the signal that
  // the owner has not overridden the value, so theme switches inherit cleanly.
  // First-screen tenant logo placement (logotip-stranke-naslovnica.md).
  // Percentages of the cover/hero image box, so one saved position holds on
  // every phone width. NULL = theme default (CSS var() fallback).
  logoX: doublePrecision("logo_x"),
  logoY: doublePrecision("logo_y"),
  logoW: doublePrecision("logo_w"),
  logoOpacity: doublePrecision("logo_opacity"),
  navColorCover: text("nav_color_cover"),
  navColor: text("nav_color"),
  navColorOn: text("nav_color_on"),
  languages: text("languages")
    .array()
    .notNull()
    .default(["sl", "en", "it", "de"]),
  // Soft per-tenant media quota (bytes). Uploads are refused at 100 %;
  // nothing is ever deleted automatically. Default 2 GB.
  mediaQuotaBytes: bigint("media_quota_bytes", { mode: "number" })
    .notNull()
    .default(2_147_483_648),
  isTemplate: boolean("is_template").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  // Yearly maintenance (datum-in-obnova-narocnine.md). createdAt is shown as
  // "Vzpostavljeno" on the tenant card; existing rows get the migration date.
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // "Obnova" — a REAL editable date, not computed. Set to createdAt + 1 year
  // on create; the operator may move it (late payer, free months).
  renewsAt: timestamp("renews_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Renewal history — proof of WHEN a renewal was recorded. Three columns and
 * nothing more: no invoicing module (spec section 4, "WHAT THIS IS NOT").
 */
export const tenantRenewalsTable = pgTable("tenant_renewals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  prevDate: timestamp("prev_date", { withTimezone: true }),
  newDate: timestamp("new_date", { withTimezone: true }).notNull(),
  // Operator username (single-operator system); kept for the audit line.
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
