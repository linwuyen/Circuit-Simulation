import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Closure = require(path.join(root, "assets", "learning", "physical-board-closure-v1.js"));
const template = JSON.parse(fs.readFileSync(path.join(root, "19_c2000_buck_firmware_lab", "board", "board-closure.template.json"), "utf8"));

const sha = "a".repeat(64);
const when = "2026-08-21T03:30:48.000Z";

function completePackage() {
  const pkg = structuredClone(template);
  pkg.requestedClaim = "BOARD_PASS";
  pkg.boardIdentity = { target: "sanitized-f2838x-lab", revision: "rev-a", mcu: "TMS320F2838x" };
  pkg.flash = {
    status: "PASS",
    imageArtifact: "ci:c2000-buck-f2838x-flash-image/c2000-buck-f2838x.out",
    ccxmlArtifact: "lab-config/f2838x-xds110.ccxml",
    probe: "XDS110",
    flashedAt: when,
    resetBootObserved: true
  };
  for (const [id, binding] of Object.entries(pkg.bindings)) {
    binding.status = "VERIFIED";
    binding.source = { kind: "sanitized-record", ref: `board/${id}.md`, verifiedAt: when };
  }
  for (const item of pkg.evidence) {
    item.status = "PASS";
    item.accepted = true;
    item.artifact = { ref: `evidence/${item.id}.png`, sha256: sha, instrument: "sanitized-scope", capturedAt: when };
  }
  return pkg;
}

test("P4-A template is fail-closed and enumerates the next physical actions", () => {
  const result = Closure.validatePackage(template);
  assert.equal(result.computedClaim, "UNCLAIMED");
  assert.equal(result.identityValid, false);
  assert.equal(result.flashPassed, false);
  assert.equal(result.bindingsVerified, false);
  assert.equal(result.evidencePassed, false);
  assert.equal(result.remainingActions.length, 19);
});

test("P4-A complete package can derive a BOARD_PASS manifest only with provenance", () => {
  const pkg = completePackage();
  const result = Closure.assertPackage(pkg);
  assert.equal(result.computedClaim, "BOARD_PASS");
  assert.equal(result.claimValid, true);
  assert.equal(result.boardManifest.boardClaim, "BOARD_PASS");
  assert.equal(result.boardManifest.evidence.every(item => item.status === "PASS"), true);
});

test("P4-A rejects fake PASS that lacks physical artifact integrity", () => {
  const pkg = completePackage();
  pkg.evidence.find(item => item.id === "trip").artifact.sha256 = "not-a-digest";
  assert.throws(() => Closure.assertPackage(pkg), /BOARD_PASS rejected/);

  const noBoot = completePackage();
  noBoot.flash.resetBootObserved = false;
  assert.throws(() => Closure.assertPackage(noBoot), /BOARD_PASS rejected/);

  const noSource = completePackage();
  noSource.bindings.adcChannels.source.ref = "";
  assert.throws(() => Closure.assertPackage(noSource), /BOARD_PASS rejected/);
});
