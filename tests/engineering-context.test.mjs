import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),X=require('../assets/learning/engineering-context.js'),Facts=require('../assets/learning/engineering-curriculum.js'),R=require('../assets/learning/model-registry.js'),U=require('../assets/learning/unified-learning.js'),F=require('../assets/learning/core-flow-v1.js'),Schema=require('../assets/learning/curriculum-schema-v3.js');
const ctx=vm.createContext({document:{querySelector:()=>null,querySelectorAll:()=>[]}});ctx.window=ctx;
for(const file of ['curriculum.js','opamp-module.js','power-firmware-modules.js','control-transforms-module.js','power-topology-control-module.js','control-unification-module.js','learning-map.js'])vm.runInContext(fs.readFileSync(new URL('../assets/learning/'+file,import.meta.url),'utf8'),ctx);
U.registerModules(ctx.CircuitLearningMap);
const curriculum=Schema.normalizeCurriculum(ctx.CircuitCurriculum),owners={map:ctx.CircuitLearningMap,curriculum,registry:R,facts:Facts,unified:U,flow:F};
test('context joins exact registered model for workspace and coupled debug without rewriting state',()=>{
  const before=F.snapshot(),home=X.resolve({path:'index.html',hash:'#duty'},owners),debug=X.resolve({path:'15_power_capstone/lab_multifault.html'},owners);
  assert.equal(home.models[0].owner,'assets/training-experiments-core.js');assert.equal(debug.models[0].owner,'assets/engineering-sandbox-core.js');assert.equal(debug.mapping,'PAGE_MODEL');assert.equal(debug.status,'MODEL_ONLY');assert.deepEqual(F.snapshot(),before);
});
test('all twenty module entries have common taxonomy; unknown mappings are not invented',()=>{
  for(const entry of owners.map){const c=X.resolve({path:entry.href},owners);assert.equal(c.known,true,entry.href);assert.ok(c.topics.length,entry.href);for(const topic of c.topics)assert.ok(Facts.taxonomy[topic]);}
  const unknown=X.resolve({path:'not-a-module.html'},owners);assert.equal(unknown.status,'UNKNOWN');assert.deepEqual(unknown.models,[]);
  for(const path of ['https://evil.invalid','../index.html','/absolute.html','%ZZ'])assert.equal(X.resolve({path},owners).known,false);
});
test('curriculum graph preserves canonical item and competency IDs without generating mastery',()=>{
  const g=X.graph(curriculum,Facts),items=curriculum.modules.flatMap(m=>[...m.lessons,...m.labs,...m.faults]);
  for(const item of items){assert.ok(g.nodes.some(n=>n.id===item.id));assert.ok(g.edges.some(e=>e.from===item.id&&e.to==='competency:'+item.competency));}
  assert.equal(g.claim,'CURRICULUM_RELATIONSHIPS_ONLY');assert.equal(g.nodes.length,new Set(g.nodes.map(n=>n.id)).size);
});
test('firmware route and truth boundary use existing layer owner; model scope remains explicit',()=>{
  const c=X.resolve({path:'19_c2000_buck_firmware_lab/index.html',search:'?layer=safety'},owners);assert.equal(c.task,'core-safety');assert.match(c.boundary,/不讀取或授予 BOARD_PASS/);assert.equal(c.mapping,'UNMAPPED');
  const legacy=X.resolve({path:'4_PI/index.html'},owners);assert.equal(legacy.mapping,'MODULE_SCOPE');assert.ok(legacy.models.length>0);
});
