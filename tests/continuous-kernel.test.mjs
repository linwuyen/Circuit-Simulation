import test from 'node:test';
import assert from 'node:assert/strict';
import K from '../assets/engineering-sandbox-core.js';
const base={vin:48,cycles:1600,capacitanceUf:220,inductanceUh:500,controlMode:'manual',manualDuty:.25,commandProfile:[{cycle:0,vref:24}],loadProfile:[{cycle:0,ohm:12}],detailCycle:1500};
test('manual commands use the original PWM queue, LC plant and measurement path',()=>{
 const r=K.simulateSystem(base);assert.equal(r.trace[0].appliedDuty,0);assert.equal(r.trace[1].appliedDuty,.25);
 assert.equal(r.summary.mode,'MANUAL');
 assert.ok(Math.abs(r.summary.avgV-48*.25)<.2);
 const off=r.waveform.filter(x=>!x.gate);assert.ok(off[0].iL>0);assert.ok(off.at(-1).iL<off[0].iL);
 const delayed=K.simulateSystem({...base,computeUs:11});assert.equal(delayed.trace[1].appliedDuty,0);assert.equal(delayed.trace[2].appliedDuty,.25);
 const wrong=K.simulateSystem({...base,sensorGain:.8});assert.equal(wrong.summary.avgV,r.summary.avgV);assert.ok(wrong.trace.at(-1).sampledV<r.trace.at(-1).sampledV);
});
test('manual mode cannot override protection, and invalid manual commands are rejected',()=>{
 const r=K.simulateSystem({...base,tripCurrent:2});assert.ok(r.summary.tripSeen);
 const trip=r.events.find(e=>e.type==='TRIP_ACTUATE');assert.ok(r.trace.filter(x=>x.k>trip.cycle).every(x=>x.appliedDuty===0));
 for(const manualDuty of [-1,1,NaN,'0.2'])assert.throws(()=>K.simulateSystem({...base,manualDuty}),/Manual duty/);
 assert.throws(()=>K.simulateSystem({...base,controlMode:'unknown'}),/control mode/);
});
