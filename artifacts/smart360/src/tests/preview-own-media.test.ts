import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the real bridge's DOM/React identity extraction without loading UI.
const text = readFileSync(new URL("../components/admin/preview-edit-bridge.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("bridge.ts", text, ts.ScriptTarget.Latest, true);
const names = new Set(["fiberOf", "collectFromProps", "reactRefs"]);
const declarations = ast.statements.filter(node =>
  ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? "") ||
  ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && ["PROP_KEYS", "ID_PROP_KEYS"].includes(d.name.text)));
const js = ts.transpileModule(declarations.map(node => node.getText(ast)).join("\n"), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const extract = runInNewContext(`${js}; reactRefs`);

test("gallery slide carries its own entry identity even when parent owns category", () => {
  const element = {
    getAttribute: (key: string) => key === "data-item-id" ? "rule-entry" : null,
    __reactFiber$test: {type:"div", memoizedProps:{"data-item-id":"rule-entry"}, return:{type:()=>null, memoizedProps:{category:{id:"rules-category"}}, return:null}},
  };
  assert.deepEqual(Array.from(extract(element).ids), ["rule-entry", "rules-category"]);
});
test("explicit photo identity survives missing React internals; unrelated elements do not invent IDs", () => {
  assert.deepEqual(Array.from(extract({getAttribute:()=> "rule-entry"}).ids), ["rule-entry"]);
  assert.deepEqual(Array.from(extract({getAttribute:()=>null}).ids), []);
});
