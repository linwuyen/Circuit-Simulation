import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const W=require("../assets/learning/ti-topology-workbench-core.js");

test("topology transfer exposes exactly five constraint families",()=>{
  const rows=W.compare();
  assert.equal(rows.length,5);
  assert.deepEqual(rows.map(r=>r.id),["boost","pfc","psfb","llc","inverter"]);
});

test("Boost duty increase moves RHPZ lower",()=>{
  const a=W.evaluate("boost",{duty:.4}),b=W.evaluate("boost",{duty:.7});
  assert.ok(b.metrics.RHPZ_Hz<a.metrics.RHPZ_Hz);
});

test("PSFB light load loses ZVS energy margin",()=>{
  const heavy=W.evaluate("psfb",{primaryCurrentA:10}),light=W.evaluate("psfb",{primaryCurrentA:2});
  assert.ok(light.metrics.ZVS_margin<heavy.metrics.ZVS_margin);
});

test("LLC frequency sweep crosses operating regions",()=>{
  const s=W.sweep("llc",100);
  assert.ok(s.rows.some(r=>r.metrics.region==="BELOW_RESONANCE"));
  assert.ok(s.rows.some(r=>r.metrics.region==="ABOVE_RESONANCE"));
});

test("inverter larger C moves ideal LCL resonance lower",()=>{
  const a=W.evaluate("inverter",{capF:10e-6}),b=W.evaluate("inverter",{capF:20e-6});
  assert.ok(b.metrics.resonance_Hz<a.metrics.resonance_Hz);
});
