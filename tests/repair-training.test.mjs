import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Core = require('../assets/repair-training-core.js');
function fixture(seed = 23, guesses) {
  const answer = Core.create(seed).reveal().answer;
  const session = Core.create(seed);
  session.measure('dmm'); session.measure('timing');
  session.submit(guesses || answer, ['dmm', 'timing']);
  return { session, answer };
}
test('precommit view does not expose faults or correctness; budget and first judgment are enforced', () => {
  const s = Core.create(23);
  assert.equal(s.view().result, null);
  assert.ok(!JSON.stringify(s.view()).includes('faults'));
  assert.throws(() => s.repair('sensorGain'));
  for (const id of ['dmm', 'raw', 'scaled', 'seq', 'timing']) s.measure(id);
  assert.throws(() => s.measure('duty'));
  assert.throws(() => s.submit(['staleCommand', 'dutyClamp'], ['dmm']));
  s.submit(['staleCommand', 'dutyClamp'], ['dmm', 'timing']);
  assert.equal(s.view().result, null);
  assert.throws(() => s.submit(['sensorGain', 'dutyClamp'], ['dmm', 'timing']));
  assert.throws(() => s.measure('dmm'));
});
test('actual repair passes nominal and changed conditions across several seeded fault combinations', () => {
  for (const seed of [23, 900, 22000, 41000]) {
    const { session, answer } = fixture(seed);
    session.repair(answer[0]);
    assert.equal(session.verify().result.physicalPass, false);
    session.repair(answer[1]);
    const result = session.verify().result;
    assert.equal(result.passed, true, `seed ${seed}`);
    assert.ok(Object.values(result.transfer).every(Boolean));
    assert.notEqual(result.transferConditions.vin, 80);
    assert.equal(result.independentOracle, false);
  }
});
test('correcting the machine does not rewrite a wrong initial diagnosis', () => {
  const { session, answer } = fixture(23, ['sensorGain', 'dutyClamp']);
  for (const id of answer) session.repair(id);
  const result = session.verify().result;
  assert.equal(result.physicalPass, true);
  assert.equal(result.firstJudgmentCorrect, false);
  assert.equal(result.passed, false);
});
test('reveal excludes independent pass and replay recalculates verification instead of trusting score', () => {
  const { session, answer } = fixture();
  session.reveal(); for (const id of answer) session.repair(id);
  assert.equal(session.verify().result.passed, false);
  const record = session.exportRecord(); record.score = 100;
  const replay = Core.replay(record);
  assert.equal(replay.view().result.score, null);
  assert.equal(replay.view().result.physicalPass, true);
  assert.throws(() => Core.replay({ ...record, engineVersion: 'future' }));
  assert.throws(() => Core.replay({ ...record, actions: [{ type: 'execute-code' }] }));
});
