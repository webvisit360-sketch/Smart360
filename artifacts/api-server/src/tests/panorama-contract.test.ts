import assert from "node:assert/strict";
import test from "node:test";
import { AddItemMediaBody, UpdateMediaBody, UpdateMediaResponse } from "@workspace/api-zod";

test("panorama marking round-trips through media input, update and guest-compatible response", () => {
  assert.equal(AddItemMediaBody.parse({ url: "/api/storage/img/test/panorama.jpg", isPanorama: true }).isPanorama, true);
  for (const isPanorama of [true, false]) {
    assert.deepEqual(UpdateMediaBody.parse({ isPanorama }), { isPanorama });
    const result = UpdateMediaResponse.parse({
      id: "photo", url: "/api/storage/img/test/panorama.jpg", position: 0,
      kind: "image", isPanorama, width: 3000, height: 750,
      provisional: false, attributionAuthor: null, attributionLicense: null, attributionSourceUrl: null,
    });
    assert.equal(result.isPanorama, isPanorama);
  }
});

test("omitted panorama flag preserves legacy media and rejects non-boolean flags", () => {
  assert.deepEqual(UpdateMediaBody.parse({ focusX: 40 }), { focusX: 40 });
  for (const isPanorama of ["true", "false", 1, null]) {
    assert.equal(UpdateMediaBody.safeParse({ isPanorama }).success, false);
  }
});
