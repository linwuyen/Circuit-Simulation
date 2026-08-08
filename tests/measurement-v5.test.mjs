import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Oracles = require('../assets/learning/lab-oracles.js');
const Registry = require('../assets/learning/model-registry.js');
const Challenges = require('../assets/learning/engineering-challenges.js');

test('buck oracle records model provenance and passes near 20 percent ripple', () => {
  const result = Oracles.verify('buck.lab.buck-ripple', {
    controls: { ind: '12', fsw: '500', load: '2' }, metrics: []
  }, Registry);
  assert.equal(result.supported, true);
  assert.equal(result.passed, true);
  assert.equal(result.model.id, 'buck-ripple-ccm');
  assert.equal(result.model.version, Registry.get('buck-ripple-ccm').version);
  assert.ok(Math.abs(result.acceptance.measured - 0.20) < 0.02);
});

test('buck oracle does not confuse interaction with verification', () => {
  const result = Oracles.verify('buck.lab.buck-ripple', {
    controls: { ind: '2.2', fsw: '500', load: '2' }, metrics: []
  }, Registry);
  assert.equal(result.supported, true);
  assert.equal(result.passed, false);
});

test('numeric open response accepts correct value and unit conversion', () => {
  const direct = Challenges.evaluateNumeric('buck-open-inductance', 90, 'uH');
  const henry = Challenges.evaluateNumeric('buck-open-inductance', 90e-6, 'H');
  assert.equal(direct.correct, true);
  assert.equal(henry.correct, true);
  assert.ok(Math.abs(direct.expected - 90) < 1e-9);
});

test('numeric open response rejects a materially wrong answer', () => {
  assert.equal(Challenges.evaluateNumeric('spi-open-frame-time', 32, 'us').correct, false);
  assert.equal(Challenges.evaluateNumeric('spi-open-frame-time', 3.2, 'us').correct, true);
});

test('diagnostic game rewards low-cost high-information root cause path', () => {
  const efficient = Challenges.scoreDiagnostic('spi-overrun-game', ['fifo-level'], 'fifo-service');
  const wasteful = Challenges.scoreDiagnostic('spi-overrun-game', ['scope-mosi', 'change-cpol', 'fifo-level'], 'fifo-service');
  assert.equal(efficient.solved, true);
  assert.ok(efficient.efficiency > wasteful.efficiency);
});