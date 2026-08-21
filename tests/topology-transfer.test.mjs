import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Transfer = require(path.join(root, "assets", "learning", "topology-transfer-v1.js"));

test("P5 Boost RHP zero moves down as duty or inductance increases", () => {
  const a = Transfer.boostCCM({ vin:48, duty:0.4, inductanceH:300e-6, loadOhm:48 });
  const b = Transfer.boostCCM({ vin:48, duty:0.7, inductanceH:300e-6, loadOhm:48 });
  const c = Transfer.boostCCM({ vin:48, duty:0.4, inductanceH:600e-6, loadOhm:48 });
  assert.ok(b.rhpzHz < a.rhpzHz);
  assert.ok(c.rhpzHz < a.rhpzHz);
  assert.equal(a.nonMinimumPhase, true);
});

test("P5 PFC exposes double-line energy scale and outer-loop ceiling", () => {
  const pfc = Transfer.pfcBoost({ vrms:230, powerW:1500, vbus:400, busCapF:680e-6, lineHz:50 });
  assert.equal(pfc.doubleLineHz, 100);
  assert.equal(pfc.suggestedOuterLoopMaxHz, 10);
  assert.ok(pfc.inputCurrentPeak > pfc.inputCurrentRms);
  assert.ok(pfc.busRippleVpk > 0);
});

test("P5 PSFB ZVS energy margin collapses quadratically toward light load", () => {
  const heavy = Transfer.psfb({ vin:400, phaseDeg:90, turnsRatio:0.1, leakageH:5e-6, primaryCurrentA:10, commutationCapF:2e-9 });
  const light = Transfer.psfb({ vin:400, phaseDeg:90, turnsRatio:0.1, leakageH:5e-6, primaryCurrentA:2, commutationCapF:2e-9 });
  assert.ok(light.zvsEnergyMargin < heavy.zvsEnergyMargin);
  assert.ok(Math.abs(light.zvsEnergyMargin / heavy.zvsEnergyMargin - 0.04) < 1e-12);
});

test("P5 LLC FHA gain is unity at normalized resonance and changes with operating point", () => {
  assert.ok(Math.abs(Transfer.llcFhaGain(1,5,0.5)-1) < 1e-12);
  const near = Transfer.llc({ resonantInductanceH:30e-6, resonantCapF:100e-9, magnetizingInductanceH:150e-6, q:0.5, switchingHz:91888 });
  const shifted = Transfer.llc({ resonantInductanceH:30e-6, resonantCapF:100e-9, magnetizingInductanceH:150e-6, q:1.2, switchingHz:130000 });
  assert.notEqual(near.gain, shifted.gain);
  assert.equal(shifted.operatingPointDependent, true);
});

test("P5 inverter distinguishes LC and LCL resonance", () => {
  const lc = Transfer.inverter({ mode:"lc", dcBusV:400, modulationIndex:0.8, l1H:2e-3, capF:10e-6 });
  const lcl = Transfer.inverter({ mode:"lcl", dcBusV:400, modulationIndex:0.8, l1H:2e-3, capF:10e-6, l2H:1e-3 });
  assert.ok(lc.resonanceHz > 0);
  assert.ok(lcl.resonanceHz > 0);
  assert.notEqual(lc.resonanceHz, lcl.resonanceHz);
  assert.equal(lcl.resonanceNeedsDamping, true);
});

test("P5 unseen challenge set covers every transfer topology", () => {
  const cases = Transfer.challengeSet(42);
  assert.deepEqual(cases.map(item=>item.topology), ["boost","pfc","psfb","llc","inverter"]);
  assert.equal(new Set(cases.map(item=>item.id)).size, 5);
  assert.equal(cases.every(item=>item.choices.includes(item.expected)), true);
});
