import assert from "node:assert/strict";
import { test } from "node:test";
import { captureGuestInstallPrompt } from "../pages/guest/guest-install";

test("early guest prompt capture suppresses default only for canonical guest documents", () => {
  const handlers = new Map<string, (event: { preventDefault: () => void }) => void>();
  const location = { pathname: "/alpine-lodge/", search: "" };
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  Object.assign(globalThis, {
    window: { location, addEventListener: (name: string, handler: (event: { preventDefault: () => void }) => void) => handlers.set(name, handler) },
    document: { querySelector: () => ({ href: "https://example.test/api/public/tenants/alpine-lodge/manifest.webmanifest" }) },
  });
  try {
    captureGuestInstallPrompt();
    let prevented = false;
    handlers.get("beforeinstallprompt")!({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    location.pathname = "/admin/";
    prevented = false;
    handlers.get("beforeinstallprompt")!({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false);
    location.pathname = "/alpine-lodge/";
    location.search = "?preview=1";
    handlers.get("beforeinstallprompt")!({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false);
  } finally {
    Object.assign(globalThis, { window: oldWindow, document: oldDocument });
  }
});