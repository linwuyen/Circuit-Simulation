import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const Transfer=require("../assets/learning/topology-transfer-v1.js");
const Core=require("../assets/learning/ti-topology-workbench-core.js");
const deps={Transfer};

test("Boost duty increase lowers RHP zero and tightens crossover ratio",()=>{
  const a=Core.analyze("boost",{duty:.4,crossoverHz:1000},deps);
  const b=Core.analyze("boost",{duty:.7,crossoverHz:1000},deps);
  assert.ok(b.model.rhpzHz<a.model.rhpzHz);
  assert.ok(b.ratio>a.ratio);
  assert.equal(b.constraint.constraint,"RHP_ZERO");
});

test("PFC outer loop exposes forced double-line ripple constraint",()=>{
  const safe=Core.analyze("pfc",{lineHz:50,outerCrossoverHz:10},deps);
  const fast=Core.analyze("pfc",{lineHz:50,outerCrossoverHz:80},deps);
  assert.equal(safe.model.doubleLineHz,100);
  assert.equal(safe.status,"SLOW_OUTER_LOOP");
  assert.equal(fast.status,"CHASES_2W_RIPPLE");
  assert.equal(fast.constraint.constraint,"DOUBLE_LINE_RIPPLE");
});

test("PSFB light-load primary current loses ZVS energy margin",()=>{
  const heavy=Core.analyze("psfb",{primaryCurrentA:10},deps);
  const light=Core.analyze("psfb",{primaryCurrentA:2},deps);
  assert.ok(light.model.zvsEnergyMargin<heavy.model.zvsEnergyMargin);
  assert.equal(heavy.status,"ZVS_MARGIN_PRESENT");
  assert.equal(light.status,"ZVS_MARGIN_LOST");
});

test("LLC exposes operating-point-dependent gain and region",()=>{
  const near=Core.analyze("llc",{switchingHz:100e3,q:.5},deps);
  const high=Core.analyze("llc",{switchingHz:160e3,q:1.2},deps);
  assert.notEqual(near.model.gain,high.model.gain);
  assert.notEqual(near.model.normalizedFrequency,high.model.normalizedFrequency);
  assert.equal(high.constraint.constraint,"OPERATING_POINT_GAIN");
  assert.match(high.boundary,/FHA/);
});

test("LCL inverter reports resonance margin against chosen control bandwidth",()=>{
  const safe=Core.analyze("inverter",{controlBandwidthHz:500},deps);
  const risky=Core.analyze("inverter",{controlBandwidthHz:5000},deps);
  assert.equal(safe.constraint.constraint,"LCL_RESONANCE");
  assert.ok(risky.ratio>safe.ratio);
  assert.ok(["CLOSE_TO_RESONANCE","RESONANCE_RISK"].includes(risky.status));
  assert.equal(risky.model.resonanceNeedsDamping,true);
});

test("constraint atlas covers all five transfer topologies with explicit fidelity",()=>{
  const vector=Core.transferVector(deps);
  assert.deepEqual(vector.map(x=>x.topology),["boost","pfc","psfb","llc","inverter"]);
  assert.ok(vector.every(x=>typeof x.model.fidelity==="string"&&x.model.fidelity.length>0));
  assert.ok(vector.every(x=>typeof x.boundary==="string"&&x.boundary.length>20));
});
