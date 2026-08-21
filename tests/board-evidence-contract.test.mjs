import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifestPath = path.join(repoRoot, "19_c2000_buck_firmware_lab", "board", "board-binding.reference.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const Board = require(path.join(repoRoot, "assets", "learning", "board-evidence-v1.js"));

test("reference board manifest contains every required binding and evidence slot", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(Object.keys(manifest.bindings).sort(), [...Board.REQUIRED_BINDINGS].sort());
  assert.deepEqual(manifest.evidence.map(item => item.id).sort(), [...Board.REQUIRED_EVIDENCE].sort());
  assert.equal(new Set(manifest.evidence.map(item => item.id)).size, Board.REQUIRED_EVIDENCE.length);
  assert.equal(manifest.targetBuild.status, "PASS");
  assert.ok(manifest.targetBuild.artifact);
});

test("public reference manifest remains explicitly unclaimed until physical evidence exists", () => {
  const result = Board.validateManifest(manifest);
  assert.equal(manifest.boardClaim, "UNCLAIMED");
  assert.equal(manifest.truthLevel, "REFERENCE_TARGET_ONLY");
  assert.equal(result.targetBuildPassed, true);
  assert.equal(result.bindingsVerified, false);
  assert.equal(result.evidencePassed, false);
  assert.equal(result.computedClaim, "UNCLAIMED");
});

test("BOARD_PASS requires target image, nine verified bindings and eight physical artifacts", () => {
  const complete = structuredClone(manifest);
  complete.boardClaim = "BOARD_PASS";
  complete.truthLevel = "PHYSICAL_BOARD_EVIDENCE";
  for (const binding of Object.values(complete.bindings)) {
    binding.status = "VERIFIED";
    binding.source = "sanitized-lab-record";
  }
  for (const item of complete.evidence) {
    item.status = "PASS";
    item.artifact = `evidence/${item.id}.capture`;
  }
  const result = Board.assertBoardPass(complete);
  assert.equal(result.computedClaim, "BOARD_PASS");
  assert.equal(result.claimValid, true);

  const missingTrip = structuredClone(complete);
  missingTrip.evidence.find(item => item.id === "trip").artifact = null;
  assert.throws(() => Board.assertBoardPass(missingTrip), /BOARD_PASS rejected/);

  const missingBuild = structuredClone(complete);
  missingBuild.targetBuild.artifact = null;
  assert.throws(() => Board.assertBoardPass(missingBuild), /targetBuild=MISSING/);
});
