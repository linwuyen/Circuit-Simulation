import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const evidenceSource = fs.readFileSync(new URL('../assets/learning/learning-evidence.js', import.meta.url), 'utf8');
const flowSource = fs.readFileSync(new URL('../assets/learning/core-flow-v1.js', import.meta.url), 'utf8');
function fixture() {
  const values = new Map(); let blocked = false;
  const storage = { getItem: k => values.get(k) ?? null, setItem(k, v) { if (blocked) throw new Error('quota'); values.set(k, String(v)); }, removeItem: k => values.delete(k) };
  const ctx = vm.createContext({ localStorage: storage });
  vm.runInContext(evidenceSource, ctx); vm.runInContext(flowSource, ctx);
  return { Flow: ctx.CircuitCoreFlowV1, Evidence: ctx.CircuitEvidence, values, block: x => { blocked = x; } };
}
test('both pending stores survive successive failed writes and share retry + full backup', () => {
  const { Flow, Evidence, values, block } = fixture();
  Flow.select('physics'); Evidence.recordEvidence('lab', 1, 'test');
  block(true);
  Flow.recordPrediction('sensing', 'low', false); Flow.recordInteraction('sensing'); Flow.recordRemediation('sensing', true); Flow.complete('sensing');
  Evidence.recordEvidence('lab', 2, 'test');
  assert.equal(Flow.progress().done, 1); assert.equal(Evidence.storageStatus().saved, false);
  const backup = JSON.parse(Evidence.exportBackup());
  assert.equal(backup.auxiliary.coreFlow.predictions.sensing.correct, false);
  assert.ok(backup.auxiliary.coreFlow.completed.sensing);
  assert.equal(backup.evidence.lab.level, 2);
  block(false); assert.equal(Evidence.retrySave().saved, true);
  assert.ok(JSON.parse(values.get(Flow.STORAGE_KEY)).completed.sensing);
});
test('corrupt mainline data is kept until a backup and replacement can be stored', () => {
  const { Flow, Evidence, values, block } = fixture();
  values.set(Flow.STORAGE_KEY, '{bad'); block(true);
  Flow.recordPrediction('physics', 'half', true); Flow.recordInteraction('physics');
  assert.equal(values.get(Flow.STORAGE_KEY), '{bad');
  block(false); Evidence.retrySave();
  assert.equal(values.get(Flow.STORAGE_KEY + '-corrupt-backup'), '{bad');
  assert.equal(Flow.ready('physics'), true);
});
test('full restore preserves local first answers while restoring other mainline completion', () => {
  const source = fixture(); source.Flow.recordPrediction('physics', 'half', true); source.Flow.recordInteraction('physics'); source.Flow.complete('physics');
  source.Evidence.recordEvidence('lab', 2, 'test');
  const backup = JSON.parse(source.Evidence.exportBackup());
  const target = fixture(); target.Flow.recordPrediction('physics', 'double', false);
  target.Evidence.merge(backup);
  assert.equal(target.Flow.snapshot().predictions.physics.choice, 'double');
  assert.equal(target.Flow.progress().done, 0);
  assert.equal(target.Evidence.load().evidence.lab.level, 2);
  const blank = fixture(); blank.Evidence.merge(backup); assert.equal(blank.Flow.progress().done, 1);
});

test('full backup restores formal outcomes on a fresh device and archives conflicting first attempts', () => {
  const source = fixture(), state = source.Evidence.load();
  state.benchmark.outcomeV1 = { seed: 1, profile: 'core8', instrumentVersion: 2, sessions: { pre: { firstAttempts: { a: { correct: true } } } }, retention: { r1: 'due' } };
  source.Evidence.save(state);
  const backup = JSON.parse(source.Evidence.exportBackup());
  const target = fixture(); target.Evidence.merge(backup);
  assert.equal(target.Evidence.load().benchmark.outcomeV1.seed, 1);
  assert.equal(target.Evidence.load().benchmark.outcomeV1.retention.r1, 'due');
  const conflict = structuredClone(backup); conflict.benchmark.outcomeV1.seed = 2;
  target.Evidence.merge(conflict);
  assert.equal(target.Evidence.load().benchmark.outcomeV1.seed, 1);
  assert.equal(target.Evidence.load().benchmark.outcomeBackupArchives[0].seed, 2);
});
