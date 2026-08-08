import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Assessment = require('../assets/learning/learning-assessment.js');

const base = [{
  id: 'concept-x',
  moduleId: 'buck',
  competency: 'buck.current-ripple.relationship',
  prompt: 'A',
  options: [
    { id: 'ok', text: 'ok', correct: true, feedback: 'yes' },
    { id: 'bad', text: 'bad', correct: false, feedback: 'no', misconception: 'wrong model' }
  ]
}];

function twoVariants() {
  const q = Assessment.expandQuestions(base);
  if (q.length === 1) {
    q.push({ ...q[0], id: 'concept-x-b', variantId: 'B' });
  }
  return q;
}

test('first wrong answer never permanently locks mastery', () => {
  const questions = twoVariants();
  const state = { questions: {} };
  const a = questions[0];
  const b = questions[1];
  const t0 = Date.parse('2026-08-01T00:00:00Z');

  Assessment.recordAttempt(state, a, a.options.find(x => !x.correct), new Date(t0).toISOString());
  Assessment.recordAttempt(state, a, a.options.find(x => x.correct), new Date(t0 + 1000).toISOString());
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), new Date(t0 + 2000).toISOString());

  const m = Assessment.mastery(a.familyId, state, questions, t0 + 3000);
  assert.equal(m.recovery, true);
  assert.equal(m.transfer, true);
  assert.equal(m.retained, false);
});

test('retention requires delayed retrieval rather than two immediate clicks', () => {
  const questions = twoVariants();
  const state = { questions: {} };
  const a = questions[0];
  const b = questions[1];
  const t0 = Date.parse('2026-08-01T00:00:00Z');
  const correctA = a.options.find(x => x.correct);
  const correctB = b.options.find(x => x.correct);

  Assessment.recordAttempt(state, a, correctA, new Date(t0).toISOString());
  Assessment.recordAttempt(state, b, correctB, new Date(t0 + 1000).toISOString());
  assert.equal(Assessment.mastery(a.familyId, state, questions, t0 + 2000).retained, false);

  Assessment.recordAttempt(state, a, correctA, new Date(t0 + Assessment.RETENTION_MS + 1000).toISOString());
  assert.equal(Assessment.mastery(a.familyId, state, questions, t0 + Assessment.RETENTION_MS + 2000).retained, true);
});

test('benchmark separates baseline from transfer first-attempt accuracy', () => {
  const questions = twoVariants();
  const state = { questions: {} };
  const a = questions[0];
  const b = questions[1];
  Assessment.recordAttempt(state, a, a.options.find(x => !x.correct), '2026-08-01T00:00:00Z');
  Assessment.recordAttempt(state, b, b.options.find(x => x.correct), '2026-08-01T00:01:00Z');
  const summary = Assessment.benchmarkSummary(state, questions, Date.parse('2026-08-01T00:02:00Z'));
  assert.equal(summary.baselineAccuracy, 0);
  assert.equal(summary.transferAccuracy, 100);
  assert.equal(summary.deltaPoints, 100);
});

test('competency prerequisites form a DAG edge for DCM reasoning', () => {
  assert.deepEqual(Assessment.prerequisitesFor('buck.ccm-dcm.boundary'), ['buck.current-ripple.relationship']);
});
