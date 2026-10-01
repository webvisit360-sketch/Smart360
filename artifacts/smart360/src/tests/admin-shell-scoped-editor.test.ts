import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../pages/admin/tenant-edit.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
const instructions = readFileSync(new URL("../../../../replit.md", import.meta.url), "utf8");

test("every reachable daily content tab mounts the real section-scoped editor", () => {
  assert.match(shell, /<TabsContent value="events">[\s\S]*?gostujočem Programu[\s\S]*?<ContentEditor[^>]*scope="events"/);
  assert.match(shell, /<TabsContent value="ponudba">[\s\S]*?<ContentEditor[^>]*scope="offer"/);
  assert.match(shell, /activeTab === 'obvestila'/);
  assert.match(shell, /tenant\.guestUiMode === "living-guide" && <button data-testid="button-open-announcements"/);
  assert.match(shell, /<TabsContent value="obvestila"><AdminTenantAnnouncements key=\{id\} tenantId=\{id\}/);
  assert.doesNotMatch(shell, /V pripravi/);
});

test("runtime announcements do not offer guide publication or refresh its draft after saving", () => {
  assert.match(shell, /activeTab !== "obvestila" && <div/);
  assert.match(shell, /event\.mutation\?\.options\?\.mutationKey\?\.\[0\] === "admin-announcements"/);
});

test("owner-only Creator is below standard navigation and has a real surface", () => {
  const creator = shell.indexOf("onClick={() => setActiveTab('kreator')}");
  assert.ok(creator > shell.indexOf("<span>Nastavitve</span>"));
  assert.ok(creator < shell.indexOf("{/* MAIN CONTENT AREA */}"));
  assert.match(shell, /\{isOwner && <TabsContent value="kreator">/);
  assert.match(shell, /<KreatorSourceList/);
});

test("scoped editor filters all section and move targets, hides cross-section trash, and uses existing section creation", () => {
  assert.match(editor, /scope\?: "events" \| "offer"/);
  assert.match(editor, /sections\.filter\(section => section\.key === scope\)/);
  assert.match(editor, /visibleSections\.flatMap/);
  assert.match(editor, /visibleSections\.map\(\(section\)/);
  assert.match(editor, /\{!scope && <TrashPanel/);
  assert.match(editor, /scope=\{scope\}[\s\S]*?onDone=\{\(\) => setAddSectionOpen\(false\)\}/);
  assert.match(editor, /const trimmedKey = scope \?\?/);
  assert.match(editor, /await createSection\(tenantId/);
  assert.match(editor, /const canCreateSection = operatorPlaceCreation && \(!scope \|\| visibleSections\.length === 0\)/);
  assert.match(editor, /if \(!canCreateSection\) setAddSectionOpen\(false\)/);
  assert.match(instructions, /nedokončane admin strani nikoli ne pošiljaj kot dosegljive navigacijske izbire/);
});