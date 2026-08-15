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
  coverTitleSize: doublePrecision("cover_title_size").notNull().default(56),
  coverTitleOpacity: doublePrecision("cover_title_opacity").notNull().default(66),
  coverTextColor: text("cover_text_color").notNull().default("#FFFFFF"),
  coverSubSize: doublePrecision("cover_sub_size").notNull().default(22),
  coverSubOpacity: doublePrecision("cover_sub_opacity").notNull().default(50),
  coverMetaSize: doublePrecision("cover_meta_size").notNull().default(19.5),
  coverMetaOpacity: doublePrecision("cover_meta_opacity").notNull().default(60),
  coverVeil: doublePrecision("cover_veil").notNull().default(26),
  coverAlign: text("cover_align").notNull().default("left"),
  coverShowRating: boolean("cover_show_rating").notNull().default(true),
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
