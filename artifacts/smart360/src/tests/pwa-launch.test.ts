import { test } from "node:test";
import assert from "node:assert/strict";
import { createPwaLaunchPolicy, PWA_RESUME_THRESHOLD_MS } from "../lib/pwa-launch";
import { hasActiveTourView, registerActiveTourView } from "../lib/active-tour-views";

test("mounted GPS owners survive passive launch presentation, isolated by tenant", () => {
  const a=registerActiveTourView("one/free-tour");
  const b=registerActiveTourView("one/free-tour");
  assert.equal(hasActiveTourView("one"),true);
  assert.equal(hasActiveTourView("two"),false);
  a(); assert.equal(hasActiveTourView("one"),true);
  b(); assert.equal(hasActiveTourView("one"),false);
});

test("installed cold launch, fresh install and process restart request a fresh landing", () => {
  let resets = 0;
  for (let i=0;i<3;i++) {
    const policy = createPwaLaunchPolicy(() => resets++);
    assert.equal(policy.show(), true);
    assert.equal(policy.show(), false);
  }
  assert.equal(resets,3);
});
test("short background retains route; threshold and long suspension reset", () => {
  let time=1000, resets=0;
  const p=createPwaLaunchPolicy(()=>resets++,()=>time);
  p.show();
  for (const [delay, expected] of [[29999,false],[30000,true],[900000,true]] as const) {
    p.hide(); time+=delay; assert.equal(p.show(),expected);
  }
  assert.equal(PWA_RESUME_THRESHOLD_MS,30000);
  assert.equal(resets,3);
});
test("pagehide does not shorten a prior visibility suspension; persisted pageshow is deduplicated", () => {
  let time=0, resets=0;
  const p=createPwaLaunchPolicy(()=>resets++,()=>time);
  p.show(); p.hide(); time=29999; p.hide(); time=30000;
  assert.equal(p.show(true),true);
  assert.equal(p.show(),false);
  assert.equal(p.show(true),false);
  assert.equal(resets,2);
});
test("clock rollback resets conservatively; foreground in-app navigation does not", () => {
  let time=1000, resets=0;
  const p=createPwaLaunchPolicy(()=>resets++,()=>time);
  p.show(); p.hide(); time=500; assert.equal(p.show(),true);
  for (let i=0;i<20;i++) assert.equal(p.show(),false);
  assert.equal(resets,2);
});
test("BFCache restore can recover even if the OS omitted the hide notification", () => {
  let time=0, resets=0;
  const p=createPwaLaunchPolicy(()=>resets++,()=>time);
  p.show(); time=60000;
  assert.equal(p.show(true),true);
  assert.equal(p.show(true),false);
  assert.equal(resets,2);
});
