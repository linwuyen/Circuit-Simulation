import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(new URL("../packaging-contract.json", import.meta.url), "utf8"));

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.releasePolicy, "release-policy.json");
assert.equal(contract.canonicalState, "circuit-learning-state-v5");
assert.equal(contract.artifacts.web.persistence, "canonical-v5-only");
assert.equal(contract.artifacts.engineeringPack.inheritsWeb, true);
assert.equal(contract.artifacts.engineeringPack.evidenceAuthority, "none");
assert.equal(contract.artifacts.engineeringPack.mayUpgradeEvidence, false);
assert.deepEqual(contract.invariants, [
  "no-parallel-state-store",
  "no-packaging-evidence-upgrade",
  "no-fabricated-human-hil-or-board-evidence",
]);
assert.equal(contract.verification.staticUnitBrowser, "exact-head-required");
assert.equal(contract.verification.githubHostedActions, "required-before-release");
assert.equal(contract.verification.humanOrHardwareEvidence, "required-only-for-corresponding-claims");

console.log("packaging contract invariants: PASS");
