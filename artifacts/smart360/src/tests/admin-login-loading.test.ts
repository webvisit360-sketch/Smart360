import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("login routing does not eagerly load protected admin pages or editor", () => {
  const text = readFileSync(new URL("../components/admin/admin-router.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("admin-router.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = source.statements.filter(ts.isImportDeclaration)
    .map(node => (node.moduleSpecifier as ts.StringLiteral).text);
  assert.ok(imports.includes("@/pages/admin/login"));
  const allowed = new Set(["@/pages/admin/login", "@/lib/chunk-recovery"]);
  assert.deepEqual(imports.filter(path => path.startsWith("@/") && !allowed.has(path)), []);
  // The recovery helper is boot-time infrastructure, not a protected page.
  const recovery = readFileSync(new URL("../lib/chunk-recovery.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(recovery, /(?:from\s*|import\s*\()\s*["'][^"']*(?:pages\/admin|tenant-edit|admin-layout)/);
  const deferred: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) deferred.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(deferred.includes("@/pages/admin/tenant-edit"));
  assert.ok(deferred.includes("@/components/admin/admin-layout"));
});
