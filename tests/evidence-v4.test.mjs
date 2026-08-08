import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Evidence = require('../assets/learning/learning-evidence.js');

test('view, practice and simulator snapshots share one item state', () => {
  Evidence._resetForTests();
  Evidence.recordEvidence('buck.lesson.current-ripple', 1, 'view');
  Evidence.recordStep('buck.lesson.current-ripple', 'operate', true);
  Evidence.recordMachine('buck.lesson.current-ripple', 'simulator', { controls: { L: '100' }, metrics: ['ΔI 1.2 A'] });
  const state = Evidence.load();
  const item = state.evidence['buck.lesson.current-ripple'];
  assert.equal(item.level, 2);
  assert.equal(item.steps.operate, true);
  assert.equal(item.machineCount, 1);
  assert.ok(item.sources.includes('simulator'));
});

test('identical consecutive machine snapshots are deduplicated', () => {
  Evidence._resetForTests();
  const snapshot = { controls: { fsw: '100' }, metrics: ['10 us'] };
  Evidence.recordMachine('spi.lab.frame', 'simulator', snapshot);
  Evidence.recordMachine('spi.lab.frame', 'simulator', snapshot);
  assert.equal(Evidence.machineEvents('spi.lab.frame').length, 1);
});

test('report and evidence are persisted in the same v4 state', () => {
  Evidence._resetForTests();
  Evidence.setReport('adc.lab.divider', { prediction: 'Rtop 增加，ADC 電壓下降。' });
  Evidence.recordEvidence('adc.lab.divider', 3, 'worksheet-human-only');
  const state = Evidence.load();
  assert.equal(state.version, 4);
  assert.equal(state.reports['adc.lab.divider'].prediction.includes('下降'), true);
  assert.equal(state.evidence['adc.lab.divider'].level, 3);
});
