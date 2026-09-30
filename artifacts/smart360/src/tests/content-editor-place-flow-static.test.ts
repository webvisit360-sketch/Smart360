import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../components/admin/content-editor.tsx", import.meta.url),
  "utf8",
);

test("operator OKOLICA create uses place search; host uses the ordinary item form", () => {
  assert.match(source, /mode === "create" && operatorPlaceCreation && \(sectionKey === "explore" \|\| sectionKey === "services"\)/);
  assert.match(source, /return <OkolicaPlaceCreate/);
  assert.match(source, /operatorPlaceCreation=\{operatorPlaceCreation\} onDone=\{\(\) => setAddOpen\(false\)\}/);
  assert.match(source, /await createItem\(categoryId,/);
  assert.match(source, /mode === "edit"/);
});

test("search candidates expose duplicate state and manual fallback", () => {
  assert.match(source, /že v vodniku/);
  assert.match(source, /candidate\.duplicateMatch && candidate\.duplicateMatch\.kind !== "pending"/);
  assert.match(source, /setDuplicateNotice\(candidate\.duplicateMatch\)/);
  assert.match(source, /setSelected\(\{ osmType: candidate\.osmType, osmId: candidate\.osmId \}\)/);
  assert.match(source, /Ročno označi na zemljevidu/);
  assert.match(source, /locationText\.trim\(\)/);
});

test("ordinary edit items preserve machine distance and coordinate review", () => {
  assert.match(source, /creatorStatus\.data\?\.activeMaterialization/);
  assert.match(source, /Preračunaj \(OSRM\)/);
  assert.match(source, /\.\.\.\(!machineOwnedDistance \? \{ distanceMeters: distanceValue \} : \{\}\)/);
  assert.match(source, /data-testid="entry-editor-pin"/);
  assert.match(source, /onClick=\{\(\) => void savePin\(\)\}/);
  assert.match(source, /legacy \/ brez shranjenih koordinat/);
  assert.match(source, /Počisti/);
  assert.match(source, /creatorStatusReady/);
  assert.match(source, /disabled=\{busy \|\| !creatorStatusReady\}/);
});