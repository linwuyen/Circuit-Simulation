import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;
const Session = require(path.join(repoRoot, "assets", "learning", "outcome-session-v1.js"));

const answerFor = item => item.expected;

test("first attempt is immutable and retries cannot change score", () => {
  Session.reset();
  const pre = Session.startPhase("pre");
  assert.equal(pre.phase, "pre");
  const item = Session.phaseStatus("pre").cases[0];
  Session.recordAttempt("pre", item.id, "wrong");
  Session.recordAttempt("pre", item.id, answerFor(item));
  const record = Session.loadRecord();
  assert.equal(record.sessions.pre.firstAttempts[item.id].answer, "wrong");
  assert.equal(record.sessions.pre.retries.length, 1);
  assert.equal(record.sessions.pre.score.correct, 0);
});

test("benchmark configuration locks after first attempt", () => {
  Session.reset();
  Session.configure({ seed: 1234, countPerCompetency: 1 });
  const item = Session.phaseStatus("pre").cases[0];
  Session.recordAttempt("pre", item.id, answerFor(item));
  assert.throws(() => Session.configure({ seed: 99 }), /immutable/);
});

test("completed post schedules 1/7/30/90 day retention", () => {
  Session.reset();
  Session.configure({ seed: 7, countPerCompetency: 1 });
  for (const phase of ["pre", "post"]) {
    const cases = Session.phaseStatus(phase).cases;
    for (const item of cases) Session.recordAttempt(phase, item.id, answerFor(item));
    assert.equal(Session.phaseStatus(phase).completed, true);
  }
  const summary = Session.summary();
  assert.equal(summary.comparison.post.accuracy, 1);
  assert.deepEqual(summary.retention.map(item => item.phase), ["r1", "r2", "r3", "r4"]);
  const record = Session.loadRecord();
  assert.deepEqual(Object.values(record.retention).map(item => item.dueAfterDays), [1, 7, 30, 90]);
});

test("retention due state follows stored post completion time", () => {
  Session.reset();
  Session.configure({ seed: 8, countPerCompetency: 1 });
  const postCases = Session.phaseStatus("post").cases;
  for (const item of postCases) Session.recordAttempt("post", item.id, answerFor(item));
  const record = Session.loadRecord();
  const r1Due = new Date(record.retention.r1.dueAt).getTime();
  assert.equal(Session.phaseStatus("r1", r1Due - 1).due, false);
  assert.equal(Session.phaseStatus("r1", r1Due).due, true);
});
