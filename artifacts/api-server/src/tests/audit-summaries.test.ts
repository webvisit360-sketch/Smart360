import assert from "node:assert/strict";
import test from "node:test";
import {
  hostReplySummary,
  orderStatusSummary,
  redactAuditSummary,
  safeSummary,
} from "../lib/changelog";

test("audit summaries for managed actions are fixed Slovenian values", () => {
  assert.equal(safeSummary("update", "host-password-change"), "je posodobil geslo stranke.");
  assert.equal(safeSummary("send", "host-password-reset"), "je poslal ponastavitev gesla stranke.");
  assert.equal(safeSummary("create", "host-account-created"), "je ustvaril nov dostop stranke.");
  assert.equal(
    safeSummary("update", "host-account-email-changed"),
    "je posodobil e-naslov dostopa stranke.",
  );
  assert.equal(
    orderStatusSummary("91230b1b-8aa3-4c23-a653-e681bde0715c", "potrjeno"),
    "Naročilo 91230b1b-8aa3-4c23-a653-e681bde0715c: status je spremenjen v potrjeno.",
  );
  assert.equal(
    hostReplySummary("0b56f1e5-2fca-4421-b58d-3f98c6d18cd7"),
    "Poslan je bil odgovor v pogovoru 0b56f1e5-2fca-4421-b58d-3f98c6d18cd7.",
  );
  assert.equal(
    safeSummary("update", "distance-review"),
    "je posodobil pregled razdalj.",
  );
});

test("audit summaries reject unsafe references and exclude sensitive content", () => {
  const summary = orderStatusSummary("Jane Doe +38640123456", "zavrnjeno");
  assert.ok(!summary.includes("@"));
  assert.ok(!summary.includes("Jane Doe"));
  assert.ok(!summary.includes("38640123456"));
  assert.equal(summary, "Status naročila je bil spremenjen.");
  assert.equal(hostReplySummary("guest@example.com"), "Poslan je bil odgovor stranki.");
});

test("route-provided entity labels have contact data redacted centrally", () => {
  const summary = redactAuditSummary(
    "Spremenjen naslov · Apartma guest@example.com +386 40 123 456 https://example.com/secret",
  );
  assert.equal(
    summary,
    "Spremenjen naslov · Apartma [e-naslov odstranjen] [telefonska številka odstranjena] [povezava odstranjena]",
  );
  assert.equal(
    redactAuditSummary("Spremenjen naslov · Apartma Studio 29"),
    "Spremenjen naslov · Apartma Studio 29",
  );
});