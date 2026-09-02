import test from "node:test";
import assert from "node:assert/strict";
import nodeCrypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  adminUsersTable,
  creatorRobotsEvidenceTable,
  creatorSourceContentsTable,
  creatorSourcesTable,
  db,
} from "@workspace/db";
import {
  assertPublicCreatorDestination,
  canonicalizeCreatorSourceUrl,
  crawlApprovedCreatorSource,
  CreatorSourcePolicyError,
  discoverDepthOneCreatorLinks,
  evaluateRobotsPolicy,
  isObviousNonContentCreatorPath,
  parseRobotsPolicy,
  readApprovedCreatorSource,
  retrieveRobotsEvidence,
} from "../lib/creatorSourceReader";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("Creator source URLs and destinations reject non-HTTPS and private/internal targets", async () => {
  assert.throws(
    () => canonicalizeCreatorSourceUrl("http://example.com/place"),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "invalid-url",
  );
  await assert.rejects(
    assertPublicCreatorDestination(new URL("https://localhost/place"), publicLookup),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "private-destination",
  );
  await assert.rejects(
    assertPublicCreatorDestination(
      new URL("https://source.example/place"),
      async () => [{ address: "10.1.2.3", family: 4 }],
    ),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "private-destination",
  );
  assert.equal(
    canonicalizeCreatorSourceUrl(
      "https://example.com/place?utm_source=newsletter&keep=yes&FBCLID=abc&gclid=def#details",
    ),
    "https://example.com/place?keep=yes",
  );
});

test("robots.txt applies the most specific user-agent group and longest Allow/Disallow rule", () => {
  const groups = parseRobotsPolicy(`
    User-agent: *
    Disallow: /

    User-agent: Smart360Creator
    Disallow: /private
    Allow: /private/public$
  `);
  assert.deepEqual(
    evaluateRobotsPolicy(groups, "https://example.com/private/public"),
    { allowed: true, matchedRule: "allow:/private/public$" },
  );
  assert.deepEqual(
    evaluateRobotsPolicy(groups, "https://example.com/private/other"),
    { allowed: false, matchedRule: "disallow:/private" },
  );
  const substringAgent = parseRobotsPolicy("User-agent: Creator\nDisallow: /hidden\n");
  assert.deepEqual(
    evaluateRobotsPolicy(substringAgent, "https://example.com/hidden"),
    { allowed: false, matchedRule: "disallow:/hidden" },
  );
  assert.throws(
    () => parseRobotsPolicy("User-agent *\nDisallow: /"),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "robots-uncertain",
  );
});

test("robots evidence is persisted, cached, and explicit denial fails closed", async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality: `Robots ${suffix}`,
    label: "Robots allow source",
    sourceKind: "test",
    url: `https://allow-${suffix}.example/place`,
    canonicalUrl: `https://allow-${suffix}.example/place`,
  }).returning();
  const [deniedSource] = await db.insert(creatorSourcesTable).values({
    municipality: `Robots ${suffix}`,
    label: "Robots deny source",
    sourceKind: "test",
    url: `https://deny-${suffix}.example/private`,
    canonicalUrl: `https://deny-${suffix}.example/private`,
  }).returning();
  assert.ok(source && deniedSource);
  t.after(async () => {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.municipality, `Robots ${suffix}`));
  });

  let fetchCount = 0;
  const allowFetch: typeof fetch = async (input) => {
    fetchCount += 1;
    assert.equal(new URL(String(input)).pathname, "/robots.txt");
    return new Response("User-agent: Smart360Creator\nAllow: /\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  };
  const first = await retrieveRobotsEvidence(source, { fetchFn: allowFetch, lookupFn: publicLookup });
  const cached = await retrieveRobotsEvidence(source, { fetchFn: allowFetch, lookupFn: publicLookup });
  assert.equal(first.allowed, true);
  assert.equal(cached.id, first.id);
  assert.equal(fetchCount, 1);
  assert.match(first.policySha256 ?? "", /^[a-f0-9]{64}$/);
  assert.ok(first.expiresAt > first.fetchedAt);

  const denied = await retrieveRobotsEvidence(deniedSource, {
    useCache: false,
    lookupFn: publicLookup,
    fetchFn: async () => new Response("User-agent: Smart360Creator\nDisallow: /private\n", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.decision, "disallowed");
  assert.equal(denied.matchedRule, "disallow:/private");
});

test("robots retrieval fails closed on parsing uncertainty and unapproved redirects", async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality: `Robots uncertainty ${suffix}`,
    label: "Uncertain source",
    sourceKind: "test",
    url: `https://uncertain-${suffix}.example/place`,
    canonicalUrl: `https://uncertain-${suffix}.example/place`,
  }).returning();
  assert.ok(source);
  t.after(async () => {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
  });

  const malformed = await retrieveRobotsEvidence(source, {
    useCache: false,
    lookupFn: publicLookup,
    fetchFn: async () => new Response("User-agent *\nDisallow: /", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });
  assert.equal(malformed.allowed, false);
  assert.equal(malformed.decision, "error");

  const redirected = await retrieveRobotsEvidence(source, {
    useCache: false,
    lookupFn: publicLookup,
    fetchFn: async () => new Response(null, {
      status: 302,
      headers: { location: "https://unapproved.example/robots.txt" },
    }),
  });
  assert.equal(redirected.allowed, false);
  assert.equal(redirected.decision, "error");
  assert.match(redirected.error ?? "", /not on the approved area list/);
});

test("content is unreachable before approval and approved extraction stores robots evidence", async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const municipality = `Content ${suffix}`;
  const origin = `https://content-${suffix}.example`;
  const enteredUrl = `${origin}/guide?utm_source=operator&keep=yes&fbclid=abc`;
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Content source",
    sourceKind: "test",
    url: enteredUrl,
    canonicalUrl: enteredUrl,
  }).returning();
  assert.ok(source);
  t.after(async () => {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
  });

  let called = false;
  await assert.rejects(
    readApprovedCreatorSource(source.id, {
      lookupFn: publicLookup,
      fetchFn: async () => {
        called = true;
        throw new Error("must not fetch");
      },
    }),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "not-approved",
  );
  assert.equal(called, false);

  const [owner] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(owner, "test requires the configured owner account");
  await db.update(creatorSourcesTable).set({
    status: "approved",
    approvedBy: owner.id,
    approvedAt: new Date(),
  }).where(eq(creatorSourcesTable.id, source.id));

  const requestedUrls: string[] = [];
  const html = "<html><head><title>Area guide</title></head><body><script>ignore()</script><h1>Waterfall walk</h1></body></html>";
  const stored = await readApprovedCreatorSource(source.id, {
    lookupFn: publicLookup,
    fetchFn: async (input) => {
      const requested = new URL(String(input));
      const path = requested.pathname;
      requestedUrls.push(requested.href);
      if (path === "/robots.txt") {
        return new Response("User-agent: Smart360Creator\nAllow: /guide\n", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });
  assert.deepEqual(requestedUrls, [
    `${origin}/robots.txt`,
    `${origin}/guide?keep=yes`,
  ]);
  assert.equal(stored.title, "Area guide");
  assert.match(stored.rawContent!, /<h1>Waterfall walk<\/h1>/);
  assert.equal(stored.contentSha256, nodeCrypto.createHash("sha256").update(html).digest("hex"));
  assert.equal(stored.extractedText, "Area guideWaterfall walk");

  const [evidence] = await db.select().from(creatorRobotsEvidenceTable)
    .where(eq(creatorRobotsEvidenceTable.id, stored.robotsEvidenceId));
  const [content] = await db.select().from(creatorSourceContentsTable)
    .where(eq(creatorSourceContentsTable.id, stored.id));
  assert.equal(evidence?.allowed, true);
  assert.equal(content?.sourceUrl, `${origin}/guide?keep=yes`);
  assert.ok(content?.retrievedAt instanceof Date);
});

test("same-origin content redirects are rechecked against robots before the redirected page is fetched", async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const municipality = `Redirect content ${suffix}`;
  const origin = `https://redirect-content-${suffix}.example`;
  const [owner] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(owner);
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Redirecting source",
    sourceKind: "test",
    url: `${origin}/guide`,
    canonicalUrl: `${origin}/guide`,
    status: "approved",
    approvedBy: owner.id,
    approvedAt: new Date(),
  }).returning();
  assert.ok(source);
  t.after(async () => {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
  });

  const requestedPaths: string[] = [];
  await assert.rejects(
    readApprovedCreatorSource(source.id, {
      lookupFn: publicLookup,
      fetchFn: async (input) => {
        const path = new URL(String(input)).pathname;
        requestedPaths.push(path);
        if (path === "/robots.txt") {
          return new Response("User-agent: Smart360Creator\nDisallow: /blocked\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }
        return new Response(null, {
          status: 302,
          headers: { location: `${origin}/blocked?utm_source=redirect&fbclid=abc` },
        });
      },
    }),
    (error) =>
      error instanceof CreatorSourcePolicyError
      && error.kind === "robots-disallowed"
      && error.sourceUrl === `${origin}/blocked`,
  );
  assert.deepEqual(
    requestedPaths,
    ["/robots.txt", "/guide"],
    "the disallowed redirect destination must never be requested",
  );
});

test("depth-one link discovery is same-origin, canonical, deduplicated, sorted, and bounded", () => {
  const manyLinks = Array.from(
    { length: 65 },
    (_, index) => `<a href="/page-${String(64 - index).padStart(2, "0")}#section">page</a>`,
  ).join("");
  const links = discoverDepthOneCreatorLinks(
    "https://example.com/guide",
    [
      manyLinks,
      "<a href='/page-00'>duplicate</a>",
      "<a href='https://other.example/page'>other origin</a>",
      "<a href='http://example.com/insecure'>insecure</a>",
      "<a href='javascript:alert(1)'>script</a>",
    ].join(""),
  );
  assert.equal(links.length, 60);
  assert.equal(links[0], "https://example.com/page-00");
  assert.equal(links[59], "https://example.com/page-59");
});

test("obvious utility paths are filtered without excluding attraction details", () => {
  for (const path of [
    "/documents/map.pdf",
    "/assets/site.css",
    "/login",
    "/admin/users",
    "/search?q=lake",
    "/tags/walks",
    "/categories/family",
    "/feed",
    "/page/2",
    "/news/2024/06",
    "/Cookies",
    "/gdpr",
    "/CreateNew/391?relatedPostId=42",
    "/objave/112",
    "/window.location.pathname",
  ]) {
    assert.equal(isObviousNonContentCreatorPath(`https://example.com${path}`), true, path);
  }
  assert.equal(
    isObviousNonContentCreatorPath("https://example.com/attractions/slap-virje"),
    false,
  );
  assert.equal(
    isObviousNonContentCreatorPath("https://example.com/places/lake-bled"),
    false,
  );
});

test("crawler evaluates robots per selected URL and never follows depth-one links", async (t) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const municipality = `Crawl ${suffix}`;
  const origin = `https://crawl-${suffix}.example`;
  const [owner] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(owner);
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Crawl source",
    sourceKind: "test",
    url: `${origin}/seed`,
    canonicalUrl: `${origin}/seed`,
    status: "approved",
    approvedBy: owner.id,
    approvedAt: new Date(),
  }).returning();
  assert.ok(source);
  t.after(async () => {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
  });

  const requestedPaths: string[] = [];
  const result = await crawlApprovedCreatorSource(source.id, {
    lookupFn: publicLookup,
    fetchFn: async (input) => {
      const path = new URL(String(input)).pathname;
      requestedPaths.push(path);
      if (path === "/robots.txt") {
        return new Response("User-agent: Smart360Creator\nDisallow: /blocked\nAllow: /\n", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      const body = path === "/seed"
        ? "<html><title>Seed</title><a href='/b'>B</a><a href='/blocked'>blocked</a><a href='/a'>A</a><a href='/a#again'>duplicate</a><a href='/assets/map.pdf'>asset</a><a href='/login'>login</a><a href='/attractions/slap-virje'>detail</a></html>"
        : "<html><title>Same body</title><p>same content</p><a href=\"/depth-two\">not followed</a></html>";
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });

  assert.deepEqual(requestedPaths, ["/robots.txt", "/seed", "/a", "/attractions/slap-virje", "/b"]);
  assert.deepEqual(result.pages.map(({ url, status, skipReason }) => ({
    path: new URL(url).pathname,
    status,
    skipReason,
  })), [
    { path: "/seed", status: "stored", skipReason: null },
    { path: "/a", status: "stored", skipReason: null },
    { path: "/attractions/slap-virje", status: "stored", skipReason: null },
    { path: "/b", status: "stored", skipReason: null },
    { path: "/blocked", status: "skipped", skipReason: "robots-disallowed" },
    { path: "/assets/map.pdf", status: "skipped", skipReason: "non-content-path" },
    { path: "/login", status: "skipped", skipReason: "non-content-path" },
  ]);
  assert.equal(result.counters.attemptedPages, 4);
  assert.equal(result.counters.storedPages, 4);
  assert.equal(result.counters.skippedPages, 3);
  assert.equal(result.counters.skipReasons["robots-disallowed"], 1);
  assert.equal(result.counters.skipReasons["non-content-path"], 2);
  assert.ok(result.pages[0]!.counters.rawBytes > 0);
  assert.equal(result.pages[1]!.content?.id, result.pages[2]!.content?.id);
  assert.equal(result.pages[1]!.content?.id, result.pages[3]!.content?.id);
  assert.equal(result.pages[1]!.finalUrl, `${origin}/a`);
  assert.equal(result.pages[2]!.finalUrl, `${origin}/attractions/slap-virje`);
  assert.equal(result.pages[3]!.finalUrl, `${origin}/b`);
  assert.ok(result.pages[1]!.observedAt instanceof Date);
  assert.ok(result.pages[3]!.observedAt instanceof Date);

  await assert.rejects(
    crawlApprovedCreatorSource(source.id, {
      lookupFn: publicLookup,
      getRemainingContentBytes: () => 10,
      fetchFn: async () => new Response("<html><title>Too large for remaining run budget</title></html>", {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "61" },
      }),
    }),
    (error) =>
      error instanceof CreatorSourcePolicyError
      && error.kind === "run-budget-exhausted"
      && error.sourceUrl === `${origin}/seed`,
  );

  let contentReads = 0;
  let sourceCapHit = false;
  const capped = await crawlApprovedCreatorSource(source.id, {
    lookupFn: publicLookup,
    getRemainingContentBytes: () => contentReads === 0 ? 10_000 : 10,
    onContentRead: () => {
      contentReads += 1;
    },
    onContentBudgetExceeded: () => {
      sourceCapHit = true;
    },
    shouldSkipRemainingOnContentBudgetExceeded: () => sourceCapHit,
    fetchFn: async (input) => {
      const path = new URL(String(input)).pathname;
      const body = path === "/seed"
        ? "<html><title>Seed</title><a href='/a'>A</a><a href='/b'>B</a></html>"
        : "<html><title>Page beyond the remaining source share</title></html>";
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  assert.equal(capped.counters.storedPages, 1);
  assert.equal(capped.counters.skipReasons["source-byte-cap"], 2);
  assert.equal(capped.counters.attemptedPages, 2);

  await assert.rejects(
    crawlApprovedCreatorSource(source.id, {
      lookupFn: publicLookup,
      timeoutMs: 20,
      fetchFn: async () => new Response(new ReadableStream<Uint8Array>({
        pull: () => new Promise(() => undefined),
      }), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    }),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "network",
  );
});
