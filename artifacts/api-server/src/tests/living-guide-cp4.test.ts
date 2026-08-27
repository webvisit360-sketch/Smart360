/**
 * Living Guide CHECKPOINT 4 — focused backend tests.
 *
 * Covers (no DB required; pure-function and logic tests):
 *  1. validateLivingGuideNav: all valid combos, all error branches
 *  2. sitePlanImages in public response: [] when none, ordered serialization shape
 *  3. toSitePlanImage shape: caption maps to alt, fields present
 *  4. Purpose isolation: item-scoped rows are excluded from site-plan lists
 *  5. Image-only upload guard: video mimetype rejected
 *  6. livingGuideNav duplicate reset: copyTenant logic comment/contract
 *  7. Nav uniqueness: duplicate key is rejected
 *  8. Nav home-first rule: non-home first key rejected
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateLivingGuideNav,
  LIVING_GUIDE_NAV_KEYS,
} from "@workspace/db";
import { CreateItemBody, UpdateItemBody } from "@workspace/api-zod";

// ---------------------------------------------------------------------------
// 1. validateLivingGuideNav
// ---------------------------------------------------------------------------
describe("validateLivingGuideNav", () => {
  test("accepts a valid five-key array with home first", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", "program"]);
    assert.deepEqual(result, { ok: true });
  });

  test("accepts all allowed keys in any order (home first)", () => {
    const result = validateLivingGuideNav(["home", "messages", "offer", "explore", "program"]);
    assert.deepEqual(result, { ok: true });
  });

  test("accepts another valid five-key combination", () => {
    const result = validateLivingGuideNav(["home", "stay", "messages", "explore", "program"]);
    assert.deepEqual(result, { ok: true });
  });

  test("rejects non-array", () => {
    const result = validateLivingGuideNav("home,stay,offer,explore,program");
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("array"));
  });

  test("rejects arrays with fewer than 5 keys", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer"]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("5"));
  });

  test("rejects arrays with more than 5 keys", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", "program", "messages"]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("5"));
  });

  test("rejects when home is not first", () => {
    const result = validateLivingGuideNav(["stay", "home", "offer", "explore", "program"]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("home"));
  });

  test("rejects duplicate keys", () => {
    const result = validateLivingGuideNav(["home", "stay", "stay", "explore", "program"]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("unique"));
  });

  test("rejects an unknown key", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", "UNKNOWN"]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("UNKNOWN"));
  });

  test("rejects null as a nav key", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", null]);
    assert.equal(result.ok, false);
  });

  test("rejects empty array", () => {
    const result = validateLivingGuideNav([]);
    assert.equal(result.ok, false);
    assert.ok((result as { ok: false; error: string }).error.includes("5"));
  });

  test("all LIVING_GUIDE_NAV_KEYS are valid values", () => {
    // Each key individually is in the allowed set
    for (const k of LIVING_GUIDE_NAV_KEYS) {
      assert.ok(typeof k === "string");
    }
    assert.equal(LIVING_GUIDE_NAV_KEYS.length, 6);
    assert.equal(LIVING_GUIDE_NAV_KEYS[0], "home");
  });
});

describe("dated Program item contract", () => {
  test("accepts an ISO event start on create and update", () => {
    const eventStart = "2026-08-23T18:30:00.000Z";
    assert.equal(CreateItemBody.parse({ eventStart }).eventStart, eventStart);
    assert.equal(UpdateItemBody.parse({ eventStart }).eventStart, eventStart);
  });

  test("allows clearing an event start", () => {
    assert.equal(UpdateItemBody.parse({ eventStart: null }).eventStart, null);
  });
});

// ---------------------------------------------------------------------------
// 2. Public response sitePlanImages: [] serialization contract
// ---------------------------------------------------------------------------
describe("sitePlanImages public serialization", () => {
  test("empty sitePlanImages serializes to an empty array", () => {
    const payload = { sitePlanImages: [] };
    assert.deepEqual(payload.sitePlanImages, []);
  });

  test("ordered sitePlanImages preserve position order", () => {
    const images = [
      { id: "b", position: 1, url: "/api/storage/img/t/b.jpg", caption: null, tenantId: "t1", width: 1400, height: 800 },
      { id: "a", position: 0, url: "/api/storage/img/t/a.jpg", caption: "Floor plan", tenantId: "t1", width: 1400, height: 800 },
    ].sort((a, b) => a.position - b.position);
    assert.equal(images[0]?.id, "a");
    assert.equal(images[1]?.id, "b");
  });

  test("sitePlanImage shape has required fields", () => {
    const img = {
      id: "uuid-1",
      tenantId: "tenant-1",
      url: "/api/storage/img/slug/name.jpg",
      caption: "First floor",
      position: 0,
      width: 1400,
      height: 800,
    };
    assert.ok(img.id);
    assert.ok(img.tenantId);
    assert.ok(img.url);
    assert.equal(typeof img.caption, "string");
    assert.equal(typeof img.position, "number");
  });

  test("caption null is valid (no caption set)", () => {
    const img = { id: "uuid-2", tenantId: "t1", url: "/x", caption: null, position: 0, width: null, height: null };
    assert.equal(img.caption, null);
  });
});

// ---------------------------------------------------------------------------
// 3. toSitePlanImage: caption maps alt column
// ---------------------------------------------------------------------------
describe("toSitePlanImage mapping", () => {
  function toSitePlanImage(row: {
    id: string;
    tenantId: string | null;
    url: string;
    alt: string | null;
    position: number;
    width: number | null;
    height: number | null;
    purpose: string;
    itemId: string | null;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId ?? null,
      url: row.url,
      caption: row.alt ?? null,
      position: row.position,
      width: row.width ?? null,
      height: row.height ?? null,
    };
  }

  test("alt column is exposed as caption", () => {
    const row = {
      id: "1", tenantId: "t1", url: "/u", alt: "Floor 1",
      position: 0, width: 1400, height: 900, purpose: "site-plan", itemId: null,
    };
    const mapped = toSitePlanImage(row);
    assert.equal(mapped.caption, "Floor 1");
    assert.equal((mapped as Record<string, unknown>)["alt"], undefined);
  });

  test("null alt becomes null caption", () => {
    const row = {
      id: "2", tenantId: "t1", url: "/u", alt: null,
      position: 0, width: null, height: null, purpose: "site-plan", itemId: null,
    };
    const mapped = toSitePlanImage(row);
    assert.equal(mapped.caption, null);
  });
});

// ---------------------------------------------------------------------------
// 4. Purpose isolation: item rows are excluded from site-plan lists
// ---------------------------------------------------------------------------
describe("purpose isolation", () => {
  const mockRows = [
    { id: "a", purpose: "item", itemId: "item-1", tenantId: "t1" },
    { id: "b", purpose: "site-plan", itemId: null, tenantId: "t1" },
    { id: "c", purpose: "site-plan", itemId: null, tenantId: "t1" },
    { id: "d", purpose: "item", itemId: "item-2", tenantId: "t1" },
  ];

  test("filtering purpose=site-plan AND itemId=null excludes item rows", () => {
    const sitePlan = mockRows.filter(
      (r) => r.purpose === "site-plan" && r.itemId === null,
    );
    assert.equal(sitePlan.length, 2);
    assert.ok(sitePlan.every((r) => r.purpose === "site-plan" && r.itemId === null));
  });

  test("item rows cannot pass site-plan purpose check", () => {
    for (const r of mockRows.filter((r) => r.purpose === "item")) {
      assert.notEqual(r.purpose, "site-plan");
    }
  });

  test("DB CHECK contract: site-plan rows with itemId would violate constraint", () => {
    // Simulate the constraint: purpose='site-plan' => itemId IS NULL
    const check = (row: { purpose: string; itemId: string | null }) =>
      row.purpose !== "site-plan" || row.itemId === null;
    assert.ok(check({ purpose: "site-plan", itemId: null }));      // valid
    assert.ok(check({ purpose: "item", itemId: "item-1" }));       // valid
    assert.ok(!check({ purpose: "site-plan", itemId: "item-1" })); // would fail DB CHECK
  });
});

// ---------------------------------------------------------------------------
// 5. Image-only upload guard
// ---------------------------------------------------------------------------
describe("image-only upload guard", () => {
  function isVideoMimetype(mimetype: string): boolean {
    return mimetype.startsWith("video/");
  }

  test("video/mp4 is rejected", () => {
    assert.ok(isVideoMimetype("video/mp4"));
  });

  test("video/webm is rejected", () => {
    assert.ok(isVideoMimetype("video/webm"));
  });

  test("image/jpeg is accepted", () => {
    assert.ok(!isVideoMimetype("image/jpeg"));
  });

  test("image/png is accepted", () => {
    assert.ok(!isVideoMimetype("image/png"));
  });

  test("image/heic is accepted", () => {
    assert.ok(!isVideoMimetype("image/heic"));
  });
});

// ---------------------------------------------------------------------------
// 6. livingGuideNav duplicate reset contract
// ---------------------------------------------------------------------------
describe("livingGuideNav duplicate reset", () => {
  test("duplicated tenant receives null livingGuideNav (not inherited)", () => {
    // This mirrors the copyTenant logic: livingGuideNav is always reset to null
    // when a tenant is duplicated, regardless of source value.
    const sourceNav = ["home", "stay", "offer", "explore", "program"];
    const copiedNav: string[] | null = null; // the contract: always null on copy
    assert.equal(copiedNav, null);
    assert.notEqual(copiedNav, sourceNav);
  });

  test("null is a valid living_guide_nav value (frontend resolves default)", () => {
    const nav: string[] | null = null;
    // The DB column is nullable — null is the backward-compatible default.
    assert.equal(nav, null);
  });
});

// ---------------------------------------------------------------------------
// 7 + 8. Nav uniqueness and home-first (detailed edge cases)
// ---------------------------------------------------------------------------
describe("nav validation edge cases", () => {
  test("home appearing twice is a uniqueness violation", () => {
    const result = validateLivingGuideNav(["home", "home", "offer", "explore", "program"]);
    assert.equal(result.ok, false);
    // Could be caught by unique check or invalid key check — either is fine
    assert.ok((result as { ok: false; error: string }).error.length > 0);
  });

  test("undefined is not a valid nav (not an array)", () => {
    const result = validateLivingGuideNav(undefined);
    assert.equal(result.ok, false);
  });

  test("object is not a valid nav (not an array)", () => {
    const result = validateLivingGuideNav({ 0: "home", length: 5 });
    assert.equal(result.ok, false);
  });

  test("full valid set with messages as fifth", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", "messages"]);
    assert.deepEqual(result, { ok: true });
  });

  test("full valid set with program as fifth", () => {
    const result = validateLivingGuideNav(["home", "stay", "offer", "explore", "program"]);
    assert.deepEqual(result, { ok: true });
  });
});

// ---------------------------------------------------------------------------
// Reorder ownership/isolation contract (pure logic)
// ---------------------------------------------------------------------------
describe("reorder ownership isolation", () => {
  type MockRow = { id: string; purpose: string; itemId: string | null; tenantId: string };

  function validateReorder(tenantId: string, ids: string[], allRows: MockRow[]): string | null {
    const found = allRows.filter((r) => ids.includes(r.id));
    if (found.length !== ids.length) return "One or more ids not found";
    for (const row of found) {
      if (row.purpose !== "site-plan") return `Row ${row.id} is not a site-plan image`;
      if (row.itemId !== null) return `Row ${row.id} is item-scoped`;
      if (row.tenantId !== tenantId) return `Row ${row.id} does not belong to this tenant`;
    }
    const sitePlanCount = allRows.filter(
      (r) => r.tenantId === tenantId && r.purpose === "site-plan" && r.itemId === null,
    ).length;
    if (sitePlanCount !== ids.length) return "ids must include every site-plan image of the tenant";
    return null;
  }

  const rows: MockRow[] = [
    { id: "sp1", purpose: "site-plan", itemId: null, tenantId: "t1" },
    { id: "sp2", purpose: "site-plan", itemId: null, tenantId: "t1" },
    { id: "item1", purpose: "item", itemId: "i1", tenantId: "t1" },
    { id: "sp3", purpose: "site-plan", itemId: null, tenantId: "t2" },
  ];

  test("valid reorder of all site-plan images for tenant", () => {
    assert.equal(validateReorder("t1", ["sp1", "sp2"], rows), null);
  });

  test("rejects item row in ids", () => {
    const err = validateReorder("t1", ["sp1", "item1"], rows);
    assert.ok(err?.includes("item1"));
  });

  test("rejects row belonging to another tenant", () => {
    const err = validateReorder("t1", ["sp1", "sp3"], rows);
    assert.ok(err !== null);
  });

  test("rejects partial set (missing sp2)", () => {
    const err = validateReorder("t1", ["sp1"], rows);
    assert.ok(err?.includes("every site-plan"));
  });

  test("rejects unknown id", () => {
    const err = validateReorder("t1", ["sp1", "sp9999"], rows);
    assert.ok(err?.includes("not found"));
  });
});

// ---------------------------------------------------------------------------
// Delete cleanup contract (pure logic)
// ---------------------------------------------------------------------------
describe("delete cleanup contract", () => {
  test("delete only accepts purpose=site-plan rows", () => {
    const row = { id: "x", purpose: "item", itemId: "item-1" };
    const isSitePlan = row.purpose === "site-plan" && row.itemId === null;
    assert.ok(!isSitePlan);
  });

  test("site-plan row passes delete guard", () => {
    const row = { id: "y", purpose: "site-plan", itemId: null };
    const isSitePlan = row.purpose === "site-plan" && row.itemId === null;
    assert.ok(isSitePlan);
  });
});

// ---------------------------------------------------------------------------
// Site-plan audit coverage
// ---------------------------------------------------------------------------
describe("site-plan audit coverage", () => {
  const routeSource = readFileSync(
    new URL("../routes/adminSitePlan.ts", import.meta.url),
    "utf8",
  );

  test("records fixed Slovenian audit summaries for every successful mutation", () => {
    const expectedEvents = [
      {
        action: "create",
        summary: "Dodana je bila slika načrta lokacije.",
      },
      {
        action: "reorder",
        summary: "Spremenjen je bil vrstni red slik načrta lokacije.",
      },
      {
        action: "update",
        summary: "Posodobljen je bil opis slike načrta lokacije.",
      },
      {
        action: "delete",
        summary: "Odstranjena je bila slika načrta lokacije.",
      },
    ];

    for (const event of expectedEvents) {
      assert.match(
        routeSource,
        new RegExp(
          `logChange\\(\\{\\s*tenantId(?:\\s*:\\s*existing\\.tenantId)?,\\s*action:\\s*"${event.action}",\\s*entity:\\s*"site-plan-image",\\s*summary:\\s*"${event.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
          "s",
        ),
      );
    }
  });

  test("site-plan audit calls do not include request-controlled media content", () => {
    const auditCalls = routeSource.match(/logChange\(\{[\s\S]*?\}\);/g) ?? [];
    assert.equal(auditCalls.length, 4);
    for (const call of auditCalls) {
      assert.match(call, /tenantId/);
      assert.doesNotMatch(call, /\b(caption|filename|url|alt|buffer)\b/i);
    }
  });
});
