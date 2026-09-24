import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Physics=require("../assets/learning/ti-buck-physics-core.js");
const Buck=require("../assets/training-experiments-core.js");
const Sandbox=require("../assets/engineering-sandbox-core.js");

test("Buck physics scenarios preserve expected steady-state directions",()=>{
  const duty=Physics.compare(Buck.buck,"duty");
  assert.equal(duty.before.model.regime,"CCM");
  assert.equal(duty.after.model.regime,"CCM");
  assert.ok(duty.metrics.vout.delta>0);

  const L=Physics.compare(Buck.buck,"inductance");
  assert.ok(Math.abs(L.after.model.ripple/L.before.model.ripple-.5)<1e-9);

  const fsw=Physics.compare(Buck.buck,"frequency");
  assert.ok(Math.abs(fsw.after.model.ripple/fsw.before.model.ripple-.5)<1e-9);

  const C=Physics.compare(Buck.buck,"capacitance");
  assert.ok(C.metrics.vRipple.after<C.metrics.vRipple.before);

  const esr=Physics.compare(Buck.buck,"esr");
  assert.ok(esr.metrics.vRipple.after>esr.metrics.vRipple.before);
});

test("Buck load scenario exposes the CCM to DCM model boundary",()=>{
  const load=Physics.compare(Buck.buck,"load");
  assert.equal(load.regime.before,"CCM");
  assert.equal(load.regime.after,"DCM");
  assert.equal(load.regime.changed,true);

  const sweep=Physics.regimeSweep(Buck.buck);
  assert.ok(sweep.some(x=>x.regime==="CCM"));
  assert.ok(sweep.some(x=>x.regime==="DCM"));
});

test("Buck derived physics links vL, di/dt, capacitor current and stored energy",()=>{
  const x=Physics.evaluate(Buck.buck,{vin:48,duty:.25,inductanceUh:100,loadOhm:5});
  assert.ok(Math.abs(x.derived.vLOn-36)<1e-9);
  assert.ok(Math.abs(x.derived.onSlopeAUs-.36)<1e-9);
  assert.ok(Math.abs(x.derived.offSlopeAUs+.12)<1e-9);
  assert.ok(x.derived.rows.some(row=>Number.isFinite(row.iC)));
  assert.ok(x.derived.energyAvgJ>0);
});

test("full transient uses the existing generic kernel and stays a teaching surrogate",()=>{
  const t=Physics.runTransient(Sandbox.simulateSystem,{vin:48,duty:.25,inductanceUh:100,capacitanceUf:220,loadOhm:5,fswKhz:100},120);
  assert.equal(t.claim,"TEACHING_SURROGATE");
  assert.equal(t.config.controlMode,"manual");
  assert.equal(t.config.manualDuty,.25);
  assert.equal(t.trace.length,120);
  assert.ok(t.trace.at(-1).vOut>0);
  assert.match(t.boundary,/not the buck-steady-v1/);
});
