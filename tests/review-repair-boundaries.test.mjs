import test from 'node:test';
import assert from 'node:assert/strict';
import K from '../assets/engineering-sandbox-core.js';
import Registry from '../assets/learning/model-registry.js';
import Repair from '../assets/repair-training-core.js';

test('supported scalar commands, acquisition and duty limits reject incomplete or nonphysical values',()=>{
 for(const input of [{samplePct:''},{samplePct:null},{samplePct:' '},{vref:''},{vref:null},{vref:-2},{dutyClamp:-.1},{dutyClamp:1.1},{dutyClamp:''},{dutyMax:-.1},{dutyMax:1.1}])
  assert.throws(()=>K.simulateSystem({cycles:20,...input}),RangeError,JSON.stringify(input));
 for(const input of [{samplePct:0,vref:0,dutyClamp:null},{dutyClamp:0},{dutyClamp:1}])
  assert.equal(K.simulateSystem({cycles:20,...input}).state.state,'RUN');
});

// Independent closed-form off-state RLC solution until diode extinction.
function offState(i0,v0,t,L,C,R){
 const a=1/(2*R*C),w=Math.sqrt(1/(L*C)-a*a),b=((i0-v0/R)/C+a*v0)/w;
 const e=Math.exp(-a*t),co=Math.cos(w*t),si=Math.sin(w*t),v=e*(v0*co+b*si);
 const dv=e*((-a*v0+b*w)*co+(-a*b-v0*w)*si);
 return {v,i:C*dv+v/R};
}
test('DCM off current reaches zero at the physical event then C follows its RC discharge',()=>{
 const values=[];
 for(const plantDtUs of [2,.25,.05]){
  const r=K.simulateSystem({vin:48,cycles:120,inductanceUh:50,capacitanceUf:220,controlMode:'manual',manualDuty:.02,loadProfile:[{cycle:0,ohm:100}],tripCurrent:100,plantDtUs,detailCycle:100,samplePct:0});
  const edge=r.waveform.find(x=>Math.abs(x.phaseUs-.2)<1e-12);
  assert.ok(edge,'exact PWM edge');
  let lo=0,hi=9.8e-6;
  for(let n=0;n<60;n++){const m=(lo+hi)/2;if(offState(edge.iL,edge.vOut,m,50e-6,220e-6,100).i>0)lo=m;else hi=m;}
  const expected=.2+(lo+hi)/2*1e6,zero=r.waveform.find(x=>x.phaseUs>.2&&x.iL===0);
  assert.ok(zero,`no diode extinction at h=${plantDtUs}`);
  assert.ok(Math.abs(zero.phaseUs-expected)<.005,`${zero.phaseUs} vs ${expected} us`);
  for(const row of r.waveform.filter(x=>x.phaseUs>=zero.phaseUs)){
   assert.equal(row.iL,0);
   assert.ok(Math.abs(row.vOut-zero.vOut*Math.exp(-(row.phaseUs-zero.phaseUs)*1e-6/(100*220e-6)))<1e-10);
  }
  values.push(r.summary.avgV);
 }
 assert.ok(Math.max(...values)-Math.min(...values)<.001,JSON.stringify(values));
});

test('changed solver has distinct provenance and refuses to reinterpret retained legacy replays',()=>{
 const legacy={schema:'circuit-repair-replay',version:1,modelVersion:'1.0.0',engineVersion:'3.2.0',seed:23,actions:[{type:'measure',id:'dmm'}]};
 const retained=JSON.stringify(legacy);
 assert.equal(K.version,'3.3.0');
 assert.equal(Registry.get('generic-power-causal-kernel').version,K.version);
 assert.throws(()=>Repair.replay(legacy),/3\.2\.0.*3\.3\.0/);
 assert.equal(JSON.stringify(legacy),retained);
 const s=Repair.create(23);s.measure('dmm');
 assert.deepEqual(Repair.replay(s.exportRecord()).view().measurements,s.view().measurements);
});
