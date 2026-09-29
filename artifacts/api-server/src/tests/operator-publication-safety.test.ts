import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hostOperatorDraftPublishDenied, operatorDraftAfterWrite } from "../lib/publicationSafety";

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("operator draft followed by host edits cannot be published by host", () => {
  let pending = operatorDraftAfterWrite(false, "owner", "dirty");
  pending = operatorDraftAfterWrite(pending, "host", "dirty");
  assert.equal(pending, true);
  assert.equal(hostOperatorDraftPublishDenied("host", pending, true), true);
  assert.equal(operatorDraftAfterWrite(pending, "host", "noop"), true);
  assert.equal(operatorDraftAfterWrite(pending, "host", "publish"), true);
});

test("owner publication clears the bit; later host-only edits remain publishable", () => {
  const pending = operatorDraftAfterWrite(true, "owner", "publish");
  assert.equal(pending, false);
  const hostDraft = operatorDraftAfterWrite(pending, "host", "dirty");
  assert.equal(hostDraft, false);
  assert.equal(hostOperatorDraftPublishDenied("host", hostDraft, true), false);
  assert.equal(operatorDraftAfterWrite(hostDraft, "host", "publish"), false);
  assert.equal(operatorDraftAfterWrite(hostDraft, "system", "dirty"), true);
});

test("publish guard precedes snapshot, alias, and tenant writes inside locked transaction", () => {
  const route = source("../routes/adminTenants.ts");
  const lock = route.indexOf('.for("update")', route.indexOf("const writeTransaction"));
  const guard = route.indexOf("hostOperatorDraftPublishDenied(", lock);
  const snapshot = route.indexOf("replacePublishedSnapshot(updated)", guard);
  const slug = route.indexOf("await claimSlug(tx, publishedSlug", guard);
  assert.ok(lock >= 0 && lock < guard && guard < slug && slug < snapshot);
  assert.match(route, /hostOperatorDraftDenied[\s\S]*?await denyAuthorization\(req, res,[\s\S]*?message: "Vodnik vsebuje spremembe upravljavca, ki še niso potrjene — objavo opravi Smart360\."/);
  assert.match(source("../lib/authorizationDenial.ts"), /res\.status\(403\)\.json\(\{ error: options\.message/);
});

test("initializer has durable once-only marker and does not reflag after owner publish", () => {
  const initializer = source("../lib/operatorDraftBackfill.ts");
  assert.match(initializer, /pg_advisory_xact_lock/);
  assert.match(initializer, /ON CONFLICT \(operation_key\) DO NOTHING/);
  assert.match(initializer, /if \(marker\.rows\.length === 0\) return/);
  assert.match(initializer, /WHERE has_unpublished_changes = true/);
  assert.match(initializer, /AND operator_draft_pending = false/);
  assert.ok(initializer.indexOf("marker.rows.length") < initializer.indexOf("UPDATE tenants"));
  const trigger = source("../lib/guestDirtyTriggers.ts");
  assert.equal((trigger.match(/operator_draft_pending = operator_draft_pending OR/g) ?? []).length, 4);
  assert.match(trigger, /NOT COALESCE\([\s\S]*?smart360\.draft_tenant[\s\S]*?false\)/);
  const onboarding = source("../lib/hostOnboarding.ts");
  const submitAttribution = onboarding.indexOf("await attributePrivilegedHostDraft(tx, tenantId)");
  assert.ok(submitAttribution > 0 && submitAttribution <
    onboarding.indexOf("await applyCanonicalHostOnboardingPatch(tx, tenantId, data)", submitAttribution));
  assert.ok(onboarding.indexOf("attributePrivilegedHostDraft(tx, round.tenantId)") <
    onboarding.indexOf("const mapped = await mapSubmission("));
});