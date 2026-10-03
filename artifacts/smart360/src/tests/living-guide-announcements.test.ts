import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  activeAnnouncements,
  announcementCopy,
  formatListDate,
  hasUnread,
  isAnnouncementActive,
  loadReadIds,
  localizedField,
  markAnnouncementRead,
  nextVisibilityChange,
  readStateKey,
  type GuestAnnouncement,
} from "../pages/living-guide/living-guide-announcements-model";
import { MENU_COPY, menuRowIds } from "../pages/living-guide/living-guide-menu-model";

const NOW = Date.parse("2026-06-10T10:00:00Z");
const row = (over: Partial<GuestAnnouncement>): GuestAnnouncement => ({
  id: "a", tenantId: "t1", titleSl: "Naslov", bodySl: "Telo", validFrom: "2026-06-01T00:00:00Z",
  validTo: null, createdAt: "2026-06-01T00:00:00Z", deletedAt: null, ...over,
});

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

test("visibility window: future, expired, open-ended, soft-deleted", () => {
  assert.equal(isAnnouncementActive(row({}), NOW), true, "no validTo = until deleted");
  assert.equal(isAnnouncementActive(row({ validFrom: "2026-06-11T00:00:00Z" }), NOW), false);
  assert.equal(isAnnouncementActive(row({ validTo: "2026-06-09T00:00:00Z" }), NOW), false);
  assert.equal(isAnnouncementActive(row({ validTo: "2026-06-12T00:00:00Z" }), NOW), true);
  assert.equal(isAnnouncementActive(row({ deletedAt: "2026-06-05T00:00:00Z" }), NOW), false);
});

test("active list is newest first and next change is scheduled", () => {
  const list = activeAnnouncements([
    row({ id: "old", validFrom: "2026-06-01T00:00:00Z" }),
    row({ id: "new", validFrom: "2026-06-09T00:00:00Z", validTo: "2026-06-10T12:00:00Z" }),
    row({ id: "later", validFrom: "2026-06-10T11:00:00Z" }),
  ], NOW);
  assert.deepEqual(list.map((r) => r.id), ["new", "old"]);
  assert.equal(nextVisibilityChange([row({ validFrom: "2026-06-10T11:00:00Z" }), row({ validTo: "2026-06-10T12:00:00Z" })], NOW), Date.parse("2026-06-10T11:00:00Z"));
});

test("language fallback picks requested, else first filled SL→EN→DE→IT", () => {
  const r = row({ titleSl: "", titleEn: "Hello", titleDe: "Hallo", bodySl: "Telo" });
  assert.equal(localizedField(r, "title", "de"), "Hallo");
  assert.equal(localizedField(r, "title", "it"), "Hello");
  assert.equal(localizedField(r, "title", "sl"), "Hello");
  assert.equal(localizedField(r, "body", "en"), "Telo");
});

test("unread state lives per device and per tenant, survives broken storage", () => {
  const store = memoryStore();
  const active = [row({ id: "x" }), row({ id: "y" })];
  assert.equal(hasUnread(active, loadReadIds("t1", store)), true);
  markAnnouncementRead("t1", "x", ["x", "y"], store);
  assert.equal(hasUnread(active, loadReadIds("t1", store)), true);
  const ids = markAnnouncementRead("t1", "y", ["x", "y"], store);
  assert.equal(hasUnread(active, ids), false);
  assert.equal(loadReadIds("t2", store).size, 0, "tenant-scoped");
  store.m.set(readStateKey("t3"), "{broken");
  assert.equal(loadReadIds("t3", store).size, 0);
  const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.doesNotThrow(() => markAnnouncementRead("t1", "x", ["x"], throwing));
});

test("labels exist in all four languages; list date uses today/yesterday", () => {
  for (const l of ["sl", "en", "de", "it"]) {
    const c = announcementCopy(l);
    assert.ok(c.title && c.isNew && c.offline && c.validTo && c.published);
  }
  assert.equal(announcementCopy("hr").title, "Obavijesti");
  assert.match(formatListDate("2026-06-10T06:10:00Z", "sl", NOW), /^danes · 8\.10$/);
  assert.equal(formatListDate("2026-06-09T06:10:00Z", "en", NOW), "yesterday");
});

test("menu: rows in order, install hidden when standalone, copy complete in SL/EN/DE/IT", () => {
  assert.deepEqual([...menuRowIds(true)], ["language", "profile", "install", "help", "about"]);
  assert.deepEqual([...menuRowIds(false)], ["language", "profile", "help", "about"]);
  for (const c of Object.values(MENU_COPY)) {
    for (const v of Object.values(c)) assert.ok(typeof v === "string" && v.length > 0);
    assert.match(c.footer, /Smart360 · smart360\.info$/);
    assert.match(c.aboutSources, /Open-Meteo/);
  }
});

test("shell wiring: hamburger after 360/search, announcements tile, no emoji in new UI", () => {
  const shell = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  const search = shell.indexOf('<use href="#lg-i-srch" /></svg>\n            </button>\n            <button\n              className="lg2-hhero-fab lg2-hhero-menu"');
  assert.ok(search > 0, "menu button directly follows search");
  assert.match(shell, /dot-announcements-unread/);
  assert.match(shell, /<LivingGuideAnnouncements /);
  for (const f of ["LivingGuideMenu.tsx", "living-guide-menu-model.ts", "LivingGuideAnnouncements.tsx", "living-guide-announcements-model.ts"]) {
    const src = readFileSync(new URL(`../pages/living-guide/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\p{Extended_Pictographic}/u, f);
  }
  const hook = readFileSync(new URL("../pages/living-guide/use-guest-announcements.ts", import.meta.url), "utf8");
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /\/api\/guest\/\$\{encodeURIComponent\(slug\)\}\/announcements/);
});

test("on-demand install request revives a dismissed prompt", async () => {
  const src = readFileSync(new URL("../pages/guest/guest-install.ts", import.meta.url), "utf8");
  assert.match(src, /export function requestGuestInstall/);
  assert.match(src, /\(hidden && !requested\)/);
  assert.match(src, /export function isGuestStandalone/);
});

test("hook source: offline suppresses rows, 30s poll, staleTime 0, strict parsing", () => {
  const hook = readFileSync(new URL("../pages/living-guide/use-guest-announcements.ts", import.meta.url), "utf8");
  assert.match(hook, /const rows = offline \? undefined : query\.data/);
  assert.match(hook, /unread: !offline &&/);
  assert.match(hook, /guideOffline\.disconnected \|\| navigatorOffline \|\| fetchOffline/);
  assert.match(hook, /staleTime: 0/);
  assert.match(hook, /refetchInterval: 30_000/);
  assert.doesNotMatch(hook, /: \[\];\n\}/);
  assert.match(hook, /throw new Error\("Malformed announcements response"\)/);
  const list = readFileSync(new URL("../pages/living-guide/LivingGuideAnnouncements.tsx", import.meta.url), "utf8");
  assert.match(list, /Opening the list always triggers a fresh request/);
});
