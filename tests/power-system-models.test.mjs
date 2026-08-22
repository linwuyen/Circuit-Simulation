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
  assert.equal(timing.missedLoads, 1);
  assert.equal(timing.apply, 20);
});

test('timing deadline is strict and an exact-boundary write waits one more load', () => {
  Store.reset();
  Store.set('timing.computeUs', 6.45); // 2.5 + .25 + .45 + .35 + 6.45 = 10.00 us
  const timing = Models.timingState(Store.snapshot());
  assert.ok(Math.abs(timing.write - 10) < 1e-9);
  assert.equal(timing.missed, true);
  assert.equal(timing.missedLoads, 1);
  assert.equal(timing.apply, 20);
});

test('PI surrogate carries every missed shadow-load cycle into its command queue', () => {
  Store.reset();
  Store.set('timing.sampleUs', 8);
  Store.set('timing.computeUs', 12);
  const timing = Models.timingState(Store.snapshot());
  assert.equal(timing.apply, 30);
  assert.equal(timing.missedLoads, 2);
  const sim = Models.simulatePi(Store.snapshot());
  assert.equal(sim.delayCycles, 2);
});

test('Boost qualitative signature starts in the inverse direction', () => {
  const response = Models.topologyResponse('rhp');
  assert.equal(response[0], 0);
  assert.ok(response[1] < response[0]);
  assert.ok(response.at(-1) > 0.9);
});

test('Buck loop plant includes load damping and capacitor ESR terms', () => {
  Store.reset();
  const state = Store.snapshot();
  const f = 500;
  const w = 2 * Math.PI * f;
  const { inductance:L, capacitance:C, load:R, esr:Rc } = state.plant;
  const num = { re:1, im:w * Rc * C };
  const den = { re:1 - w*w*L*C*(1 + Rc/R), im:w*(L/R + Rc*C) };
  const d2 = den.re*den.re + den.im*den.im;
  const plant = {
    re:(num.re*den.re + num.im*den.im)/d2,
    im:(num.im*den.re - num.re*den.im)/d2
  };
  const controller = { re:state.control.kp, im:-state.control.ki/w };
  const expectedMag = Math.hypot(
    controller.re*plant.re - controller.im*plant.im,
    controller.re*plant.im + controller.im*plant.re
  );
  const actual = Models.buckLoopPoint(f, 0, state);
  assert.ok(Math.abs(actual.magDb - 20*Math.log10(expectedMag)) < 1e-9);
});

test('loop analysis scans low enough to retain the real low-frequency crossing', () => {
  Store.reset();
  const result = Models.analyzeLoop(Store.snapshot(), 7.5);
  assert.equal(result.minHz, 1);
  assert.ok(result.maxHz <= Store.get('plant.fsw') * 0.45 + 1e-9);
  assert.ok(result.crossings.some(crossing => crossing.freq < 100));
  for (const crossing of result.crossings) {
    assert.ok(crossing.freq >= result.minHz && crossing.freq <= result.maxHz);
    assert.ok(Number.isFinite(crossing.phaseMargin));
  }
  assert.ok(['NO_CROSSOVER','SINGLE','MULTIPLE'].includes(result.status));
});

test('loop probe phase preserves full pure-delay rotation instead of wrapping at 180 degrees', () => {
  Store.reset();
  const point = Models.buckLoopPoint(40000, 25, Store.snapshot());
  assert.ok(point.phase < -360);
});

test('diagnostic measurement reduces hypothesis space quantitatively', () => {
  const scenario = Models.DEBUG_SCENARIOS.find(x => x.id === 'data');
  const result = Models.applyMeasurement(scenario, Models.HYPOTHESES.slice(), 'host');
  assert.deepEqual(result.after, ['data']);
  assert.equal(result.reduction, 80);
  assert.ok(result.bits > 2);
});
