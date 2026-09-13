import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),A=require('../assets/learning/learning-assessment.js'),W=require('../assets/learning/workspace-core.js'),U=require('../assets/learning/unified-learning.js');
const experiment=()=>({version:1,completed:false,rows:Object.fromEntries(W.experimentLessons().map(l=>[l.id,{first:{correct:false},proof:{observation:true,reason:true},transferPassed:true}]))});
const wrap=w=>({benchmark:{learningWorkspace:w}});
test('resume cannot advance on an aggregate flag without step proof',()=>{
 const e=wrap({experiment:{version:1,completed:true,rows:{}}});assert.equal(W.learningRecords(e)[0].completed,0);assert.equal(U.next(e,{}).id,'experiment');
});
test('proven steps advance despite a stale false aggregate flag and evidence stays unchanged',()=>{
 const e=wrap({experiment:experiment()}),before=JSON.stringify(e);assert.equal(W.learningRecords(e)[0].completed,8);assert.equal(U.next(e,{}).id,'topology');assert.equal(JSON.stringify(e),before);
});
test('unknown versions cannot grant practice completion; explicit core choice remains available',()=>{
 const e=wrap({experiment:{...experiment(),version:99,completed:true}});assert.equal(U.next(e,{}).id,'records');e.benchmark.unifiedLearning={track:'core'};assert.equal(U.next(e,{}).id,'core-physics');
});
test('topology and applications also require their canonical per-step proofs',()=>{
 const e=wrap({experiment:{...experiment(),completed:true},topologyTransfer:{version:1,completed:true}});assert.equal(U.next(e,{}).id,'topology');
 e.benchmark.learningWorkspace.topologyTransfer={version:1,protocol:'topology-workbench-v1',completed:false,operated:true,rows:{prediction:{first:{correct:false}},observation:{passed:true},reason:{passed:true},return:{passed:true}}};assert.equal(U.next(e,{}).id,'applications');
 e.benchmark.learningWorkspace.topologyApplications={version:1,completed:true,rows:{}};assert.equal(U.next(e,{}).id,'applications');
 e.benchmark.learningWorkspace.topologyApplications={version:1,completed:false,rows:Object.fromEntries(W.applicationLessons().map(l=>[l.id,{protocol:'topology-application-v1',first:{correct:false},operated:true,observationPassed:true,reasonPassed:true}]))};assert.equal(U.next(e,{}).id,'topology-assessment');
});
