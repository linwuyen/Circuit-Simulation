import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const models = require("../assets/learning/engineering-models.js");

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("buck ripple never increases when inductance or switching frequency increases", () => {
  for (let i = 1; i <= 40; i++) {
    const vin = 24 + i;
    const vout = 5 + (i % 8);
    if (vout >= vin) continue;
    const base = models.calculateBuckRipple({ vin, vout, inductanceH: 40e-6, switchingHz: 100e3, outputCurrentA: 10 });
    const largerL = models.calculateBuckRipple({ vin, vout, inductanceH: 80e-6, switchingHz: 100e3, outputCurrentA: 10 });
    const higherF = models.calculateBuckRipple({ vin, vout, inductanceH: 40e-6, switchingHz: 200e3, outputCurrentA: 10 });
    assert.ok(largerL.deltaIA <= base.deltaIA);
    assert.ok(higherF.deltaIA <= base.deltaIA);
  }
});

test("buck current valley is never negative in the public model", () => {
  for (const outputCurrentA of [0, 0.01, 0.1, 1, 5]) {
    const result = models.calculateBuckRipple({ vin: 48, vout: 12, inductanceH: 10e-6, switchingHz: 100e3, outputCurrentA });
    assert.ok(result.valleyA >= 0);
    if (outputCurrentA < result.boundaryCurrentA) assert.equal(result.mode, "DCM");
  }
});

test("ADC code is monotonic and bounded", () => {
  let previous = -1;
  for (let millivolts = -100; millivolts <= 3500; millivolts += 5) {
    const result = models.quantizeAdc({ voltageV: millivolts / 1000, vrefV: 3.3, bits: 12 });
    assert.ok(result.count >= 0 && result.count <= 4095);
    assert.ok(result.count >= previous);
    previous = result.count;
  }
});

test("more ADC bits reduce LSB size", () => {
  const adc12 = models.quantizeAdc({ voltageV: 1, vrefV: 3.3, bits: 12 });
  const adc16 = models.quantizeAdc({ voltageV: 1, vrefV: 3.3, bits: 16 });
  assert.ok(adc16.lsbV < adc12.lsbV);
});

test("divider conserves voltage and power", () => {
  for (const busV of [12, 48, 400, 800]) {
    const result = models.calculateDivider({ busV, topOhm: 1e6, bottomOhm: 6.8e3, vrefV: 3.3, bits: 12 });
    near(result.topVoltageV + result.bottomVoltageV, busV, 1e-9);
    near(result.topPowerW + result.bottomPowerW, result.totalPowerW, 1e-12);
    near(result.totalPowerW, busV * result.currentA, 1e-12);
  }
});
