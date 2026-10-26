import test from 'node:test';
import assert from 'node:assert/strict';
import K from '../assets/engineering-sandbox-core.js';
import E from '../assets/learning/control-engineering-v1.js';
const base={vin:48,cycles:3000,inductanceUh:500,capacitanceUf:220,controlMode:'manual',manualDuty:.251,loadProfile:[{cycle:0,ohm:12}],tripCurrent:100};
test('non-grid PWM duty obeys volt-second balance and converges without a duty-grid bias',()=>{
 const values=[2,.25,.05].map(plantDtUs=>K.simulateSystem({...base,plantDtUs}).summary.avgV);
 for(const v of values)assert.ok(Math.abs(v-12.048)<.003,JSON.stringify(values));
 assert.ok(Math.max(...values)-Math.min(...values)<.001,JSON.stringify(values));
});
test('ADC acquisition observes the physical state at its declared time including cycle start',()=>{
 for(const [samplePct,plantDtUs,want]of [[0,2,900],[51,.25,905.1]]){
  const r=K.simulateSystem({...base,cycles:100,samplePct,plantDtUs,detailCycle:90});
  assert.equal(r.trace[90].sampleTUs,want);
  const sample=r.waveform.find(x=>Math.abs(x.tUs-want)<1e-8);
  assert.ok(sample,'no physical sample at declared time '+want);
  assert.equal(sample.vOut,r.trace[90].samplePhysicalV);
  assert.equal(r.events.find(x=>x.cycle===90&&x.type==='ADC_SOC').tUs,want);
 }
});
test('ready before, exactly on, or after ZERO/PERIOD follows the strict future-event contract',()=>{
 for(const [mode,boundary,compute,want]of [['zero',10,1909,20],['zero-period',5,909,10]]){
  for(const [offset,expected]of [[-1,boundary],[0,want],[1,want]]){
   const r=E.timingBudget({sysclkHz:200e6,adclkHz:50e6,pwmHz:100e3,acquisitionCycles:15,conversionCycles:14,computeCycles:compute+offset,writeCycles:20,loadMode:mode});
   assert.ok(Math.abs(r.actuationS*1e6-expected)<1e-9,JSON.stringify({mode,offset,r}));
  }
 }
});
