import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const Labs=require("../assets/learning/ti-concept-labs-core.js");

test("all 15 TI concept cards have executable web adapters",()=>{
  const rows=Labs.list();
  assert.equal(rows.length,15);
  for(const row of rows){
    assert.ok(row.id);
    assert.ok(row.kind);
    const lab=Labs.get(row.id);
    assert.ok(Array.isArray(lab.choices)&&lab.choices.length>=3);
    assert.ok(Labs.expected(row.id));
    const result=Labs.evaluate(row.id,Labs.defaults(row.id));
    assert.ok(result.summary);
    assert.ok(result.metrics);
    assert.ok(result.boundary);
  }
});

test("peak-current adapter exposes alternating-cycle instability above 50% without enough compensation",()=>{
  const r=Labs.evaluate("current-mode-slope-comp",{vin:48,vout:30,inductanceH:100e-6,slopeCompAUs:0});
  assert.ok(r.metrics.perturbationRatio<0);
  assert.ok(Math.abs(r.metrics.perturbationRatio)>1);
  assert.equal(r.metrics.stable,false);
});

test("ePWM adapter delays a write that misses the ZERO load event",()=>{
  const r=Labs.evaluate("epwm-signal-path",{periodUs:10,writeUs:10.2});
  assert.equal(r.metrics.activeUs,20);
});

test("Trip Zone adapter preserves hardware authority over ISR-only shutdown",()=>{
  const r=Labs.evaluate("trip-zone-authority",{faultUs:6,hardwareLatencyUs:.2,isrDecisionUs:14});
  assert.ok(r.metrics.hardwareSafeUs<r.metrics.isrSafeUs);
});

test("WCET adapter does not confuse lower average with lower maximum",()=>{
  const r=Labs.evaluate("c28x-wcet-evidence",{deadlineUs:10,averageScale:.5});
  assert.ok(r.metrics.avgAfterUs<r.metrics.avgBeforeUs);
  assert.equal(r.metrics.maxAfterUs,r.metrics.maxBeforeUs);
});
