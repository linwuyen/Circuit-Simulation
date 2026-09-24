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

test("TI learner UI exposes component interaction, four-trace scope and causal chain",async()=>{
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
  assert.match(ui,/TRACE_COMPONENT=\{pwm:"switch",vl:"inductor",il:"inductor",vout:"capacitor"\}/);
  assert.match(ui,/function bindScopeInteraction\(svg\)/);
  assert.match(ui,/setPointerCapture/);
  assert.match(ui,/setCircuitPhase\(next\)/);
  assert.match(ui,/mouseenter/);
  assert.match(ui,/selectComponent\(component\)/);
  assert.match(css,/ti-component-hit\.is-preview/);
  assert.match(css,/touch-action:none/);
});
