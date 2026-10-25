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
  assert.deepEqual(imports.filter(path => path.startsWith("@/") && path !== "@/pages/admin/login"), []);
  const deferred: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) deferred.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(deferred.includes("@/pages/admin/tenant-edit"));
  assert.ok(deferred.includes("@/components/admin/admin-layout"));
});
