import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Study = require(path.join(root, "assets", "learning", "outcome-study-v1.js"));

function summary(pre, post, delta, retentionAccuracy = null) {
  const status = (accuracy, completed = true) => ({ attempted:8, total:8, completed, score:{ accuracy, nextMeasurementAccuracy:accuracy, transferAccuracy:accuracy } });
  return {
    pre:status(pre), post:status(post), comparison:{ delta },
    retention:["r1","r2","r3","r4"].map((phase,index)=>({ phase, ...status(retentionAccuracy == null ? post : Math.max(0, retentionAccuracy-index*0.02), retentionAccuracy != null) }))
  };
}

test("P4-C export strips raw answers/prompts and preserves only learner metrics", () => {
  const bundle = Study.exportParticipant(summary(0.5,0.875,0.375), { participantId:"learner_001", exportedAt:"2026-08-21T00:00:00Z" });
  assert.equal(Study.validateParticipant(bundle).valid, true);
  assert.equal(bundle.containsRawAnswers, false);
  assert.equal(bundle.containsPrompts, false);
  assert.equal(bundle.phases.pre.accuracy, 0.5);
  assert.equal(bundle.delta, 0.375);
  assert.equal("sessions" in bundle, false);
});

test("P4-C cohort aggregate reports observational evidence without causal claim", () => {
  const bundles = Array.from({ length:8 }, (_,index) => Study.exportParticipant(
    summary(0.4 + index*0.01, 0.75 + index*0.01, 0.35, 0.72),
    { participantId:`p_${index}` }
  ));
  const result = Study.aggregate(bundles);
  assert.equal(result.participants, 8);
  assert.equal(result.pairedPrePost, 8);
  assert.equal(result.evidenceStatus, "usable");
  assert.ok(Math.abs(result.meanDelta - 0.35) < 1e-12);
  assert.equal(result.retention.r1.completed, 8);
  assert.equal(result.causalClaimAllowed, false);
});

test("P4-C duplicate participants and invalid IDs fail closed", () => {
  assert.throws(() => Study.exportParticipant(summary(0.5,0.8,0.3), { participantId:"name with spaces" }), /participantId/);
  const a = Study.exportParticipant(summary(0.5,0.8,0.3), { participantId:"same" });
  assert.throws(() => Study.aggregate([a,a]), /duplicate participantId/);
});
