import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { hostUsersTable } from "./hosts";
import { tenantsTable } from "./tenants";

export type HostOnboardingContact = { id: string; name: string; phone: string };
export type HostOnboardingOffer = { id: string; name: string; price: string };
export type HostOnboardingRecommendation = {
  id: string;
  categoryId: string;
  name: string;
};
export type HostOnboardingMedia = {
  id: string;
  itemId: string | null;
  kind: "image" | "video";
  url: string;
  alt: string;
  position: number;
  posterUrl: string | null;
  durationSec: number | null;
  width?: number | null;
  height?: number | null;
  focusX?: number | null;
  focusY?: number | null;
};
export type HostOnboardingCanonicalItem = {
  id: string;
  categoryId: string;
  categoryKey: string | null;
  sectionKey: string;
  title: string;
  body: string;
  price: string;
  priceUnit: string;
  phone: string;
  website: string;
  mapQuery: string;
  difficulty: string;
  duration: string;
  distance: string;
  noteType: string;
  noteText: string;
  bullets: string[];
  tint: string;
  frame: string;
  isVisible: boolean;
  orderEnabled: boolean;
  soldOut: boolean;
  producerName: string;
  producerNote: string;
};
export type HostOnboardingCustomCategory = {
  id: string;
  name: string;
  entries: Array<{ id: string; name: string }>;
};
export type HostOnboardingEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
};
export type HostOnboardingData = {
  accommodationName: string;
  address: string;
  guestPhone: string;
  guestEmail: string;
  website: string;
  checkInFrom: string;
  checkOutUntil: string;
  contacts: HostOnboardingContact[];
  wifiName: string;
  wifiPassword: string;
  houseRulesParking: string;
  offers: HostOnboardingOffer[];
  recommendations: HostOnboardingRecommendation[];
  customCategories: HostOnboardingCustomCategory[];
  events: HostOnboardingEvent[];
  /** Canonical tenant draft media. Legacy rounds may omit this workflow view. */
  media?: HostOnboardingMedia[];
  /** Deletions are always explicit; omission from a collection never deletes. */
  deleteContactIds?: string[];
  deleteOfferIds?: string[];
  deleteEventIds?: string[];
  deleteMediaIds?: string[];
  /** Lossless canonical item projection for rich/opaque editor fields. */
  canonicalItems?: HostOnboardingCanonicalItem[];
  hero?: { url: string; alt: string; mediaId: string | null } | null;
};
export type HostOnboardingTargetReview = {
  target: string;
  hostValue: unknown;
  operatorValue: unknown;
  resolution: "filled_blank" | "suggestion" | "unchanged";
  suggestionVisible: boolean;
};
export type HostOnboardingRecommendationReview = {
  categoryKey: string;
  name: string;
  proposalId: string | null;
  hostCreated?: boolean;
  provenance?: string;
  customCategoryId?: string;
  customEntryId?: string;
  categoryId?: string;
};

export const hostOnboardingRoundsTable = pgTable(
  "host_onboarding_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => hostUsersTable.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    status: text("status").notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    draftData: jsonb("draft_data").notNull().$type<HostOnboardingData>(),
    targetReview: jsonb("target_review")
      .notNull()
      .default([])
      .$type<HostOnboardingTargetReview[]>(),
    recommendationReview: jsonb("recommendation_review")
      .notNull()
      .default([])
      .$type<HostOnboardingRecommendationReview[]>(),
    notificationStatus: text("notification_status").notNull().default("not_admitted"),
    notificationRecipient: text("notification_recipient"),
    notificationProviderMessageId: text("notification_provider_message_id"),
    notificationError: text("notification_error"),
    notificationAttemptedAt: timestamp("notification_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("host_onboarding_rounds_tenant_round_uq").on(t.tenantId, t.round),
    uniqueIndex("host_onboarding_rounds_one_draft_uq")
      .on(t.tenantId)
      .where(sql`${t.status} = 'draft'`),
    index("host_onboarding_rounds_host_status_idx").on(t.hostUserId, t.status),
    check("host_onboarding_rounds_round_check", sql`${t.round} > 0`),
    check("host_onboarding_rounds_revision_check", sql`${t.revision} > 0`),
    check(
      "host_onboarding_rounds_status_check",
      sql`${t.status} IN ('draft','submitted')`,
    ),
    check(
      "host_onboarding_rounds_submission_check",
      sql`(${t.status} = 'submitted') = (${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      "host_onboarding_rounds_notification_check",
      sql`${t.notificationStatus} IN ('not_admitted','pending','sending','sent','failed')`,
    ),
  ],
);

export const hostOnboardingPhotosTable = pgTable(
  "host_onboarding_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => hostOnboardingRoundsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    // Runtime upload allowlist plus Sharp decode enforce real image content.
    // This is deliberately not a DB MIME constraint.
    contentType: text("content_type").notNull(),
    expectedSize: integer("expected_size").notNull(),
    actualSize: integer("actual_size"),
    width: integer("width"),
    height: integer("height"),
    status: text("status").notNull().default("uploading"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    index("host_onboarding_photos_round_status_idx").on(t.onboardingId, t.status),
    index("host_onboarding_photos_tenant_idx").on(t.tenantId),
    check(
      "host_onboarding_photos_status_check",
      sql`${t.status} IN ('uploading','ready','submitted')`,
    ),
    check(
      "host_onboarding_photos_size_check",
      sql`${t.expectedSize} > 0 AND ${t.expectedSize} <= 20971520 AND (${t.actualSize} IS NULL OR ${t.actualSize} > 0)`,
    ),
  ],
);

export const hostOnboardingEventSuggestionsTable = pgTable(
  "host_onboarding_event_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => hostOnboardingRoundsTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    sourceRowId: text("source_row_id").notNull(),
    name: text("name").notNull(),
    eventDate: text("event_date").notNull(),
    eventTime: text("event_time").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("host_onboarding_events_round_source_uq").on(
      t.onboardingId,
      t.sourceRowId,
    ),
    index("host_onboarding_events_tenant_status_idx").on(t.tenantId, t.status),
    check(
      "host_onboarding_events_status_check",
      sql`${t.status} IN ('pending','reviewed','rejected')`,
    ),
    check(
      "host_onboarding_events_date_check",
      sql`${t.eventDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check(
      "host_onboarding_events_time_check",
      sql`${t.eventTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
);

export type HostOnboardingRound = typeof hostOnboardingRoundsTable.$inferSelect;
export type HostOnboardingPhoto = typeof hostOnboardingPhotosTable.$inferSelect;
export type HostOnboardingEventSuggestion =
  typeof hostOnboardingEventSuggestionsTable.$inferSelect;