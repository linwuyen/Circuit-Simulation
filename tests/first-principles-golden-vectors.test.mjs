import test from 'node:test';
import assert from 'node:assert/strict';
import Models from '../assets/learning/engineering-models.js';
import T from '../assets/learning/topology-transfer-v1.js';

// Fixed, hand-derived first-principles reference vectors; no production-model
// calculation is used to compute an expected value during these tests.
// These are NOT independently simulated waveforms or physical-board evidence.
function near(actual,expected,relative=1e-7){
 assert.ok(Number.isFinite(actual),`not finite: ${actual}`);
 assert.ok(Math.abs(actual-expected)<=relative*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
}

test('Buck CCM: V-second balance, inductor ripple and LC/ESR frequencies',()=>{
 const p={vin:48,duty:0.25,inductanceH:400e-6,capacitanceF:220e-6,loadOhm:8,esrOhm:0.02,switchingHz:100000};
 const r=T.buckCCM(p);
 near(r.vout,12);
 near(r.ripple,0.225);
 near(r.averageCurrentA,1.5);
 near(r.valleyCurrentA,1.3875);
 near(r.resonanceHz,536.5112037145047);
 near(r.esrZeroHz,36171.57797543075);
 assert.equal(r.ccmValid,true);
});

test('Buck boundary marks the CCM-only ripple formula invalid in DCM',()=>{
 const p={vin:48,vout:12,inductanceH:400e-6,switchingHz:100000};
 const bc=Models.calculateBuckRipple({...p,outputCurrentA:0.1125});
 near(bc.deltaIA,0.225);
 near(bc.boundaryCurrentA,0.1125);
 assert.equal(bc.mode,'BOUNDARY');
 const dcm=Models.calculateBuckRipple({...p,outputCurrentA:0.05});
 assert.equal(dcm.mode,'DCM');
 assert.equal(dcm.formulaValid,false);
 assert.match(dcm.warning,/DCM/);
 // No DCM peak-current golden value is asserted: this model does not solve DCM.
});

test('Boost CCM: DC conversion and duty-dependent RHP zero',()=>{
 const p={vin:48,duty:0.4,inductanceH:300e-6,capacitanceF:220e-6,loadOhm:48,switchingHz:100000};
 const r=T.boostCCM(p);
 near(r.vout,80);
 near(r.dcGain,133.33333333333334);
 near(r.rhpzHz,9167.324722093173);
 near(r.resonanceHz,371.70586546538345);
 near(r.ripple,0.64);
 assert.equal(r.nonMinimumPhase,true);
 assert.equal(r.ccmValid,true);
});

test('Boost PFC: rms input, forced 2-line-frequency ripple and slow energy pole',()=>{
 const p={vrms:230,powerW:1500,vbus:400,busCapF:680e-6,lineHz:50,efficiency:0.97};
 const r=T.pfcBoost(p);
 near(r.inputCurrentRms,6.723442402510085);
 near(r.busRippleVpk,8.776927008744227);
 near(r.outerPoleHz,4.388463504372114);
 near(r.doubleLineHz,100);
 near(r.linePeakV,325.2691193458119);
 assert.equal(r.boostBusAboveLinePeak,true);
 assert.equal(T.pfcBoost({...p,vrms:265,vbus:300}).boostBusAboveLinePeak,false);
});

test('PSFB: ideal output mapping must remain separate from approximate ZVS energy margin',()=>{
 const base={vin:400,phaseDeg:90,turnsRatio:0.1,leakageH:5e-6,primaryCurrentA:10,commutationCapF:2e-9};
 const heavy=T.psfb(base),light=T.psfb({...base,primaryCurrentA:2});
 near(heavy.idealSecondaryV,20);
 near(heavy.zvsEnergyMargin,1.5625);
 near(light.zvsEnergyMargin,0.0625);
 assert.equal(heavy.zvsEnergySufficient,true);
 assert.equal(light.zvsEnergySufficient,false);
 // This is a necessary-energy estimate, NOT observed ZVS switching.
});

test('LLC FHA and undamped LCL: basic resonant limits, not time-domain evidence',()=>{
 const llc=T.llc({resonantInductanceH:20e-6,resonantCapF:100e-9,magnetizingInductanceH:120e-6,q:0.5,switchingHz:112539.53951963825});
 near(llc.normalizedFrequency,1);
 near(llc.gain,1);
 const inv=T.inverter({mode:'lcl',dcBusV:400,modulationIndex:0.8,l1H:0.002,l2H:0.001,capF:10e-6});
 near(inv.resonanceHz,1949.2420030841902);
 near(inv.fundamentalVrms,226.2741699796952);
 assert.equal(inv.resonanceNeedsDamping,true);
});
