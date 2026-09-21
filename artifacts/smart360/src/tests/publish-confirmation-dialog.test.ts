import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../components/admin/publish-confirmation-dialog.tsx", import.meta.url),
  "utf8",
);
const tenantEdit = readFileSync(
  new URL("../pages/admin/tenant-edit.tsx", import.meta.url),
  "utf8",
);

test("publish confirmation presents exact Slovenian groups in a mobile scroll area", () => {
  assert.match(source, /Ta objava vsebuje \$\{preview\.total\} sprememb/);
  assert.match(source, /title="Novo:"/);
  assert.match(source, /title="Spremenjeno:"/);
  assert.match(source, /title="Izbrisano ali odstranjeno:"/);
  assert.match(source, /#DD9A2B/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /w-\[calc\(100%-1\.5rem\)\]/);
  assert.match(source, /\bPrekliči\b/);
  assert.match(source, /\bObjavi\b/);
});

test("tenant publish flow previews first and publishes only with the returned token", () => {
  assert.match(tenantEdit, /usePreviewTenantPublication/);
  assert.match(tenantEdit, /publishToken:\s*publicationPreview\.token/);
  assert.match(tenantEdit, /publishNow:\s*true/);
  assert.match(tenantEdit, /isPublished:\s*true/);
  assert.match(tenantEdit, /<PublishConfirmationDialog/);
});