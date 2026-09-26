import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const retired = [
  "assets/learning/learning-v2.js",
  "assets/learning/curriculum-schema.js"
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "build", "test-results"].includes(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(?:html|js|mjs|cjs|md|json|yml|yaml)$/.test(name)) out.push(full);
  }
  return out;
}

test("retired parallel runtime owners are absent and unreferenced", () => {
  for (const path of retired) {
    assert.equal(existsSync(join(root, path)), false, path + " must be retired");
  }

  const needles = retired.map(path => path.split("/").at(-1));
  const references = [];
  for (const file of walk(root)) {
    if (fileURLToPath(import.meta.url) === file) continue;
    const text = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) references.push(relative(root, file) + " -> " + needle);
    }
  }
  assert.deepEqual(references, [], "retired runtime references remain:\n" + references.join("\n"));
});

test("learn.html is only a compatibility alias for the canonical workspace", () => {
  const learn = readFileSync(join(root, "learn.html"), "utf8");
  assert.match(learn, /rel=["']canonical["'][^>]*href=["']index\.html["']/);
  assert.match(learn, /location\.replace\(/);
  assert.doesNotMatch(learn, /workspace-ui\.js/);
  assert.doesNotMatch(learn, /data-learning-workspace/);
});
