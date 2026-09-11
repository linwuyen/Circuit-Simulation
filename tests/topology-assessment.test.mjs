import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), A=require('../assets/learning/learning-assessment.js'), Q=require('../assets/learning/quiz-bank.js');
const bases=Q.questions.filter(q=>q.moduleId==='power-topology-control');
test('four topology families have independent numerical grading and distinct changed conditions',()=>{
 assert.equal(bases.length,4);
 for(const base of bases){
  const prompts=new Set();
  for(let depth=1;depth<=40;depth++){
   const q=A.generateVariant(base,'T'+depth,'transfer',depth),p=q.parameters;
   const expected=base.id.includes('pfc')?p.initial*p.powerFactor/p.capacitanceFactor:base.id.includes('psfb')?p.initial*p.currentFactor**2:p.initial/Math.sqrt(p.capacitanceFactor);
   assert.equal(q.options.filter(o=>o.correct).length,1);
   assert.ok(Math.abs(parseFloat(q.options.find(o=>o.correct).text)-expected)<=.00051);
   assert.equal(new Set(q.options.map(o=>o.text)).size,4);
   for(const o of q.options.filter(o=>!o.correct))assert.ok(Math.abs(parseFloat(o.text)-expected)>.001);
   assert.deepEqual(q,A.generateVariant(base,'T'+depth,'transfer',depth));prompts.add(q.prompt);
  }
  assert.equal(prompts.size,40);
 }
});
test('topology transfer keeps wrong first attempts and reviews only after due time',()=>{
 for(const base of bases){
  const qs=A.expandQuestions([base]),s={questions:{}},t=Date.parse('2026-09-01T00:00:00Z');
  A.recordAttempt(s,qs[0],qs[0].options.find(o=>o.correct),new Date(t).toISOString());
  A.recordAttempt(s,qs[1],qs[1].options.find(o=>!o.correct),new Date(t+1000).toISOString());
  A.recordAttempt(s,qs[1],qs[1].options.find(o=>o.correct),new Date(t+2000).toISOString());
  assert.equal(A.metrics(s.questions[base.id],t+3000).transfer,false);
  const next=A.nextQuestion(qs,s.questions[base.id],t+3000);assert.equal(next.variantId,'C');
  A.recordAttempt(s,next,next.options.find(o=>o.correct),new Date(t+4000).toISOString());
  const restored=JSON.parse(JSON.stringify(s.questions[base.id]));
  assert.equal(A.metrics(restored,t+5000).transferFirstAttempt,false);
  assert.equal(A.nextQuestion(qs,restored,t+5000),null);
  assert.equal(A.nextQuestion(qs,restored,t+A.DAY_MS+5000).assessmentRole,'retention');
 }
});
