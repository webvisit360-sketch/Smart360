import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContentIndex,
  contactFieldFromHref,
  resolvePreviewTarget,
  routeTarget,
  type PreviewNode,
  type ResolveContext,
} from "../lib/preview-edit-resolver.ts";

const index = buildContentIndex([
  {
    id: "sec-1", key: "stay", title: "Nastanitev",
    categories: [{ id: "cat-1", label: "Apartmaji", items: [{ id: "item-1", title: "Apartma 3", phone: "+386 41 222 333", bullets: ["Parkiranje"] }, { id: "item-2", title: "Koncert" }] }],
  },
]);

const operator = { isOperator: true, canManageContent: true, canEditIdentity: true, canEditAppearance: true };
const concierge = { isOperator: false, canManageContent: false, canEditIdentity: false, canEditAppearance: false };
const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  index, contacts: { phone: "+386 40 111 222" }, announcementIds: new Set(["ann-1"]),
  pathname: "/demo/home", slug: "demo", permissions: operator, announcementsAvailable: true, ...over,
});
const node = (n: Partial<PreviewNode>): PreviewNode => ({ tag: "DIV", ...n });

test("contact hrefs map to exact contact fields", () => {
  assert.equal(contactFieldFromHref("tel:+38640111222"), "phone");
  assert.equal(contactFieldFromHref("https://wa.me/38640111222"), "whatsapp");
  assert.equal(contactFieldFromHref("viber://chat?number=1"), "viber");
  assert.equal(contactFieldFromHref("https://instagram.com/x"), "instagram");
  assert.equal(contactFieldFromHref("mailto:a@b.si"), "email");
  assert.equal(contactFieldFromHref("https://www.google.com/maps/search/?q=x"), "address");
  assert.equal(contactFieldFromHref("/demo/home"), null);
});

test("photo inside an entry resolves to the entry media field via React id", () => {
  const r = resolvePreviewTarget([node({ tag: "IMG" }), node({ ids: ["item-1"] })], ctx());
  assert.deepEqual(r?.target, { kind: "item", id: "item-1", categoryId: "cat-1", field: "media" });
  assert.equal(r?.explicit, true);
});

test("tile test id maps to category, labels are never used as ids", () => {
  const r = resolvePreviewTarget([node({ testId: "tile-cat-1" })], ctx());
  assert.deepEqual(r?.target, { kind: "category", id: "cat-1" });
  assert.deepEqual(resolvePreviewTarget([
    node({ tag: "path" }), node({ tag: "svg" }),
    node({ testId: "tile-c-cat-1" }),
    node({ testId: "simple-section-stay" }),
  ], ctx())?.target, { kind: "category", id: "cat-1" });
  // A label-shaped candidate never matches a record; it falls back to appearance.
  assert.equal(resolvePreviewTarget([node({ ids: ["Apartmaji"] })], ctx({ pathname: "/demo/home" }))?.target.kind, "appearance");
});

test("entry phone vs tenant phone", () => {
  const tenantCall = resolvePreviewTarget([node({ tag: "A", href: "tel:+38640111222" })], ctx());
  assert.deepEqual(tenantCall?.target, { kind: "contact", field: "phone" });
  const itemCall = resolvePreviewTarget([node({ tag: "A", href: "tel:+38641222333" }), node({ ids: ["item-1"] })], ctx());
  assert.equal(itemCall?.target.kind === "item" && itemCall.target.field, "phone");
});

test("route fallback is reported as nearest parent", () => {
  assert.deepEqual(routeTarget("/demo/c/cat-1/i/item-1", "demo", index), { kind: "item", id: "item-1", categoryId: "cat-1", field: null });
  const r = resolvePreviewTarget([node({ tag: "SPAN" })], ctx({ pathname: "/demo/c/cat-1" }));
  assert.deepEqual(r?.target, { kind: "category", id: "cat-1" });
  assert.equal(r?.explicit, false);
});

test("weather, announcements and simple sections", () => {
  assert.equal(resolvePreviewTarget([node({ testId: "card-home-weather" })], ctx())?.target.kind, "weather");
  assert.deepEqual(resolvePreviewTarget([node({ testId: "card-announcement-ann-1" })], ctx())?.target, { kind: "announcement", id: "ann-1" });
  assert.deepEqual(resolvePreviewTarget([node({ testId: "simple-section-stay" })], ctx())?.target, { kind: "section", id: "sec-1" });
});

test("concierge may only resolve to contact controls", () => {
  const p = { permissions: concierge };
  assert.equal(resolvePreviewTarget([node({ ids: ["item-1"] })], ctx(p))?.allowed, false);
  assert.equal(resolvePreviewTarget([node({ tag: "A", href: "mailto:a@b.si" })], ctx(p))?.allowed, true);
  assert.equal(resolvePreviewTarget([node({ testId: "card-home-weather" })], ctx(p))?.allowed, false);
  assert.equal(resolvePreviewTarget([node({ testId: "card-announcement-ann-1" })], ctx(p))?.allowed, false);
});

test("bullet rows map to the bullets field, body-derived bullets to body", () => {
  const r = resolvePreviewTarget([node({ tag: "P" }), node({ className: "lg2-rule-row" }), node({ ids: ["item-1"] })], ctx());
  assert.equal(r?.target.kind === "item" && r.target.field, "bullets");
  const viaProps = resolvePreviewTarget([node({ tag: "P", bulletList: true }), node({ ids: ["item-2"] })], ctx());
  assert.equal(viaProps?.target.kind === "item" && viaProps.target.field, "body");
});

test("title over a hero photo stays title (closest semantic target wins)", () => {
  const r = resolvePreviewTarget([
    node({ tag: "H1", className: "lg2-hero-title" }),
    node({ className: "lg2-hero-image-frame", isImage: true }),
    node({ ids: ["item-1"] }),
  ], ctx());
  assert.equal(r?.target.kind === "item" && r.target.field, "title");
});

test("home hero, logo and unmapped elements fall back to appearance", () => {
  const hero = resolvePreviewTarget([node({ tag: "IMG", className: "lg2-hero-image-main" }), node({ testId: "screen-home" })], ctx());
  assert.deepEqual(hero?.target, { kind: "appearance", part: "hero" });
  assert.equal(hero?.explicit, true);
  const logo = resolvePreviewTarget([node({ tag: "IMG", className: "lg2-home-logo" })], ctx());
  assert.deepEqual(logo?.target, { kind: "appearance", part: "logo" });
  const other = resolvePreviewTarget([node({ tag: "SPAN" }), node({ testId: "screen-cover" })], ctx());
  assert.deepEqual(other?.target, { kind: "appearance", part: "cover" });
  assert.equal(other?.explicit, false);
  assert.equal(resolvePreviewTarget([node({ tag: "SPAN" })], ctx({ permissions: concierge }))?.allowed, false);
});

test("program occurrence keys resolve to the source item", () => {
  const r = resolvePreviewTarget([node({ tag: "SPAN" }), node({ ids: ["item-2-2025-07-14"] })], ctx());
  assert.deepEqual(r?.target, { kind: "item", id: "item-2", categoryId: "cat-1", field: null });
  assert.equal(resolvePreviewTarget([node({ testId: "program-card-item-2" })], ctx())?.target.kind, "item");
  assert.equal(resolvePreviewTarget([node({ ids: ["ghost-2025-07-14"] })], ctx())?.target.kind, "appearance");
});

test("entry id on an ancestor beats a nearer composite carrying its category", () => {
  // Click on card text: the text's own composites carry `category`, the card
  // element higher up is keyed by the entry id.
  const r = resolvePreviewTarget([
    node({ tag: "P", className: "card__sub", ids: ["cat-1"] }),
    node({ tag: "DIV", ids: ["cat-1"] }),
    node({ tag: "ARTICLE", className: "card fade", ids: ["item-1"] }),
    node({ tag: "SECTION", ids: ["cat-1", "sec-1"] }),
  ], ctx({ pathname: "/demo/c/cat-1" }));
  assert.equal(r?.target.kind, "item");
  assert.equal(r?.target.kind === "item" && r.target.id, "item-1");
});

test("detail route is authoritative for title, body, bullets and photo", () => {
  const detail = { pathname: "/demo/c/cat-1/i/item-1" };
  const cases: Array<[PreviewNode[], string]> = [
    [[node({ tag: "H1" }), node({ ids: ["cat-1"] })], "title"],
    [[node({ tag: "P", className: "prose" }), node({ ids: ["cat-1"] })], "body"],
    [[node({ tag: "P" }), node({ className: "lg2-rule-row" }), node({ ids: ["cat-1"] })], "bullets"],
    [[node({ tag: "IMG" }), node({ ids: ["cat-1", "sec-1"] })], "media"],
  ];
  for (const [chain, field] of cases) {
    const r = resolvePreviewTarget(chain, ctx(detail));
    assert.deepEqual(r?.target, { kind: "item", id: "item-1", categoryId: "cat-1", field });
    assert.equal(r?.explicit, true);
  }
});

test("Enostaven section wrapper does not swallow an entry inside it", () => {
  const r = resolvePreviewTarget([node({ tag: "SPAN" }), node({ ids: ["item-1"] }), node({ testId: "simple-section-stay" })], ctx());
  assert.equal(r?.target.kind, "item");
});
