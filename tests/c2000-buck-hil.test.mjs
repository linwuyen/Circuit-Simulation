import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Hil = require(path.join(repoRoot, "19_c2000_buck_firmware_lab", "hil", "hil-models.js"));

test("C2000 Buck HIL nominal and load-step remain regulated", () => {
  const nominal = Hil.runScenario("nominal");
  const load = Hil.runScenario("load-step");
  assert.equal(nominal.pass, true);
  assert.equal(load.pass, true);
  assert.ok(Math.abs(nominal.vout - 12) < 0.35);
  assert.ok(Math.abs(load.vout - 12) < 0.35);
  assert.equal(nominal.faultLatch, 0);
  assert.equal(load.faultLatch, 0);
});

test("hardware-class faults fail closed deterministically", () => {
  for (const name of ["ocp", "ovp", "adc-stuck"]) {
    const result = Hil.runScenario(name);
    assert.equal(result.pass, true, `${name} should pass its fail-closed contract`);
    assert.equal(result.duty, 0);
    assert.ok(result.tripLatencyTicks <= 1, `${name} trip latency`);
  }
});

test("stale command trips only after the freshness budget", () => {
  const result = Hil.runScenario("command-timeout");
  assert.equal(result.pass, true);
  assert.equal(result.duty, 0);
  assert.ok(result.tripLatencyTicks >= Hil.DEFAULTS.commandTimeoutTicks);
  assert.ok(result.tripLatencyTicks <= Hil.DEFAULTS.commandTimeoutTicks + 1);
});

test("board evidence contract requires eight physical captures", () => {
  const evidence = Hil.boardEvidenceContract();
  assert.equal(evidence.length, 8);
  assert.equal(new Set(evidence.map(item => item.id)).size, 8);
  assert.ok(evidence.some(item => item.id === "trip"));
  assert.ok(evidence.some(item => item.id === "gpio"));
});

test("F2838x binding uses driverlib timing and fail-closed safety path", () => {
  const file = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "f2838x_target.c"), "utf8");
  for (const api of [
    "EPWM_setADCTriggerSource",
    "ADC_setupSOC",
    "ADC_setInterruptSource",
    "CMPSS_configHighComparator",
    "EPWM_selectDigitalCompareTripInput",
    "EPWM_enableTripZoneSignals",
    "EPWM_setTripZoneAction",
    "EPWM_setCounterCompareValue",
    "GPIO_writePin"
  ]) assert.ok(file.includes(api), `target binding should contain ${api}`);
});
