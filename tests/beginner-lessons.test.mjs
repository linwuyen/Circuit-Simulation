import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {lessons,accepts,updateAt,complete}=require('../assets/beginner-lessons.js');
const {buck}=require('../assets/training-experiments-core.js');
test('beginner claims match the existing Buck model and timing rule',()=>{
  const before=buck(),after=buck({duty:.5}),light=buck({loadOhm:100});
  assert.equal(before.regime,'CCM');assert.equal(after.regime,'CCM');assert.equal(after.vout,2*before.vout);
  assert.ok(before.rows.find(r=>r.tUs===5).iL>0);
  assert.equal(light.regime,'DCM');assert.ok(light.zeroFraction>0);assert.notEqual(light.vout,light.idealCcmVout);
  assert.equal(buck({vin:36,duty:.5}).vout,lessons[0].expected);
  assert.equal(updateAt(9),10);assert.equal(updateAt(10),20);assert.equal(updateAt(11),20);assert.equal(updateAt(6,5),10);
});
test('completion needs first prediction, actual observation and transfer; blank is not a numeric answer',()=>{
  assert.equal(complete({first:{correct:true},observed:false,transferPassed:true}),false);
  assert.equal(complete({observed:true,transferPassed:true}),false);
  assert.equal(complete({first:{correct:false},observed:true,transferPassed:true}),true);
  assert.equal(accepts(0,''),false);assert.equal(accepts(.3,'0.3'),true);assert.equal(accepts(18,'Infinity'),false);
});
test('full backup restores beginner practice without replacing local first attempts',()=>{
  const source=fs.readFileSync(new URL('../assets/learning/learning-evidence.js',import.meta.url),'utf8');
  const make=()=>{const ctx=vm.createContext({localStorage:{getItem:()=>null,setItem(){},removeItem(){}}});vm.runInContext(source,ctx);return ctx.CircuitEvidence;};
  // Use real persisted storage so subsequent loads see the written state.
  const values=new Map(),ctx=vm.createContext({localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
  vm.runInContext(source,ctx);const E=ctx.CircuitEvidence,state=E.load();
  state.benchmark.beginnerLessons={version:1,rows:{duty:{first:{answer:'down',correct:false}}}};E.save(state);
  const incoming=JSON.parse(E.exportBackup());incoming.benchmark.beginnerLessons.rows.duty.first={answer:'up',correct:true};incoming.benchmark.beginnerLessons.rows.probe={first:{answer:'tenth',correct:true},observed:true,transferPassed:true};
  E.merge(incoming);assert.equal(E.load().benchmark.beginnerLessons.rows.duty.first.correct,false);assert.equal(E.load().benchmark.beginnerLessons.rows.probe.transferPassed,true);
  const fresh=make();assert.equal(fresh.merge(incoming).benchmark.beginnerLessons.rows.probe.transferPassed,true);
});
