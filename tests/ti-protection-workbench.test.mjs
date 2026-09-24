import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-protection-workbench-core.js");

const sandbox={};sandbox.window=sandbox;
for(const file of ["assets/learning/power-system-state-v1.js","assets/learning/power-system-models-v1.js"]){
  vm.runInNewContext(fs.readFileSync(file,"utf8"),sandbox,{filename:file});
}
const deps={Models:sandbox.CircuitPowerModelsV1,initial:sandbox.CircuitPowerSystemStateV1.initial};

test("all software gates true and no hardware veto grants PWM",()=>{
  const a=Core.analyze({currentA:8,thresholdA:12,tripLatched:false},deps);
  assert.equal(a.softwareGrant,true);
  assert.equal(a.hardwareVeto,false);
  assert.equal(a.physicalDuty,a.requestedDuty);
});

test("software freshness blocks PWM even when hardware is clear",()=>{
  const a=Core.analyze({commandFresh:false,currentA:8,thresholdA:12,tripLatched:false},deps);
  assert.equal(a.softwareGrant,false);
  assert.deepEqual(a.softwareBlockers,["commandFresh"]);
  assert.equal(a.hardwareVeto,false);
  assert.equal(a.physicalDuty,0);
});

test("hardware comparator/trip veto overrides valid software grant",()=>{
  const live=Core.analyze({currentA:18,thresholdA:12,tripLatched:false},deps);
  assert.equal(live.softwareGrant,true);
  assert.equal(live.comparatorFault,true);
  assert.equal(live.hardwareVeto,true);
  assert.equal(live.physicalDuty,0);

  const latched=Core.analyze({currentA:8,thresholdA:12,tripLatched:true},deps);
  assert.equal(latched.comparatorFault,false);
  assert.equal(latched.tripLatched,true);
  assert.equal(latched.hardwareVeto,true);
  assert.equal(latched.physicalDuty,0);
});

test("trip latch requires fault removal and software readiness before explicit clear",()=>{
  const eligible=Core.analyze({currentA:8,thresholdA:12,tripLatched:true},deps);
  assert.equal(eligible.clearEligible,true);
  assert.equal(Core.nextLatch(eligible,{requestClear:true}),false);

  const fault=Core.analyze({currentA:18,thresholdA:12,tripLatched:true},deps);
  assert.throws(()=>Core.nextLatch(fault,{requestClear:true}),/fault input/);

  const blocked=Core.analyze({currentA:8,thresholdA:12,tripLatched:true,calibrationValid:false},deps);
  assert.throws(()=>Core.nextLatch(blocked,{requestClear:true}),/readiness/);
});

test("hardware trip latency remains measurement-required while software timing is model-derived",()=>{
  const a=Core.analyze({currentA:18,thresholdA:12,tripLatched:true},deps);
  assert.equal(a.hardwareLatencyClaim,"MEASURE_REQUIRED");
  assert.ok(a.softwareBestAlignedUs>0);
  assert.match(a.invariant,/independent/);
});
