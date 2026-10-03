// Read-only catalog inventory. Output goes to /tmp, never tenant data.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const strings = new Set();
const locations = {};
function capture(node, file) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.trim()) {
      strings.add(node.text);
      (locations[node.text] ??= []).push(file);
    }
  } else if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    node.templateSpans.forEach((span, i) => { text += `{v${i}}` + span.literal.text; });
    strings.add(text);
    (locations[text] ??= []).push(file);
  } else if (ts.isObjectLiteralExpression(node)) {
    for (const p of node.properties) if (p.initializer) capture(p.initializer, file);
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach(x => capture(x, file));
  } else if (ts.isArrowFunction(node)) {
    capture(node.body, file);
  } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    capture(node.expression, file);
  }
}
function scan(file) {
  const source = fs.readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if ((ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) && node.name?.getText(tree).replace(/['"]/g, "") === "en" && node.initializer) capture(node.initializer, file);
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file) && !/fixture/i.test(file)) scan(file);
  }
}
walk("artifacts/smart360/src/pages/guest");
walk("artifacts/smart360/src/pages/living-guide");
walk("artifacts/smart360/src/lib");
walk("artifacts/smart360/src/components");
fs.writeFileSync("/tmp/guest-english.json", JSON.stringify([...strings].sort()));
fs.writeFileSync("/tmp/guest-english-locations.json", JSON.stringify(locations));
console.log(`Collected ${strings.size} English UI strings`);