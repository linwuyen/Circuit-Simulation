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
  for (const name of ["ocp", "ovp", "adc-stuck", "adc-overflow", "hardware-trip"]) {
    const result = Hil.runScenario(name);
    assert.equal(result.pass, true, `${name} should pass its fail-closed contract`);
    assert.equal(result.duty, 0);
    assert.ok(result.tripLatencyTicks <= 1, `${name} trip latency`);
  }
});

test("fault clear is a fresh one-shot command event, not a held mailbox level", () => {
  const result = Hil.runFaultClearScenario();
  assert.equal(result.unsafeClearRejected, true);
  assert.equal(result.heldLevelRejected, true);
  assert.equal(result.freshClearAccepted, true);
  assert.equal(result.state, "OFF");
  assert.equal(result.faultLatch, 0);
});

test("HIL command snapshots preserve C uint16 enable semantics", () => {
  const tracker = Hil.createCommandTracker();
  const disabled = Hil.consumeCommand(tracker, { sequence: 1, clearFaultToken: 0, enable: 0 });
  const enabled = Hil.consumeCommand(tracker, { sequence: 2, clearFaultToken: 0, enable: 1 });
  const booleanDisabled = Hil.consumeCommand(tracker, { sequence: 3, clearFaultToken: 0, enable: false });

  assert.equal(disabled.enable, false);
  assert.equal(enabled.enable, true);
  assert.equal(booleanDisabled.enable, false);
});

test("stale enabled command trips only after the freshness budget", () => {
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

  const hilSource = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "hil", "hil-models.js"), "utf8");
  const controlSource = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "buck_control.c"), "utf8");
  assert.match(hilSource, /const heartbeat = input\.heartbeat === true;/);
  assert.match(hilSource, /if \(name === "idle-off"\) \{[\s\S]*?input\.enable = false;[\s\S]*?input\.heartbeat = false;/);
  assert.match(hilSource, /if \(enable && s\.commandAge > c\.commandTimeoutTicks\)/);
  assert.match(controlSource, /input->enable_request && state->command_age_ticks > config->command_timeout_ticks/);
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

test("Module 19 exposes one ordered eight-layer path and keeps transfer optional", () => {
  const html = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "index.html"), "utf8");
  const steps = [...html.matchAll(/data-core-step="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(steps, ["physics", "sensing", "feedback", "timing", "dynamics", "safety", "production", "evidence"]);
  assert.match(html, /data-optional-tool="transfer"/);
  assert.doesNotMatch(html, /data-core-layer-panel="transfer"/);
  assert.match(html, /data-core-layer-panel="evidence" data-show-modes="guided explain firmware debug sandbox"/);
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
  assert.match(file, /input\.clear_fault_request = \(command\.clear_fault_token != gLastClearFaultToken\)/);
  assert.match(file, /clear_fault && !gPublishedClearFaultLevel/);
  assert.doesNotMatch(file, /input\.clear_fault_request\s*=\s*command\.clear_fault;/);
  assert.doesNotMatch(file, /input\.command_heartbeat\s*=\s*1U/);
  assert.doesNotMatch(file, /input\.enable_request\s*=\s*1U/);
  assert.match(file, /slots\[2\]/);
  assert.match(file, /gCommand\.active_slot = next;/);
  assert.doesNotMatch(file, /while \(\(before != after\)/);
});

test("F2838x target mirrors ADC overflow and asynchronous DCAEVT1 into software safety state", () => {
  const file = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "f2838x_target.c"), "utf8");
  const header = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "buck_control.h"), "utf8");
  const control = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "buck_control.c"), "utf8");
  assert.match(file, /ADC_getInterruptOverflowStatus/);
  assert.match(file, /ADC_clearInterruptOverflowStatus/);
  assert.match(file, /input\.sensor_valid = adcOverflow \? 0U : 1U;/);
  assert.match(file, /input\.hardware_trip_active = hardwareTripActive;/);
  assert.match(file, /#define BUCK_BOARD_CALIBRATION_VALID 0U/);
  assert.match(header, /uint16_t hardware_trip_active;/);
  assert.match(header, /uint16_t peripherals_ready;/);
  assert.match(header, /uint16_t calibration_valid;/);
  assert.match(control, /input->hardware_trip_active\) detected \|= BUCK_FAULT_OCP;/);
  assert.match(control, /!input->peripherals_ready \|\| !input->calibration_valid/);
});

test("F2838x reference current range reaches software OCP and trip evidence counts edges", () => {
  const file = fs.readFileSync(path.join(repoRoot, "19_c2000_buck_firmware_lab", "firmware", "f2838x_target.c"), "utf8");
  assert.match(file, /#define IL_AMPS_PER_ADC_V\s+6\.0f/);
  assert.match(file, /#define CONTROL_HW_OCP_AMPS\s+8\.6f/);
  assert.match(file, /#define CONTROL_OCP_DAC_VOLTS\s+\(IL_ZERO_ADC_V \+ \(CONTROL_HW_OCP_AMPS \/ IL_AMPS_PER_ADC_V\)\)/);
  assert.match(file, /static uint16_t gHardwareTripActive = 0U;/);
  assert.match(file, /if \(hardwareTripActive && !gHardwareTripActive\) gHardwareTripCount\+\+;/);
  assert.match(file, /gHardwareTripActive = hardwareTripActive;/);
  assert.doesNotMatch(file, /if \(\(tzFlags & EPWM_TZ_FLAG_DCAEVT1\) != 0U\) gHardwareTripCount\+\+;/);
});
