import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const tenant = readFileSync(new URL("../pages/admin/tenant-edit.tsx", import.meta.url), "utf8");
const content = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../components/admin/translations-editor.tsx", import.meta.url), "utf8");

test("concierge retains publication handoff; self-service uses the shared publication action", () => {
  assert.match(tenant, /\{permissions\.canPublish && <Button[\s\S]*?onClick=\{handlePublish\}/);
  assert.match(tenant, /\{!permissions\.canPublish \? \(/);
  assert.match(tenant, /Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene\./);
  assert.match(tenant, /\{isOwner && <div className="flex items-center gap-2 pt-4">\s*<button[\s\S]*?Objavljeno \(vidno gostom\)/);
  for (const value of ["appearance", "guide"]) {
    assert.match(tenant, new RegExp(`\\{permissions\\.canEditAppearance && <TabsContent value="${value}"`));
  }
  assert.match(tenant, /\{isOwner && <Card data-testid="card-guest-ui-mode">/);
  assert.match(tenant, /\{permissions\.canEditIdentity && <div className="space-y-2 col-span-2">\s*<Label>Google Maps povezava/);
  assert.match(tenant, /<ContentEditor sections=\{tenant\.sections as any\[\] \?\? \[\]\} tenantId=\{tenant\.id\} operatorPlaceCreation=\{permissions\.canManageContent\}/);
});

test("content capabilities gate structural controls/restoration and import/export, never host hard purge", () => {
  assert.match(content, /\{operatorPlaceCreation && <button[\s\S]*?Uredi sekcijo/);
  assert.match(content, /onEdit=\{operatorPlaceCreation \? \(\) => setEditOpen\(true\) : undefined\}/);
  assert.match(content, /\{\(canCreateSection \|\| addSectionOpen\) && <EditDialog open=\{addSectionOpen\}/);
  assert.match(content, /\{\(operatorPlaceCreation \|\| addCatOpen\) && <EditDialog open=\{addCatOpen\}/);
  assert.match(content, /<fieldset disabled=\{!allowed\}/);
  assert.match(content, /\{permissions\.canManageContent && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"[\s\S]*?onRestoreSection/);
  assert.match(content, /\{permissions\.canManageContent && <Button\s+variant="ghost"[\s\S]*?onRestoreCategory/);
  assert.match(content, /\{permissions\.canPurge && \([\s\S]*?onPurgeCategory/);
  assert.match(content, /\{permissions\.canPurge && \([\s\S]*?onPurgeItem/);
  assert.match(content, /onClick=\{\(\) => onRestoreItem\(it\.id\)\}/);
  assert.match(content, /<ItemRow key=\{item\.id\}/);
  assert.match(content, /<ItemDialog mode="create"/);
  assert.match(content, /mode === "create" && operatorPlaceCreation && \(sectionKey === "explore" \|\| sectionKey === "services"\)/);
  assert.match(content, /operatorPlaceCreation=\{operatorPlaceCreation\} onDone=\{\(\) => setAddOpen\(false\)\}/);
  assert.match(translations, /const list = entries \?\? \[\]/);
  assert.match(translations, /onSave=\{\(value\) =>\s*upsert\.mutate\(/);
  assert.match(translations, /\{permissions\.canManageContent && <div className="ml-auto flex items-center gap-2">/);
  assert.match(translations, /<Download[^>]*\/> Izvozi JSON/);
  assert.match(translations, /<Upload[^>]*\/>}\s*Uvozi JSON/);
});

test("capabilities expose self-service settings but keep protected operator fields and daily work unchanged", () => {
  for (const label of ["Ime namestitve", "Podnaslov"]) {
    assert.match(tenant, new RegExp(`\\{permissions\\.canEditIdentity && <div className="[^"]+">\\s*<Label>${label}`));
  }
  assert.match(tenant, /\{permissions\.canEditAppearance && <div className="space-y-2">\s*<Label>URL naslovnične/);
  assert.match(tenant, /\{permissions\.canManageContent && <div className="col-span-2 space-y-2">\s*<Label>Virtualni sprehod/);
  for (const label of ["Google Maps povezava", "Latitude \\(zemljepisna širina\\)", "Longitude \\(zemljepisna dolžina\\)", "Nadomestna poizvedba za zemljevid \\(Map Query\\)"]) {
    assert.match(tenant, new RegExp(`\\{permissions\\.canEditIdentity && <div className="[^"]+">\\s*<Label>${label}`));
  }
  assert.match(tenant, /\{permissions\.canEditAppearance && <TabsContent value="appearance"/);
  assert.match(tenant, /\{permissions\.canEditAppearance && <TabsContent value="guide"/);
  assert.match(tenant, /\{isOwner && <div className="col-span-2">\s*<SlugField/);
  assert.match(tenant, /\{isOwner && <div className="space-y-2">\s*<Label>Kvota za medije/);
  assert.match(tenant, /\{isOwner && <Card>\s*<CardHeader>\s*<CardTitle>Naročnina/);
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