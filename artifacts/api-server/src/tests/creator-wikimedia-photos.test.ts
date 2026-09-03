import assert from "node:assert/strict";
import test from "node:test";
import {
  commonsNameMatchesPlace,
  commonsFileCandidate,
  creatorPhotoReservedAt,
  creatorPhotoNextMediaPosition,
  guardedCreatorPhotoDiscovery,
  normalizeFreeLicense,
  normalizePlaceName,
} from "../lib/creatorWikimediaPhotos";
import { deletePhotoVariants } from "../routes/storage";
const immediateSlot = async () => new Date();

test("Commons metadata accepts only the explicit free-license families", () => {
  assert.equal(normalizeFreeLicense("CC BY-SA 4.0"), "CC BY-SA 4.0");
  assert.equal(normalizeFreeLicense("CC-BY 3.0"), "CC BY 3.0");
  assert.equal(normalizeFreeLicense("CC0 1.0"), "CC0");
  assert.equal(normalizeFreeLicense("Public domain"), "Public domain");
  assert.equal(normalizeFreeLicense("CC BY-NC 4.0"), null);
  assert.equal(normalizeFreeLicense("Copyrighted, free use"), null);
  assert.equal(normalizeFreeLicense(""), null);
});

test("place-name normalization is strict but accent and punctuation safe", () => {
  assert.equal(normalizePlaceName("Slap Rinka"), "slap rinka");
  assert.equal(normalizePlaceName("File: Logarská dolina – photo"), "logarska dolina");
});

test("geosearch name match handles Slap Rinka Commons English titles without accepting proximity alone", () => {
  assert.equal(commonsNameMatchesPlace("Slap Rinka", "Rinka Waterfall in Winter.jpg"), true);
  assert.equal(commonsNameMatchesPlace("Slap Rinka", "Logarska Dolina.jpg"), false);
  assert.equal(commonsNameMatchesPlace("Logarska dolina", "Logarska Dolina (33381161502).jpg"), true);
});

test("Commons imageinfo yields attribution and sends a descriptive User-Agent", async () => {
  let userAgent = "";
  const fetchFn: typeof fetch = async (_input, init) => {
    userAgent = new Headers(init?.headers).get("user-agent") ?? "";
    return new Response(JSON.stringify({
      query: {
        pages: [{
          title: "File:Slap Rinka.jpg",
          imageinfo: [{
            url: "https://upload.wikimedia.org/wikipedia/commons/a/aa/Slap_Rinka.jpg",
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Slap_Rinka.jpg/620px-Slap_Rinka.jpg",
            extmetadata: {
              Artist: { value: "<b>Janez Novak</b>" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
            },
          }],
        }],
      },
    }), { headers: { "content-type": "application/json" } });
  };
  const candidate = await commonsFileCandidate("Slap Rinka.jpg", fetchFn, immediateSlot);
  assert.equal(candidate?.author, "Janez Novak");
  assert.equal(candidate?.license, "CC BY-SA 4.0");
  assert.match(candidate?.sourcePageUrl ?? "", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  assert.match(userAgent, /Smart360-Creator-Wikimedia/);
});

test("Commons imageinfo rejects non-free licenses and non-Wikimedia image hosts", async () => {
  const payload = (url: string, license: string) => new Response(JSON.stringify({
    query: { pages: [{ title: "File:X.jpg", imageinfo: [{
      url,
      thumburl: "https://upload.wikimedia.org/thumb/x.jpg",
      extmetadata: { Artist: { value: "A" }, LicenseShortName: { value: license } },
    }] }] },
  }));
  assert.equal(await commonsFileCandidate("X.jpg", async () =>
    payload("https://upload.wikimedia.org/x.jpg", "CC BY-NC 4.0"), immediateSlot), null);
  await assert.rejects(
    commonsFileCandidate("X.jpg", async () => payload("https://evil.example/x.jpg", "CC BY 4.0"), immediateSlot),
    /not safe/,
  );
});

test("all Wikimedia fetches reject redirects rather than following them", async () => {
  let redirect = "";
  await assert.rejects(commonsFileCandidate("X.jpg", async (_url, init) => {
    redirect = String(init?.redirect);
    return new Response("", { status: 302, headers: { location: "https://evil.example/" } });
  }, immediateSlot), /failed/);
  assert.equal(redirect, "error");
});

test("variant compensation deletes exactly the three generated variants", async () => {
  const deleted: string[] = [];
  await deletePhotoVariants("gril", "only-this.jpg", async (bucket, object) => {
    deleted.push(`${bucket}/${object}`);
  });
  assert.equal(deleted.length, 3);
  assert.match(deleted.join("\n"), /\/media\/gril\/200\/only-this\.jpg/);
  assert.match(deleted.join("\n"), /\/media\/gril\/620\/only-this\.jpg/);
  assert.match(deleted.join("\n"), /\/media\/gril\/1400\/only-this\.jpg/);
  assert.equal(deleted.some((path) => path.includes("unrelated")), false);
});

test("development discovery guard refuses production", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(guardedCreatorPhotoDiscovery("tenant"), /disabled in production/);
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("photo API slot reservations are monotonic and at least 300ms apart", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const first = creatorPhotoReservedAt(null, now);
  const second = creatorPhotoReservedAt(first, now);
  const third = creatorPhotoReservedAt(second, new Date("2026-01-01T00:00:00.100Z"));
  assert.equal(first.getTime(), now.getTime());
  assert.equal(second.getTime() - first.getTime(), 300);
  assert.equal(third.getTime() - second.getTime(), 300);
});

test("approved Wikimedia media appends after the highest existing gallery position", () => {
  assert.equal(creatorPhotoNextMediaPosition([]), 0);
  assert.equal(creatorPhotoNextMediaPosition([0, 1, 4]), 5);
  assert.equal(creatorPhotoNextMediaPosition([8, 2]), 9);
});