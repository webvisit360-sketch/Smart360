import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const tenant = readFileSync(new URL("../pages/admin/tenant-edit.tsx", import.meta.url), "utf8");
const content = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../components/admin/translations-editor.tsx", import.meta.url), "utf8");

test("hosts see the exact publication handoff rather than an action; operator controls remain gated", () => {
  assert.match(tenant, /\{isOwner && <Button\s+onClick=\{handlePublish\}/);
  assert.match(tenant, /Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene\./);
  assert.match(tenant, /\{isOwner && <div className="flex items-center gap-2 pt-4">\s*<button[\s\S]*?Objavljeno \(vidno gostom\)/);
  for (const value of ["appearance", "guide"]) {
    assert.match(tenant, new RegExp(`\\{isOwner && <TabsContent value="${value}"`));
  }
  assert.match(tenant, /\{isOwner && <Card data-testid="card-guest-ui-mode">/);
  assert.match(tenant, /\{isOwner && <div className="space-y-2 col-span-2">\s*<Label>Google Maps povezava/);
  assert.match(tenant, /<ContentEditor sections=\{tenant\.sections as any\[\] \?\? \[\]\} tenantId=\{tenant\.id\} operatorPlaceCreation=\{isOwner\}/);
});

test("hosts can edit entries but not structural controls or restore structural trash", () => {
  assert.match(content, /\{operatorPlaceCreation && <button[\s\S]*?Uredi sekcijo/);
  assert.match(content, /onEdit=\{operatorPlaceCreation \? \(\) => setEditOpen\(true\) : undefined\}/);
  assert.match(content, /\{operatorPlaceCreation && <EditDialog open=\{addSectionOpen\}/);
  assert.match(content, /\{operatorPlaceCreation && <EditDialog open=\{addCatOpen\}/);
  assert.match(content, /\{isOwner && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"[\s\S]*?onRestoreSection/);
  assert.match(content, /\{isOwner && <Button\s+variant="ghost"[\s\S]*?onRestoreCategory/);
  assert.match(content, /onClick=\{\(\) => onRestoreItem\(it\.id\)\}/);
  assert.match(content, /<ItemRow key=\{item\.id\}/);
  assert.match(content, /<ItemDialog mode="create"/);
  assert.match(content, /mode === "create" && operatorPlaceCreation && \(sectionKey === "explore" \|\| sectionKey === "services"\)/);
  assert.match(content, /operatorPlaceCreation=\{operatorPlaceCreation\} onDone=\{\(\) => setAddOpen\(false\)\}/);
  assert.match(translations, /const list = entries \?\? \[\]/);
  assert.match(translations, /onSave=\{\(value\) =>\s*upsert\.mutate\(/);
  assert.match(translations, /\{isOwner && <div className="ml-auto flex items-center gap-2">/);
  assert.match(translations, /<Download[^>]*\/> Izvozi JSON/);
  assert.match(translations, /<Upload[^>]*\/>}\s*Uvozi JSON/);
});

test("host UI hides every newly operator-only tenant field, while retaining entry and daily-work controls", () => {
  for (const label of ["Ime namestitve", "Podnaslov", "URL naslovnične \\(Hero\\) fotografije", "Virtualni sprehod"]) {
    assert.match(tenant, new RegExp(`\\{isOwner && <div className="[^"]+">\\s*<Label>${label}`));
  }
  for (const label of ["Google Maps povezava", "Latitude \\(zemljepisna širina\\)", "Longitude \\(zemljepisna dolžina\\)", "Nadomestna poizvedba za zemljevid \\(Map Query\\)"]) {
    assert.match(tenant, new RegExp(`\\{isOwner && <div className="[^"]+">\\s*<Label>${label}`));
  }
  assert.match(tenant, /\{isOwner && <TabsContent value="appearance"/);
  assert.match(tenant, /\{isOwner && <TabsContent value="guide"/);
  assert.match(tenant, /\{isOwner && <Card data-testid="card-guest-ui-mode"/);
  assert.match(tenant, /\{isOwner && <div className="flex items-center gap-2 pt-4">/);
  assert.match(tenant, /<Label>WiFi omrežje \(SSID\)<\/Label>/);
  assert.match(tenant, /<Label>WiFi geslo<\/Label>/);
  assert.match(tenant, /<Label>Šifriranje<\/Label>/);
  for (const label of ["Telefon", "WhatsApp", "Viber", "Instagram uporabniško ime", "E-pošta"]) {
    assert.match(tenant, new RegExp(`<Label>${label}</Label>`));
  }
  assert.match(tenant, /<AdminTenantOrders tenantId=\{id\}/);
  assert.match(tenant, /<AdminTenantMessages tenantId=\{id\}/);
  assert.match(tenant, /<DistanceReview tenantId=\{id\}/);
  assert.match(content, /<ItemRow key=\{item\.id\}/);
  assert.match(content, /const canAdd = true/);
  assert.match(content, /await createItem\(categoryId,/);
  assert.match(content, /onClick=\{\(\) => onRestoreItem\(it\.id\)\}/);
  assert.match(content, /<ItemMediaEditor/);
  assert.match(content, /<GpxRouteEditor/);
  assert.match(translations, /const list = entries \?\? \[\]/);
  assert.match(translations, /onSave=\{\(value\) =>\s*upsert\.mutate\(/);
});