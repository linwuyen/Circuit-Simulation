import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Registry = require('../assets/learning/model-registry.js');

test('executable registry validates cleanly', () => {
  assert.deepEqual(Registry.validate(), []);
  assert.ok(Registry.cards.some(card => card.executable));
});

test('SPI registry model calculates frame and FIFO deadline', () => {
  const r = Registry.run('spi-frame-timing', { sclkHz: 10e6, bits: 16, fifoDepthWords: 4, serviceLatencyS: 4e-6 });
  assert.equal(r.frameTimeS, 1.6e-6);
  assert.equal(r.fifoDeadlineS, 6.4e-6);
  assert.equal(r.overrunRisk, false);
});

test('PI model clamps and reports saturation', () => {
  const r = Registry.run('pi-discrete-step', { error: 10, kp: 2, ki: 100, dtS: 0.001, previousIntegral: 0, minOutput: -5, maxOutput: 5 });
  assert.equal(r.output, 5);
  assert.equal(r.saturated, true);
});

test('DAC and DDS models stay bounded and quantized', () => {
  const dac = Registry.run('dac-code-map', { targetV: 6, fullScaleV: 5, bits: 12, bipolar: false });
  assert.equal(dac.code, 4095);
  const dds = Registry.run('dds-phase-increment', { outputHz: 1000, sampleHz: 100000, phaseBits: 32 });
  assert.ok(Number.isInteger(dds.increment));
  assert.ok(Math.abs(dds.frequencyErrorHz) < 0.1);
});
