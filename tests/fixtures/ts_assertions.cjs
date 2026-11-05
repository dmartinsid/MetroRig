// Prints, as JSON, each vitest test's full name and the text of its assertion statements.
// Usage: node tests/fixtures/ts_assertions.cjs <file.test.ts>...
// A name is its describe titles and its own title joined by ' > '. An assertion is each outermost
// statement of the test's body that calls expect or an expect* helper, whitespace collapsed.
const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '../../node_modules/typescript'));

const title = node => (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null);
const squash = text => text.replace(/\s+/g, ' ').trim();

function assertions(node, source, found) {
  if (ts.isExpressionStatement(node) || ts.isVariableStatement(node) || ts.isReturnStatement(node)) {
    const text = node.getText(source);
    if (/\bexpect\w*\s*[(.<]/.test(text)) found.push(squash(text));
    return;
  }
  ts.forEachChild(node, child => assertions(child, source, found));
}

const tests = {};
for (const file of process.argv.slice(2)) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node, titles) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length >= 2) {
      const callee = node.expression.text;
      const name = title(node.arguments[0]);
      const body = node.arguments[1];
      if (name !== null && callee === 'describe') {
        ts.forEachChild(body, child => visit(child, [...titles, name]));
        return;
      }
      if (name !== null && (callee === 'it' || callee === 'test')) {
        const full = [...titles, name].join(' > ');
        assertions(body, source, (tests[full] ??= []));
        return;
      }
    }
    ts.forEachChild(node, child => visit(child, titles));
  };
  visit(source, []);
}
process.stdout.write(JSON.stringify(tests));
