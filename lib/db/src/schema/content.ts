import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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
});

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sectionsTable.id, { onDelete: "cascade" }),
  key: text("key"),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("doc"),
  layout: text("layout").notNull().default("text"),
  position: integer("position").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
});

export const itemsTable = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categoriesTable.id, { onDelete: "cascade" }),
  title: text("title"),
  body: text("body"),
  price: text("price"),
  priceUnit: text("price_unit"),
  phone: text("phone"),
  website: text("website"),
  mapQuery: text("map_query"),
  difficulty: text("difficulty"),
  duration: text("duration"),
  distance: text("distance"),
  open24: boolean("open24").notNull().default(false),
  hoursJson: text("hours_json"),
  noteType: text("note_type"),
  noteText: text("note_text"),
  bullets: text("bullets").array().notNull().default([]),
  position: integer("position").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
});

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
});

export const translationsTable = pgTable("translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  model: text("model").notNull(),
  recordId: uuid("record_id").notNull(),
  field: text("field").notNull(),
  lang: text("lang").notNull(),
  value: text("value").notNull(),
});

export const changelogTable = pgTable("changelog", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  tenantName: text("tenant_name"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
export type MediaRow = typeof mediaTable.$inferSelect;
export type TranslationRow = typeof translationsTable.$inferSelect;
export type ChangelogRow = typeof changelogTable.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
