#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const Study = require(path.join(repoRoot, "assets", "learning", "outcome-study-v1.js"));

const files = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
if (!files.length) {
  console.error("usage: node tools/learning/summarize-outcome-study.mjs participant-1.json participant-2.json ...");
  process.exit(2);
}
const bundles = files.map(file => JSON.parse(fs.readFileSync(path.resolve(file), "utf8")));
const invalid = bundles.map((bundle,index)=>({ index, result:Study.validateParticipant(bundle) })).filter(row=>!row.result.valid);
if (invalid.length) {
  for (const row of invalid) console.error(`invalid participant bundle at argv index ${row.index}`);
  process.exit(1);
}
const summary = Study.aggregate(bundles);
console.log(JSON.stringify(summary, null, 2));
