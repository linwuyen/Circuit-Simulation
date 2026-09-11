import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Transfer = require(path.join(root, "assets", "learning", "topology-transfer-v1.js"));
const close = (a,b,tol=1e-9) => assert.ok(Math.abs(a-b) <= tol*Math.max(1,Math.abs(a),Math.abs(b)), `${a} != ${b}`);

const buckPoint={vin:48,duty:.5,inductanceH:200e-6,capacitanceF:220e-6,loadOhm:6,esrOhm:.04,switchingHz:100000};

test("Buck extraction preserves the Module 17 operating point and physical scaling", () => {
  const a=Transfer.buckCCM(buckPoint);
  close(a.vout,24);close(a.ripple,.6);close(a.averageCurrentA,4);close(a.valleyCurrentA,3.7);
  close(a.resonanceHz,1/(2*Math.PI*Math.sqrt(200e-6*220e-6)));
  close(a.esrZeroHz,1/(2*Math.PI*.04*220e-6));
  assert.equal(a.ccmValid,true);assert.equal(Object.isFrozen(a),true);
  const largerL=Transfer.buckCCM({...buckPoint,inductanceH:800e-6});
  close(largerL.ripple,a.ripple/4);close(largerL.resonanceHz,a.resonanceHz/2);
  const faster=Transfer.buckCCM({...buckPoint,switchingHz:200000});
  close(faster.ripple,a.ripple/2);close(faster.resonanceHz,a.resonanceHz);
  const largerC=Transfer.buckCCM({...buckPoint,capacitanceF:880e-6});
  close(largerC.resonanceHz,a.resonanceHz/2);close(largerC.esrZeroHz,a.esrZeroHz/4);
});

test("Buck ESR-free limit retains its DC gain, resonance phase and no finite ESR zero", () => {
  const p={...buckPoint,esrOhm:0},op=Transfer.buckCCM(p);
  assert.equal(op.esrZeroHz,Infinity);
  const dc=Transfer.buckControlToOutputAt(p,.00001);
  close(dc.magnitude,48,1e-9);assert.ok(dc.phaseDeg<0);
  const resonance=Transfer.buckControlToOutputAt(p,op.resonanceHz);
  close(resonance.real,0);close(resonance.imag,-48*6/(2*Math.PI*op.resonanceHz*200e-6));
  close(resonance.phaseDeg,-90);assert.equal(resonance.units,"V/duty");
  const high=Transfer.buckControlToOutputAt(p,op.resonanceHz*100);
  assert.ok(high.phaseDeg<-170&&high.phaseDeg>-180);
});

test("Buck delegation keeps frozen pre-extraction magnitude and atan2 phase across the displayed band", () => {
  // Independent frozen results from the previous inline Module 17 expression.
  const fixtures=[
    {f:1,db:33.62483964484894,phase:-.01200002617216498},
    {f:1000,db:35.64101921085949,phase:-157.36055858966589},
    {f:10000,db:-10.021825510698065,phase:-150.18855979400678},
    {f:45000,db:-28.787432898497173,phase:-111.70269720066118}
  ];
  for(const fixture of fixtures){const r=Transfer.buckControlToOutputAt(buckPoint,fixture.f);close(r.magnitudeDb,fixture.db,1e-12);close(r.phaseDeg,fixture.phase,1e-12);}
});

test("Buck declares the CCM boundary without silently substituting a DCM solution", () => {
  const p={...buckPoint,esrOhm:0,loadOhm:80},boundary=Transfer.buckCCM(p);
  close(boundary.valleyCurrentA,0);assert.equal(boundary.ccmValid,false);
  const light=Transfer.buckCCM({...p,loadOhm:160});
  assert.ok(light.valleyCurrentA<0);assert.equal(light.ccmValid,false);close(light.vout,24);
  assert.equal(Transfer.buckControlToOutputAt({...p,loadOhm:160},1000).ccmValid,false);
  for(const patch of [{vin:0},{duty:-.1},{duty:1.1},{inductanceH:0},{capacitanceF:-1},{loadOhm:Infinity},{esrOhm:-.01},{esrOhm:NaN},{switchingHz:0}])assert.throws(()=>Transfer.buckCCM({...buckPoint,...patch}),RangeError);
  for(const f of [0,-1,Infinity,NaN])assert.throws(()=>Transfer.buckControlToOutputAt(buckPoint,f),RangeError);
});

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

test("P5 fixed concept set covers every transfer topology", () => {
  const cases=Transfer.challengeSet(42);
  assert.deepEqual(cases.map(item=>item.topology),["boost","pfc","psfb","llc","inverter"]);
  assert.equal(new Set(cases.map(item=>item.id)).size,5);
  assert.equal(cases.every(item=>item.choices.includes(item.expected)),true);
});
