import assert from "node:assert/strict";
import test from "node:test";
import {
  expandGoogleMapsShortLink,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrl,
} from "../lib/maps-link";

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

test("offline: @ viewport alone is always rejected", () => {
  assert.equal(
    parseGoogleMapsLocationUrl(
      "https://www.google.com/maps/place/Unsafe/@46.3114597,14.9067248,794m",
    ),
    null,
  );
});

test("offline: short-link expansion refuses an off-Google redirect", async () => {
  const fetchFn = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/maps/search/46.3,14.9" },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      expandGoogleMapsShortLink("https://maps.app.goo.gl/example", { fetchFn }),
    (error: unknown) =>
      error instanceof GoogleMapsRedirectError &&
      error.kind === "disallowed-url" &&
      /example\.com/.test(error.message),
  );
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