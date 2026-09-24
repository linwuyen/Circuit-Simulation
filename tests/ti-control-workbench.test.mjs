import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const C=require("../assets/learning/ti-control-workbench-core.js");
const E=require("../assets/learning/control-engineering-v1.js");
const T=require("../assets/learning/topology-transfer-v1.js");

test("control workbench stable baseline has positive deterministic margin",()=>{
  const s=C.sweep(E,T);
  assert.equal(s.op.ccmValid,true);
  assert.ok(s.margins.crossoverHz>0);
  assert.ok(s.margins.phaseMarginDeg>45);
  assert.ok(s.piZeroHz>0);
});

test("adding digital delay consumes phase margin",()=>{
  const pair=C.vary(E,T,{}, {delayUs:100});
  assert.ok(pair.after.margins.phaseMarginDeg<pair.before.margins.phaseMarginDeg);
});

test("sample period changes discrete PI coefficients",()=>{
  const a=C.sweep(E,T,{sampleUs:10}),b=C.sweep(E,T,{sampleUs:20});
  assert.notEqual(a.controller.coefficients.b0,b.controller.coefficients.b0);
  assert.notEqual(a.controller.coefficients.b1,b.controller.coefficients.b1);
});

test("model vs synthetic SFRA mismatch reports phase error without claiming hardware",()=>{
  const exact=C.correlate(E,T,{}, {extraDelayUs:0});
  const delayed=C.correlate(E,T,{}, {extraDelayUs:50});
  assert.ok(exact.correlation.rmsPhaseDeg<1e-9);
  assert.ok(delayed.correlation.rmsPhaseDeg>exact.correlation.rmsPhaseDeg);
  assert.equal(exact.claim.evidence,"UNVERIFIED_IMPORT");
});

test("timing budget returns sample-to-actuate evidence",()=>{
  const t=C.timing(E,{},80);
  assert.ok(t.sampleToActuateS>=0);
  assert.equal(t.claim,"MODEL_ONLY_TIMING_BUDGET");
});
