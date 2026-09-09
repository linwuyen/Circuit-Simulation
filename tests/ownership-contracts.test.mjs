import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const B=require('../assets/training-experiments-core.js'),U=require('../assets/learning/unified-learning.js'),F=require('../assets/learning/core-flow-v1.js');
const R=require('../assets/learning/model-registry.js'),K=require('../assets/engineering-sandbox-core.js'),Facts=require('../assets/learning/engineering-curriculum.js');
test('shared scenario accepts precisely the Buck owner ranges and keeps strict payload typing',()=>{
  const base=B.buckConfig(),wrap=model=>({version:1,family:'buck-steady-v1',model});
  for(const [key,spec] of Object.entries(B.BUCK_INPUTS)){
    for(const value of [spec.min,spec.max])assert.deepEqual(U.validateScenario(wrap({...base,[key]:value})).model,B.buckConfig({...base,[key]:value}));
    for(const value of [spec.min-.001,spec.max+.001,NaN,Infinity,String(spec.default),null])assert.throws(()=>U.validateScenario(wrap({...base,[key]:value})),key);
    const missing={...base};delete missing[key];assert.throws(()=>U.validateScenario(wrap(missing)),key+' may not default during import');
  }
  assert.ok(Object.isFrozen(B.BUCK_INPUTS));assert.ok(Object.isFrozen(B.BUCK_INPUTS.vin));
});
test('registry delegates to existing steady and coupled owners without rewriting either calculation',()=>{
  assert.deepEqual(R.run('buck-steady-v1',{vin:36,loadOhm:100}),B.buck({vin:36,loadOhm:100}));
  const input={cycles:40,seed:71};assert.deepEqual(R.run('generic-power-causal-kernel',input),K.simulateSystem(input));
  assert.equal(R.describe('buck-steady-v1').owner,'assets/training-experiments-core.js');
  assert.equal(R.describe('generic-power-causal-kernel').contractStatus,'PARTIAL');
  assert.equal(R.describe('generic-power-causal-kernel').claim,'MODEL_ONLY');
  assert.equal(R.describe('not-registered'),null);assert.deepEqual(R.validate(),[]);
});
test('shared curriculum covers all module topics and the complete authority grammar',()=>{
  assert.equal(Object.keys(Facts.moduleTopics).length,20);
  for(const topics of Object.values(Facts.moduleTopics))for(const topic of topics)assert.ok(Facts.taxonomy[topic]);
  assert.deepEqual(Object.keys(Facts.views),['physical','signal','control','time','authority']);
  assert.ok(Facts.views.authority.flow.includes('Valid calibration'));assert.ok(Facts.views.authority.flow.includes('Peripherals ready'));
  assert.match(Facts.views.authority.note,/獨立 hardware veto/);
});
test('UnifiedLearning derives core identity, order and route labels from CoreFlow',()=>{
  assert.deepEqual(U.layers,F.layers.map(l=>[l.key,l.label]));
  for(const layer of F.layers){assert.equal(U.task('core-'+layer.key).title,layer.label+'主線任務');assert.equal(U.route('core-'+layer.key),F.href(layer.key));}
  assert.equal(U.next({benchmark:{unifiedLearning:{track:'core'}}},{completed:{physics:'done'}}).id,'core-sensing');
});
