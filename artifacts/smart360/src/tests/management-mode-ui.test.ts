import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const setting = readFileSync(
  new URL("../components/admin/management-mode-setting.tsx", import.meta.url),
  "utf8",
);
const hostPanel = readFileSync(
  new URL("../components/admin/host-invite-panel.tsx", import.meta.url),
  "utf8",
);
const tenantEdit = readFileSync(
  new URL("../pages/admin/tenant-edit.tsx", import.meta.url),
  "utf8",
);

test("management mode uses its dedicated generated mutation and exact labels", () => {
  assert.match(setting, /useUpdateTenantManagementMode/);
  assert.match(setting, /Gostitelj ureja sam/);
  assert.match(setting, /Ureja Smart360/);
  assert.match(setting, /save-management-mode/);
  assert.match(setting, /aktivne seje bodo končane/);
  assert.doesNotMatch(setting, /useUpdateTenant\W/);
});

test("management mode is operator-only and remains outside the general autosave form", () => {
  assert.match(tenantEdit, /\{isOwner && \(\s*<ManagementModeSetting/);
  assert.match(tenantEdit, /<HostInvitePanel tenantId=\{id\} managementMode=\{managementMode\}/);
  assert.doesNotMatch(tenantEdit, /setFormData\([^)]*managementMode/);
});

test("concierge hides access controls but keeps welcome sending and standalone history", () => {
  assert.match(hostPanel, /managementMode === "concierge"/);
  assert.match(hostPanel, /data-testid="send-concierge-welcome"/);
  assert.match(hostPanel, /data-testid="host-access-controls"/);
  assert.match(hostPanel, /getAdminTenantHostAccount/);
  assert.match(hostPanel, /history \?\? accountData\?\.inviteHistory/);
  assert.match(hostPanel, /dobrodošlica brez dostopa/);
  assert.match(hostPanel, /row-welcome-history-/);
});