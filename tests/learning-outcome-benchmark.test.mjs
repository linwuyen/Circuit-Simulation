import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));

function perfectAttempts(cases) {
  return cases.map((item, index) => ({ caseId: item.id, answer: item.expected, attemptIndex: index }));
}

function fingerprints(cases) {
  return cases.map(item => Benchmark.contentFingerprint(item));
}

test("pre/post benchmark sets are deterministic and content-disjoint", () => {
  const preA = Benchmark.generateBenchmarkSet({ seed: 42, phase: "pre" });
  const preB = Benchmark.generateBenchmarkSet({ seed: 42, phase: "pre" });
  const post = Benchmark.generateBenchmarkSet({ seed: 42, phase: "post" });
  assert.deepEqual(preA, preB);
  assert.equal(preA.length, 8);
  assert.equal(post.length, 8);
  assert.equal(new Set(fingerprints(preA)).size, preA.length);
  assert.equal(new Set(fingerprints(post)).size, post.length);
  const preContent = new Set(fingerprints(preA));
  assert.equal(fingerprints(post).some(fingerprint => preContent.has(fingerprint)), false);
  assert.equal(new Set(preA.map(item => item.competency)).size, 4);
  assert.deepEqual([...new Set(preA.map(item => item.competency))], Benchmark.COMPETENCIES);
});

test("core8 profile measures all eight causal layers without increasing phase length", () => {
  const pre = Benchmark.generateBenchmarkSet({ seed: 20260821, phase: "pre", profile: "core8" });
  assert.equal(pre.length, 8);
  assert.deepEqual(pre.map(item => item.competency), Benchmark.CORE8_COMPETENCIES);
  assert.equal(new Set(pre.map(item => item.competency)).size, 8);
  assert.ok(pre.every(item => item.answerType === "choice" || item.answerType === "timing"));
});

test("core8 PRE/POST/R1-R4 are content-disjoint at the visible-case fingerprint level", () => {
  const phases = ["pre", "post", "r1", "r2", "r3", "r4"];
  const all = phases.flatMap(phase => Benchmark.generateBenchmarkSet({ seed: 20260821, phase, profile: "core8" }));
  assert.equal(all.length, 48);
  assert.equal(new Set(fingerprints(all)).size, all.length);
});

test("core8 scoring reports layer-level first-attempt coverage", () => {
  const cases = Benchmark.generateBenchmarkSet({ seed: 99, phase: "pre", profile: "core8" });
  const score = Benchmark.scoreFirstAttempts(cases, perfectAttempts(cases));
  assert.equal(score.attempted, 8);
  assert.equal(score.correct, 8);
  assert.equal(score.competencyCount, 8);
  assert.equal(score.attemptedCompetencies, 8);
  assert.deepEqual(Object.keys(score.byCompetency), Benchmark.CORE8_COMPETENCIES);
  assert.equal(score.nextMeasurementAccuracy, null);
  assert.equal(score.transferAccuracy, null);
  assert.equal(score.status, "usable");
});

test("all pre/post/retention phase namespaces are content-disjoint", () => {
  const phases = ["pre", "post", "r1", "r2", "r3", "r4"];
  const all = phases.flatMap(phase => Benchmark.generateBenchmarkSet({ seed: 20260821, phase }));
  const allFingerprints = fingerprints(all);
  assert.equal(new Set(allFingerprints).size, allFingerprints.length);
});

test("compareSessions rejects cloned content even when ids and phases differ", () => {
  const pre = Benchmark.generateBenchmarkSet({ seed: 17, phase: "pre", countPerCompetency: 1 });
  const clonedPost = pre.map((item, index) => Object.freeze({ ...item, id: `post-clone-${index}`, phase: "post" }));
  assert.throws(
    () => Benchmark.compareSessions(pre, [], clonedPost, []),
    /reuses benchmark content/
  );
});

test("shadow-load timing treats exactly-on-ZERO completion as a miss", () => {
  const periodS = 10e-6;
  const exact = Benchmark.strictSampleToActuate({ switchingHz: 100000, completionS: periodS });
  const before = Benchmark.strictSampleToActuate({ switchingHz: 100000, completionS: periodS - 1e-9 });
  assert.equal(exact.firstLoadMet, false);
  assert.equal(exact.commitCycle, 2);
  assert.equal(before.firstLoadMet, true);
  assert.equal(before.commitCycle, 1);
});

test("retry cannot wash a wrong first attempt", () => {
  const cases = Benchmark.generateBenchmarkSet({ seed: 7, phase: "pre", countPerCompetency: 1 });
  const target = cases[0];
  const attempts = [
    { caseId: target.id, answer: "definitely-wrong", attemptIndex: 0 },
    { caseId: target.id, answer: target.expected, attemptIndex: 1 }
  ];
  const score = Benchmark.scoreFirstAttempts(cases, attempts);
  assert.equal(score.attempted, 1);
  assert.equal(score.correct, 0);
  assert.equal(score.rows.find(row => row.caseId === target.id).correct, false);
});

test("first-attempt summary reports next-measurement and transfer separately", () => {
  const cases = Benchmark.generateBenchmarkSet({ seed: 99, phase: "pre" });
  const score = Benchmark.scoreFirstAttempts(cases, perfectAttempts(cases));
  assert.equal(score.attempted, 8);
  assert.equal(score.accuracy, 1);
  assert.equal(score.nextMeasurementAccuracy, 1);
  assert.equal(score.transferAccuracy, 1);
  assert.equal(score.status, "usable");
});

test("pre/post comparison reports measured change without making a causal claim", () => {
  const pre = Benchmark.generateBenchmarkSet({ seed: 123, phase: "pre" });
  const post = Benchmark.generateBenchmarkSet({ seed: 123, phase: "post" });
  const preAttempts = pre.map((item, index) => ({
    caseId: item.id,
    answer: index < 4 ? item.expected : "wrong",
    attemptIndex: 0
  }));
  const result = Benchmark.compareSessions(pre, preAttempts, post, perfectAttempts(post));
  assert.equal(result.pre.accuracy, 0.5);
  assert.equal(result.post.accuracy, 1);
  assert.equal(result.delta, 0.5);
  assert.equal(result.status, "usable");
  assert.equal(result.causalClaimAllowed, false);
});

test("retention plan generates content-fresh R1/R2/R3/R4 sets at 1/7/30/90 days", () => {
  const plan = Benchmark.retentionPlan({ seed: 456 });
  assert.deepEqual(plan.map(item => item.phase), ["r1", "r2", "r3", "r4"]);
  assert.deepEqual(plan.map(item => item.dueAfterDays), [1, 7, 30, 90]);
  const cases = plan.flatMap(item => item.cases);
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  assert.equal(new Set(fingerprints(cases)).size, cases.length);
});

test("core8 retention plan keeps eight questions per checkpoint", () => {
  const plan = Benchmark.retentionPlan({ seed: 456, profile: "core8" });
  assert.ok(plan.every(item => item.cases.length === 8));
  assert.ok(plan.every(item => item.cases.map(testCase => testCase.competency).join(",") === Benchmark.CORE8_COMPETENCIES.join(",")));
});
