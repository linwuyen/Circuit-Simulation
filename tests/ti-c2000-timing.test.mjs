import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const C=require("../assets/learning/ti-c2000-timing-core.js");
const S=require("../assets/engineering-sandbox-core.js");
const V=require("../assets/learning/control-validation-v1.js");

test("fast compute meets next ePWM shadow load",()=>{
  const r=C.run(S,V,{computeUs:1.7});
  assert.equal(r.window.closed,true);
  assert.equal(r.firstNextLoad,true);
  assert.equal(r.extraCycleDelay,0);
  assert.equal(r.observedCommitUs,10);
  assert.equal(r.acceptance.pass,true);
});

test("11 us compute misses one load event",()=>{
  const r=C.run(S,V,{computeUs:11});
  assert.equal(r.window.closed,false);
  assert.equal(r.extraCycleDelay,1);
  assert.equal(r.observedCommitUs,20);
  assert.ok(r.stages.some(x=>x.type==="PWM_COMMIT_MISSED"));
});

test("timing sweep exposes one and two-cycle misses",()=>{
  const rows=C.sweepCompute(S,V);
  assert.ok(rows.some(x=>x.computeUs===11&&x.extraCycleDelay===1));
  assert.ok(rows.some(x=>x.computeUs===15&&x.extraCycleDelay===2));
});

test("event chain preserves ADC ISR control write and hardware load ordering",()=>{
  const r=C.run(S,V,{computeUs:1.7});
  const names=r.stages.map(x=>x.type);
  for(const name of ["PWM_ZERO","ADC_SOC","ADC_EOC","ISR","CONTROL_DONE","PWM_COMMIT","PWM_SHADOW_LOAD"])assert.ok(names.includes(name),name);
  for(let i=1;i<r.stages.length;i++)assert.ok(r.stages[i].relativeUs>=r.stages[i-1].relativeUs);
});
