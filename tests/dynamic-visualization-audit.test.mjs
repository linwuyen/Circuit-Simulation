import test from "node:test";
import assert from "node:assert/strict";
import { runAudit } from "../tools/audit-dynamic-visuals.mjs";

test("0-19 dynamic visualization audit covers every numbered module",()=>{
  const {manifest,visualRows,summary}=runAudit();
  assert.equal(manifest.modules.length,20);
  assert.deepEqual(manifest.modules.map(x=>x.module).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i));
  assert.equal(summary.modules,20);
  assert.ok(visualRows.length>0);
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
    assert.ok(row.canvases+row.ranges+row.selects>0,row.path);
  }
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
