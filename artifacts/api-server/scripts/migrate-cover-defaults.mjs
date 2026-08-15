/**
 * One-time migration: null out cover_* fields that still hold the old schema default values.
 *
 * Background: the previous schema had NOT NULL with defaults for all cover_* numeric/text
 * fields. The new schema makes them nullable (NULL = "inherit theme default from CSS").
 * But existing DB rows still carry the old DB-default values.  Any tenant whose values
 * match those defaults never explicitly set them, so we safely set them to NULL.
 * Values that differ from the old defaults are preserved (user explicitly changed them).
 */

import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

const OLD_DEFAULTS = {
  cover_title_size: 56,
  cover_title_opacity: 66,
  cover_text_color: "#FFFFFF",
  cover_sub_size: 22,
  cover_sub_opacity: 50,
  cover_meta_size: 19.5,
  cover_meta_opacity: 60,
  cover_veil: 26,
  cover_align: "left",
  cover_show_rating: true,
};

await client.connect();

try {
  // Build a WHERE clause that identifies rows with old default values in each field.
  // We update each column independently to avoid clearing genuinely customised values.

  let totalUpdated = 0;

  for (const [col, defaultVal] of Object.entries(OLD_DEFAULTS)) {
    let placeholder;
    let params;

    if (typeof defaultVal === "string") {
      placeholder = "$1";
      params = [defaultVal];
    } else if (typeof defaultVal === "boolean") {
      placeholder = "$1";
      params = [defaultVal];
    } else {
      // For floating-point columns use BETWEEN to handle precision quirks
      const lo = defaultVal - 0.001;
      const hi = defaultVal + 0.001;
      placeholder = null;
      params = [lo, hi];
    }

    let sql;
    if (placeholder) {
      sql = `UPDATE tenants SET ${col} = NULL WHERE ${col} = ${placeholder}`;
    } else {
      sql = `UPDATE tenants SET ${col} = NULL WHERE ${col} BETWEEN $1 AND $2`;
    }

    const result = await client.query(sql, params);
    if (result.rowCount > 0) {
      console.log(`Cleared ${col} → NULL for ${result.rowCount} tenant(s)`);
      totalUpdated += result.rowCount;
    }
  }

  console.log(`\nMigration complete. Total column-rows cleared: ${totalUpdated}`);
} finally {
  await client.end();
}
