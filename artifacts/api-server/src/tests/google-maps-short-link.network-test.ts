import assert from "node:assert/strict";
import test from "node:test";
import {
  expandGoogleMapsShortLink,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrl,
} from "../lib/maps-link";

const SHORT_LINK = "https://maps.app.goo.gl/7TptijjPqZXsX7bw6";

test("NETWORK: Google still expands the owner short link to the expected search pin", async () => {
  let expanded: string;
  try {
    expanded = await expandGoogleMapsShortLink(SHORT_LINK);
  } catch (error) {
    if (error instanceof GoogleMapsRedirectError && error.kind === "network") {
      assert.fail(`GOOGLE NETWORK FAILURE while expanding ${SHORT_LINK}: ${error.message}`);
    }
    throw error;
  }

  assert.match(
    new URL(expanded).pathname,
    /^\/maps\/search\//,
    `GOOGLE DESTINATION CHANGED: expected /maps/search/, received ${expanded}`,
  );
  assert.deepEqual(
    parseGoogleMapsLocationUrl(expanded),
    {
      lat: 46.311167,
      lng: 14.909133,
      name: null,
      placeId: null,
      source: "search",
    },
    `PARSER LOGIC FAILURE for expanded destination ${expanded}`,
  );
});