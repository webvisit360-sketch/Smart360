import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  extractVirtualTourUrl,
  VirtualTourUrlError,
} from "../lib/virtualTour";

const KUULA_URL =
  "https://kuula.co/share/collection/7TwMg?logo=1&info=0&fs=0";

describe("virtual tour URL extraction", () => {
  test("plain URL, iframe and script data attribute resolve to the same URL", () => {
    const iframe =
      '<iframe allowfullscreen src="https://kuula.co/share/collection/7TwMg?logo=1&amp;info=0&amp;fs=0"></iframe>';
    const script =
      '<script src="https://static.kuula.io/embed.js" data-kuula="https://kuula.co/share/collection/7TwMg?logo=1&amp;info=0&amp;fs=0"></script>';

    assert.equal(extractVirtualTourUrl(KUULA_URL), KUULA_URL);
    assert.equal(extractVirtualTourUrl(iframe), KUULA_URL);
    assert.equal(extractVirtualTourUrl(script), KUULA_URL);
  });

  test("blank input clears the configured tour", () => {
    assert.equal(extractVirtualTourUrl("  "), null);
    assert.equal(extractVirtualTourUrl(null), null);
  });

  test("javascript iframe source is rejected", () => {
    assert.throws(
      () =>
        extractVirtualTourUrl(
          '<iframe src="javascript:alert(1)"></iframe>',
        ),
      VirtualTourUrlError,
    );
  });

  test("unknown providers are rejected with the allowlist", () => {
    assert.throws(
      () => extractVirtualTourUrl("https://example.com/tour"),
      /Kuula.*Matterport.*Momento360.*Google Maps.*YouTube.*Vimeo/,
    );
  });

  test("HTTP is rejected and URL credentials are removed", () => {
    assert.throws(
      () => extractVirtualTourUrl("http://kuula.co/share/collection/7TwMg"),
      /HTTPS/,
    );
    assert.equal(
      extractVirtualTourUrl(
        "https://guest:secret@kuula.co/share/collection/7TwMg",
      ),
      "https://kuula.co/share/collection/7TwMg",
    );
  });

  test("path-restricted providers only allow embed URLs", () => {
    assert.equal(
      extractVirtualTourUrl(
        "https://www.google.com/maps/embed?pb=allowed",
      ),
      "https://www.google.com/maps/embed?pb=allowed",
    );
    assert.throws(
      () => extractVirtualTourUrl("https://www.google.com/search?q=maps"),
      /ni dovoljen/,
    );
    assert.throws(
      () => extractVirtualTourUrl("https://www.google.com/maps/embed-not-valid"),
      /ni dovoljen/,
    );
    assert.equal(
      extractVirtualTourUrl("https://www.youtube.com/embed/abc123"),
      "https://www.youtube.com/embed/abc123",
    );
    assert.throws(
      () => extractVirtualTourUrl("https://www.youtube.com/watch?v=abc123"),
      /ni dovoljen/,
    );
    assert.throws(
      () => extractVirtualTourUrl("https://www.youtube.com/embed-not-valid"),
      /ni dovoljen/,
    );
  });
});