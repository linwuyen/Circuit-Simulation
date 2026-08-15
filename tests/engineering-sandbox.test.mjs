import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../assets/engineering-sandbox-core.js',import.meta.url),'utf8');
vm.runInThisContext(src,{filename:'engineering-sandbox-core.js'});
const Core=globalThis.CircuitEngineeringSandboxCore;

test('shared timing window closes only when the full serial path fits',()=>{
  const w=Core.timingWindow({dtUs:10,samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:1.7,pwmCommitUs:.3});
  assert.equal(w.period,10);assert.equal(w.soc,5);assert.ok(Math.abs(w.margin-1)<1e-9);assert.equal(w.closed,true);
  const miss=Core.timingWindow({dtUs:10,samplePct:60,adcLatencyUs:1.5,isrLatencyUs:1,computeUs:2,pwmCommitUs:.5});
  assert.equal(miss.closed,false);assert.ok(miss.margin<0);
});

test('closed-loop converter exposes CV, CC and sensing-bias behavior',()=>{
  const base=Core.simulateConverter({steps:2500,loadStepAt:300,currentLimit:12,seed:7});
  assert.equal(base.summary.mode,'CV');assert.ok(base.summary.finalV>45&&base.summary.finalV<52);
  const cc=Core.simulateConverter({steps:2500,loadStepAt:300,currentLimit:4,seed:7});
  assert.equal(cc.summary.mode,'CC');assert.ok(cc.summary.finalV<base.summary.finalV-8);
  const gain=Core.simulateConverter({steps:2500,loadStepAt:300,currentLimit:12,sensorGain:.9,seed:7});
  assert.ok(gain.summary.finalV>base.summary.finalV);
});

test('non-ideal timing faults separate computed duty from applied duty',()=>{
  const r=Core.simulateConverter({steps:120,missedCommitEvery:10,seed:3});
  assert.equal(r.summary.missedCommits,11);
  assert.ok(r.trace.some(x=>x.missed&&x.duty!==x.appliedDuty));
  assert.ok(r.events.some(x=>x.type==='PWM_COMMIT_MISSED'));
});

test('DMA ownership rejects publish-before-complete and overwrite',()=>{
  assert.equal(Core.dmaScenario({ringSize:4,bursts:8,consumerEvery:1,mode:'safe'}).pass,true);
  const early=Core.dmaScenario({ringSize:4,bursts:4,consumerEvery:1,mode:'early-publish'});
  assert.equal(early.pass,false);assert.ok(early.violations.includes('published-before-complete'));
  const slow=Core.dmaScenario({ringSize:2,bursts:8,consumerEvery:4,mode:'safe'});
  assert.ok(slow.violations.includes('overwrite-unconsumed'));
});

test('state machine is fail-closed and fault clear cannot auto-run',()=>{
  const good=Core.runStateMachine(['precheck-pass','ready','run','fault','fault-clear','rearm','recover']);
  assert.equal(good.pass,true);assert.equal(good.state,'OFF');assert.equal(good.log.find(x=>x.action==='fault-clear').pwm,false);
  const bad=Core.runStateMachine(['run']);assert.equal(bad.pass,false);assert.ok(bad.violations.includes('illegal-run-transition'));
});

test('multi-fault scenarios require both causes and respect measurement budget',()=>{
  const a=Core.multiFault(23),b=Core.multiFault(23);assert.deepEqual(a,b);assert.equal(a.faults.length,2);assert.notEqual(a.faults[0],a.faults[1]);
  const partial=Core.diagnosticScore(a.faults,['raw','duty'],[a.faults[0]]);assert.equal(partial.pass,false);
  const full=Core.diagnosticScore(a.faults,['raw','duty','seq'],a.faults);assert.equal(full.pass,true);assert.equal(full.measurementCost,3);
});

test('code trace maps generic firmware defects to a physical measurement',()=>{
  for(const bug of Object.keys(Core.CODE_BUGS)){const r=Core.codeTrace(bug);assert.ok(r.line);assert.ok(r.effect);assert.ok(r.measurement);}
  assert.match(Core.codeTrace('shadow').effect,/one PWM period late/i);
});
