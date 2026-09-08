import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs';import vm from 'node:vm';
const require=createRequire(import.meta.url),U=require('../assets/learning/unified-learning.js'),C=require('../assets/learning/shared-case-core.js');
const done={first:{correct:false},observed:true,transferPassed:true};
test('one recommendation resumes beginners, preserves advanced progress and prioritizes due review',()=>{
 assert.equal(U.next().id,'basic-duty');
 const e={benchmark:{beginnerLessons:{rows:{duty:done}}}};assert.equal(U.next(e).id,'basic-inductor');
 assert.equal(U.next(e,{completed:{physics:'date'}}).id,'core-sensing');
 assert.equal(U.next({benchmark:{unifiedLearning:{track:'core'}}}).id,'core-physics');
 e.benchmark.outcomeV1={sessions:{post:{completedAt:'2026-01-01'}},retention:{r1:{dueAt:'2026-01-02'}}};assert.equal(U.next(e,{},Date.parse('2026-01-03')).id,'formal');
 e.benchmark.outcomeV1.sessions.r1={completedAt:'2026-01-02'};assert.equal(U.next(e,{},Date.parse('2026-01-03')).id,'basic-inductor');
});
test('remediation returns to source without modifying core first attempts or granting completion',()=>{
 const f={predictions:{physics:{correct:false}},completed:{}},e={benchmark:{unifiedLearning:{returnTask:{id:'core-physics',category:'physics',passedAt:null}}}};
 assert.equal(U.next(e,f).remediation,'physics');e.benchmark.unifiedLearning.returnTask.passedAt=123;assert.equal(U.next(e,f).remediation,undefined);assert.equal(U.next(e,f).id,'core-physics');assert.equal(f.predictions.physics.correct,false);assert.deepEqual(f.completed,{});
 e.benchmark.unifiedLearning.returnTask.category='evil';assert.equal(U.next(e,f).remediation,'physics');
 assert.equal(U.route('case','https://evil.invalid'), 'learning-case.html');assert.throws(()=>U.remediationRoute('core-safety','model'));
});
test('same-model scenario validation rejects incompatible families and unsafe numeric values',()=>{
 const model=C.views().physical.config,raw={version:1,family:'buck-steady-v1',model};assert.deepEqual(U.validateScenario(raw).model,model);
 assert.throws(()=>U.validateScenario({...raw,family:'boost'}));assert.throws(()=>U.validateScenario({...raw,model:{...model,vin:NaN}}));assert.throws(()=>U.validateScenario({...raw,model:{...model,vin:'48'}}));
});
test('shared lenses agree on working point and refuse unsupported CCM views',()=>{
 const a=C.views(),b=C.views({vin:36});assert.equal(a.physical.vout,12);assert.equal(b.physical.vout,9);assert.ok(b.sensing.reconstructedV< a.sensing.reconstructedV);assert.ok(a.transient.points.length>0);assert.equal(a.frequency.length,160);
 const dcm=C.views({loadOhm:100});assert.equal(dcm.physical.regime,'DCM');assert.equal(dcm.transient,null);assert.deepEqual(dcm.frequency,[]);
 assert.equal(C.views({esrOhm:.1}).modelValid,false);assert.equal(C.views({}, {delayUs:10}).commitUs,20);
 const changed=C.views({}, {kp:.5});assert.deepEqual(changed.frequency,a.frequency);assert.notDeepEqual(changed.transient.points,a.transient.points);
});
test('all twenty modules belong to the seven-stage map and retain valid entries',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../assets/learning/learning-map.js',import.meta.url),'utf8'),ctx);
 const modules=ctx.CircuitLearningMap;assert.equal(modules.length,20);assert.deepEqual([...new Set(U.stages.flatMap(s=>s.modules))].sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i));
 for(const m of modules)assert.ok(fs.existsSync(new URL('../'+m.href,import.meta.url)),m.href);
});
test('unified settings survive full backup while keeping local selection and scenario',()=>{
 const source=fs.readFileSync(new URL('../assets/learning/learning-evidence.js',import.meta.url),'utf8'),values=new Map(),ctx=vm.createContext({localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});vm.runInContext(source,ctx);const E=ctx.CircuitEvidence,s=E.load();s.benchmark.unifiedLearning={version:1,track:'core',scenarios:{}};E.save(s);
 const incoming=JSON.parse(E.exportBackup());incoming.benchmark.unifiedLearning={version:1,track:'beginner',scenarios:{'buck-steady-v1':{version:1,family:'buck-steady-v1',model:C.views().physical.config}}};E.merge(incoming);assert.equal(E.load().benchmark.unifiedLearning.track,'core');assert.equal(E.load().benchmark.unifiedLearning.scenarios['buck-steady-v1'].model.vin,48);
 incoming.benchmark.unifiedLearning.scenarios['buck-steady-v1'].model.vin=36;E.merge(incoming);assert.equal(E.load().benchmark.unifiedLearning.scenarios['buck-steady-v1'].model.vin,48);
});
