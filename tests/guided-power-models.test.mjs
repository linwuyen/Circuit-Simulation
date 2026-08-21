import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Models = require(path.join(root, "assets", "learning", "guided-power-models-v1.js"));

test("ideal Buck lesson is equation-backed and volt-second balanced", () => {
  const m = Models.idealBuckCycle({ vin:48, vout:12, inductanceH:200e-6, switchingHz:100e3, averageCurrentA:4 });
  assert.equal(m.duty, 0.25);
  assert.ok(Math.abs(m.periodS - 10e-6) < 1e-15);
  assert.ok(Math.abs(m.onTimeS - 2.5e-6) < 1e-15);
  assert.ok(Math.abs(m.offTimeS - 7.5e-6) < 1e-15);
  assert.ok(Math.abs(m.slopeOnAps - 180000) < 1e-9);
  assert.ok(Math.abs(m.slopeOffAps + 60000) < 1e-9);
  assert.ok(Math.abs(m.rippleA - 0.45) < 1e-12);
  assert.ok(Math.abs(m.voltSecondResidualVs) < 1e-15);
  assert.equal(m.ccm, true);
  assert.ok(Math.abs(m.points.at(-1).iLA - m.currentMinA) < 1e-12);
});

test("larger inductance lowers current slope and ripple without changing ideal duty", () => {
  const a = Models.idealBuckCycle({ vin:48, vout:12, inductanceH:100e-6, switchingHz:100e3, averageCurrentA:4 });
  const b = Models.idealBuckCycle({ vin:48, vout:12, inductanceH:400e-6, switchingHz:100e3, averageCurrentA:4 });
  assert.equal(a.duty, b.duty);
  assert.ok(b.slopeOnAps < a.slopeOnAps);
  assert.ok(b.rippleA < a.rippleA);
  assert.ok(Math.abs(a.rippleA / b.rippleA - 4) < 1e-12);
});

test("sample-to-actuate model uses strict shadow-load timing", () => {
  const pass = Models.sampleToActuate({ switchingHz:100e3, adcS:1.2e-6, isrEntryS:0.3e-6, computeS:4e-6, crossoverHz:10e3 });
  assert.ok(Math.abs(pass.computeDoneS - 5.5e-6) < 1e-15);
  assert.ok(Math.abs(pass.commitS - 10e-6) < 1e-15);
  assert.equal(pass.missedLoadEvents, 0);
  assert.ok(Math.abs(pass.timingPhaseDeg + 36) < 1e-12);

  const miss = Models.sampleToActuate({ switchingHz:100e3, adcS:1.2e-6, isrEntryS:0.3e-6, computeS:9e-6, crossoverHz:10e3 });
  assert.ok(Math.abs(miss.computeDoneS - 10.5e-6) < 1e-15);
  assert.ok(Math.abs(miss.commitS - 20e-6) < 1e-15);
  assert.equal(miss.missedLoadEvents, 1);
  assert.ok(Math.abs(miss.timingPhaseDeg + 72) < 1e-12);
});

test("exactly-on-ZERO write is treated as too late and transfer can expose a miss", () => {
  const exact = Models.sampleToActuate({ switchingHz:100e3, adcS:1e-6, isrEntryS:1e-6, computeS:8e-6, crossoverHz:10e3 });
  assert.equal(exact.missedLoadEvents, 1);
  assert.ok(Math.abs(exact.commitS - 20e-6) < 1e-15);

  const transfer = Models.timingTransfer({ switchingHz:100e3, transferSwitchingHz:200e3, adcS:1.2e-6, isrEntryS:0.3e-6, computeS:4e-6, crossoverHz:10e3 });
  assert.equal(transfer.base.missedLoadEvents, 0);
  assert.equal(transfer.transfer.missedLoadEvents, 1);
  assert.ok(Math.abs(transfer.transfer.periodS - 5e-6) < 1e-15);
  assert.ok(Math.abs(transfer.transfer.commitS - 10e-6) < 1e-15);
});

test("lesson model rejects inputs that violate the ideal Buck contract", () => {
  assert.throws(() => Models.idealBuckCycle({ vin:12, vout:12 }), /requires 0 < vout < vin/);
  assert.throws(() => Models.idealBuckCycle({ vin:48, vout:12, inductanceH:0 }), /> 0/);
});
