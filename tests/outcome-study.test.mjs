import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Study = require(path.join(root, "assets", "learning", "outcome-study-v1.js"));

function summary(pre, post, delta, retentionAccuracy = null, profile = "legacy4", instrumentVersion = 1) {
  const competencies = profile === "core8"
    ? ["physics","sensing","feedback","timing","dynamics","safety","production","evidence"]
    : ["physics","timing","next-measurement","transfer"];
  const status = (accuracy, completed = true) => ({
    attempted:8,
    total:8,
    completed,
    score:{
      accuracy,
      nextMeasurementAccuracy:profile === "legacy4" ? accuracy : null,
      transferAccuracy:profile === "legacy4" ? accuracy : null,
      byCompetency:Object.fromEntries(competencies.map(key => [key,{ attempted:1, correct:accuracy === 1 ? 1 : 0, accuracy }]))
    }
  });
  return {
    profile,
    instrumentVersion,
    pre:status(pre),
    post:status(post),
    comparison:{ delta },
    retention:["r1","r2","r3","r4"].map((phase,index)=>({ phase, ...status(retentionAccuracy == null ? post : Math.max(0, retentionAccuracy-index*0.02), retentionAccuracy != null) }))
  };
}

test("P4-C export strips raw answers/prompts and preserves only learner metrics", () => {
  const bundle = Study.exportParticipant(summary(0.5,0.875,0.375), { participantId:"learner_001", exportedAt:"2026-08-21T00:00:00Z" });
  assert.equal(Study.validateParticipant(bundle).valid, true);
  assert.equal(bundle.outcomeProfile, "legacy4");
  assert.equal(bundle.outcomeInstrumentVersion, 1);
  assert.equal(bundle.containsRawAnswers, false);
  assert.equal(bundle.containsPrompts, false);
  assert.equal(bundle.phases.pre.accuracy, 0.5);
  assert.equal(bundle.delta, 0.375);
  assert.equal("sessions" in bundle, false);
});

test("core8 export carries instrument version and per-layer accuracy but no raw response content", () => {
  const bundle = Study.exportParticipant(summary(0.5,0.875,0.375,null,"core8",2), { participantId:"core8_001" });
  assert.equal(bundle.outcomeProfile, "core8");
  assert.equal(bundle.outcomeInstrumentVersion, 2);
  assert.equal(bundle.phases.post.byCompetency.sensing.accuracy, 0.875);
  assert.equal(bundle.phases.post.nextMeasurementAccuracy, null);
  assert.equal(bundle.phases.post.transferAccuracy, null);
  assert.equal(bundle.containsRawAnswers, false);
  assert.equal(bundle.containsPrompts, false);
});

test("P4-C cohort aggregate reports observational evidence without causal claim", () => {
  const bundles = Array.from({ length:8 }, (_,index) => Study.exportParticipant(
    summary(0.4 + index*0.01, 0.75 + index*0.01, 0.35, 0.72),
    { participantId:`p_${index}` }
  ));
  const result = Study.aggregate(bundles);
  assert.equal(result.outcomeProfile, "legacy4");
  assert.equal(result.outcomeInstrumentVersion, 1);
  assert.equal(result.participants, 8);
  assert.equal(result.pairedPrePost, 8);
  assert.equal(result.evidenceStatus, "usable");
  assert.ok(Math.abs(result.meanDelta - 0.35) < 1e-12);
  assert.equal(result.retention.r1.completed, 8);
  assert.equal(result.causalClaimAllowed, false);
});

test("core8 cohort aggregate reports per-layer post means within one instrument version", () => {
  const bundles = Array.from({ length:8 }, (_,index) => Study.exportParticipant(
    summary(0.4 + index*0.01, 0.75 + index*0.01, 0.35, 0.72, "core8", 2),
    { participantId:`c_${index}` }
  ));
  const result = Study.aggregate(bundles);
  assert.equal(result.outcomeProfile, "core8");
  assert.equal(result.outcomeInstrumentVersion, 2);
  assert.equal(result.meanPostByCompetency.safety.n, 8);
  assert.ok(result.meanPostByCompetency.safety.meanAccuracy > 0.7);
});

test("mixed outcome profiles fail closed instead of averaging different instruments", () => {
  const legacy = Study.exportParticipant(summary(0.5,0.8,0.3,null,"legacy4"), { participantId:"legacy" });
  const core8 = Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8"), { participantId:"core8" });
  assert.throws(() => Study.aggregate([legacy,core8]), /mixed outcome profiles/);
});

test("mixed core8 instrument versions fail closed instead of blending v1 and v2 forms", () => {
  const v1 = Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8",1), { participantId:"core8_v1" });
  const v2 = Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8",2), { participantId:"core8_v2" });
  assert.throws(() => Study.aggregate([v1,v2]), /mixed outcome instrument versions/);
});

test("pre-version study bundles remain readable as instrumentVersion 1", () => {
  const current = Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8",1), { participantId:"historical" });
  const historical = JSON.parse(JSON.stringify(current));
  delete historical.outcomeInstrumentVersion;
  assert.equal(Study.validateParticipant(historical).valid, true);
  const aggregate = Study.aggregate([historical]);
  assert.equal(aggregate.outcomeInstrumentVersion, 1);
});

test("P4-C malformed competency metrics, unknown profiles, invalid versions and invalid IDs fail closed", () => {
  assert.throws(() => Study.exportParticipant(summary(0.5,0.8,0.3), { participantId:"name with spaces" }), /participantId/);
  assert.throws(() => Study.exportParticipant(summary(0.5,0.8,0.3,null,"unknown"), { participantId:"unknown_profile" }), /outcome profile/);
  assert.throws(() => Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8",99), { participantId:"bad_version" }), /instrument version/);
  const legacy = Study.exportParticipant(summary(0.5,0.8,0.3), { participantId:"same" });
  assert.equal(Study.validateParticipant({ ...legacy, outcomeProfile:"unknown" }).valid, false);
  const core8 = Study.exportParticipant(summary(0.5,0.8,0.3,null,"core8",2), { participantId:"polluted" });
  const polluted = JSON.parse(JSON.stringify(core8));
  polluted.phases.post.byCompetency.hack = { attempted:1, correct:1, accuracy:1 };
  assert.equal(Study.validateParticipant(polluted).valid, false);
  assert.equal(Study.validateParticipant({ ...core8, outcomeInstrumentVersion:3 }).valid, false);
  assert.throws(() => Study.aggregate([legacy,legacy]), /duplicate participantId/);
});
