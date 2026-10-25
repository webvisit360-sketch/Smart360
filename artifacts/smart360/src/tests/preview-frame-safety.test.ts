import assert from "node:assert/strict";
import test from "node:test";
import { isExternalPreviewLink, withPreviewFrame } from "../lib/preview-frame-safety";

const origin = "https://guide.test";
test("frame guards include getters, foreign origins, callback access and missing documents", () => {
  const blocked = () => { throw new DOMException("Blocked a frame", "SecurityError"); };
  const frames = [
    null,
    { get contentWindow() { return blocked(); } },
    { contentWindow: { get location() { return blocked(); } } },
    { contentWindow: { location: { origin: "https://google.com" } } },
    { contentWindow: { location: { origin } }, contentDocument: null },
  ];
  for (const frame of frames) {
    assert.equal(withPreviewFrame(frame as HTMLIFrameElement | null, origin, () => assert.fail("must not access foreign frame")), undefined);
  }
  const doc = {} as Document;
  const frame = { contentWindow: { location: { origin }, document: doc }, contentDocument: doc } as unknown as HTMLIFrameElement;
  assert.equal(withPreviewFrame(frame, origin, () => 42), 42);
  assert.equal(withPreviewFrame(frame, origin, blocked), undefined);
  const inherited = { contentWindow: { location: { origin: "null", protocol: "about:" }, origin, document: doc }, contentDocument: doc } as unknown as HTMLIFrameElement;
  assert.equal(withPreviewFrame(inherited, origin, () => true), true);
});

test("cleanup rechecks current origin before reading fetch after navigation", () => {
  const doc = {} as Document;
  let foreign = false;
  let fetchReads = 0;
  const win = {
    get location() { if (foreign) throw new DOMException("Blocked", "SecurityError"); return { origin }; },
    document: doc,
    get fetch() { fetchReads++; return fetch; },
  };
  const frame = { contentWindow: win, contentDocument: doc } as unknown as HTMLIFrameElement;
  const cleanup = withPreviewFrame(frame, origin, () => () => withPreviewFrame(frame, origin, (w) => w.fetch));
  foreign = true;
  assert.doesNotThrow(() => cleanup?.());
  assert.equal(fetchReads, 0);
});

test("external preview targets include maps, phone, mail and Kuula but not guest routes", () => {
  for (const href of ["https://google.com/maps?q=beach", "tel:+386123456", "mailto:host@example.com", "https://kuula.co/share/collection/abc", "sms:+386123", "viber://chat?number=123", "whatsapp://send?text=hello", "//external.test/path"]) {
    assert.equal(isExternalPreviewLink(href, origin + "/guest"), true, href);
  }
  for (const href of ["/guest/c/123", "#photos", origin + "/guest", "javascript:alert(1)"]) {
    assert.equal(isExternalPreviewLink(href, origin + "/guest"), false, href);
  }
});
