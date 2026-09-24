import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const C=require("../assets/learning/ti-control-workbench-core.js");

test("digital delay reduces modeled phase margin",()=>{
  const a=C.loopResponse({delayUs:1});
  const b=C.loopResponse({delayUs:30});
  assert.ok(b.phaseMarginDeg<a.phaseMarginDeg);
});

test("PI zero follows Ki over Kp",()=>{
  const a=C.loopResponse({kp:.04,ki:40});
  const b=C.loopResponse({kp:.04,ki:80});
  assert.ok(Math.abs(b.piZeroHz/a.piZeroHz-2)<1e-12);
});

test("SFRA teaching gate rejects saturation and low SNR separately",()=>{
  const sat=C.sfraMeasurement({duty:.45,injectionDuty:.5,noiseDuty:.0001});
  assert.equal(sat.quality,"NONLINEAR_SATURATION");
  const noisy=C.sfraMeasurement({injectionDuty:.0001,noiseDuty:.001});
  assert.equal(noisy.quality,"LOW_SNR");
  const good=C.sfraMeasurement({injectionDuty:.01,noiseDuty:.0001});
  assert.equal(good.quality,"LINEAR_TEACHING_RANGE");
});

test("time response reuses existing causal kernel and preserves boundary",()=>{
  const r=C.timeResponse({kp:.04,ki:80,delayUs:8});
  assert.ok(r.rows.length>500);
  assert.ok(Number.isFinite(r.summary.finalV));
  assert.match(r.boundary,/generic switched causal teaching kernel/);
});
