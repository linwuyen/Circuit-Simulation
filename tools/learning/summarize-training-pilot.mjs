#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Pilot = require("../../assets/learning/training-pilot.js");
const files = process.argv.slice(2);
try {
  if (!files.length) throw new Error("Usage: node tools/learning/summarize-training-pilot.mjs participant1.json participant2.json ...");
  const bundles = files.map(file => {
    if (fs.statSync(file).size > 100000) throw new Error("Pilot file exceeds 100 KB");
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  });
  console.log(JSON.stringify(Pilot.aggregate(bundles), null, 2));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
