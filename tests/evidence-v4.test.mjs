import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Evidence = require('../assets/learning/learning-evidence.js');

test('view, practice and simulator snapshots share one V5 item state', () => {
  Evidence._resetForTests();
  Evidence.recordEvidence('buck.lesson.current-ripple', 1, 'view');
  Evidence.recordStep('buck.lesson.current-ripple', 'operate', true);
  Evidence.recordMachine('buck.lesson.current-ripple', 'simulator', { controls: { L: '100' }, metrics: ['ΔI 1.2 A'] });
  const state = Evidence.load();
  const item = state.evidence['buck.lesson.current-ripple'];
  assert.equal(state.version, 5);
  assert.equal(item.level, 2);
  assert.equal(item.steps.operate, true);
  assert.equal(item.machineCount, 1);
});

test('prediction commit before first machine event is preregistered', () => {
  Evidence._resetForTests();
  Evidence.commitPrediction('buck.lab.buck-ripple', { prediction: 'L 增加，漣波下降', parameters: 'Vin=12 V, L=2.2 uH', confidence: 0.7 });
  Evidence.recordMachine('buck.lab.buck-ripple', 'simulator', { controls: { ind: '2.2' } });
  const status = Evidence.predictionStatus('buck.lab.buck-ripple');
  assert.equal(status.committed, true);
  assert.equal(status.preRegistered, true);
  assert.ok(Date.parse(status.first.committedAt) <= Date.parse(status.firstMachineAt));
});

test('prediction written after simulator evidence is marked post-hoc', () => {
  Evidence._resetForTests();
  Evidence.recordMachine('buck.lab.buck-ripple', 'simulator', { controls: { ind: '2.2' } });
  Evidence.commitPrediction('buck.lab.buck-ripple', { prediction: 'L 增加，漣波下降', parameters: 'Vin=12 V, L=2.2 uH', confidence: 0.9 });
  assert.equal(Evidence.predictionStatus('buck.lab.buck-ripple').preRegistered, false);
});

test('report drafts do not create committed revision spam', () => {
  Evidence._resetForTests();
  Evidence.setReport('adc.lab.adc-divider', { observation: 'draft 1', draft: true });
  Evidence.setReport('adc.lab.adc-divider', { observation: 'draft 2', draft: true });
  assert.equal(Evidence.getReportHistory('adc.lab.adc-divider').length, 0);
  Evidence.setReport('adc.lab.adc-divider', { observation: 'final' });
  assert.equal(Evidence.getReportHistory('adc.lab.adc-divider').length, 1);
  assert.equal(Evidence.getReport('adc.lab.adc-divider').observation, 'final');
});

test('structured machine verification stores model provenance', () => {
  Evidence._resetForTests();
  Evidence.recordMachine('buck.lab.buck-ripple', 'simulator', { controls: { ind: '90' } }, {
    supported: true,
    passed: true,
    model: { id: 'buck-ripple-ccm', version: '2.0.0' },
    inputs: { vin: 12 }, outputs: { deltaIA: 1 }
  });
  const item = Evidence.getEvidence('buck.lab.buck-ripple');
  assert.equal(item.machineVerified, true);
  assert.deepEqual(item.modelProvenance, { id: 'buck-ripple-ccm', version: '2.0.0' });
});

test('semantic merge keeps stronger local evidence and unions question history', () => {
  Evidence._resetForTests();
  Evidence.recordEvidence('x', 3, 'worksheet', {}, { strength: 'A', stage: 'verified' });
  const local = Evidence.load();
  local.questions.q = { history: [{ id: 'a', at: '2026-08-01T00:00:00Z', correct: true }] };
  Evidence.save(local);
  Evidence.merge({ schema: Evidence.SCHEMA, version: 5, evidence: { x: { level: 2, strength: 'C', at: '2026-07-01T00:00:00Z' } }, questions: { q: { history: [{ id: 'b', at: '2026-08-02T00:00:00Z', correct: false }] } } });
  const merged = Evidence.load();
  assert.equal(merged.evidence.x.strength, 'A');
  assert.equal(merged.evidence.x.level, 3);
  assert.equal(merged.questions.q.history.length, 2);
});

test('legacy aliases preserve evidence across identity changes', () => {
  Evidence._resetForTests();
  Evidence.recordEvidence('buck.lesson.current-ripple', 2, 'practice');
  Evidence.reconcileAliases([{ id: 'buck.lesson.current-ripple', legacyIds: ['buck.lesson.2-current-ripple'] }]);
  Evidence.reconcileAliases([{ id: 'buck.lesson.inductor-ripple-design', legacyIds: ['buck.lesson.2-current-ripple'] }]);
  assert.equal(Evidence.load().evidence['buck.lesson.inductor-ripple-design'].level, 2);
});