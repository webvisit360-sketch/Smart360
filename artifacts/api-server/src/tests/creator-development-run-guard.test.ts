import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCreatorDevelopmentRunEnvironment,
  assertCreatorLjubnoTargetTenantId,
  CREATOR_DEVELOPMENT_RUN_CONFIRMATION,
  CREATOR_LJUBNO_PROTECTED_TENANT_IDS,
} from "../lib/creatorDevelopmentRunGuard";

const valid = {
  NODE_ENV: "development",
  REPLIT_DEV_DOMAIN: "development.example",
  CONFIRM_CREATOR_DEVELOPMENT_RUN: CREATOR_DEVELOPMENT_RUN_CONFIRMATION,
};

test("Creator source data scripts require explicit development confirmation", () => {
  assert.doesNotThrow(() => assertCreatorDevelopmentRunEnvironment(valid));
  for (const patch of [
    { NODE_ENV: "production" },
    { REPLIT_DEV_DOMAIN: "" },
    { CONFIRM_CREATOR_DEVELOPMENT_RUN: "wrong" },
    { REPLIT_DEPLOYMENT: "1" },
    { REPLIT_DEPLOYMENT_ID: "deployment-id" },
  ]) {
    assert.throws(
      () => assertCreatorDevelopmentRunEnvironment({ ...valid, ...patch }),
      /locked to the confirmed Replit development workspace/,
    );
  }
});

test("Ljubno source data scripts reject every protected tenant before lookup", () => {
  for (const tenantId of CREATOR_LJUBNO_PROTECTED_TENANT_IDS) {
    assert.throws(
      () => assertCreatorLjubnoTargetTenantId(tenantId),
      /outside the Ljubno source-run boundary/,
    );
  }
  assert.doesNotThrow(() => assertCreatorLjubnoTargetTenantId("03e96996-b5e3-4457-915b-d012142ed416"));
});