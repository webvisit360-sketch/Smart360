/**
 * Enkratna normalizacija vse vsebine skozi sanitizer — zagon za RAZVOJNO bazo:
 *   cd artifacts/api-server && npx tsx scripts/normalize-content.ts
 * V produkciji isto opravi admin akcija POST /admin/maintenance/normalize-content
 * (gumb "Normaliziraj oblikovanje" v adminu). Idempotentno.
 */
import { normalizeAllContent } from "../src/lib/normalizeContent";

const { count, changes } = await normalizeAllContent();
for (const c of changes) {
  console.log(
    `${c.table} ${c.id} ${c.field}:\n  PREJ: ${c.before.slice(0, 160)}\n  POTEM: ${c.after.slice(0, 160)}`,
  );
}
console.log(`\nSkupaj spremenjenih polj: ${count}`);
process.exit(0);
