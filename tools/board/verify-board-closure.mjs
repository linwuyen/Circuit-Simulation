#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const Closure = require(path.join(repoRoot, "assets", "learning", "physical-board-closure-v1.js"));

const input = process.argv[2];
if (!input) {
  console.error("usage: node tools/board/verify-board-closure.mjs <board-closure.json> [--emit-manifest <path>]");
  process.exit(2);
}

const emitIndex = process.argv.indexOf("--emit-manifest");
const emitPath = emitIndex >= 0 ? process.argv[emitIndex + 1] : null;
const pkg = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const result = Closure.validatePackage(pkg);

console.log(`Physical board closure: ${result.computedClaim}`);
console.log(`  identity: ${result.identityValid ? "PASS" : "MISSING"}`);
console.log(`  flash: ${result.flashPassed ? "PASS" : "MISSING"}`);
console.log(`  bindings: ${result.bindingRows.filter(row => row.valid).length}/${result.bindingRows.length}`);
console.log(`  physical evidence: ${result.evidenceRows.filter(row => row.valid).length}/${result.evidenceRows.length}`);
for (const action of result.remainingActions) console.log(`  NEXT: ${action}`);

if (emitPath) {
  fs.mkdirSync(path.dirname(path.resolve(emitPath)), { recursive: true });
  fs.writeFileSync(path.resolve(emitPath), `${JSON.stringify(result.boardManifest, null, 2)}\n`);
  console.log(`  emitted board manifest: ${emitPath}`);
}

if (pkg.requestedClaim === "BOARD_PASS" && !result.claimValid) process.exit(1);
