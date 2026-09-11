import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../assets/learning/workspace-core.js';
import R from '../assets/learning/model-registry.js';
import E from '../assets/learning/learning-evidence.js';
import U from '../assets/learning/unified-learning.js';
test('four native-control comparisons use registered models and independent scaling identities',()=>{
 for(const l of W.applicationLessons()){
  const p=W.applicationPlan(l.id),a=W.applicationRun(l.id,p.before).result,b=W.applicationRun(l.id,p.after).result;
  assert.equal(Object.keys(p.before).filter(k=>p.before[k]!==p.after[k]).length,1);
  assert.ok(b[l.metrics[0][0]]<a[l.metrics[0][0]],l.id);
  if(l.id==='pfc'){assert.ok(Math.abs(b.busRippleVpk/a.busRippleVpk-.5)<1e-12);assert.ok(Math.abs(b.outerPoleHz/a.outerPoleHz-.5)<1e-12);assert.equal(b.doubleLineHz,120);}
  if(l.id==='psfb'){assert.ok(Math.abs(b.zvsEnergyMargin/a.zvsEnergyMargin-.04)<1e-12);assert.equal(b.idealSecondaryV,a.idealSecondaryV);assert.equal(b.zvsEnergySufficient,false);}
  if(l.id==='llc')assert.ok(Math.abs(b.normalizedFrequency/a.normalizedFrequency-1.5)<1e-12);
  if(l.id==='inverter'){assert.ok(Math.abs(b.resonanceHz/a.resonanceHz-1/Math.sqrt(2))<1e-12);assert.equal(b.fundamentalVrms,a.fundamentalVrms);}
  assert.equal(R.describe(l.modelId).owner,'assets/learning/topology-transfer-v1.js');
 }
});
test('registry retains distinct FHA steady gain, current plant and grid-filter response contracts',()=>{
 assert.equal(R.run('llc-normalized-fha',{normalizedFrequency:1,ln:6,q:.5}).gain,1);
 assert.equal(R.describe('llc-normalized-fha').outputs.phaseDeg,undefined);
 assert.equal(R.run('boost-pfc-current-inner',{vbus:400,inductanceH:.0005,frequencyHz:100}).phaseDeg,-90);
 const p=W.applicationRun('inverter',W.applicationPlan('inverter').before).params;
 assert.equal(R.run('inverter-filter-plant',{...p,frequencyHz:10}).units,'A/modulation');
 assert.throws(()=>R.run('inverter-filter-plant',{...p,mode:'unknown',frequencyHz:10}));
});
test('practice resume preserves due and advanced priorities and cannot grant formal completion',()=>{
 const state={benchmark:{learningWorkspace:{topologyApplications:{version:1,completed:false}}}};
 assert.equal(U.next(state).id,'applications');state.benchmark.unifiedLearning={track:'core'};assert.equal(U.next(state).id,'core-physics');
 const row={protocol:'topology-application-v1',first:{correct:false},observationPassed:true,reasonPassed:true};assert.equal(W.applicationProof(row),false);row.operated=true;assert.equal(W.applicationProof(row),true);
 assert.equal(state.benchmark.outcomeV1,undefined);
});
test('application backups fill absent child and preserve local first attempts and old concept records',()=>{
 E._resetForTests();const s=E.load();s.benchmark.learningWorkspace={version:1,topologyConcepts:{version:1,rows:{old:true}}};E.save(s);
 const incoming=JSON.parse(E.exportBackup());incoming.benchmark.learningWorkspace.topologyApplications={version:1,rows:{pfc:{first:{answer:'higher',correct:false}}}};E.merge(incoming);
 incoming.benchmark.learningWorkspace.topologyApplications.rows.pfc.first.answer='lower';E.merge(incoming);
 assert.equal(E.load().benchmark.learningWorkspace.topologyApplications.rows.pfc.first.answer,'higher');assert.equal(E.load().benchmark.learningWorkspace.topologyConcepts.rows.old,true);E._resetForTests();
});
