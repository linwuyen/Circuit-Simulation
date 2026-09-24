import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-learning-core.js");
const Models=require("../assets/training-experiments-core.js");

test("TI Buck first-cycle model preserves slopes but changes dwell time first",()=>{
  const s=Core.buildFirstCycle(Models.buck,{vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5},.5);
  assert.equal(s.vout0,12);
  assert.ok(Math.abs(s.before.deltaI)<1e-9);
  assert.ok(Math.abs(s.after.onSlopeAUs-s.before.onSlopeAUs)<1e-12);
  assert.ok(Math.abs(s.after.offSlopeAUs-s.before.offSlopeAUs)<1e-12);
  assert.ok(Math.abs(s.after.deltaI-1.2)<1e-9);
  assert.equal(s.before.onUs,2.5);
  assert.equal(s.after.onUs,5);
});

test("TI web learning grade and spaced review follow 1/3/7/30 policy",()=>{
  assert.equal(Core.gradeResult({reasonPassed:false}),"fail");
  assert.equal(Core.gradeResult({predictionCorrect:false,observationFirstCorrect:true,reasonFirstCorrect:true,reasonPassed:true}),"partial");
  assert.equal(Core.gradeResult({predictionCorrect:true,observationFirstCorrect:true,reasonFirstCorrect:true,reasonPassed:true}),"pass");
  assert.equal(Core.gradeResult({transferPassed:true}),"transfer");
  assert.equal(Core.nextReview("fail","2026-09-24"),"2026-09-25");
  assert.equal(Core.nextReview("partial","2026-09-24"),"2026-09-27");
  assert.equal(Core.nextReview("pass","2026-09-24"),"2026-10-01");
  assert.equal(Core.nextReview("transfer","2026-09-24"),"2026-10-24");
});

test("existing workspace exposes TI learning as a web route",async()=>{
  const [html,ui]=await Promise.all([
    readFile(new URL("../learn.html",import.meta.url),"utf8"),
    readFile(new URL("../assets/learning/workspace-ui.js",import.meta.url),"utf8")
  ]);
  assert.match(html,/open-ti-learning/);
  assert.match(html,/ti-learning-core\.js/);
  assert.match(html,/ti-learning-ui\.js/);
  assert.match(ui,/#ti-learning/);
  assert.match(ui,/CircuitTILearning\.mount/);
});

test("TI simulator v2 keeps parameterized first-cycle physics inside CCM",()=>{
  const s=Core.buildFirstCycle(Models.buck,{vin:60,duty:.25,inductanceUh:200,fswKhz:100,loadOhm:5,capacitanceUf:470},.5);
  assert.equal(s.vout0,15);
  assert.equal(s.config.loadOhm,5);
  assert.ok(Math.abs(s.after.onSlopeAUs-.225)<1e-12);
  assert.ok(Math.abs(s.after.offSlopeAUs+.075)<1e-12);
  assert.ok(Math.abs(s.after.deltaI-.75)<1e-9);
});

test("TI learner UI exposes component interaction, scope and causal chain",async()=>{
  const ui=await readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8");
  assert.match(ui,/ti-component-hit-layer/);
  assert.match(ui,/ti-component-inspector/);
  assert.match(ui,/data-trace/);
  assert.match(ui,/PWM/);
  assert.match(ui,/vL/);
  assert.match(ui,/Vout/);
  assert.match(ui,/ti-causal-chain/);
});

test("TI UI id helper never receives CSS hash selectors",async()=>{
  const ui=await readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8");
  assert.doesNotMatch(ui,/\$\("#/);
});

test("TI compact workbench keeps circuit inspector overlay and causal controls in scope toolbar",async()=>{
  const [ui,css]=await Promise.all([
    readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8"),
    readFile(new URL("../assets/learning/workspace.css",import.meta.url),"utf8")
  ]);
  assert.match(ui,/ti-circuit-stage/);
  assert.match(ui,/toolbar\.insertBefore\(chain,status\)/);
  assert.match(ui,/data\.tiWorkbench="compact"/);
  assert.match(css,/\.ti-component-inspector\{[\s\S]*position:absolute/);
  assert.match(css,/\.route\{display:none\}/);
  assert.match(css,/#ws-plot\{[\s\S]*height:min\(31vh,300px\)/);
});

test("TI scope interaction maps waveform traces back to circuit components and scrubs circuit phase",async()=>{
  const ui=await readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8");
  const css=await readFile(new URL("../assets/learning/workspace.css",import.meta.url),"utf8");
  assert.match(ui,/TRACE_COMPONENT=\{pwm:"switch",vl:"inductor",il:"inductor",ic:"capacitor",vout:"capacitor"\}/);
  assert.match(ui,/function bindScopeInteraction\(svg,phaseHandler=setCircuitPhase\)/);
  assert.match(ui,/setPointerCapture/);
  assert.match(ui,/phaseHandler\(next\)/);
  assert.match(ui,/mouseenter/);
  assert.match(ui,/selectComponent\(component\)/);
  assert.match(css,/ti-component-hit\.is-preview/);
  assert.match(css,/touch-action:none/);
});

test("TI physics workbench exposes first steady and transient views with fsw and DCM exploration",async()=>{
  const [ui,css]=await Promise.all([
    readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8"),
    readFile(new URL("../assets/learning/workspace.css",import.meta.url),"utf8")
  ]);
  assert.match(ui,/\["first","FIRST"\]/);
  assert.match(ui,/\["steady","STEADY"\]/);
  assert.match(ui,/\["transient","TRANSIENT"\]/);
  assert.match(ui,/function drawSteadyPlot\(\)/);
  assert.match(ui,/function drawTransientPlot\(\)/);
  assert.match(ui,/buckTransient/);
  assert.match(ui,/fsw:\{label:"fsw"/);
  assert.match(ui,/load:\{label:"R",unit:"Ω",key:"loadOhm",min:1,max:100/);
  assert.match(css,/ti-trace-ic/);
});

test("first-cycle lesson preserves CCM boundary before DCM exploration",async()=>{
  const ui=await readFile(new URL("../assets/learning/ti-learning-ui.js",import.meta.url),"utf8");
  assert.match(ui,/stage===0&&B\.buck\(\{\.\.\.candidate,duty:\.25\}\)\.regime!=="CCM"/);
  assert.match(ui,/完成這次 loop 後/);
});


test("Epic 101 PASS directions are deterministic across L, fsw and load boundary",()=>{
  const base={vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0};
  const nominal=Models.buck(base);
  const l2=Models.buck({...base,inductanceUh:200});
  const f2=Models.buck({...base,fswKhz:200});
  const light=Models.buck({...base,loadOhm:100});
  assert.equal(nominal.regime,"CCM");
  assert.ok(Math.abs(l2.ripple/nominal.ripple-.5)<1e-9);
  assert.ok(Math.abs(f2.ripple/nominal.ripple-.5)<1e-9);
  assert.equal(light.regime,"DCM");
  assert.ok(light.zeroFraction>0);
});

test("Epic 101 full transient falsifies the frozen-Vout approximation after the first cycle",()=>{
  const t=Models.buckTransient({
    before:{vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0},
    after:{vin:48,duty:.5,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0},
    cycles:20,stepsPerCycle:128
  });
  assert.ok(Math.abs(t.firstCycle.avgVout-t.initialVout)<.1);
  assert.ok(t.lastCycle.avgVout>t.firstCycle.avgVout+5);
  assert.ok(t.rows.some(row=>row.state==="ON"));
  assert.ok(t.rows.some(row=>row.state==="OFF"));
});
