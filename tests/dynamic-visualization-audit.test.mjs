import test from "node:test";
import assert from "node:assert/strict";
import { detectDynamicSvgBlocks, runAudit } from "../tools/audit-dynamic-visuals.mjs";

test("0-19 dynamic visualization audit covers every numbered module",()=>{
  const {manifest,visualRows,summary}=runAudit();
  assert.equal(manifest.modules.length,20);
  assert.deepEqual(manifest.modules.map(x=>x.module).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i));
  assert.equal(summary.modules,20);
  assert.ok(visualRows.length>0);
  assert.ok(Number.isInteger(summary.dynamicSvgs));
  for(const module of manifest.modules){
    assert.ok(module.model.length>0);
    assert.ok(module.validRegion.length>0);
    assert.ok(module.knownBoundary.length>0);
    assert.ok(module.action.length>0);
  }
});

test("every interactive numbered HTML file inherits an explicit fidelity policy",()=>{
  const {manifest,visualRows}=runAudit();
  const policies=new Map(manifest.modules.map(x=>[x.module,x]));
  for(const row of visualRows){
    assert.ok(policies.has(row.module),row.path);
    assert.equal(row.fidelity,policies.get(row.module).defaultFidelity,row.path);
    assert.ok(row.canvases+row.ranges+row.selects+row.dynamicSvgs>0,row.path);
  }
});

test("JS-mutated SVGs are audited while decorative static SVGs are ignored",()=>{
  const html=`
    <svg id="logo"><path id="mark" d="M0 0L1 1"/></svg>
    <svg id="plot"><path id="curve" d="M0 0L1 1"/></svg>`;
  const script=`
    const mark=document.getElementById("mark");
    console.log(mark);
    const curve=document.getElementById("curve");
    curve.setAttribute("d", nextPath);`;
  assert.deepEqual(detectDynamicSvgBlocks(html,script).map(x=>x.id),["plot"]);
});

test("selector-chain SVG mutation is detected without requiring a slider or canvas",()=>{
  const html='<svg id="scope"><polyline id="trace" points="0,0 1,1"/></svg>';
  const script='document.querySelector("#scope #trace").setAttribute("points", samples);';
  assert.deepEqual(detectDynamicSvgBlocks(html,script).map(x=>x.id),["scope"]);
});

test("Module 17 equation-grade canvases all declare units and validity boundaries",()=>{
  const {manifest,visualRows}=runAudit();
  const declared=new Map(manifest.module17Visuals.map(v=>[v.id,v]));
  const actual=new Set(visualRows.filter(x=>x.module===17).flatMap(x=>x.canvasIds));
  assert.deepEqual([...actual].sort(),[...declared.keys()].sort());
  for(const [id,v] of declared){
    assert.equal(v.fidelity,"EQUATION_GRADE",id);
    assert.ok(v.units.trim().length>0,id);
    assert.ok(v.boundary.trim().length>0,id);
  }
});
