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

test("disabled target remains OFF without pretending a command heartbeat", () => {
  const result = Hil.runScenario("idle-off");
  assert.equal(result.pass, true);
  assert.equal(result.state, "OFF");
  assert.equal(result.duty, 0);
  assert.equal(result.faultLatch, 0);
});

test("HIL contract owns cadence and physical Vin/iL semantics", () => {
  assert.equal(Hil.DEFAULTS.controlPeriodS, 1e-5);
  assert.equal(Hil.DEFAULTS.vin, 48);
  const source = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "buck_control.c"), "utf8");
  const header = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "buck_control.h"), "utf8");
  assert.match(header, /float control_period_s;/);
  assert.match(header, /float vin;/);
  assert.match(header, /float iL;/);
  assert.doesNotMatch(header, /float iout;/);
  assert.match(source, /const float dt = config->control_period_s;/);
  assert.match(source, /state->soft_vref \/ input->vin/);
  assert.doesNotMatch(source, /soft_vref \/ 48\.0f/);
});

test("board evidence contract requires eight physical captures", () => {
  const evidence = Hil.boardEvidenceContract();
  assert.equal(evidence.length, 8);
  assert.equal(new Set(evidence.map(item => item.id)).size, 8);
  assert.ok(evidence.some(item => item.id === "trip"));
  assert.ok(evidence.some(item => item.id === "gpio"));
});

test("F2838x binding closes timing, ADC, XBAR and command-ownership P0 gaps", () => {
  const file = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "f2838x_target.c"), "utf8");
  for (const api of [
    "SysCtl_disablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC)",
    "EPWM_setTimeBaseCounterMode",
    "EPWM_setCounterCompareShadowLoadMode",
    "EPWM_setActionQualifierAction",
    "EPWM_setADCTriggerSource",
    "ADC_setPrescaler",
    "ADC_setMode",
    "ADC_enableConverter",
    "DEVICE_DELAY_US(500U)",
    "ADC_setupSOC",
    "CMPSS_configHighComparator",
    "CMPSS_configOutputsHigh",
    "XBAR_setEPWMMuxConfig",
    "XBAR_enableEPWMMux",
    "EPWM_selectDigitalCompareTripInput",
    "EPWM_setDigitalCompareEventSyncMode",
    "EPWM_enableTripZoneSignals",
    "EPWM_forceTripZoneEvent",
    "BuckTarget_publishCommand",
    "SysCtl_enablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC)"
  ]) assert.ok(file.includes(api), `target binding should contain ${api}`);
  assert.match(file, /input\.command_heartbeat = \(command\.sequence != gLastCommandSequence\)/);
  assert.doesNotMatch(file, /input\.command_heartbeat\s*=\s*1U/);
  assert.doesNotMatch(file, /input\.enable_request\s*=\s*1U/);
  assert.match(file, /slots\[2\]/);
  assert.match(file, /gCommand\.active_slot = next;/);
  assert.doesNotMatch(file, /while \(\(before != after\)/);
});
