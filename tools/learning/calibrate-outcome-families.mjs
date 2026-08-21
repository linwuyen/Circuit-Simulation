#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;
require(path.join(repoRoot, "assets", "learning", "outcome-families-v2.js"));
require(path.join(repoRoot, "assets", "learning", "outcome-calibration-v1.js"));
const FamilyCalibration = require(path.join(repoRoot, "assets", "learning", "outcome-family-calibration-v1.js"));

let phase = "post";
const files = [];
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--phase") {
    phase = process.argv[index + 1] || "";
    index += 1;
  } else if (arg.startsWith("--phase=")) {
    phase = arg.slice("--phase=".length);
  } else if (!arg.startsWith("--")) {
    files.push(arg);
  }
}

if (!FamilyCalibration.PHASES.includes(phase) || !files.length) {
  console.error("usage: node tools/learning/calibrate-outcome-families.mjs --phase post participant-1.outcome-calibration.json participant-2.outcome-calibration.json ...");
  console.error(`phase must be one of: ${FamilyCalibration.PHASES.join(", ")}`);
  process.exit(2);
}

try {
  const bundles = files.map(file => JSON.parse(fs.readFileSync(path.resolve(file), "utf8")));
  console.log(JSON.stringify(FamilyCalibration.aggregate(bundles, { phase }), null, 2));
} catch (error) {
  console.error(`family calibration rejected: ${error.message}`);
  process.exit(1);
}
