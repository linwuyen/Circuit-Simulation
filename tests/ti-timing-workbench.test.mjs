import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-timing-workbench-core.js");

const sandbox={};sandbox.window=sandbox;
for(const file of ["assets/learning/power-system-state-v1.js","assets/learning/power-system-models-v1.js"]){
  vm.runInNewContext(fs.readFileSync(file,"utf8"),sandbox,{filename:file});
}
const deps={Models:sandbox.CircuitPowerModelsV1,initial:sandbox.CircuitPowerSystemStateV1.initial};

test("default timing separates command-ready from PWM-active hardware time",()=>{
  const a=Core.analyze({},deps);
  assert.ok(Math.abs(a.timing.periodUs-10)<1e-9);
  assert.ok(Math.abs(a.commandReadyUs-4.75)<1e-9);
  assert.ok(Math.abs(a.activePwmUs-10)<1e-9);
  assert.equal(a.deadlineMet,true);
  assert.equal(a.cycleIndex,1);
  assert.equal(a.distinction,"command ready precedes hardware activation");
});

test("strict shadow-load boundary fails closed when CMPA write lands exactly at load",()=>{
  const a=Core.analyze({computeUs:6.45},deps);
  assert.ok(Math.abs(a.commandReadyUs-10)<1e-9);
  assert.equal(a.deadlineMet,false);
  assert.equal(a.timing.missedLoads,1);
  assert.ok(Math.abs(a.activePwmUs-20)<1e-9);
  assert.equal(a.cycleIndex,2);
});

test("heavy compute pushes actuation one PWM cycle later",()=>{
  const light=Core.analyze({computeUs:1.2},deps);
  const heavy=Core.analyze({computeUs:8.8},deps);
  assert.equal(light.timing.missedLoads,0);
  assert.equal(heavy.timing.missedLoads,1);
  assert.ok(Math.abs(light.timing.actuation-7.5)<1e-9);
  assert.ok(Math.abs(heavy.timing.actuation-17.5)<1e-9);
  assert.equal(heavy.cycleIndex,2);
});

test("PWM frequency changes deadline geometry deterministically",()=>{
  const a=Core.analyze({fswKhz:100,computeUs:3},deps);
  const b=Core.analyze({fswKhz:200,computeUs:3},deps);
  assert.ok(Math.abs(a.timing.periodUs-10)<1e-9);
  assert.ok(Math.abs(b.timing.periodUs-5)<1e-9);
  assert.equal(a.deadlineMet,true);
  assert.equal(b.deadlineMet,false);
  assert.ok(b.cycleIndex>a.cycleIndex);
});

test("timeline contains software-ready and hardware-active events as separate contracts",()=>{
  const a=Core.analyze({},deps);
  const byId=new Map(a.events.map(x=>[x.id,x]));
  assert.equal(byId.get("write").label,"CMPA write / command ready");
  assert.equal(byId.get("active").label,"PWM active");
  assert.ok(byId.get("write").timeUs<byId.get("active").timeUs);
});
