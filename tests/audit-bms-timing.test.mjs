import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import E from '../assets/learning/control-engineering-v1.js';
function bms(){
 const context={document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}}};
 const source=fs.readFileSync(new URL('../7.28388d_bms_tutorial/assets/bms-sim.js',import.meta.url),'utf8');
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.probe={lessonState,evaluateFsm};})();'),context);
 return context.probe;
}
test('every nonfault BMS state vetoes OVP, OCP and lost SPI before any transition',()=>{
 for(const state of ['INIT','STANDBY','DISCHARGE']) for(const fault of [{v:4300},{i:151},{spi:3},{spiBroken:true}]){
  const x=bms();Object.assign(x.lessonState,{state,v:4000,i:0,spi:0,contactor:state==='DISCHARGE'},fault);
  x.evaluateFsm('request');assert.equal(x.lessonState.state,'FAULT',JSON.stringify({state,fault}));assert.equal(x.lessonState.contactor,false);
 }
});
test('BMS fault latch cannot be cleared by healthy samples or a request',()=>{
 const x=bms(); Object.assign(x.lessonState,{state:'FAULT',v:4000,i:0,spi:0,contactor:false});x.evaluateFsm('request');assert.equal(x.lessonState.state,'FAULT');
});
test('acquisition is SYSCLK cycles; SOC coincident ZERO is not a missed future load',()=>{
 const p={sysclkHz:200e6,adclkHz:50e6,pwmHz:100e3,acquisitionCycles:15,conversionCycles:14,computeCycles:500,writeCycles:20,loadMode:'zero'};
 const a=E.timingBudget(p);assert.ok(Math.abs(a.adcDoneS-355e-9)<1e-15);assert.equal(a.missedLoadEvents,0);assert.equal(a.actuationS,10e-6);
 const b=E.timingBudget({...p,computeCycles:2200});assert.equal(b.missedLoadEvents,1);assert.equal(b.actuationS,20e-6);
});
import K from '../assets/engineering-sandbox-core.js';
test('trip timestamps represent sampled detection and actual grid actuation, never backdated',()=>{
 const r=K.simulateSystem({vin:48,cycles:20,controlMode:'manual',manualDuty:.5,inductanceUh:500,tripCurrent:.03,tripLatencyUs:.1,plantDtUs:.25,detailCycle:1});
 const detect=r.events.find(x=>x.type==='TRIP_DETECT'),act=r.events.find(x=>x.type==='TRIP_ACTUATE');
 assert.equal(detect.tUs,10.5); // 0.024 A at 10.25 us, 0.048 A at 10.5 us.
 assert.equal(act.tUs,10.75); // next integration boundary after requested 10.6 us.
 assert.ok(r.waveform.filter(x=>x.tUs<=detect.tUs).every(x=>x.gate));
 assert.ok(r.waveform.filter(x=>x.tUs>act.tUs).every(x=>!x.gate));
});
test('BMS exact thresholds are healthy; reinitialization cannot bypass a persistent fault',()=>{
 const x=bms();Object.assign(x.lessonState,{state:'INIT',v:4250,i:150,spi:2});x.evaluateFsm();assert.equal(x.lessonState.state,'STANDBY');
 x.evaluateFsm('request');assert.equal(x.lessonState.state,'STANDBY');
 x.lessonState.v=4150;x.evaluateFsm('request');assert.equal(x.lessonState.state,'DISCHARGE');
 Object.assign(x.lessonState,{state:'INIT',v:4300});x.evaluateFsm();assert.equal(x.lessonState.state,'FAULT');
});
