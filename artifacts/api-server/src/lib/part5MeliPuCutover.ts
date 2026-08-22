import { pool, type PoolClient } from "@workspace/db";
import { createHash } from "node:crypto";
import {
  PART5_CATEGORY_KEY_UPDATES,
  PART5_COMPILED_PAYLOAD_SHA256,
  PART5_EXPECTED_POST,
  PART5_EXPECTED_PRE,
  PART5_LEDGER_SHA256,
  PART5_MEDIA_DIMENSION_UPDATES,
  PART5_MEDIA_INSERTS,
  PART5_MEDIA_REMOVALS,
  PART5_ORDER_FLAG_UPDATES,
} from "./part5MeliPuLedger";

const TARGET_SLUG = "meli-pu";
const CUTOVER_LOCK_KEY = 537_360_005;
const CUTOVER_OPERATION_KEY = `part5-meli-pu:${PART5_LEDGER_SHA256}`;
const EXPECTED_GUEST_UI_CONSTRAINT =
  "CHECK ((guest_ui_mode = ANY (ARRAY['legacy'::text, 'living-guide'::text])))";

type Manifest = {
  count: number;
  hash: string | null;
};

export type Part5ContentManifests = {
  categories: Manifest;
  items: Manifest;
  media: Manifest;
};

export type Part5CutoverPreflight = {
  tenantId: string;
  tenantName: string;
  slug: typeof TARGET_SLUG;
  isPublished: boolean;
  guestUiMode: string;
  recipientConfigured: boolean;
  orderPasswordConfigured: boolean;
  orderEmailEnabled: boolean;
  schema: {
    guestUiModeColumnReady: boolean;
    guestUiModeConstraintReady: boolean;
    cutoverMarkerReady: boolean;
    columnDefault: string | null;
    constraintDefinition: string | null;
  };
  ledgerSha256: typeof PART5_LEDGER_SHA256;
  manifests: Part5ContentManifests;
  phase: "pre" | "post" | "drift";
};

export type Part5CutoverResult = Part5CutoverPreflight & {
  applied: true;
  mutations: {
    categoryKeys: number;
    orderFlags: number;
    mediaDimensionRows: number;
    mediaInserts: number;
    mediaRemovals: number;
    changelogEntries: 1;
  };
};

type TenantCutoverRow = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  guest_ui_mode: string;
  recipient_configured: boolean;
  order_password_configured: boolean;
  order_notify_email: boolean;
};

type SchemaReadinessRow = {
  column_ready: boolean;
  column_default: string | null;
  constraint_ready: boolean;
  constraint_definition: string | null;
  marker_ready: boolean;
};

type ManifestRow = {
  count: number;
  hash: string | null;
};

export class Part5CutoverPreconditionError extends Error {
  readonly code = "PART5_CUTOVER_PRECONDITION_FAILED";

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "Part5CutoverPreconditionError";
  }
}

function isProductionRuntime(): boolean {
  return (
    process.env["NODE_ENV"] === "production" &&
    Boolean(process.env["REPLIT_DEPLOYMENT"])
  );
}

export function computePart5CompiledPayloadSha256(): string {
  const canonical = JSON.stringify({
    targetSlug: TARGET_SLUG,
    ledgerSha256: PART5_LEDGER_SHA256,
    expectedPre: PART5_EXPECTED_PRE,
    expectedPost: PART5_EXPECTED_POST,
    categoryKeyUpdates: PART5_CATEGORY_KEY_UPDATES,
    orderFlagUpdates: PART5_ORDER_FLAG_UPDATES,
    mediaDimensionUpdates: PART5_MEDIA_DIMENSION_UPDATES,
    mediaInserts: PART5_MEDIA_INSERTS,
    mediaRemovals: PART5_MEDIA_REMOVALS,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function assertLedgerShape(): void {
  const compiledPayloadSha256 = computePart5CompiledPayloadSha256();
  if (compiledPayloadSha256 !== PART5_COMPILED_PAYLOAD_SHA256) {
    throw new Part5CutoverPreconditionError(
      "Compiled ledger payload SHA-256 does not match the approved allowlist",
      {
        expected: PART5_COMPILED_PAYLOAD_SHA256,
        actual: compiledPayloadSha256,
      },
    );
  }
  const ledgerLines =
    PART5_CATEGORY_KEY_UPDATES.length +
    PART5_ORDER_FLAG_UPDATES.length +
    PART5_MEDIA_DIMENSION_UPDATES.length * 2 +
    PART5_MEDIA_INSERTS.length * 13 +
    PART5_MEDIA_REMOVALS.length;
  if (
    PART5_CATEGORY_KEY_UPDATES.length !== 37 ||
    PART5_ORDER_FLAG_UPDATES.length !== 9 ||
    PART5_MEDIA_DIMENSION_UPDATES.length !== 131 ||
    PART5_MEDIA_INSERTS.length !== 3 ||
    PART5_MEDIA_REMOVALS.length !== 2 ||
    ledgerLines !== 349
  ) {
    throw new Part5CutoverPreconditionError("Compiled ledger totals are invalid", {
      categoryKeys: PART5_CATEGORY_KEY_UPDATES.length,
      orderFlags: PART5_ORDER_FLAG_UPDATES.length,
      mediaDimensionRows: PART5_MEDIA_DIMENSION_UPDATES.length,
      mediaInserts: PART5_MEDIA_INSERTS.length,
      mediaRemovals: PART5_MEDIA_REMOVALS.length,
      ledgerLines,
    });
  }
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(PART5_CATEGORY_KEY_UPDATES.map((row) => row.id)) ||
    !unique(PART5_ORDER_FLAG_UPDATES.map((row) => row.id)) ||
    !unique(PART5_MEDIA_DIMENSION_UPDATES.map((row) => row.id)) ||
    !unique(PART5_MEDIA_INSERTS.map((row) => row.id)) ||
    !unique(PART5_MEDIA_REMOVALS.map((row) => row.id))
  ) {
    throw new Part5CutoverPreconditionError(
      "Compiled ledger contains duplicate row IDs",
    );
  }
}

function sameManifest(actual: Manifest, expected: Manifest): boolean {
  return actual.count === expected.count && actual.hash === expected.hash;
}

function manifestsEqual(
  actual: Part5ContentManifests,
  expected: Part5ContentManifests,
): boolean {
  return (
    sameManifest(actual.categories, expected.categories) &&
    sameManifest(actual.items, expected.items) &&
    sameManifest(actual.media, expected.media)
  );
}

function manifestPhase(manifests: Part5ContentManifests): "pre" | "post" | "drift" {
  if (manifestsEqual(manifests, PART5_EXPECTED_PRE)) return "pre";
  if (manifestsEqual(manifests, PART5_EXPECTED_POST)) return "post";
  return "drift";
}

async function readTenant(
  client: PoolClient,
  lock = false,
): Promise<TenantCutoverRow> {
  const suffix = lock ? " FOR UPDATE" : "";
  const result = await client.query<TenantCutoverRow>(
    `SELECT
       id,
       name,
       slug,
       is_published,
       guest_ui_mode,
       (email IS NOT NULL AND btrim(email) <> '') AS recipient_configured,
       (order_password IS NOT NULL AND btrim(order_password) <> '') AS order_password_configured,
       order_notify_email
     FROM tenants
     WHERE slug = $1${suffix}`,
    [TARGET_SLUG],
  );
  const tenant = result.rows[0];
  if (!tenant || tenant.slug !== TARGET_SLUG) {
    throw new Part5CutoverPreconditionError("Production Meli Pu tenant not found");
  }
  return tenant;
}

async function readSchemaReadiness(
  client: PoolClient,
): Promise<SchemaReadinessRow> {
  const result = await client.query<SchemaReadinessRow>(
    `WITH column_state AS (
       SELECT
         (
           data_type = 'text'
           AND is_nullable = 'NO'
           AND column_default = '''legacy''::text'
         ) AS column_ready,
         column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tenants'
         AND column_name = 'guest_ui_mode'
     ),
     constraint_state AS (
       SELECT
         (pg_get_constraintdef(c.oid) = $1) AS constraint_ready,
         pg_get_constraintdef(c.oid) AS constraint_definition
       FROM pg_constraint c
       JOIN pg_class r ON r.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = r.relnamespace
       WHERE n.nspname = 'public'
         AND r.relname = 'tenants'
         AND c.contype = 'c'
         AND c.conname = 'tenants_guest_ui_mode_enum'
       LIMIT 1
     ),
     marker_column_state AS (
       SELECT (data_type = 'text' AND is_nullable = 'YES') AS marker_column_ready
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'changelog'
         AND column_name = 'operation_key'
     ),
     marker_constraint_state AS (
       SELECT (pg_get_constraintdef(c.oid) = 'UNIQUE (operation_key)') AS marker_constraint_ready
       FROM pg_constraint c
       JOIN pg_class r ON r.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = r.relnamespace
       WHERE n.nspname = 'public'
         AND r.relname = 'changelog'
         AND c.contype = 'u'
         AND c.conname = 'changelog_operation_key_unique'
       LIMIT 1
     )
     SELECT
       COALESCE((SELECT column_ready FROM column_state), false) AS column_ready,
       (SELECT column_default FROM column_state) AS column_default,
       COALESCE((SELECT constraint_ready FROM constraint_state), false) AS constraint_ready,
       (SELECT constraint_definition FROM constraint_state) AS constraint_definition,
       (
         COALESCE((SELECT marker_column_ready FROM marker_column_state), false)
         AND COALESCE((SELECT marker_constraint_ready FROM marker_constraint_state), false)
       ) AS marker_ready`,
    [EXPECTED_GUEST_UI_CONSTRAINT],
  );
  return (
    result.rows[0] ?? {
      column_ready: false,
      column_default: null,
      constraint_ready: false,
      constraint_definition: null,
      marker_ready: false,
    }
  );
}

async function readManifests(
  client: PoolClient,
  tenantId: string,
): Promise<Part5ContentManifests> {
  const categories = await client.query<ManifestRow>(
    `WITH rows AS (
       SELECT c.*
       FROM categories c
       JOIN sections s ON s.id = c.section_id
       WHERE s.tenant_id = $1
     )
     SELECT
       count(*)::int AS count,
       md5(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY id)) AS hash
     FROM rows`,
    [tenantId],
  );
  const items = await client.query<ManifestRow>(
    `WITH rows AS (
       SELECT i.*
       FROM items i
       JOIN categories c ON c.id = i.category_id
       JOIN sections s ON s.id = c.section_id
       WHERE s.tenant_id = $1
     )
     SELECT
       count(*)::int AS count,
       md5(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY id)) AS hash
     FROM rows`,
    [tenantId],
  );
  const media = await client.query<ManifestRow>(
    `WITH rows AS (
       SELECT m.*
       FROM media m
       LEFT JOIN items i ON i.id = m.item_id
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN sections s ON s.id = c.section_id
       WHERE s.tenant_id = $1 OR m.tenant_id = $1
     )
     SELECT
       count(*)::int AS count,
       md5(string_agg(to_jsonb(rows)::text, E'\\n' ORDER BY id)) AS hash
     FROM rows`,
    [tenantId],
  );
  return {
    categories: categories.rows[0]!,
    items: items.rows[0]!,
    media: media.rows[0]!,
  };
}

function formatPreflight(
  tenant: TenantCutoverRow,
  schema: SchemaReadinessRow,
  manifests: Part5ContentManifests,
): Part5CutoverPreflight {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    slug: TARGET_SLUG,
    isPublished: tenant.is_published,
    guestUiMode: tenant.guest_ui_mode,
    recipientConfigured: tenant.recipient_configured,
    orderPasswordConfigured: tenant.order_password_configured,
    orderEmailEnabled: tenant.order_notify_email,
    schema: {
      guestUiModeColumnReady: schema.column_ready,
      guestUiModeConstraintReady: schema.constraint_ready,
      cutoverMarkerReady: schema.marker_ready,
      columnDefault: schema.column_default,
      constraintDefinition: schema.constraint_definition,
    },
    ledgerSha256: PART5_LEDGER_SHA256,
    manifests,
    phase: manifestPhase(manifests),
  };
}

export async function readPart5MeliPuPreflight(): Promise<Part5CutoverPreflight> {
  assertLedgerShape();
  const client = await pool.connect();
  try {
    const schema = await readSchemaReadiness(client);
    if (!schema.column_ready || !schema.constraint_ready || !schema.marker_ready) {
      throw new Part5CutoverPreconditionError(
        "Cutover schema precondition is not satisfied",
        {
          columnReady: schema.column_ready,
          constraintReady: schema.constraint_ready,
          markerReady: schema.marker_ready,
        },
      );
    }
    const tenant = await readTenant(client);
    const manifests = await readManifests(client, tenant.id);
    return formatPreflight(tenant, schema, manifests);
  } finally {
    client.release();
  }
}

async function lockAndVerifyLedgerRows(
  client: PoolClient,
  tenantId: string,
): Promise<void> {
  const categoryIds = PART5_CATEGORY_KEY_UPDATES.map((row) => row.id);
  const itemIds = PART5_ORDER_FLAG_UPDATES.map((row) => row.id);
  const mediaIds = [
    ...PART5_MEDIA_DIMENSION_UPDATES.map((row) => row.id),
    ...PART5_MEDIA_REMOVALS.map((row) => row.id),
  ];
  const insertIds = PART5_MEDIA_INSERTS.map((row) => row.id);

  const categories = await client.query<{ id: string; key: string | null }>(
    `SELECT c.id, c.key
     FROM categories c
     JOIN sections s ON s.id = c.section_id
     WHERE s.tenant_id = $1 AND c.id = ANY($2::uuid[])
     ORDER BY c.id
     FOR UPDATE OF c`,
    [tenantId, categoryIds],
  );
  const items = await client.query<{ id: string; order_enabled: boolean }>(
    `SELECT i.id, i.order_enabled
     FROM items i
     JOIN categories c ON c.id = i.category_id
     JOIN sections s ON s.id = c.section_id
     WHERE s.tenant_id = $1 AND i.id = ANY($2::uuid[])
     ORDER BY i.id
     FOR UPDATE OF i`,
    [tenantId, itemIds],
  );
  const media = await client.query<{
    id: string;
    item_id: string | null;
    url: string;
    position: number;
    width: number | null;
    height: number | null;
  }>(
    `SELECT m.id, m.item_id, m.url, m.position, m.width, m.height
     FROM media m
     LEFT JOIN items i ON i.id = m.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     LEFT JOIN sections s ON s.id = c.section_id
     WHERE (s.tenant_id = $1 OR m.tenant_id = $1)
       AND m.id = ANY($2::uuid[])
     ORDER BY m.id
     FOR UPDATE OF m`,
    [tenantId, mediaIds],
  );
  const existingInserts = await client.query<{ id: string }>(
    `SELECT id FROM media WHERE id = ANY($1::uuid[])`,
    [insertIds],
  );

  if (categories.rowCount !== PART5_CATEGORY_KEY_UPDATES.length) {
    throw new Part5CutoverPreconditionError("Category allowlist row count changed");
  }
  const categoriesById = new Map(categories.rows.map((row) => [row.id, row]));
  for (const expected of PART5_CATEGORY_KEY_UPDATES) {
    const actual = categoriesById.get(expected.id);
    if (!actual || actual.key !== expected.oldKey) {
      throw new Part5CutoverPreconditionError("Category old value changed", {
        id: expected.id,
        field: "key",
      });
    }
  }

  if (items.rowCount !== PART5_ORDER_FLAG_UPDATES.length) {
    throw new Part5CutoverPreconditionError("Item allowlist row count changed");
  }
  const itemsById = new Map(items.rows.map((row) => [row.id, row]));
  for (const expected of PART5_ORDER_FLAG_UPDATES) {
    const actual = itemsById.get(expected.id);
    if (!actual || actual.order_enabled !== expected.oldOrderEnabled) {
      throw new Part5CutoverPreconditionError("Item old value changed", {
        id: expected.id,
        field: "order_enabled",
      });
    }
  }

  if (media.rowCount !== mediaIds.length) {
    throw new Part5CutoverPreconditionError("Media allowlist row count changed");
  }
  const mediaById = new Map(media.rows.map((row) => [row.id, row]));
  for (const expected of PART5_MEDIA_DIMENSION_UPDATES) {
    const actual = mediaById.get(expected.id);
    if (
      !actual ||
      actual.width !== expected.oldWidth ||
      actual.height !== expected.oldHeight
    ) {
      throw new Part5CutoverPreconditionError("Media dimensions changed", {
        id: expected.id,
      });
    }
  }
  for (const expected of PART5_MEDIA_REMOVALS) {
    const actual = mediaById.get(expected.id);
    if (
      !actual ||
      actual.item_id !== expected.itemId ||
      actual.url !== expected.url ||
      actual.position !== expected.position ||
      actual.width !== expected.width ||
      actual.height !== expected.height
    ) {
      throw new Part5CutoverPreconditionError("Media removal row changed", {
        id: expected.id,
      });
    }
  }
  if ((existingInserts.rowCount ?? 0) !== 0) {
    throw new Part5CutoverPreconditionError("Approved media insert ID already exists");
  }

  const insertItemIds = [...new Set(PART5_MEDIA_INSERTS.map((row) => row.itemId))];
  const insertItems = await client.query<{ id: string }>(
    `SELECT i.id
     FROM items i
     JOIN categories c ON c.id = i.category_id
     JOIN sections s ON s.id = c.section_id
     WHERE s.tenant_id = $1 AND i.id = ANY($2::uuid[])
     ORDER BY i.id
     FOR UPDATE OF i`,
    [tenantId, insertItemIds],
  );
  if (insertItems.rowCount !== insertItemIds.length) {
    throw new Part5CutoverPreconditionError(
      "Approved media insert item does not belong to Meli Pu",
    );
  }
}

async function executeApprovedMutations(
  client: PoolClient,
  tenant: TenantCutoverRow,
): Promise<Part5CutoverResult["mutations"]> {
  let categoryKeys = 0;
  let orderFlags = 0;
  let mediaDimensionRows = 0;
  let mediaInserts = 0;
  let mediaRemovals = 0;

  for (const row of PART5_CATEGORY_KEY_UPDATES) {
    const result = await client.query(
      `UPDATE categories
       SET key = $1
       WHERE id = $2 AND key IS NOT DISTINCT FROM $3`,
      [row.newKey, row.id, row.oldKey],
    );
    if (result.rowCount !== 1) {
      throw new Part5CutoverPreconditionError("Category compare-and-swap failed", {
        id: row.id,
      });
    }
    categoryKeys += 1;
  }

  for (const row of PART5_ORDER_FLAG_UPDATES) {
    const result = await client.query(
      `UPDATE items
       SET order_enabled = $1
       WHERE id = $2 AND order_enabled = $3`,
      [row.newOrderEnabled, row.id, row.oldOrderEnabled],
    );
    if (result.rowCount !== 1) {
      throw new Part5CutoverPreconditionError("Item compare-and-swap failed", {
        id: row.id,
      });
    }
    orderFlags += 1;
  }

  for (const row of PART5_MEDIA_DIMENSION_UPDATES) {
    const result = await client.query(
      `UPDATE media
       SET width = $1, height = $2
       WHERE id = $3
         AND width IS NOT DISTINCT FROM $4
         AND height IS NOT DISTINCT FROM $5`,
      [row.width, row.height, row.id, row.oldWidth, row.oldHeight],
    );
    if (result.rowCount !== 1) {
      throw new Part5CutoverPreconditionError("Media compare-and-swap failed", {
        id: row.id,
      });
    }
    mediaDimensionRows += 1;
  }

  for (const row of PART5_MEDIA_INSERTS) {
    const result = await client.query(
      `INSERT INTO media (
         id, item_id, tenant_id, url, alt, position, kind, poster_url,
         duration_sec, focus_x, focus_y, width, height
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )
       ON CONFLICT DO NOTHING`,
      [
        row.id,
        row.itemId,
        row.tenantId,
        row.url,
        row.alt,
        row.position,
        row.kind,
        row.posterUrl,
        row.durationSec,
        row.focusX,
        row.focusY,
        row.width,
        row.height,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Part5CutoverPreconditionError("Media insert compare-and-swap failed", {
        id: row.id,
      });
    }
    mediaInserts += 1;
  }

  for (const row of PART5_MEDIA_REMOVALS) {
    const result = await client.query(
      `DELETE FROM media
       WHERE id = $1
         AND item_id = $2
         AND url = $3
         AND position = $4
         AND width IS NOT DISTINCT FROM $5
         AND height IS NOT DISTINCT FROM $6`,
      [row.id, row.itemId, row.url, row.position, row.width, row.height],
    );
    if (result.rowCount !== 1) {
      throw new Part5CutoverPreconditionError("Media removal compare-and-swap failed", {
        id: row.id,
      });
    }
    mediaRemovals += 1;
  }

  const changelog = await client.query(
    `INSERT INTO changelog (
       tenant_id, tenant_name, operation_key, action, entity, detail
     )
     VALUES ($1, $2, $3, 'sync', 'part5-cutover', $4)`,
    [
      tenant.id,
      tenant.name,
      CUTOVER_OPERATION_KEY,
      `PART 5 content sync; ledger SHA-256 ${PART5_LEDGER_SHA256}; 349 approved ledger lines`,
    ],
  );
  if (changelog.rowCount !== 1) {
    throw new Part5CutoverPreconditionError("Single changelog insert failed");
  }

  return {
    categoryKeys,
    orderFlags,
    mediaDimensionRows,
    mediaInserts,
    mediaRemovals,
    changelogEntries: 1,
  };
}

export async function applyPart5MeliPuCutover(input: {
  ledgerSha256: string;
  confirmTenantSlug: string;
}): Promise<Part5CutoverResult> {
  assertLedgerShape();
  if (!isProductionRuntime()) {
    throw new Part5CutoverPreconditionError(
      "The PART 5 write operation is locked outside a Replit production deployment",
    );
  }
  if (
    input.ledgerSha256 !== PART5_LEDGER_SHA256 ||
    input.confirmTenantSlug !== TARGET_SLUG
  ) {
    throw new Part5CutoverPreconditionError("Ledger confirmation does not match");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock($1)", [CUTOVER_LOCK_KEY]);

    const schema = await readSchemaReadiness(client);
    if (!schema.column_ready || !schema.constraint_ready || !schema.marker_ready) {
      throw new Part5CutoverPreconditionError(
        "Cutover schema precondition is not satisfied",
        {
          columnReady: schema.column_ready,
          constraintReady: schema.constraint_ready,
          markerReady: schema.marker_ready,
        },
      );
    }
    const tenant = await readTenant(client, true);
    if (
      !tenant.is_published ||
      tenant.guest_ui_mode !== "legacy"
    ) {
      throw new Part5CutoverPreconditionError(
        "Meli Pu must be published and remain on legacy UI during content sync",
        {
          isPublished: tenant.is_published,
          guestUiMode: tenant.guest_ui_mode,
        },
      );
    }
    if (
      !tenant.recipient_configured ||
      !tenant.order_password_configured ||
      !tenant.order_notify_email
    ) {
      throw new Part5CutoverPreconditionError(
        "Production order recipient/password gates are not satisfied",
        {
          recipientConfigured: tenant.recipient_configured,
          orderPasswordConfigured: tenant.order_password_configured,
          orderEmailEnabled: tenant.order_notify_email,
        },
      );
    }

    const priorCutover = await client.query<{ id: string }>(
      `SELECT id
       FROM changelog
       WHERE operation_key = $1
       FOR UPDATE`,
      [CUTOVER_OPERATION_KEY],
    );
    if ((priorCutover.rowCount ?? 0) !== 0) {
      throw new Part5CutoverPreconditionError(
        "PART 5 cutover was already applied; replay refused",
      );
    }

    await lockAndVerifyLedgerRows(client, tenant.id);
    const preManifests = await readManifests(client, tenant.id);
    if (!manifestsEqual(preManifests, PART5_EXPECTED_PRE)) {
      throw new Part5CutoverPreconditionError(
        "Approved precondition manifest mismatch; transaction aborted",
        { expected: PART5_EXPECTED_PRE, actual: preManifests },
      );
    }

    const mutations = await executeApprovedMutations(client, tenant);
    const postManifests = await readManifests(client, tenant.id);
    if (!manifestsEqual(postManifests, PART5_EXPECTED_POST)) {
      throw new Part5CutoverPreconditionError(
        "Post-write manifest mismatch; transaction rolled back",
        { expected: PART5_EXPECTED_POST, actual: postManifests },
      );
    }

    await client.query("COMMIT");
    return {
      ...formatPreflight(tenant, schema, postManifests),
      applied: true,
      mutations,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}