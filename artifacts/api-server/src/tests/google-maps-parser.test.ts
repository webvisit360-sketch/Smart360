import assert from "node:assert/strict";
import test from "node:test";
import {
  expandGoogleMapsShortLink,
  GoogleMapsParseError,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrl,
  parseGoogleMapsLocationUrlOrThrow,
} from "../lib/maps-link";
import { resolveCreatorOrigin } from "../lib/creatorOrigin";

const HOTEL_VIEWPORT = { lat: 46.2680508, lng: 15.1860367 };
const MENINA_VIEWPORT = { lat: 46.3114597, lng: 14.9067248 };

test("offline: search form parses pin coordinates and no name", () => {
  const result = parseGoogleMapsLocationUrl(
    "https://www.google.com/maps/search/46.311167,+14.909133?entry=tts&example=1",
  );
  assert.deepEqual(result, {
    lat: 46.311167,
    lng: 14.909133,
    name: null,
    placeId: null,
    source: "search",
  });
});

test("offline: Hotel A plus uses !3d/!4d and never the @ viewport", () => {
  const result = parseGoogleMapsLocationUrl(
    "https://www.google.com/maps/place/Hotel+A+plus/@46.2680508,15.1860367,794m/data=!3m2!1e3!4b1!4m9!3m8!1s0x47656f63b402157b:0xc1f9c11df0f2a827!5m2!4m1!1i2!8m2!3d46.2680471!4d15.188617!16s%2Fg%2F11g_zf9hs1",
  );
  assert.deepEqual(result, {
    lat: 46.2680471,
    lng: 15.188617,
    name: "Hotel A plus",
    placeId: "/g/11g_zf9hs1",
    source: "place",
  });
  assert.notDeepEqual(
    result && { lat: result.lat, lng: result.lng },
    HOTEL_VIEWPORT,
    "parser silently used Hotel A plus @ viewport coordinates",
  );
});

test("offline: Camping MENINA uses !3d/!4d and never the @ viewport", () => {
  const result = parseGoogleMapsLocationUrl(
    "https://www.google.com/maps/place/Camping+MENINA/@46.3114597,14.9067248,794m/data=!3m2!1e3!4b1!4m9!3m8!1s0x476544b2dceb3c9d:0xfed2eb6fc9373f3d!5m2!4m1!1i2!8m2!3d46.311456!4d14.9093051!16s%2Fg%2F11b76h070l",
  );
  assert.deepEqual(result, {
    lat: 46.311456,
    lng: 14.9093051,
    name: "Camping MENINA",
    placeId: "/g/11b76h070l",
    source: "place",
  });
  assert.notDeepEqual(
    result && { lat: result.lat, lng: result.lng },
    MENINA_VIEWPORT,
    "parser silently used Camping MENINA @ viewport coordinates",
  );
});

test("offline: multi-place URL keeps the selected place pin and feature ID together", () => {
  const result = parseGoogleMapsLocationUrl(
    "https://www.google.com/maps/place/Piknik+prostor+in+kamp+Gril/@46.3499833,14.8470013,1311m/data=!3m1!1e3!4m14!1m7!3m6!1s0x47655bac1c180a51:0xec9821cb7ac81b4b!2sGlamping+Gril!8m2!3d46.35001!4d14.850273!16s%2Fg%2F11vyqnsc6n!3m5!1s0x47655bc349c591dd:0xd66c5a12dbe4dc27!8m2!3d46.3536005!4d14.8509723!16s%2Fg%2F11s57htx7l",
  );
  assert.deepEqual(result, {
    lat: 46.3536005,
    lng: 14.8509723,
    name: "Piknik prostor in kamp Gril",
    placeId: "/g/11s57htx7l",
    source: "place",
  });
});

test("offline: unavailable Nominatim records an unverified pin without rejecting origin parsing", async () => {
  let reverseLookupCalls = 0;
  const result = await resolveCreatorOrigin(
    "https://www.google.com/maps/place/Piknik+prostor+in+kamp+Gril/@46.3499833,14.8470013,1311m/data=!3m1!1e3!4m14!1m7!3m6!1s0x47655bac1c180a51:0xec9821cb7ac81b4b!2sGlamping+Gril!8m2!3d46.35001!4d14.850273!16s%2Fg%2F11vyqnsc6n!3m5!1s0x47655bc349c591dd:0xd66c5a12dbe4dc27!8m2!3d46.3536005!4d14.8509723!16s%2Fg%2F11s57htx7l",
    {
      fetchFn: async () => {
        reverseLookupCalls += 1;
        return new Response(null, { status: 429 });
      },
    },
  );
  assert.equal(result.lat, 46.3536005);
  assert.equal(result.lng, 14.8509723);
  assert.equal(result.placeId, "/g/11s57htx7l");
  assert.equal(result.originVerificationStatus, "unverified");
  assert.equal(result.originVerificationReason, "Nominatim HTTP 429");
  assert.equal(result.nominatimDisplayName, null);
  assert.equal(reverseLookupCalls, 1, "origin verification must not retry in a loop");
});

test("offline: @ viewport alone is always rejected", () => {
  assert.equal(
    parseGoogleMapsLocationUrl(
      "https://www.google.com/maps/place/Unsafe/@46.3114597,14.9067248,794m",
    ),
    null,
  );
});

test("offline: deceptive Google substring hostname is refused", () => {
  assert.throws(
    () =>
      parseGoogleMapsLocationUrlOrThrow(
        "https://maps.app.goo.gl.example.net/abc",
      ),
    (error: unknown) =>
      error instanceof GoogleMapsParseError && error.kind === "disallowed-url",
  );
});

test("offline: country domains are deliberately refused with accepted hosts named", () => {
  for (const url of [
    "https://google.si/maps/search/46.3,14.9",
    "https://maps.google.de/maps/search/46.3,14.9",
  ]) {
    assert.throws(
      () => parseGoogleMapsLocationUrlOrThrow(url),
      (error: unknown) =>
        error instanceof GoogleMapsParseError &&
        error.kind === "disallowed-url" &&
        /google\.com/.test(error.message) &&
        /maps\.app\.goo\.gl/.test(error.message),
    );
  }
});

test("offline: named place without pin and viewport-only URL fail distinctly", () => {
  assert.throws(
    () =>
      parseGoogleMapsLocationUrlOrThrow(
        "https://www.google.com/maps/place/Hotel+A+plus/@46.2680508,15.1860367,794m",
      ),
    (error: unknown) =>
      error instanceof GoogleMapsParseError &&
      error.kind === "place-missing-pin" &&
      /!3d\/!4d/.test(error.message),
  );
  assert.throws(
    () =>
      parseGoogleMapsLocationUrlOrThrow(
        "https://www.google.com/maps/@46.2680508,15.1860367,794m",
      ),
    (error: unknown) =>
      error instanceof GoogleMapsParseError &&
      error.kind === "viewport-only" &&
      /samo središče zemljevida/.test(error.message),
  );
});

test("offline: short-link expansion refuses an off-Google redirect", async () => {
  const fetched: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    fetched.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { location: "https://example.com/maps/search/46.3,14.9" },
    });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      expandGoogleMapsShortLink("https://maps.app.goo.gl/example", { fetchFn }),
    (error: unknown) =>
      error instanceof GoogleMapsRedirectError &&
      error.kind === "disallowed-url" &&
      /example\.com/.test(error.message),
  );
  assert.equal(fetched.length, 1, "off-Google redirect target must never be fetched");
});

test("offline: short-link expansion follows at most three redirects", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: `https://www.google.com/maps/redirect-${calls}` },
    });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      expandGoogleMapsShortLink("https://maps.app.goo.gl/example", { fetchFn }),
    (error: unknown) =>
      error instanceof GoogleMapsRedirectError &&
      error.kind === "too-many-redirects",
  );
  assert.equal(calls, 4, "initial request plus no more than three redirects");
});