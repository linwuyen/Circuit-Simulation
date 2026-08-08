import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Assessment = require('../assets/learning/learning-assessment.js');

const base = [{
  id: 'buck-ripple-inductance-transfer', moduleId: 'buck', competency: 'buck.current-ripple.relationship', prompt: 'Vin、Vout 與 fsw 不變，L 加倍後 ΔI？',
  options: [
    { id: 'ok', text: '約減半', correct: true, feedback: 'yes' },
    { id: 'bad', text: '約加倍', correct: false, feedback: 'no', misconception: 'wrong model' }
  ]
}];
const expanded = () => Assessment.expandQuestions(base);

test('wrong transfer variant cannot be washed into a transfer pass by retrying', () => {
  const questions = expanded(), state = { questions: {} }, a = questions[0], b = questions[1], c = questions[2];
  const t0 = Date.parse('2026-08-01T00:00:00Z');
  Assessment.recordAttempt(state, a, a.options.find(x => x.correct), new Date(t0).toISOString());
  Assessment.recordAttempt(state, b, b.options.find(x => !x.correct), new Date(t0 + 1000).toISOString());
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), new Date(t0 + 2000).toISOString());
  assert.equal(Assessment.mastery(a.familyId, state, questions, t0 + 3000).transfer, false);
  Assessment.recordAttempt(state, c, c.options.find(x => x.correct), new Date(t0 + 4000).toISOString());
  assert.equal(Assessment.mastery(a.familyId, state, questions, t0 + 5000).transfer, true);
});

test('first wrong baseline can recover and later pass unseen transfer', () => {
  const questions = expanded(), state = { questions: {} }, a = questions[0], b = questions[1];
  Assessment.recordAttempt(state, a, a.options.find(x => !x.correct), '2026-08-01T00:00:00Z');
  Assessment.recordAttempt(state, a, a.options.find(x => x.correct), '2026-08-01T00:00:01Z');
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), '2026-08-01T00:00:02Z');
  const m = Assessment.mastery(a.familyId, state, questions, Date.parse('2026-08-01T00:00:03Z'));
  assert.equal(m.recovery, true);
  assert.equal(m.transfer, true);
});

test('retention clock starts at transfer pass, not first correct answer', () => {
  const questions = expanded(), state = { questions: {} }, a = questions[0], b = questions[1], d = questions[3];
  const old = Date.parse('2026-07-01T00:00:00Z'), transferAt = Date.parse('2026-08-01T00:00:00Z');
  Assessment.recordAttempt(state, a, a.options.find(x => x.correct), new Date(old).toISOString());
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), new Date(transferAt).toISOString());
  Assessment.recordAttempt(state, d, d.options.find(x => x.correct), new Date(transferAt + 1000).toISOString());
  assert.equal(Assessment.mastery(a.familyId, state, questions, transferAt + 2000).retained, false);
  const fresh = { questions: JSON.parse(JSON.stringify(state.questions)) };
  fresh.questions[a.familyId].history = fresh.questions[a.familyId].history.filter(x => x.variantId !== 'D');
  Assessment.recordAttempt(fresh, d, d.options.find(x => x.correct), new Date(transferAt + Assessment.DAY_MS + 1000).toISOString());
  const m = Assessment.mastery(a.familyId, fresh, questions, transferAt + Assessment.DAY_MS + 2000);
  assert.equal(m.retained, true);
  assert.equal(m.retentionStage, 1);
});

test('retention schedule advances 1d then 7d', () => {
  const questions = expanded(), state = { questions: {} }, a = questions[0], b = questions[1], d = questions[3];
  const t0 = Date.parse('2026-08-01T00:00:00Z');
  Assessment.recordAttempt(state, a, a.options.find(x => x.correct), new Date(t0).toISOString());
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), new Date(t0 + 1000).toISOString());
  Assessment.recordAttempt(state, d, d.options.find(x => x.correct), new Date(t0 + 1000 + Assessment.DAY_MS).toISOString());
  const m = Assessment.mastery(a.familyId, state, questions, t0 + Assessment.DAY_MS + 2000);
  assert.equal(m.retentionStage, 1);
  assert.ok(Date.parse(m.nextReviewAt) >= t0 + Assessment.DAY_MS + 7 * Assessment.DAY_MS);
});

test('paired benchmark uses the same competency denominator and reports uncertainty', () => {
  const questions = expanded(), state = { questions: {} }, a = questions[0], b = questions[1];
  Assessment.recordAttempt(state, a, a.options.find(x => !x.correct), { at: '2026-08-01T00:00:00Z', confidence: 0.9 });
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), { at: '2026-08-01T00:01:00Z', confidence: 0.7 });
  const summary = Assessment.benchmarkSummary(state, questions, Date.parse('2026-08-01T00:02:00Z'));
  assert.equal(summary.pairedN, 1);
  assert.equal(summary.baselineAccuracy, 0);
  assert.equal(summary.transferAccuracy, 100);
  assert.equal(summary.deltaPoints, 100);
  assert.equal(summary.calibration.n, 2);
  assert.equal(summary.evidenceGrade, 'VERY LOW');
  assert.ok(summary.baselineInterval.low <= summary.baselineInterval.high);
});

test('competency prerequisites remain explicit', () => {
  assert.deepEqual(Assessment.prerequisitesFor('buck.ccm-dcm.boundary'), ['buck.current-ripple.relationship']);
});

test('transfer variants are genuinely parameterized and change representation', () => {
  const questions = expanded();
  const [a,b,c,d] = questions;
  assert.equal(a.transferDepth, 0);
  assert.notEqual(b.seed, c.seed);
  assert.notEqual(b.prompt, c.prompt);
  assert.notEqual(c.representation, b.representation);
  assert.equal(d.assessmentRole, 'retention');
  assert.ok(!c.prompt.startsWith('另一個未見情境：'));
});