import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../components/admin/content-editor.tsx", import.meta.url),
  "utf8",
);

test("OKOLICA create uses search while edit keeps the ordinary form", () => {
  assert.match(source, /mode === "create" && \(sectionKey === "explore" \|\| sectionKey === "services"\)/);
  assert.match(source, /return <OkolicaPlaceCreate/);
  assert.match(source, /mode === "edit"/);
});

test("search candidates expose duplicate state and manual fallback", () => {
  assert.match(source, /že v vodniku/);
  assert.match(source, /disabled=\{candidate\.duplicate \|\| busy\}/);
  assert.match(source, /Ročno označi na zemljevidu/);
  assert.match(source, /locationText\.trim\(\)/);
});