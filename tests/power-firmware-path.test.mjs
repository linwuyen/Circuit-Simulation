import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

globalThis.window=globalThis;
require('../assets/learning/curriculum.js');
require('../assets/learning/opamp-module.js');
require('../assets/learning/power-firmware-modules.js');
const Schema=require('../assets/learning/curriculum-schema-v3.js');
const Assessment=require('../assets/learning/learning-assessment.js');
const Quiz=require('../assets/learning/quiz-bank.js');
const V8=require('../assets/learning/assessment-v8.js');
const Bindings=require('../assets/learning/competency-bindings.js');
const Challenges=require('../assets/learning/engineering-challenges.js');
const ChallengesV8=require('../assets/learning/engineering-challenges-v8.js');
const Oracles=require('../assets/learning/lab-oracles.js');
const Contracts=require('../assets/learning/lab-verification-contracts.js');
const Anchors=require('../assets/learning/external-anchors-v8.js');
const Mutation=require('../assets/learning/mutation-v8.js');
const Registry=require('../assets/learning/model-registry.js');

globalThis.CircuitAssessment=Assessment;globalThis.CircuitQuizBank=Quiz;globalThis.CircuitCompetencyBindings=Bindings;globalThis.CircuitEngineeringChallenges=Challenges;globalThis.CircuitLabOracles=Oracles;globalThis.CircuitLabVerificationContracts=Contracts;globalThis.CircuitExternalAnchorsV8=Anchors;globalThis.CircuitMutationV8=Mutation;globalThis.CircuitModelRegistry=Registry;
V8.install(Assessment,Quiz);ChallengesV8.install(Challenges);Bindings.install(Assessment);
require('../assets/learning/opamp-assessment.js');
require('../assets/learning/power-firmware-assessment.js');
require('../assets/learning/opamp-verification.js');
require('../assets/learning/power-firmware-verification.js');
require('../assets/learning/opamp-external.js');
require('../assets/learning/power-firmware-external.js');

const curriculum=Schema.normalizeCurriculum(globalThis.CircuitCurriculum);

test('power firmware path expands production to 16 modules and 50 labs',()=>{
  assert.equal(curriculum.modules.length,16);
  for(const id of ['power-sync','protection','power-capstone']){
    const m=curriculum.moduleById[id];assert.ok(m,id);assert.equal(m.labs.length,3,id);assert.ok(m.lessons.length>=4,id);
  }
  assert.equal(curriculum.modules.flatMap(m=>m.labs).length,50);
});

test('new formal families expose baseline, three unseen transfers and four retention variants',()=>{
  for(const id of ['power-sync-deadline','protection-trip-latency','capstone-signal-chain']){
    const family=Assessment.expandQuestions(Quiz.questions).filter(q=>q.familyId===id);
    assert.equal(family.length,8,id);
    assert.equal(family.filter(q=>q.assessmentRole==='baseline').length,1,id);
    assert.equal(family.filter(q=>q.assessmentRole==='transfer').length,3,id);
    assert.equal(family.filter(q=>q.assessmentRole==='retention').length,4,id);
    assert.ok(new Set(family.slice(1).map(q=>q.representation)).size>=3,id);
  }
});

test('six new numeric generators grade seeded timing and integration calculations',()=>{
  assert.equal(Challenges.numericTasks.length,21);
  for(const id of ['sync-open-margin','sync-open-period','protection-open-hw-latency','protection-open-speedup','capstone-open-margin','capstone-open-critical']){
    const a=Challenges.instantiateNumeric(id,7),b=Challenges.instantiateNumeric(id,11);
    assert.equal(Challenges.evaluateNumeric(id,a.expected(),a.unit,7).correct,true,id);
    assert.notDeepEqual(a.parameters,b.parameters,id);
  }
});

test('diagnostic engine expands to 14 cases with real information gain',()=>{
  assert.equal(Challenges.diagnosticGames.length,14);
  const cases=[['sync-deadline-game',['trace-timeline'],'deadline'],['protection-path-game',['scope-trip'],'software-path'],['capstone-chain-game',['raw-vs-meter'],'scale']];
  for(const [id,tests,cause] of cases){const score=Challenges.scoreDiagnostic(id,tests,cause);assert.equal(score.solved,true,id);assert.ok(score.informationGain>0,id);assert.ok(score.posteriorRoot>.5,id);}
});

test('independent timing oracles accept correct public teaching vectors',()=>{
  const sync=Oracles.verify('power-sync.lab.timing',{controls:{'sync-fsw':'100','sync-sample':'50','sync-acq':'200','sync-conv':'350','sync-isr':'500','sync-control':'1000'},observed:{'sync-period':{text:'10000 ns'},'sync-sample-time':{text:'5000 ns'},'sync-update':{text:'7050 ns'},'sync-margin':{text:'2950 ns'},'sync-state':{text:'PASS / timing closed'}}},Registry);
  assert.equal(sync.passed,true,JSON.stringify(sync,null,2));assert.equal(sync.independentValidated,true);
  const protection=Oracles.verify('protection.lab.trip-latency',{controls:{'prot-comp':'80','prot-filter':'200','prot-trip':'120','prot-wait':'3000','prot-adc':'500','prot-isr':'800','prot-decision':'700'},observed:{'prot-hw':{text:'400 ns'},'prot-sw':{text:'5000 ns'},'prot-speedup':{text:'12.5 x'},'prot-state':{text:'PASS / hardware path wins'}}},Registry);
  assert.equal(protection.passed,true,JSON.stringify(protection,null,2));
  const cap=Oracles.verify('power-capstone.lab.integration-budget',{controls:{'cap-period':'10','cap-sensing':'1.2','cap-control':'2.3','cap-commit':'0.5','cap-background':'3'},observed:{'cap-critical':{text:'4.00 us'},'cap-margin':{text:'6.00 us'},'cap-util':{text:'40.0 %'},'cap-state':{text:'PASS / deadline closed'}}},Registry);
  assert.equal(cap.passed,true,JSON.stringify(cap,null,2));
});

test('A reasoning gates fail closed on fluent but non-causal prose',()=>{
  for(const id of ['power-sync.lab.timing','protection.lab.trip-latency','power-capstone.lab.integration-budget']){
    assert.equal(Contracts.reasoningGate(id,{explanation:'看起來很合理而且畫面漂亮。',limitations:'沒有'}).passed,false,id);
  }
  assert.equal(Contracts.reasoningGate('power-sync.lab.timing',{explanation:'ADC SOC 決定 sample 時刻，conversion/ISR/control 必須在 PWM deadline 前保留 margin。',limitations:'worst-case jitter、switching noise 與 shadow load event 仍是模型邊界。'}).passed,true);
  assert.equal(Contracts.reasoningGate('protection.lab.trip-latency',{explanation:'Comparator/CMPSS 經 hardware trip 直接關 PWM，比 ADC/ISR software latency 短。',limitations:'filter、threshold、noise 與 latch recovery policy 仍需實機驗證。'}).passed,true);
  assert.equal(Contracts.reasoningGate('power-capstone.lab.integration-budget',{explanation:'critical path 是 sensing、control、PWM commit 串行總和，必須在 period deadline 前保留 margin。',limitations:'background communication 仍可能透過 resource contention/jitter 影響 hardware runtime。'}).passed,true);
});

test('verification closes 50 labs and 16 module A paths',()=>{
  assert.deepEqual(Contracts.validate(curriculum,Oracles),[]);
  const c=Contracts.coverage(curriculum);assert.equal(c.total,50);assert.equal(c.classified,50);assert.equal(c.modules.length,16);assert.equal(c.modules.filter(x=>x.aCapable>0).length,16);
});

test('external anchors and mutation campaign close all 16 modules',()=>{
  assert.deepEqual(Anchors.validate(),[]);
  const a=Anchors.summary();assert.equal(a.total,16);assert.equal(a.modules,16);assert.equal(a.passed,16);
  const m=Mutation.run(Oracles,Registry);assert.equal(m.total,16);assert.equal(m.detected,16,JSON.stringify(m.results.filter(x=>!x.detected),null,2));assert.equal(m.rate,1);
});

test('new core competencies are independently verified in coverage',()=>{
  const questions=Assessment.expandQuestions(Quiz.getQuestions(curriculum));
  const summary=Assessment.coverageSummary(curriculum,questions,Assessment.MEASUREMENT_ORACLE_LABS);
  for(const competency of ['power-sync.sample-update.deadline','protection.trip.latency','capstone.signal-chain.integration']){
    const row=summary.rows.find(x=>x.competency===competency);assert.ok(row,competency);assert.equal(row.lab,true,competency);assert.equal(row.oracle,true,competency);assert.equal(row.transfer,true,competency);assert.equal(row.retention,true,competency);assert.equal(row.status,'verified',competency);
  }
});
