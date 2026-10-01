import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  announcementAdminStatus, announcementAdminTitle, announcementDraft,
  announcementSavePayload, announcementWallClock, announcementWallClockCandidates,
  announcementWallClockToIso, type AdminAnnouncement,
} from "../lib/announcements-admin-model";

const row: AdminAnnouncement = {
  id: "announcement", tenantId: "tenant-a",
  titleSl: "Naslov", titleEn: null, titleDe: null, titleIt: null,
  bodySl: "Besedilo", bodyEn: null, bodyDe: null, bodyIt: null,
  imageUrl: null, validFrom: "2026-01-15T12:34:56.123Z", validTo: null,
  createdAt: "2026-01-15T12:34:56.123Z", updatedAt: "2026-01-15T12:34:56.123Z", deletedAt: null,
};

test("Ljubljana wall clocks use winter/summer offsets, independently of device timezone", () => {
  assert.equal(announcementWallClock("2026-01-15T12:34:00Z"), "2026-01-15T13:34");
  assert.equal(announcementWallClock("2026-07-15T12:34:00Z"), "2026-07-15T14:34");
  assert.equal(announcementWallClockToIso("2026-01-15T13:34", "earlier"), "2026-01-15T12:34:00.000Z");
  assert.equal(announcementWallClockToIso("2026-07-15T14:34", "earlier"), "2026-07-15T12:34:00.000Z");
});

test("spring nonexistent clock and malformed dates cannot be silently normalized", () => {
  for (const value of ["2026-03-29T02:30", "2026-02-30T12:00", "2026-13-01T12:00", "2026-01-15T24:00", "not-a-date"]) {
    assert.deepEqual(announcementWallClockCandidates(value), []);
    assert.throws(() => announcementWallClockToIso(value, "earlier"), /Čas ni veljaven/);
  }
});

test("autumn repeated clock has explicitly selectable instants and preserves the existing occurrence", () => {
  assert.deepEqual(announcementWallClockCandidates("2026-10-25T02:30"), [
    "2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z",
  ]);
  assert.equal(announcementWallClockToIso("2026-10-25T02:30", "later"), "2026-10-25T01:30:00.000Z");
  const repeated = { ...row, validFrom: "2026-10-25T01:30:42.456Z" };
  const draft = announcementDraft(repeated);
  assert.equal(draft.fromOccurrence, "later");
  assert.equal(announcementSavePayload(draft, repeated).validFrom, repeated.validFrom);
  draft.fromOccurrence = "earlier";
  assert.equal(announcementSavePayload(draft, repeated).validFrom, "2026-10-25T00:30:00.000Z");
});

test("save sends only writable fields, explicit null clears, and preserves an unchanged precise instant", () => {
  const draft = announcementDraft(row);
  draft.titleSl = "  ";
  draft.titleEn = "  Announcement  ";
  draft.bodySl = "";
  draft.bodyIt = "  Testo  ";
  const payload = announcementSavePayload(draft, row);
  assert.equal(payload.validFrom, row.validFrom);
  assert.equal(payload.validTo, null);
  assert.equal(payload.imageUrl, null);
  assert.equal(payload.titleSl, null);
  assert.equal(payload.titleEn, "Announcement");
  assert.equal(payload.bodyIt, "Testo");
  assert.deepEqual(Object.keys(payload).sort(), [
    "bodyDe", "bodyEn", "bodyIt", "bodySl", "imageUrl",
    "titleDe", "titleEn", "titleIt", "titleSl", "validFrom", "validTo",
  ].sort());
  assert.equal(announcementAdminTitle(payload), "Announcement");
});

test("validation rejects missing content/backwards validity without mutating the draft", () => {
  const draft = announcementDraft(row);
  draft.validTo = "2026-01-15T13:00";
  const before = structuredClone(draft);
  assert.throws(() => announcementSavePayload(draft, row), /pred začetkom/);
  assert.deepEqual(draft, before);
  draft.validTo = "";
  draft.titleSl = "";
  assert.throws(() => announcementSavePayload(draft), /naslov/);
  draft.titleSl = "Naslov";
  draft.bodySl = "";
  assert.throws(() => announcementSavePayload(draft), /besedilo/);
});

test("status is inclusive at both validity endpoints and distinguishes planned/expired/deleted", () => {
  const dated = { ...row, validTo: "2026-01-15T13:00:00Z" };
  assert.equal(announcementAdminStatus(dated, Date.parse(dated.validFrom) - 1), "Načrtovano");
  assert.equal(announcementAdminStatus(dated, Date.parse(dated.validFrom)), "Aktivno");
  assert.equal(announcementAdminStatus(dated, Date.parse(dated.validTo)), "Aktivno");
  assert.equal(announcementAdminStatus(dated, Date.parse(dated.validTo) + 1), "Poteklo");
  assert.equal(announcementAdminStatus({ ...dated, deletedAt: dated.validTo }), "Izbrisano");
  assert.equal(announcementAdminStatus(row, Date.parse("2030-01-01T00:00:00Z")), "Aktivno");
});

test("admin editor exposes real runtime CRUD, device-independent clocks, draft-preserving errors and upload", () => {
  const source = readFileSync(new URL("../components/admin/admin-tenant-announcements.tsx", import.meta.url), "utf8");
  assert.match(source, /Obvestilo je vidno gostom takoj po shranjevanju\./);
  assert.match(source, /useCreateTenantAnnouncement/);
  assert.match(source, /useUpdateTenantAnnouncement/);
  assert.match(source, /useDeleteTenantAnnouncement/);
  assert.match(source, /useUploadTenantAnnouncementImage/);
  assert.doesNotMatch(source, /\bfetch\(/);
  assert.match(source, /onError: \(error\) => setOperationError\(error\.message\)/);
  assert.match(source, /refetchInterval: 30_000/);
  assert.match(source, /Europe\/Ljubljana/);
  assert.doesNotMatch(source, /isOwner|handlePublish|published_snapshot/);
});