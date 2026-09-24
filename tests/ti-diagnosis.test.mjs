import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const D=require("../assets/learning/ti-diagnosis-core.js");

test("diagnosis case hides root cause until learner chooses measurements",()=>{
  const s=D.caseFromSeed(23);
  assert.equal(s.revealed.length,0);
  assert.equal(s.measurements.length,0);
  assert.equal(s.faults.length,2);
});

test("ideal measurement set can diagnose deterministic multifault case",()=>{
  let s=D.caseFromSeed(23);
  const ideal=D.idealMeasurementSet(s);
  for(const m of ideal)s=D.measure(s,m);
  const score=D.diagnose(s,s.faults);
  assert.equal(score.accuracy,1);
  assert.equal(score.falsePos,0);
  assert.ok(score.measurementCost<=5);
});

test("wrong extra root cause is penalized",()=>{
  let s=D.caseFromSeed(23);
  for(const m of D.idealMeasurementSet(s))s=D.measure(s,m);
  const wrong=[...s.faults,D.faults.find(x=>!s.faults.includes(x))];
  const score=D.diagnose(s,wrong);
  assert.ok(score.falsePos>0);
  assert.equal(score.pass,false);
});

test("code trace surfaces an evidence-first measurement",()=>{
  const r=D.codeCase("shadow");
  assert.equal(r.bug,"shadow");
  assert.equal(r.measurement.measurement,"timing");
});
