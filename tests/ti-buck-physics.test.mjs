import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Physics=require("../assets/learning/ti-buck-physics-core.js");
const Models=require("../assets/training-experiments-core.js");

test("Buck physics boundary matches steady model",()=>{
  const c={vin:48,duty:.25,inductanceUh:100,capacitanceUf:220,loadOhm:5,fswKhz:100};
  const steady=Physics.steadySnapshot(Models.buck,c);
  assert.equal(steady.regime,"CCM");
  assert.ok(Math.abs(steady.boundaryOhm-Physics.boundaryOhm(c))<1e-12);
  assert.ok(Math.abs(steady.vout-12)<1e-12);
  assert.ok(Math.abs(steady.firstOrder.onVL-36)<1e-12);
  assert.ok(Math.abs(steady.firstOrder.offVL+12)<1e-12);
  assert.ok(Math.abs(steady.firstOrder.onSlopeAUs-.36)<1e-12);
});

test("Buck physics load sweep crosses CCM to DCM near Rcrit",()=>{
  const sweep=Physics.loadSweep(Models.buck,{vin:48,duty:.25,inductanceUh:100,capacitanceUf:220,loadOhm:5,fswKhz:100},{
    minLoadOhm:2,maxLoadOhm:100,points:40
  });
  assert.ok(sweep.rows.some(r=>r.regime==="CCM"));
  assert.ok(sweep.rows.some(r=>r.regime==="DCM"));
  const firstDcm=sweep.rows.find(r=>r.regime==="DCM");
  assert.ok(firstDcm.loadOhm>sweep.boundaryOhm*.8);
});

test("Buck transient approaches the algebraic CCM operating point",()=>{
  const c={vin:48,duty:.25,inductanceUh:100,capacitanceUf:220,loadOhm:5,fswKhz:100};
  const steady=Physics.steadySnapshot(Models.buck,c);
  const t=Physics.simulateTransient(c,{cycles:900,stepsPerCycle:100,maxPoints:1000});
  assert.equal(t.final.regime,"CCM");
  assert.ok(Math.abs(t.final.avgVout-steady.vout)<.35,JSON.stringify({actual:t.final.avgVout,expected:steady.vout}));
  assert.ok(Math.abs(t.final.avgIL-steady.avgI)<.2);
  assert.ok(t.rows.length<=1002);
});

test("Buck transient exposes startup overshoot and solver provenance",()=>{
  const t=Physics.simulateTransient({vin:48,duty:.5,inductanceUh:100,capacitanceUf:47,loadOhm:8,fswKhz:100},{
    cycles:500,stepsPerCycle:80,maxPoints:800
  });
  assert.equal(t.version,1);
  assert.match(t.solver.type,/ideal-switched-buck/);
  assert.ok(t.final.peakVout>0);
  assert.ok(t.solver.dtUs>0);
  assert.match(t.boundary,/not device stress design/);
});
