import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { canPreviewTenant } from "../lib/tenantPreview";

const request = (preview?: string) => ({ query: { preview }, cookies: {} }) as unknown as Request;

test("draft preview requires explicit preview flag and a resolved tenant", async () => {
  for (const flag of [undefined, "false", "0", "yes"]) {
    assert.equal(await canPreviewTenant(request(flag), "tenant"), false);
  }
  assert.equal(await canPreviewTenant(request("1"), undefined), false);
});

test("anonymous callers cannot read drafts with either supported preview flag", async () => {
  for (const flag of ["1", "true"]) {
    assert.equal(await canPreviewTenant(request(flag), "tenant"), false);
  }
});
