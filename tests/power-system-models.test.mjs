import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

global.window = global;
for (const file of ['assets/learning/power-system-state-v1.js','assets/learning/power-system-models-v1.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}
const Store = global.CircuitPowerSystemStateV1;
const Models = global.CircuitPowerModelsV1;

test('shared Buck truth and sensing model stay numerically coherent', () => {
  Store.reset();
  const truth = Models.buckTruth(Store.snapshot());
  assert.equal(truth.vout, 24);
  const measured = Models.measureVout(truth.vout, Store.snapshot().sensing);
  assert.ok(Math.abs(measured.firmwareVout - 24) < 0.02);
  Store.set('sensing.offsetCounts', 100);
  const biased = Models.measureVout(truth.vout, Store.snapshot().sensing);
  assert.ok(biased.firmwareVout > measured.firmwareVout + 1.1);
});

test('timing model detects missed PWM load', () => {
  Store.reset();
  assert.equal(Models.timingState(Store.snapshot()).missed, false);
  Store.set('timing.computeUs', 8.8);
  const timing = Models.timingState(Store.snapshot());
  assert.equal(timing.missed, true);
  assert.ok(timing.apply >= 20);
});

test('Boost RHP-zero response starts in the inverse direction', () => {
  const response = Models.topologyResponse('rhp');
  assert.equal(response[0], 0);
  assert.ok(response[1] < response[0]);
  assert.ok(response.at(-1) > 0.9);
});

test('loop analysis uses true sign-change crossings and reports multiplicity', () => {
  Store.reset();
  const result = Models.analyzeLoop(Store.snapshot(), 7.5);
  for (const crossing of result.crossings) {
    assert.ok(crossing.freq >= 100 && crossing.freq <= 50000);
    assert.ok(Number.isFinite(crossing.phaseMargin));
  }
  assert.ok(['NO_CROSSOVER','SINGLE','MULTIPLE'].includes(result.status));
});

test('diagnostic measurement reduces hypothesis space quantitatively', () => {
  const scenario = Models.DEBUG_SCENARIOS.find(x => x.id === 'data');
  const result = Models.applyMeasurement(scenario, Models.HYPOTHESES.slice(), 'host');
  assert.deepEqual(result.after, ['data']);
  assert.equal(result.reduction, 80);
  assert.ok(result.bits > 2);
});
