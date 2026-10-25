import test from "node:test";
import assert from "node:assert/strict";
import { auditRuleIconFallbacks } from "../lib/ruleIconAudit";

test("rule audit logs visible fallback sentences for catalogue review", () => {
  const records: Record<string, unknown>[] = [];
  const secret = "Qzxv neznano javno pravilo";
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
  assert.equal(records[0].sentence, secret);
  assert.equal(records[0].length, secret.length);
  assert.match(String(records[0].fingerprint), /^[0-9a-f]{12}$/);
});

test("legacy rules rows include tinted body sentences, not ordinary entry paragraphs", () => {
  const records: Record<string, unknown>[] = [];
  const sections = [{key:"stay",categories:[
    {id:"house",layout:"rules",items:[
      {id:"pets",tint:"#C4552E",body:"<p>Hišni ljubljenčki v objektu žal niso dovoljeni.</p>"},
      {id:"unknown",body:"<p>Qzxv &amp; blorf</p>"},
    ]},
    {id:"ordinary",layout:"text",items:[{id:"prose",body:"Qzxv ordinary paragraph"}]},
  ]}];
  assert.equal(auditRuleIconFallbacks("t","sl",sections,r=>records.push(r)),1);
  assert.equal(records[0].itemId,"unknown");
  assert.equal(records[0].sentence,"Qzxv & blorf");
});
