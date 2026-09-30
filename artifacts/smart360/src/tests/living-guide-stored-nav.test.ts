import assert from "node:assert/strict";
import test from "node:test";
import { resolveLivingGuideNav, type NavItem } from "../pages/living-guide/living-guide-nav-resolver";

const all = new Set<NavItem>(["home", "stay", "offer", "explore", "program", "messages"]);
const defaults = ["home", "stay", "offer", "explore", "messages"];

test("valid stored order is respected without mutating its array", () => {
  const stored: NavItem[] = ["home", "messages", "program", "explore", "stay"];
  assert.deepEqual(resolveLivingGuideNav(stored, all, false).resolved, stored);
  assert.deepEqual(stored, ["home", "messages", "program", "explore", "stay"]);
});

test("missing and invalid stored values fall back to the entire fixed default", () => {
  for (const value of [null, undefined, [], "home", {}, ["home", "stay"],
    ["home", "stay", "stay", "explore", "messages"],
    ["stay", "home", "offer", "explore", "messages"],
    ["home", "stay", "unknown", "explore", "messages"],
    ["home", "stay", null, "explore", "messages"],
    [...defaults, "program"]]) {
    assert.deepEqual(resolveLivingGuideNav(value as any, all, false).resolved, defaults);
  }
});

test("valid stored Program cannot bypass guest occurrence visibility", () => {
  const features = new Set(all);
  features.delete("program");
  const result = resolveLivingGuideNav(["home", "program", "messages", "stay", "explore"], features, false);
  assert.deepEqual(result.resolved, ["home", "messages", "stay", "explore", "offer"]);
});

test("no stored value preserves previous default for every feature combination", () => {
  const possible = [...all];
  for (let mask = 0; mask < 64; mask++) {
    const features = new Set(possible.filter((_, i) => mask & (1 << i)));
    const available = possible.filter(key => features.has(key) || key === "home" || key === "messages");
    const previous = defaults.filter(key => available.includes(key as NavItem));
    for (const key of available) {
      if (previous.length < 5 && !previous.includes(key)) previous.push(key);
    }
    assert.deepEqual(resolveLivingGuideNav(null, features, false).resolved, previous);
    assert.deepEqual(resolveLivingGuideNav(undefined, features, false).resolved, previous);
  }
});