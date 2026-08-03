import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const models = require("../assets/learning/engineering-models.js");

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test("buck CCM ripple uses SI units and reports CCM", () => {
  const result = models.calculateBuckRipple({
    vin: 12,
    vout: 3.3,
    inductanceH: 2.2e-6,
    switchingHz: 500e3,
    outputCurrentA: 2
  });
  near(result.duty, 0.275, 1e-12);
  near(result.deltaIA, 2.175, 1e-12);
  assert.equal(result.mode, "CCM");
  assert.ok(result.valleyA > 0);
  assert.equal(result.formulaValid, true);
});

test("buck stops presenting a negative valley in DCM", () => {
  const result = models.calculateBuckRipple({
    vin: 12,
    vout: 3.3,
    inductanceH: 1e-6,
    switchingHz: 100e3,
    outputCurrentA: 0.1
  });
  assert.equal(result.mode, "DCM");
  assert.equal(result.valleyA, 0);
  assert.equal(result.formulaValid, false);
  assert.match(result.warning, /DCM/);
});

test("ideal ADC uses 2^N levels and floors the code", () => {
  const result = models.quantizeAdc({ voltageV: 1.65, vrefV: 3.3, bits: 12 });
  assert.equal(result.levels, 4096);
  assert.equal(result.maxCount, 4095);
  near(result.lsbV, 3.3 / 4096, 1e-15);
  assert.equal(result.count, 2048);
});

test("ADC clamps at the high rail", () => {
  const result = models.quantizeAdc({ voltageV: 3.3, vrefV: 3.3, bits: 12 });
  assert.equal(result.count, 4095);
  assert.equal(result.saturatedHigh, true);
});

test("divider power uses divider current rather than applying the full bus to Rtop", () => {
  const result = models.calculateDivider({
    busV: 400,
    topOhm: 1e6,
    bottomOhm: 6.8e3,
    vrefV: 3.3,
    bits: 12
  });
  const expectedCurrent = 400 / 1006800;
  near(result.currentA, expectedCurrent, 1e-15);
  near(result.topPowerW, expectedCurrent ** 2 * 1e6, 1e-12);
  assert.ok(result.topPowerW < 0.16);
  near(result.totalPowerW, result.topPowerW + result.bottomPowerW, 1e-12);
});

test("current chain maps a 1.65 V midpoint to the zero code", () => {
  const result = models.calculateCurrentChain({
    currentA: 0,
    shuntOhm: 0.005,
    gain: 8.2,
    offsetV: 1.65,
    vrefV: 3.3,
    bits: 12
  });
  assert.equal(result.adc.count, 2048);
  assert.equal(result.zeroCount, 2048);
  assert.equal(result.adc.saturated, false);
});

test("sampled total power factor is based on P over VA", () => {
  const count = 720;
  const voltage = Array.from({ length: count }, (_, i) => 170 * Math.sin(2 * Math.PI * i / count));
  const current = Array.from({ length: count }, (_, i) => 14 * Math.sin(2 * Math.PI * i / count + Math.PI / 3));
  const result = models.powerMetrics(voltage, current);
  near(result.totalPowerFactor, 0.5, 1e-12);
  near(models.displacementPowerFactor(60), 0.5, 1e-12);
});