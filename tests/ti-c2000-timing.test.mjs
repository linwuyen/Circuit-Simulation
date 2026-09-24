import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const T=require("../assets/learning/ti-c2000-timing-core.js");

test("C2000 timing hit commits at next ZERO",()=>{
  const r=T.directTimeline({periodUs:10,samplePct:20,adcLatencyUs:.5,isrLatencyUs:.3,computeUs:3,pwmCommitUs:.3});
  assert.equal(r.hit,true);
  assert.equal(r.activeUs,10);
  assert.equal(r.actuationDelayCycles,1);
  assert.ok(r.marginUs>0);
});

test("C2000 timing miss waits one additional ZERO",()=>{
  const r=T.directTimeline({periodUs:10,samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:4,pwmCommitUs:.3});
  assert.equal(r.miss,true);
  assert.equal(r.activeUs,20);
  assert.equal(r.actuationDelayCycles,2);
  assert.ok(r.marginUs<0);
});

test("compute sweep crosses the deterministic deadline",()=>{
  const s=T.sweepCompute({periodUs:10,samplePct:20,adcLatencyUs:.5,isrLatencyUs:.3,pwmCommitUs:.3},{minUs:.2,maxUs:12,points:80});
  assert.ok(s.rows.some(r=>!r.miss));
  assert.ok(s.rows.some(r=>r.miss));
  assert.ok(s.boundaryComputeUs>0);
});

test("sandbox cross-check exposes timing misses without changing evidence level",()=>{
  const e=T.sandboxEvidence({periodUs:10,samplePct:20,adcLatencyUs:.5,isrLatencyUs:.3,computeUs:3,pwmCommitUs:.3});
  assert.equal(e.direct.hit,true);
  assert.equal(e.summary.missedCommits,0);
  assert.match(e.boundary,/teaching evidence/);
});
