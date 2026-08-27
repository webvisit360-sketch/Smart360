import assert from "node:assert/strict";
import test from "node:test";
import { ApplyPart5MeliPuCutoverBody } from "@workspace/api-zod";
import {
  PART5_CATEGORY_KEY_UPDATES,
  PART5_COMPILED_PAYLOAD_SHA256,
  PART5_EXPECTED_POST,
  PART5_EXPECTED_PRE,
  PART5_LEDGER_SHA256,
  PART5_MEDIA_DIMENSION_UPDATES,
  PART5_MEDIA_INSERTS,
  PART5_MEDIA_REMOVALS,
  PART5_ORDER_FLAG_UPDATES,
} from "../lib/part5MeliPuLedger";
import {
  applyPart5MeliPuCutover,
  computePart5CompiledPayloadSha256,
  part5CutoverAuditFields,
  Part5CutoverPreconditionError,
} from "../lib/part5MeliPuCutover";
import { actorStorage } from "../lib/actorContext";

test("compiled PART 5 ledger is the exact signed allowlist", () => {
  assert.equal(
    PART5_LEDGER_SHA256,
    "7121b80080a3ae2a391d169f6c48ef73edda146f87081b95969831a30df86caf",
  );
  assert.equal(
    computePart5CompiledPayloadSha256(),
    PART5_COMPILED_PAYLOAD_SHA256,
  );
  assert.equal(
    PART5_COMPILED_PAYLOAD_SHA256,
    "81a5753e839bb59b1834354546f5253334f775d7fb86dd5251825c89616a6789",
  );
  assert.equal(PART5_CATEGORY_KEY_UPDATES.length, 37);
  assert.equal(PART5_ORDER_FLAG_UPDATES.length, 9);
  assert.equal(PART5_MEDIA_DIMENSION_UPDATES.length, 131);
  assert.equal(PART5_MEDIA_INSERTS.length, 3);
  assert.equal(PART5_MEDIA_REMOVALS.length, 2);

  const ledgerLines =
    PART5_CATEGORY_KEY_UPDATES.length +
    PART5_ORDER_FLAG_UPDATES.length +
    PART5_MEDIA_DIMENSION_UPDATES.length * 2 +
    PART5_MEDIA_INSERTS.length * 13 +
    PART5_MEDIA_REMOVALS.length;
  assert.equal(ledgerLines, 349);
});

test("compiled PART 5 manifests match the approved pre/post evidence", () => {
  assert.deepEqual(PART5_EXPECTED_PRE, {
    categories: { count: 37, hash: "bd0cce5e43c91f734f8185918e23e4b7" },
    items: { count: 136, hash: "54a66a2bff47cdaaeeba54f44bd94f39" },
    media: { count: 133, hash: "87a1a47094045f81cf8c9fbe135150d0" },
  });
  assert.deepEqual(PART5_EXPECTED_POST, {
    categories: { count: 37, hash: "6ec36fdc5e276e354f6a939539a711fc" },
    items: { count: 136, hash: "dcdf0e96a1787d64fda35716a5173afa" },
    media: { count: 134, hash: "5f576ae9b973c02dc9d8a29c69c54814" },
  });
});

test("cutover body accepts only the signed ledger and target slug", () => {
  assert.equal(
    ApplyPart5MeliPuCutoverBody.safeParse({
      ledgerSha256: PART5_LEDGER_SHA256,
      confirmTenantSlug: "meli-pu",
    }).success,
    true,
  );
  assert.equal(
    ApplyPart5MeliPuCutoverBody.safeParse({
      ledgerSha256: "wrong",
      confirmTenantSlug: "meli-pu",
    }).success,
    false,
  );
  assert.equal(
    ApplyPart5MeliPuCutoverBody.safeParse({
      ledgerSha256: PART5_LEDGER_SHA256,
      confirmTenantSlug: "another-tenant",
    }).success,
    false,
  );
});

test("cutover write is locked outside a Replit production deployment", async () => {
  const previousNodeEnv = process.env["NODE_ENV"];
  const previousDeployment = process.env["REPLIT_DEPLOYMENT"];
  process.env["NODE_ENV"] = "test";
  delete process.env["REPLIT_DEPLOYMENT"];
  try {
    await assert.rejects(
      applyPart5MeliPuCutover({
        ledgerSha256: PART5_LEDGER_SHA256,
        confirmTenantSlug: "meli-pu",
      }),
      (error: unknown) =>
        error instanceof Part5CutoverPreconditionError &&
        error.message.includes("locked outside"),
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previousNodeEnv;
    if (previousDeployment === undefined) delete process.env["REPLIT_DEPLOYMENT"];
    else process.env["REPLIT_DEPLOYMENT"] = previousDeployment;
  }
});

test("cutover audit attribution is private and keeps the operator IP", () => {
  const audit = actorStorage.run(
    { kind: "owner", requestIp: "198.51.100.55" },
    () => part5CutoverAuditFields(),
  );
  assert.deepEqual(audit, {
    tenantName: null,
    detail: null,
    summary: "Smart360 je izvedel uskladitev vsebine.",
    actorType: "owner",
    actorId: null,
    actorEmail: null,
    actorLabel: "Smart360",
    requestIp: "198.51.100.55",
  });
  assert.deepEqual(part5CutoverAuditFields(), {
    tenantName: null,
    detail: null,
    summary: "Smart360 je izvedel uskladitev vsebine.",
    actorType: "system",
    actorId: null,
    actorEmail: null,
    actorLabel: "Smart360",
    requestIp: null,
  });
});