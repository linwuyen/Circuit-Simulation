import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../assets/learning/workspace-core.js';
import R from '../assets/learning/model-registry.js';
import E from '../assets/learning/learning-evidence.js';
import U from '../assets/learning/unified-learning.js';
import contracts from '../assets/learning/model-contracts-v1.json' with {type:'json'};
test('shared comparison uses the existing model contracts and analytical DC limits',()=>{
 const {params}=W.topologyPlan(),c=W.topologyCompare(params);
 assert.ok(c.valid);assert.equal(c.buck.before.vout,params.vin*params.duty);assert.equal(c.boost.before.vout,params.vin/(1-params.duty));
 assert.ok(c.buck.after.vout>c.buck.before.vout&&c.boost.after.vout>c.boost.before.vout);assert.ok(c.boost.after.rhpzHz<c.boost.before.rhpzHz);
 for(const id of ['buck-ccm-control-output-esr','boost-ccm-control-output']){assert.deepEqual(R.describe(id).assumptions,contracts.visuals.find(v=>v.modelId===id).assumptions);assert.ok(Number.isFinite(R.run(id,{...params,frequencyHz:100}).phaseDeg));}
 assert.equal(R.describe('boost-ccm-control-output').claim,'MODEL_ONLY');
});
test('comparison takes manual parameters, never fault or closed controller state',()=>{
 const manual={...W.experimentPlan('demand').after,vin:36};const fault=W.experimentPlan('protection').after;
 const e={benchmark:{learningWorkspace:{experiment:{history:[{config:manual},{config:fault}],currentConfig:fault}}}};
 const plan=W.topologyPlan(e);assert.equal(plan.params.vin,36);assert.equal(plan.params.loadOhm,24);assert.equal(plan.params.duty,.4);assert.equal(plan.params.switchingHz,100000);assert.equal(plan.params.tripCurrent,undefined);
});
test('CCM comparison fails outside conduction assumptions; malformed data cannot become a result',()=>{
 const p=W.topologyPlan().params;assert.equal(W.topologyCompare({...p,loadOhm:1000,inductanceH:20e-6}).valid,false);
 for(const value of [null,'48',NaN,Infinity,-1])assert.throws(()=>W.topologyCompare({...p,vin:value}));
 assert.throws(()=>W.topologyCompare({...p,esrOhm:.1}));assert.throws(()=>W.topologyCompare({...p,duty:.94}));
});
test('guided completion requires operation and all proof gates, and does not grant formal grades',()=>{
 const r={version:1,protocol:'topology-workbench-v1',rows:{prediction:{first:{correct:false}},observation:{passed:true},reason:{passed:true},return:{passed:true}}};
 assert.equal(W.topologyProof(r),false);r.operated=true;assert.equal(W.topologyProof(r),true);
 const e={benchmark:{learningWorkspace:{topologyTransfer:{...r,completed:true},experiment:{version:1,completed:true}}}};
 assert.equal(U.next(e).id,'applications');e.benchmark.learningWorkspace.topologyApplications={version:1,completed:true};assert.equal(U.next(e).id,'core-physics');assert.equal(e.benchmark.outcomeV1,undefined);
 e.benchmark.outcomeV1={sessions:{post:{completedAt:'2026-01-01'}},retention:{r1:{dueAt:'2026-01-02'}}};assert.equal(U.next(e).id,'formal');
});
test('backup adds missing topology records without replacing local first attempts or experiment',()=>{
 E._resetForTests();const state=E.load();state.benchmark.learningWorkspace={version:1,experiment:{version:1,history:[{kind:'retained'}]},topologyTransfer:{version:1,rows:{prediction:{first:{answer:'wrong'}}}}};E.save(state);
 const backup=JSON.parse(E.exportBackup());backup.benchmark.learningWorkspace.experiment.history=[];backup.benchmark.learningWorkspace.topologyTransfer.rows.prediction.first.answer='correct';backup.benchmark.learningWorkspace.topologyConcepts={version:1,rows:{boost:{first:{answer:'RHP zero'}}}};
 E.merge(backup);const w=E.load().benchmark.learningWorkspace;assert.equal(w.experiment.history.length,1);assert.equal(w.topologyTransfer.rows.prediction.first.answer,'wrong');assert.equal(w.topologyConcepts.rows.boost.first.answer,'RHP zero');E._resetForTests();
});
