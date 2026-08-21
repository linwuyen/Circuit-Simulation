import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;
const Families = require(path.join(repoRoot, "assets", "learning", "outcome-families-v2.js"));
const Calibration = require(path.join(repoRoot, "assets", "learning", "outcome-calibration-v1.js"));
const FamilyCalibration = require(path.join(repoRoot, "assets", "learning", "outcome-family-calibration-v1.js"));

const PHASES = ["pre","post","r1","r2","r3","r4"];

function statusFor(seed, phase, answerPattern, completed) {
  const cases = Families.generateBenchmarkSet({ seed, phase, countPerCompetency:1 });
  const rows = cases.map((item, index) => ({
    caseId:item.id,
    phase,
    competency:item.competency,
    attempted:completed,
    correct:completed ? Boolean(answerPattern(item, index)) : false
  }));
  return {
    phase,
    profile:"core8",
    instrumentVersion:2,
    total:cases.length,
    attempted:completed ? cases.length : 0,
    completed,
    score:completed ? { rows } : null,
    cases
  };
}

function v2Summary(seed, answerPattern = () => true) {
  const statuses = Object.fromEntries(PHASES.map(phase => [phase, statusFor(seed, phase, answerPattern, phase === "post")]));
  return {
    seed,
    profile:"core8",
    instrumentVersion:2,
    familyContractFingerprint:Families.contractFingerprint(),
    countPerCompetency:1,
    pre:statuses.pre,
    post:statuses.post,
    retention:[statuses.r1,statuses.r2,statuses.r3,statuses.r4]
  };
}

function v1Summary(seed) {
  const make = phase => {
    const cases = Benchmark.generateBenchmarkSet({ seed, phase, profile:"core8" });
    return { phase, profile:"core8", total:8, attempted:8, completed:true, score:{ rows:cases.map(item => ({ caseId:item.id, phase, competency:item.competency, attempted:true, correct:true })) }, cases };
  };
  return { seed, profile:"core8", countPerCompetency:1, pre:make("pre"), post:make("post"), retention:["r1","r2","r3","r4"].map(make) };
}

test("family calibration accepts mixed seeds that exact-item calibration correctly rejects", () => {
  const a = Calibration.exportParticipant(v2Summary(11), { participantId:"a" });
  const b = Calibration.exportParticipant(v2Summary(12), { participantId:"b" });
  assert.throws(() => Calibration.aggregate([a,b], { phase:"post" }), /mixed calibration instruments/);
  const result = FamilyCalibration.aggregate([a,b], { phase:"post" });
  assert.equal(result.completed, 2);
  assert.equal(result.instrumentVersion, 2);
  assert.equal(result.evidenceStatus, "insufficient");
});

test("cross-form cohort observes both families in every core8 competency without increasing phase length", () => {
  const bundles = Array.from({ length:120 }, (_, learner) => {
    const seed = 1000 + learner;
    const ability = learner / 119;
    const pattern = (item, index) => {
      const familyPenalty = item.familyId.endsWith("board-closure-gap") || item.familyId.endsWith("feedback-first-step") ? 0.12 : 0;
      const threshold = 0.30 + index * 0.035 + familyPenalty;
      return ability >= threshold;
    };
    return Calibration.exportParticipant(v2Summary(seed, pattern), { participantId:`f_${learner}` });
  });
  const result = FamilyCalibration.aggregate(bundles, { phase:"post" });
  assert.equal(result.completed, 120);
  assert.equal(result.evidenceStatus, "usable");
  assert.equal(result.families.length, 16);
  for (const competency of Families.COMPETENCIES) {
    assert.equal(result.byCompetency[competency].familiesObserved, 2, competency);
    assert.ok(result.byCompetency[competency].minFamilyN >= 50, competency);
    assert.equal(result.byCompetency[competency].familyComparisonStatus, "usable", competency);
  }
  const feedbackFamilies = result.families.filter(row => row.competency === "feedback");
  assert.equal(feedbackFamilies.length, 2);
  assert.ok(feedbackFamilies.every(row => row.correctedDiscrimination > 0));
  assert.ok(feedbackFamilies.every(row => Object.keys(row.byRestScoreBand).join(",") === "low,mid,high"));
  assert.equal(result.abilityAdjustment.includes("not a Rasch/IRT"), true);
  assert.equal(result.causalClaimAllowed, false);
});

test("family analyzer verifies the exact v2 semantic contract before resolving case IDs", () => {
  const clean = Calibration.exportParticipant(v2Summary(77), { participantId:"clean" });
  const tampered = JSON.parse(JSON.stringify(clean));
  tampered.instrument.contractFingerprint = "0000000000000000";
  assert.throws(() => FamilyCalibration.aggregate([tampered]), /bundle contract does not match/);
});

test("legacy core8 v1 bundles are not silently reinterpreted as family-v2 evidence", () => {
  const legacy = Calibration.exportParticipant(v1Summary(20260821), { participantId:"legacy_v1" });
  assert.throws(() => FamilyCalibration.aggregate([legacy]), /bundle contract does not match/);
});

test("family calibration remains phase-specific", () => {
  const bundle = Calibration.exportParticipant(v2Summary(33), { participantId:"phase_specific" });
  const post = FamilyCalibration.aggregate([bundle], { phase:"post" });
  assert.equal(post.completed, 1);
  const pre = FamilyCalibration.aggregate([bundle], { phase:"pre" });
  assert.equal(pre.completed, 0);
  assert.throws(() => FamilyCalibration.aggregate([bundle], { phase:"all" }), /unknown family calibration phase/);
});
