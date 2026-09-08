import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), Pilot = require('../assets/learning/training-pilot.js');
const options = { participantId: 'p-fixture1', experience: 'beginner', consent: true };
test('pilot export is opt-in, omits raw content and separates missing scores from incorrect answers', () => {
  const sessions = [{ id:'one', kind:'repair', diagnosisCommitted:true, firstJudgmentCorrect:null, measurementCost:2, replay:{secret:'do not export'} }, { id:'two', kind:'repair', diagnosisCommitted:true, firstJudgmentCorrect:false, measurementCost:3 }];
  assert.throws(() => Pilot.exportParticipant(sessions, { ...options, consent:false }));
  const bundle = Pilot.exportParticipant(sessions, options);
  assert.equal(bundle.metrics.repairAttempted, 2); assert.equal(bundle.metrics.repairScored, 1);
  assert.equal(bundle.metrics.firstJudgmentCorrect, 0);
  assert.ok(!JSON.stringify(bundle).includes('secret'));
  const cohort = Pilot.aggregate([bundle]);
  assert.equal(cohort.unscoredRepairs, 1); assert.equal(cohort.firstJudgmentAccuracy, 0);
  assert.equal(cohort.causalClaimAllowed, false);
});
test('no learners remain unknown; duplicate participants and impossible denominators are rejected', () => {
  assert.equal(Pilot.aggregate([]).firstJudgmentAccuracy, null);
  const bundle = Pilot.exportParticipant([], options);
  assert.throws(() => Pilot.aggregate([bundle, bundle]));
  bundle.metrics.repairPassed = 1;
  assert.throws(() => Pilot.aggregate([bundle]));
});
test('rehearsal cases do not inflate independent trial metrics', () => {
  const bundle = Pilot.exportParticipant([{ kind:'repair', rehearsal:true, diagnosisCommitted:true, firstJudgmentCorrect:true, passed:true, transferPassed:true }], options);
  assert.equal(bundle.metrics.repairAttempted, 0);
  assert.equal(bundle.metrics.repairPassed, 0);
});
