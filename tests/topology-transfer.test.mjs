import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Transfer = require(path.join(root, "assets", "learning", "topology-transfer-v1.js"));
const close = (a,b,tol=1e-9) => assert.ok(Math.abs(a-b) <= tol*Math.max(1,Math.abs(a),Math.abs(b)), `${a} != ${b}`);

test("Boost CCM equation-grade model preserves DC gain, LC pole and moving RHP zero", () => {
  const p={ vin:48, duty:0.4, inductanceH:300e-6, capacitanceF:220e-6, loadOhm:48 };
  const a=Transfer.boostCCM(p);
  const b=Transfer.boostCCM({ ...p, duty:0.7 });
  const c=Transfer.boostCCM({ ...p, inductanceH:600e-6 });
  close(a.vout,48/0.6);
  close(a.dcGain,48/(0.6*0.6));
  close(a.rhpzHz,48*0.6*0.6/(2*Math.PI*300e-6));
  close(a.resonanceHz,0.6/(2*Math.PI*Math.sqrt(300e-6*220e-6)));
  assert.ok(b.rhpzHz < a.rhpzHz);
  assert.ok(c.rhpzHz < a.rhpzHz);
  assert.equal(a.nonMinimumPhase,true);
  assert.equal(a.fidelity,"EQUATION_GRADE_IDEAL_CCM");

  const nearDc=Transfer.boostControlToOutputAt(p,0.001);
  close(nearDc.magnitude,a.dcGain,2e-5);
  assert.ok(nearDc.phaseDeg < 0);
});

test("Boost RHP zero adds negative phase while its magnitude numerator rises", () => {
  const p={ vin:48, duty:0.55, inductanceH:300e-6, capacitanceF:220e-6, loadOhm:48 };
  const op=Transfer.boostCCM(p);
  const atRhp=Transfer.boostControlToOutputAt(p,op.rhpzHz);
  assert.ok(atRhp.phaseDeg < -90);
  assert.ok(Number.isFinite(atRhp.magnitudeDb));
});

test("PFC separates stiff-bus current plant, slow energy plant, and forced 2omega ripple", () => {
  const pfc=Transfer.pfcBoost({ vrms:230, powerW:1500, vbus:400, busCapF:680e-6, lineHz:50, inductanceH:500e-6 });
  assert.equal(pfc.doubleLineHz,100);
  assert.equal(pfc.suggestedOuterLoopMaxHz,10);
  close(pfc.loadOhm,400*400/1500);
  assert.ok(pfc.outerPoleHz > 0);
  assert.ok(pfc.inputCurrentPeak > pfc.inputCurrentRms);
  assert.ok(pfc.busRippleVpk > 0);

  const inner=Transfer.pfcCurrentPlantAt({ vbus:400, inductanceH:500e-6 },1000);
  close(inner.magnitude,400/(2*Math.PI*1000*500e-6));
  close(inner.phaseDeg,-90);

  const outerLow=Transfer.pfcVoltagePlantAt({ vrms:230, powerW:1500, vbus:400, busCapF:680e-6 },0.01);
  const outerHigh=Transfer.pfcVoltagePlantAt({ vrms:230, powerW:1500, vbus:400, busCapF:680e-6 },100);
  assert.ok(outerLow.magnitude > outerHigh.magnitude);
  assert.ok(outerHigh.phaseDeg < outerLow.phaseDeg);
});

test("PSFB keeps ZVS energy estimate separate from ideal no-duty-loss output plant", () => {
  const heavy=Transfer.psfb({ vin:400, phaseDeg:90, turnsRatio:0.1, leakageH:5e-6, primaryCurrentA:10, commutationCapF:2e-9, outputInductanceH:100e-6, outputCapacitanceF:470e-6, loadOhm:4 });
  const light=Transfer.psfb({ vin:400, phaseDeg:90, turnsRatio:0.1, leakageH:5e-6, primaryCurrentA:2, commutationCapF:2e-9 });
  assert.ok(light.zvsEnergyMargin < heavy.zvsEnergyMargin);
  close(light.zvsEnergyMargin/heavy.zvsEnergyMargin,0.04);

  const dc=Transfer.psfbControlToOutputAt({ vin:400, turnsRatio:0.1, outputInductanceH:100e-6, outputCapacitanceF:470e-6, loadOhm:4 },0.001);
  close(dc.magnitude,400*0.1/180,2e-5);
  assert.equal(dc.units,"V/degree");
  assert.equal(dc.fidelity,"EQUATION_GRADE_IDEAL_NO_DUTY_LOSS");
});

test("LLC FHA is equation-grade steady state and exposes local operating-point sensitivity", () => {
  close(Transfer.llcFhaGain(1,5,0.5),1);
  const atRes=Transfer.llcFhaSensitivity(1,5,0.5);
  assert.ok(Number.isFinite(atRes.normalizedSlope));
  const near=Transfer.llc({ resonantInductanceH:30e-6, resonantCapF:100e-9, magnetizingInductanceH:150e-6, q:0.5, switchingHz:91888 });
  const shifted=Transfer.llc({ resonantInductanceH:30e-6, resonantCapF:100e-9, magnetizingInductanceH:150e-6, q:1.2, switchingHz:130000 });
  assert.notEqual(near.gain,shifted.gain);
  assert.equal(shifted.operatingPointDependent,true);
  assert.ok(Number.isFinite(shifted.gainSlopePerHz));
  assert.ok(Number.isFinite(shifted.normalizedGainSlope));
  assert.equal(shifted.fidelity,"EQUATION_GRADE_FHA_STEADY_STATE");
});

test("Inverter ideal LC and undamped LCL plants reproduce their resonance identities", () => {
  const lc=Transfer.inverter({ mode:"lc", dcBusV:400, modulationIndex:0.8, l1H:2e-3, capF:10e-6, loadOhm:20 });
  const lcl=Transfer.inverter({ mode:"lcl", dcBusV:400, modulationIndex:0.8, l1H:2e-3, capF:10e-6, l2H:1e-3 });
  close(lc.resonanceHz,1/(2*Math.PI*Math.sqrt(2e-3*10e-6)));
  close(lcl.resonanceHz,(1/(2*Math.PI))*Math.sqrt(3e-3/(2e-3*1e-3*10e-6)));
  assert.equal(lcl.resonanceNeedsDamping,true);

  const lcDc=Transfer.inverterLcVoltageAt({ dcBusV:400, l1H:2e-3, capF:10e-6, loadOhm:20 },0.001);
  close(lcDc.magnitude,400,2e-5);
  const below=Transfer.inverterLclGridCurrentAt({ dcBusV:400, l1H:2e-3, l2H:1e-3, capF:10e-6 },100);
  assert.ok(Number.isFinite(below.magnitude));
  assert.equal(below.units,"A/modulation");
  assert.equal(below.fidelity,"EQUATION_GRADE_IDEAL_UNDAMPED_LCL");
});

test("undamped LCL Bode phase stays continuous as -90 to -270 rather than wrapping to +90", () => {
  const params={ dcBusV:400, l1H:2e-3, l2H:1e-3, capF:10e-6 };
  const op=Transfer.inverter({ mode:"lcl", modulationIndex:0.8, ...params });
  const below=Transfer.inverterLclGridCurrentAt(params,op.resonanceHz/4);
  const above=Transfer.inverterLclGridCurrentAt(params,op.resonanceHz*4);
  close(below.phaseDeg,-90);
  close(above.phaseDeg,-270);
  assert.ok(above.phaseDeg < below.phaseDeg);
});

test("P5 unseen challenge set covers every transfer topology", () => {
  const cases=Transfer.challengeSet(42);
  assert.deepEqual(cases.map(item=>item.topology),["boost","pfc","psfb","llc","inverter"]);
  assert.equal(new Set(cases.map(item=>item.id)).size,5);
  assert.equal(cases.every(item=>item.choices.includes(item.expected)),true);
});
