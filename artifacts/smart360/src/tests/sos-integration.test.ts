import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const guide = new URL("../pages/living-guide/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, guide), "utf8");

test("SOS card is prepended, preserving the original Help contacts and heading", () => {
  const shell = read("LivingGuideGuestShell.tsx");
  const help = shell.slice(shell.indexOf("function EmergencyHelpTemplate("), shell.indexOf("function OrderDock("));
  assert.ok(help.indexOf("<h1>") < help.indexOf("<SosCard"));
  assert.ok(help.indexOf("<SosCard") < help.indexOf('className="lg2-emergency-contacts"'));
  assert.match(help, /items\.map/);
  assert.match(help, /href=\{`tel:\$\{item\.phone\}`\}/);
  assert.doesNotMatch(help, /tourRecordingEnabled|sosEnabled|featureFlag/);
});

test("SOS is a separate body portal above fullscreen tours, not a route replacement", () => {
  const shell = read("LivingGuideGuestShell.tsx");
  assert.match(shell, /const openSos = useCallback\(\(\) => setShowSos\(true\), \[\]\)/);
  assert.match(shell, /showSos && createPortal\([\s\S]*?<SosView[\s\S]*?document\.body/);
  assert.match(shell, /if \(showSos\) return; \/\/ SOS owns Escape/);
  const css = read("living-guide-guest.css");
  assert.match(css, /\.s360-sos-layer[\s\S]*?z-index: 2147483100/);
  assert.match(read("living-guide-gpx.css"), /\.s360-gpx-full \{ position: fixed; inset: 0; z-index: 2147483000/);
});

test("shared RouteMap exposes SOS for active GPX and free recording without modifying their hooks", () => {
  const map = read("living-guide-gpx.tsx");
  assert.equal((map.match(/tourActive && sos && <div className="s360-tour-sos-control">/g) ?? []).length, 2);
  assert.match(map, /e\.key === "Escape" && !sosOpenRef\.current/);
  assert.match(read("living-guide-free-tour.tsx"), /<RouteMap[\s\S]*?freeMode[\s\S]*?tourActive=\{tourActive\}/);
  assert.doesNotMatch(read("living-guide-sos-context.ts"), /\b(latitude|longitude|fix|localStorage|fetch|sendBeacon)\s*[:(]/);
});

test("guest Living Guide non-emergency styling no longer uses the old red", () => {
  for (const file of readdirSync(fileURLToPath(guide))) {
    if (!/\.(css|tsx?)$/.test(file)) continue;
    const source = read(file);
    assert.doesNotMatch(source, /#D93A2B|#DC2626|#EF4444|#B42318|(?:text|bg|border)-red-\d+/i, file);
  }
  assert.match(read("living-guide-guest.css"), /\.lg2-error-text \{\s*color: #DD9A2B/);
  assert.match(read("living-guide-gpx.css"), /\.s360-tour-error.*?color: #DD9A2B/);
});