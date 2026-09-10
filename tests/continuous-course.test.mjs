import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../assets/learning/workspace-core.js';
import R from '../assets/learning/model-registry.js';
import U from '../assets/learning/unified-learning.js';
const tail=r=>r.trace.slice(-320);
const load=r=>tail(r).reduce((s,x)=>s+x.vOut/x.load,0)/320;
test('the existing navigator resumes experiments then advances without promoting legacy scores',()=>{
 const state={benchmark:{learningWorkspace:{experiment:{version:1,completed:false}}}};
 assert.equal(U.next(state,{}).id,'experiment');
 state.benchmark.unifiedLearning={track:'core'};assert.equal(U.next(state,{}).id,'core-physics');
 delete state.benchmark.unifiedLearning;state.benchmark.learningWorkspace.experiment.completed=true;
 assert.equal(U.next(state,{}).id,'topology');assert.equal(state.benchmark.beginnerLessons,undefined);
});
function verify(id,b,a){
 if(id==='energy')assert.ok(a.summary.avgV>b.summary.avgV);
 if(id==='storage'){const off=a.waveform.filter(r=>!r.gate);assert.ok(off[0].iL>0&&off.at(-1).iL<off[0].iL);}
 if(id==='demand')assert.ok(load(a)<load(b));
 if(id==='sensing'){assert.equal(a.summary.avgV,b.summary.avgV);assert.ok(a.trace.at(-1).sampledV<b.trace.at(-1).sampledV);}
 if(id==='feedback')assert.ok(Math.abs(a.summary.avgV-24)<Math.abs(b.summary.avgV-24));
 if(id==='deadline'){assert.ok(a.summary.missedCommits>b.summary.missedCommits);assert.ok(a.trace[0].scheduledApplyCycle>b.trace[0].scheduledApplyCycle);}
 if(id==='response')assert.ok(a.summary.peakV>b.summary.peakV);
 if(id==='protection'){assert.ok(a.summary.tripSeen);assert.equal(a.trace.at(-1).appliedDuty,0);assert.ok(a.summary.finalV>0);}
}
test('every prediction matches the registered causal model in lesson and unseen-input conditions',()=>{
 for(const l of W.experimentLessons()){
  const p=W.experimentPlan(l.id),t=W.experimentTransfer(p);
  verify(l.id,W.experimentRun(p.prepared),W.experimentRun(p.after));
  verify(l.id,W.experimentRun(t.before),W.experimentRun(t.after));
 }
});
test('successive lessons retain all preceding conditions; preparations are explicit',()=>{
 const lessons=W.experimentLessons();
 for(let i=1;i<lessons.length;i++)assert.deepEqual(W.experimentPlan(lessons[i].id).before,W.experimentPlan(lessons[i-1].id).after);
 assert.deepEqual(W.experimentRun(W.experimentPlan('feedback').after),R.run('generic-power-causal-kernel',W.experimentPlan('feedback').after));
 assert.equal(W.experimentPlan('feedback').before.sensorGain,.8);
 assert.equal(W.experimentPlan('feedback').prepared.sensorGain,1);
 assert.equal(W.experimentPlan('response').before.computeUs,11);
 assert.equal(W.experimentPlan('response').prepared.computeUs,1.7);
});
