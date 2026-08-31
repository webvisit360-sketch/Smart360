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
  CreatorSourcePolicyError,
  evaluateRobotsPolicy,
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
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Content source",
    sourceKind: "test",
    url: `${origin}/guide`,
    canonicalUrl: `${origin}/guide`,
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

  const requestedPaths: string[] = [];
  const html = "<html><head><title>Area guide</title></head><body><script>ignore()</script><h1>Waterfall walk</h1></body></html>";
  const stored = await readApprovedCreatorSource(source.id, {
    lookupFn: publicLookup,
    fetchFn: async (input) => {
      const path = new URL(String(input)).pathname;
      requestedPaths.push(path);
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
  assert.deepEqual(requestedPaths, ["/robots.txt", "/guide"]);
  assert.equal(stored.title, "Area guide");
  assert.match(stored.rawContent!, /<h1>Waterfall walk<\/h1>/);
  assert.equal(stored.contentSha256, nodeCrypto.createHash("sha256").update(html).digest("hex"));
  assert.equal(stored.extractedText, "Area guideWaterfall walk");

  const [evidence] = await db.select().from(creatorRobotsEvidenceTable)
    .where(eq(creatorRobotsEvidenceTable.id, stored.robotsEvidenceId));
  const [content] = await db.select().from(creatorSourceContentsTable)
    .where(eq(creatorSourceContentsTable.id, stored.id));
  assert.equal(evidence?.allowed, true);
  assert.equal(content?.sourceUrl, `${origin}/guide`);
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
          headers: { location: `${origin}/blocked` },
        });
      },
    }),
    (error) => error instanceof CreatorSourcePolicyError && error.kind === "robots-disallowed",
  );
  assert.deepEqual(
    requestedPaths,
    ["/robots.txt", "/guide"],
    "the disallowed redirect destination must never be requested",
  );
});