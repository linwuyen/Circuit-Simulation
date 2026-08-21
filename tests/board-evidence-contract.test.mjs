import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifestPath = path.join(repoRoot, "19_c2000_buck_firmware_lab", "board", "board-binding.reference.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const requiredBindingIds = [
  "pwmPinmuxAndPolarity",
  "adcChannels",
  "adcAcquisitionWindow",
  "voltageScaling",
  "currentScaling",
  "cmpssInputAndThreshold",
  "deadTimeAndComplementaryOutputs",
  "startupAndRearmPolicy",
  "communicationOwner"
];

const requiredEvidenceIds = ["pwm", "gpio", "soc", "trip", "soft", "load", "timeout", "rearm"];

function boardPassEligible(candidate) {
  const bindings = candidate.bindings || {};
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  const bindingsReady = requiredBindingIds.every(id =>
    bindings[id] && bindings[id].status === "VERIFIED" && typeof bindings[id].source === "string" && bindings[id].source.trim().length > 0
  );
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  const evidenceReady = requiredEvidenceIds.every(id => {
    const item = evidenceById.get(id);
    return item && item.status === "PASS" && typeof item.artifact === "string" && item.artifact.trim().length > 0;
  });
  return bindingsReady && evidenceReady;
}

test("reference board manifest contains every required binding and evidence slot", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(Object.keys(manifest.bindings).sort(), [...requiredBindingIds].sort());
  assert.deepEqual(manifest.evidence.map(item => item.id).sort(), [...requiredEvidenceIds].sort());
  assert.equal(new Set(manifest.evidence.map(item => item.id)).size, requiredEvidenceIds.length);
});

test("public reference manifest remains explicitly unclaimed until physical evidence exists", () => {
  assert.equal(manifest.boardClaim, "UNCLAIMED");
  assert.equal(manifest.truthLevel, "REFERENCE_TARGET_ONLY");
  assert.equal(boardPassEligible(manifest), false);
});

test("BOARD_PASS cannot be asserted without all verified bindings and eight physical artifacts", () => {
  if (manifest.boardClaim === "BOARD_PASS") {
    assert.equal(boardPassEligible(manifest), true, "BOARD_PASS requires all bindings VERIFIED and all eight physical evidence items PASS");
  }

  const complete = structuredClone(manifest);
  for (const binding of Object.values(complete.bindings)) {
    binding.status = "VERIFIED";
    binding.source = "sanitized-lab-record";
  }
  for (const item of complete.evidence) {
    item.status = "PASS";
    item.artifact = `evidence/${item.id}.capture`;
  }
  assert.equal(boardPassEligible(complete), true);

  complete.evidence.find(item => item.id === "trip").artifact = null;
  assert.equal(boardPassEligible(complete), false, "one missing physical capture must invalidate BOARD_PASS");
});
