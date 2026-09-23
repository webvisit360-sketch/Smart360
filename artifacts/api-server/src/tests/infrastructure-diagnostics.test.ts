import assert from "node:assert/strict";
import test from "node:test";
import { safeDatabaseErrorDiagnostic } from "../lib/infrastructureDiagnostics";

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