import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../assets/engineering-sandbox-core.js',import.meta.url),'utf8');
vm.runInThisContext(src,{filename:'engineering-sandbox-core.js'});
const Core=globalThis.CircuitEngineeringSandboxCore;

test('a late shadow write is delayed to its next eligible ZERO instead of discarded',()=>{
  const ok=Core.simulateSystem({cycles:220,samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:1.7,pwmCommitUs:.3});
  assert.equal(ok.summary.missedCommits,0);
  const late=Core.simulateSystem({cycles:900,samplePct:60,adcLatencyUs:1.5,isrLatencyUs:1,computeUs:2,pwmCommitUs:.5,tripCurrent:30});
  assert.ok(late.summary.missedCommits>0);
  assert.ok(late.trace.some(x=>x.timingMiss&&x.computedDuty!==x.appliedDuty));
  assert.ok(late.trace.some(x=>x.timingMiss&&x.scheduledApplyCycle===x.k+2));
  assert.ok(late.trace.some(x=>x.loadedFromCycle===x.k-2));
  assert.ok(late.summary.finalV>5,'late writes should still reach the plant after the extra-cycle delay');
  assert.ok(late.events.some(x=>x.type==='PWM_COMMIT_MISSED'&&x.tUs>(x.cycle+1)*late.config.controlPeriodUs));
});

test('ISR jitter can create intermittent real PWM misses near the deadline',()=>{
  const stable=Core.simulateSystem({cycles:300,samplePct:50,computeUs:2.5,jitterUs:0});
  const jittered=Core.simulateSystem({cycles:300,samplePct:50,computeUs:2.5,jitterUs:1,seed:9});
  assert.equal(stable.summary.missedCommits,0);
  assert.ok(jittered.summary.missedCommits>0&&jittered.summary.missedCommits<300);
});

test('ADC samples the plant at the selected point inside the PWM period',()=>{
  const early=Core.simulateSystem({cycles:900,samplePct:25,adcLatencyUs:.2,isrLatencyUs:.2,computeUs:.4,pwmCommitUs:.1,plantDtUs:.05,tripCurrent:30});
  const late=Core.simulateSystem({cycles:900,samplePct:75,adcLatencyUs:.2,isrLatencyUs:.2,computeUs:.4,pwmCommitUs:.1,plantDtUs:.05,tripCurrent:30});
  const a=early.trace.slice(-80).reduce((s,x)=>s+x.samplePhysicalI,0)/80;
  const b=late.trace.slice(-80).reduce((s,x)=>s+x.samplePhysicalI,0)/80;
  assert.ok(Math.abs(a-b)>0.01);
  assert.equal(early.summary.missedCommits,0);assert.equal(late.summary.missedCommits,0);
});

test('stale communication delays a real command step seen by the controller',()=>{
  const r=Core.simulateSystem({cycles:260,commandProfile:[{cycle:0,vref:24},{cycle:100,vref:48}],loadProfile:[{cycle:0,ohm:12}],communicationMode:'stale',staleCommandCycles:30});
  const before=r.trace[105],after=r.trace[135];
  assert.equal(before.producerCommand,48);assert.equal(before.consumedCommand,24);
  assert.equal(after.consumedCommand,48);
  assert.ok(r.communication.maxLag>=1);
});

test('protection latency changes peak current and fault-energy exposure',()=>{
  const fast=Core.simulateSystem({cycles:300,commandProfile:[{cycle:0,vref:48}],loadProfile:[{cycle:0,ohm:2}],currentLimit:30,tripCurrent:12,tripLatencyUs:.2,kpV:.8,kiV:80,kpI:.08,kiI:1000});
  const slow=Core.simulateSystem({cycles:300,commandProfile:[{cycle:0,vref:48}],loadProfile:[{cycle:0,ohm:2}],currentLimit:30,tripCurrent:12,tripLatencyUs:5,kpV:.8,kiV:80,kpI:.08,kiI:1000});
  assert.equal(fast.summary.tripSeen,true);assert.equal(slow.summary.tripSeen,true);
  assert.ok(slow.summary.peakI>fast.summary.peakI);
  assert.ok(slow.summary.faultEnergyProxy>fast.summary.faultEnergyProxy*2);
  assert.equal(slow.summary.state,'FAULT');
});

test('state logic and the physical plant share the same RUN permission',()=>{
  const sm=Core.runStateMachine(['precheck-pass','ready','run','fault','fault-clear']);
  assert.equal(sm.state,'FAULT');assert.equal(sm.log.at(-1).pwm,false);
  const off=Core.simulateSystem({cycles:350,initialState:sm.state,precheckPassed:sm.precheck,commandProfile:[{cycle:0,vref:48}],loadProfile:[{cycle:0,ohm:12}]});
  const run=Core.simulateSystem({cycles:350,initialState:'RUN',precheckPassed:true,commandProfile:[{cycle:0,vref:48}],loadProfile:[{cycle:0,ohm:12}]});
  assert.equal(off.summary.finalV,0);assert.ok(run.summary.finalV>5);
});

test('multi-fault measurements are read from the live hidden system',()=>{
  const scenario=Core.multiFault(23);
  assert.deepEqual(scenario.faults,['sensorGain','staleCommand']);
  const scaled=Core.measureSystem(scenario,'scaled'),seq=Core.measureSystem(scenario,'seq');
  assert.ok(Number.isFinite(scaled.value.measuredV));
  assert.ok(seq.value.maxLag>=1);
  const score=Core.diagnosticScore(scenario.faults,['scaled','seq','duty'],scenario.faults);
  assert.equal(score.pass,true);assert.equal(score.measurementCost,3);
});

test('generic code mutations actually drive the same physical simulator',()=>{
  const sign=Core.codeTrace('sign'),shadow=Core.codeTrace('shadow'),stale=Core.codeTrace('stale');
  assert.ok(sign.system.summary.finalV<5);
  assert.ok(shadow.system.summary.missedCommits>0);
  assert.ok(stale.system.communication.maxLag>=1);
  assert.match(shadow.measurement.text,/Timing:/);
});
