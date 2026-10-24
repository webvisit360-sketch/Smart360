import test from "node:test";
import assert from "node:assert/strict";
import { auditCategoryIconFallbacks } from "../lib/categoryIconAudit";

test("fallback audit logs every visible unknown category, not matches or explicit overrides", () => {
  const records: Record<string, unknown>[] = [];
  const categories = [
    { id:"police", label:"Policijska pisarna", items:[{}] },
    { id:"unknown", label:"Qzxv", items:[{}] },
    { id:"manual", label:"Qzxv", icon:"catalog:potovanja", items:[{}] },
    { id:"hidden", label:"Qzxv", isVisible:false, items:[{}] },
    { id:"empty", label:"Qzxv", items:[] },
  ];
  for (let i=0; i<2; i++) assert.equal(auditCategoryIconFallbacks("test","sl",[{key:"explore",categories}], r => records.push(r)),1);
  assert.equal(records.length,2);
  assert.equal(records[0].categoryId,"unknown");
  assert.equal(records[0].fallback,"pin");
  const offer: Record<string,unknown>[] = [];
  auditCategoryIconFallbacks("test","en",[{key:"offer",categories:[{id:"unknown",label:"Qzxv",items:[{}]}]}],r=>offer.push(r));
  assert.equal(offer[0].fallback,"cart");
});
