import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Calibration = require(path.join(repoRoot, "assets", "learning", "outcome-calibration-v1.js"));
const CORE = Calibration.PROFILE_COMPETENCIES.core8;

function phaseStatus(phase, pattern, completed = true) {
  const rows = CORE.map((competency, index) => ({
    caseId: `${phase}-${competency}-v${index}-s20260821`,
    phase,
    competency,
    attempted: completed,
    correct: completed ? Boolean(pattern(index, competency)) : false
  }));
  return {
    phase,
    attempted: completed ? rows.length : 0,
    total: rows.length,
    completed,
    score: completed ? { rows } : null
  };
}

function summary(pattern = () => true, { seed = 20260821, postCompleted = true } = {}) {
  return {
    seed,
    profile: "core8",
    countPerCompetency: 1,
    pre: phaseStatus("pre", pattern, false),
    post: phaseStatus("post", pattern, postCompleted),
    retention: ["r1","r2","r3","r4"].map(phase => phaseStatus(phase, pattern, false))
  };
}

test("calibration export keeps item correctness without prompts, choices or raw answers", () => {
  const bundle = Calibration.exportParticipant(summary(index => index % 2 === 0), { participantId:"p_001", exportedAt:"2026-08-21T00:00:00Z" });
  assert.equal(Calibration.validateParticipant(bundle).valid, true);
  assert.deepEqual(bundle.instrument, { seed:20260821, countPerCompetency:1 });
  assert.equal(bundle.phases.post.rows.length, 8);
  assert.deepEqual(Object.keys(bundle.phases.post.rows[0]).sort(), ["caseId","competency","correct"]);
  assert.equal(bundle.containsItemCorrectness, true);
  assert.equal(bundle.containsRawAnswers, false);
  assert.equal(bundle.containsPrompts, false);
  assert.equal("answer" in bundle.phases.post.rows[0], false);
  assert.equal("prompt" in bundle.phases.post.rows[0], false);
});

test("malformed item rows and duplicate case IDs fail closed", () => {
  const clean = Calibration.exportParticipant(summary(), { participantId:"p_clean" });
  const duplicate = JSON.parse(JSON.stringify(clean));
  duplicate.phases.post.rows[1].caseId = duplicate.phases.post.rows[0].caseId;
  assert.equal(Calibration.validateParticipant(duplicate).valid, false);

  const badCompetency = JSON.parse(JSON.stringify(clean));
  badCompetency.phases.post.rows[0].competency = "mystery";
  assert.equal(Calibration.validateParticipant(badCompetency).valid, false);

  const badCorrect = JSON.parse(JSON.stringify(clean));
  badCorrect.phases.post.rows[0].correct = 1;
  assert.equal(Calibration.validateParticipant(badCorrect).valid, false);
});

test("fewer than 20 completed learners never yields actionable item flags", () => {
  const bundles = Array.from({ length:19 }, (_, index) => Calibration.exportParticipant(
    summary(item => item === 0 || (index + item) % 2 === 0),
    { participantId:`small_${index}` }
  ));
  const result = Calibration.aggregate(bundles, { phase:"post" });
  assert.equal(result.evidenceStatus, "insufficient");
  assert.equal(result.items.length, 8);
  assert.ok(result.items.every(item => item.reviewStatus === "insufficient"));
  assert.ok(result.items.every(item => item.reviewFlags.length === 1 && item.reviewFlags[0] === "insufficient-sample"));
  assert.deepEqual(result.reviewPriorityCompetencies, []);
});

test("usable cohort identifies extreme p-correct and positively discriminating items", () => {
  const bundles = Array.from({ length:60 }, (_, learner) => {
    const strong = learner >= 30;
    const pattern = item => {
      if (item === 0) return true;
      if (item === 1) return learner % 5 === 0;
      if (item === 2) return strong;
      return strong ? learner % 7 !== item % 7 : learner % 11 === item;
    };
    return Calibration.exportParticipant(summary(pattern), { participantId:`u_${learner}` });
  });
  const result = Calibration.aggregate(bundles, { phase:"post" });
  assert.equal(result.evidenceStatus, "usable");
  assert.equal(result.completed, 60);
  const easy = result.items.find(item => item.competency === "physics");
  const hard = result.items.find(item => item.competency === "sensing");
  const discriminating = result.items.find(item => item.competency === "feedback");
  assert.equal(easy.proportionCorrect, 1);
  assert.ok(easy.reviewFlags.includes("too-easy"));
  assert.ok(Math.abs(hard.proportionCorrect - 0.2) < 1e-12);
  assert.ok(hard.reviewFlags.includes("too-hard"));
  assert.ok(discriminating.correctedDiscrimination > 0.25);
  assert.equal(discriminating.reviewFlags.includes("low-discrimination"), false);
  assert.equal(result.causalClaimAllowed, false);
});

test("calibration aggregation rejects mixed instrument configuration and duplicate participants", () => {
  const a = Calibration.exportParticipant(summary(), { participantId:"same" });
  const b = Calibration.exportParticipant(summary(() => true, { seed:77 }), { participantId:"other" });
  assert.throws(() => Calibration.aggregate([a,b]), /mixed calibration instruments/);
  assert.throws(() => Calibration.aggregate([a,a]), /duplicate participantId/);
});

test("calibration is phase-specific and excludes incomplete phase records", () => {
  const bundles = Array.from({ length:20 }, (_, index) => {
    const source = summary(item => (index + item) % 2 === 0, { postCompleted:index !== 19 });
    return Calibration.exportParticipant(source, { participantId:`phase_${index}` });
  });
  const post = Calibration.aggregate(bundles, { phase:"post" });
  assert.equal(post.completed, 19);
  assert.equal(post.evidenceStatus, "insufficient");
  assert.throws(() => Calibration.aggregate(bundles, { phase:"all" }), /unknown calibration phase/);
});
