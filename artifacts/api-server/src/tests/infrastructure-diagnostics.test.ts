import assert from "node:assert/strict";
import test from "node:test";
import {
  safeDatabaseErrorDiagnostic,
  safeRequestId,
} from "../lib/infrastructureDiagnostics";

test("database diagnostics expose only safe SQLSTATE code and class", () => {
  const sensitive = new Error("Failed query with email and password", {
    cause: Object.assign(new Error("raw database detail"), {
      code: "42501",
      detail: "secret row content",
      query: "select * from private",
      parameters: ["person@example.test", "password"],
    }),
  });

  assert.deepEqual(safeDatabaseErrorDiagnostic(sensitive), {
    errorClass: "database",
    databaseCode: "42501",
    databaseClass: "42",
  });
  assert.doesNotMatch(
    JSON.stringify(safeDatabaseErrorDiagnostic(sensitive)),
    /email|password|secret|query|private|example/i,
  );
});

test("database diagnostics do not mistake arbitrary driver content for SQLSTATE", () => {
  const cyclic = { code: "not-a-sqlstate", message: "sensitive", cause: undefined as unknown };
  cyclic.cause = cyclic;
  assert.deepEqual(safeDatabaseErrorDiagnostic(cyclic), { errorClass: "unknown" });
  assert.deepEqual(
    safeDatabaseErrorDiagnostic({ cause: { code: "23505-too-long", detail: "sensitive" } }),
    { errorClass: "unknown" },
  );
});

test("request diagnostics allocate one stable non-empty ID when middleware omitted it", () => {
  const request: { id?: unknown } = {};
  const first = safeRequestId(request);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(safeRequestId(request), first);
  assert.notEqual(first, "undefined");
  assert.notEqual(first, "null");
});

test("request diagnostics preserve a non-empty middleware request ID", () => {
  assert.equal(safeRequestId({ id: "production-request-42" }), "production-request-42");
  assert.equal(safeRequestId({ id: 42 }), "42");
});