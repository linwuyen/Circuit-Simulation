import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Models = require(path.join(repoRoot, "assets", "learning", "guided-layer-models-v1.js"));

test("sensing model quantizes and reconstructs through divider", () => {
  const result = Models.sensingSample({ physicalV: 12, rippleVpp: 0, phaseDeg: 0, divider: 0.2 });
  assert.equal(result.code, Math.round(2.4 / 3.3 * 4095));
  assert.ok(Math.abs(result.reconstructedV - 12) < 0.01);
  assert.equal(result.clipped, false);
});

test("feedback model uses voltage PI -> Iref -> current PI -> duty like buck_control.c", () => {
  const result = Models.feedbackResponse();
  assert.equal(result.architecture, "CASCADED_VOLTAGE_CURRENT_PI");
  assert.ok(result.finalV > 8);
  assert.ok(Math.abs(result.errorV) < 0.5);
  assert.ok(result.finalCurrentReference > 0);
  assert.ok(result.finalIL > 0);
  assert.ok(result.points.length > 20);
  assert.ok(result.points.every(point => Number.isFinite(point.currentReferenceA)));
  assert.ok(result.assumptions.some(text => text.includes("buck_control.c")));
});

test("feedback inner-current gain changes the command path without changing architecture", () => {
  const slow = Models.feedbackResponse({ currentKp: 0.005, currentKi: 100, durationS: 0.002 });
  const fast = Models.feedbackResponse({ currentKp: 0.05, currentKi: 1000, durationS: 0.002 });
  assert.equal(slow.architecture, fast.architecture);
  assert.notEqual(slow.finalDuty, fast.finalDuty);
});

test("dynamics model exposes LC resonance and pure-delay phase", () => {
  const result = Models.dynamicsAt({ frequencyHz: 10000, delayS: 10e-6 });
  assert.ok(result.resonantHz > 100 && result.resonantHz < 1000);
  assert.equal(Math.round(result.delayPhaseDeg), -36);
  assert.ok(Number.isFinite(result.magnitudeDb));
});

test("hardware safety path is much faster than ADC ISR path for teaching vector", () => {
  const result = Models.safetyLatency();
  assert.equal(result.hardwareNs, 230);
  assert.equal(result.softwareUs, 5.5);
  assert.ok(result.speedup > 20);
});

test("command timeout matches controller's strict greater-than semantics", () => {
  const before = Models.productionFreshness({ timeoutTicks: 500, missedTicks: 500 });
  const trip = Models.productionFreshness({ timeoutTicks: 500, missedTicks: 501 });
  assert.equal(before.faulted, false);
  assert.equal(trip.faulted, true);
  assert.equal(trip.faultTick, 501);
  assert.ok(Math.abs(trip.faultAfterMs - 5.01) < 1e-12);
});

test("Boost transfer exposes RHP-zero crossover ceiling", () => {
  const result = Models.boostTransfer({ vin: 24, vout: 48, L: 200e-6, loadOhm: 12 });
  assert.equal(result.duty, 0.5);
  assert.ok(result.rhpZeroHz > 2000);
  assert.equal(result.recommendedCrossoverMaxHz, result.rhpZeroHz / 5);
});