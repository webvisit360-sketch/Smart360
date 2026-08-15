import {
  pgTable,
  text,
  boolean,
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
  logoUrl: text("logo_url"),
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
  navColorCover: text("nav_color_cover"),
  navColor: text("nav_color"),
  navColorOn: text("nav_color_on"),
  languages: text("languages")
    .array()
    .notNull()
    .default(["sl", "en", "it", "de"]),
  isTemplate: boolean("is_template").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
