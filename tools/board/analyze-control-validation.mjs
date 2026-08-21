#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const Validation = require(path.join(repoRoot, "assets", "learning", "control-validation-v1.js"));

const input = process.argv[2];
if (!input) {
  console.error("usage: node tools/board/analyze-control-validation.mjs <control-validation.json>");
  process.exit(2);
}

const bundle = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const result = Validation.validateBundle(bundle);
console.log(`Control validation: ${result.status}`);
console.log(`  captures: ${result.captureRows.filter(row => row.valid).length}/${result.captureRows.length}`);
for (const key of ["loadStep", "timing", "trip", "sfra"]) {
  const item = result[key];
  console.log(`  ${key}: ${item.ready ? (item.pass ? "PASS" : "FAIL") : "MISSING"}`);
}
console.log("  BOARD_PASS implied: no");
if (!result.overallPass) process.exit(1);
