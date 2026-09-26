import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const policy=JSON.parse(readFileSync(new URL("../release-policy.json",import.meta.url),"utf8"));

test("release policy preserves canonical V5 state and evidence truth",()=>{
  assert.equal(policy.schemaVersion,1);
  assert.equal(policy.stateSchema,"circuit-learning-state-v5");
  assert.equal(policy.compatibility.state,"backward-compatible-with-v5");
  assert.equal(policy.compatibility.evidence,"never-upgraded-by-packaging");
  assert.equal(policy.compatibility.offline,"static-shell-only");
});

test("release policy fails closed on missing truth gates",()=>{
  assert.deepEqual(policy.releaseGates,[
    "static-unit-browser-exact-head",
    "github-hosted-actions",
    "required-human-or-hardware-evidence-when-claimed"
  ]);
  assert.ok(policy.failClosed.includes("state-schema-change-without-migration"));
  assert.ok(policy.failClosed.includes("evidence-truth-upgrade"));
  assert.ok(policy.failClosed.includes("required-gate-missing-or-unverified"));
});
