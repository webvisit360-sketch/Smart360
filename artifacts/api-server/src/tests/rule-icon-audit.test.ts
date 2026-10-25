import test from "node:test";
import assert from "node:assert/strict";
import { auditRuleIconFallbacks } from "../lib/ruleIconAudit";

test("rule audit logs only visible fallback bullets, never raw text", () => {
  const records: Record<string, unknown>[] = [];
  const secret = "Qzxv geslo 1234 tajno";
  const sections = [{ key: "stay", categories: [
    { id: "rules", items: [
      { id: "i1", bullets: ["Kajenje je strogo prepovedano.", secret] },
      { id: "i2", body: "- Please save water.\n- Blorf snark" },
      { id: "hidden", isVisible: false, bullets: ["Qzxv"] },
    ] },
    { id: "off", isVisible: false, items: [{ id: "i3", bullets: ["Qzxv"] }] },
  ] }];
  assert.equal(auditRuleIconFallbacks("t", "sl", sections, (r) => records.push(r)), 2);
  assert.deepEqual(records.map((r) => [r.itemId, r.bulletIndex, r.fallback]),
    [["i1", 1, "rule:privzeto-pravilo"], ["i2", 1, "rule:privzeto-pravilo"]]);
  assert.ok(!JSON.stringify(records).includes("geslo"));
  assert.equal(records[0].length, secret.length);
  assert.match(String(records[0].fingerprint), /^[0-9a-f]{12}$/);
});
