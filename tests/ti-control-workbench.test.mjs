import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Control=require("../assets/learning/control-engineering-v1.js");
const Workbench=require("../assets/learning/ti-control-workbench-core.js");

const sandbox={};sandbox.window=sandbox;
for(const file of ["assets/learning/power-system-state-v1.js","assets/learning/power-system-models-v1.js"]){
  vm.runInNewContext(fs.readFileSync(file,"utf8"),sandbox,{filename:file});
}
const Models=sandbox.CircuitPowerModelsV1;
const initial=sandbox.CircuitPowerSystemStateV1.initial;
const deps={Models,Control,initial};

test("control workbench exposes deterministic PI zero, transient and loop evidence",()=>{
  const a=Workbench.analyze({kp:.4,ki:120,computeUs:1.2},deps);
  assert.ok(Math.abs(a.piZeroHz-120/(2*Math.PI*.4))<1e-9);
  assert.ok(a.transient.phys.length>100);
  assert.ok(a.loop.freqs.length>100);
  assert.ok(["NO_CROSSOVER","SINGLE","MULTIPLE"].includes(a.loop.status));
  assert.equal(a.sfra.state,"MODEL_ONLY");
  assert.equal(a.sfra.evidence,"NONE");
});

test("missing PWM deadline adds one cycle and 36 degrees lag at 10 kHz",()=>{
  const fast=Workbench.analyze({kp:.4,ki:120,computeUs:1.2},deps);
  const late=Workbench.analyze({kp:.4,ki:120,computeUs:8.8},deps);
  assert.equal(fast.timing.missedLoads,0);
  assert.equal(late.timing.missedLoads,1);
  assert.ok(Math.abs(fast.timing.actuation-7.5)<1e-9);
  assert.ok(Math.abs(late.timing.actuation-17.5)<1e-9);
  const pf=Models.buckLoopPoint(10000,fast.timing.actuation,fast.state);
  const pl=Models.buckLoopPoint(10000,late.timing.actuation,late.state);
  assert.ok(Math.abs((pl.phase-pf.phase)+36)<1e-9);
});

test("anti-windup changes controller state while actuator limit remains authoritative",()=>{
  const common={vref:40,kp:1.8,ki:800,computeUs:1.2,dutyMax:.45};
  const protectedRun=Workbench.analyze({...common,antiWindup:true},deps);
  const windupRun=Workbench.analyze({...common,antiWindup:false},deps);
  assert.ok(protectedRun.transient.saturatedSamples>0);
  assert.ok(windupRun.transient.saturatedSamples>0);
  assert.ok(protectedRun.transient.duties.every(v=>v<=.450000000001));
  assert.ok(windupRun.transient.duties.every(v=>v<=.450000000001));
  assert.ok(Math.abs(windupRun.transient.finalIntegrator)>Math.abs(protectedRun.transient.finalIntegrator));
});

test("controller changes alter both time response and open-loop evidence",()=>{
  const a=Workbench.analyze({kp:.2,ki:80},deps);
  const b=Workbench.analyze({kp:.8,ki:320},deps);
  assert.notDeepEqual(a.transient.phys,b.transient.phys);
  assert.notDeepEqual(a.loop.mags,b.loop.mags);
  assert.notEqual(a.pi.b0,b.pi.b0);
});

test("imported matching SFRA can correlate numerically but remains unverified import",()=>{
  const base=Workbench.analyze({},deps);
  const measurements=[100,1000,10000].map(f=>{
    const p=Models.buckLoopPoint(f,base.timing.actuation,base.state);
    return {frequencyHz:f,magnitudeDb:p.magDb,phaseDeg:p.phase};
  });
  const result=Workbench.analyze({measurements},deps);
  assert.equal(result.sfra.state,"CORRELATED");
  assert.equal(result.sfra.evidence,"UNVERIFIED_IMPORT");
  assert.ok(result.correlation.rmsMagnitudeDb<1e-9);
  assert.ok(result.correlation.rmsPhaseDeg<1e-9);
});
