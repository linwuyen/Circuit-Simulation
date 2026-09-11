import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),W=require('../assets/learning/workspace-core.js'),A=require('../assets/learning/learning-assessment.js'),Q=require('../assets/learning/quiz-bank.js');
test('map reads existing proof gates and never trusts aggregate completion flags',()=>{
 const e={benchmark:{learningWorkspace:{experiment:{version:1,completed:true,rows:{}},topologyApplications:{version:1,completed:true,rows:{}}}}};
 const before=JSON.stringify(e),groups=W.learningRecords(e);assert.deepEqual(groups.map(g=>g.total),[8,1,4,4]);assert.ok(groups.every(g=>g.completed===0));assert.equal(JSON.stringify(e),before);
 e.benchmark.learningWorkspace.experiment.rows.energy={first:{correct:false},proof:{observation:true,reason:true},transferPassed:true};
 e.benchmark.learningWorkspace.topologyApplications.rows.pfc={protocol:'topology-application-v1',first:{correct:false},operated:true,observationPassed:true,reasonPassed:true};
 const result=W.learningRecords(e);assert.equal(result[0].completed,1);assert.equal(result[2].completed,1);assert.match(result[0].rows[0].first,/首次答錯/);
 e.benchmark.learningWorkspace.topologyApplications.version=99;assert.equal(W.learningRecords(e)[2].completed,0);
});
test('map shows due reviews from canonical assessment without changing evidence',()=>{
 const base=Q.questions.find(q=>q.id==='topology-pfc-scaling'),qs=A.expandQuestions([base]),e={questions:{}},t=Date.parse('2026-09-01T00:00:00Z');
 A.recordAttempt(e,qs[0],qs[0].options.find(o=>o.correct),new Date(t).toISOString());
 A.recordAttempt(e,qs[1],qs[1].options.find(o=>!o.correct),new Date(t+1000).toISOString());
 A.recordAttempt(e,qs[2],qs[2].options.find(o=>o.correct),new Date(t+2000).toISOString());
 const before=JSON.stringify(e),row=W.learningRecords(e,t+A.DAY_MS+3000)[3].rows[0];assert.equal(row.status,'複習已到期');assert.match(row.first,/首次新條件答錯/);assert.equal(row.passed,true);assert.equal(JSON.stringify(e),before);
 e.questions[base.id]={history:[null]};assert.equal(W.learningRecords(e)[3].rows[0].status,'作答紀錄無法判讀');
});
