import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

globalThis.window=globalThis;
require('../assets/learning/curriculum.js');
require('../assets/learning/opamp-module.js');
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
require('../assets/learning/opamp-verification.js');
require('../assets/learning/opamp-external.js');

const curriculum=Schema.normalizeCurriculum(globalThis.CircuitCurriculum);

test('OP AMP is the 13th module with six lessons and three labs',()=>{
  assert.equal(curriculum.modules.length,13);
  const m=curriculum.moduleById.opamp;assert.ok(m);assert.equal(m.lessons.length,6);assert.equal(m.labs.length,3);
  assert.deepEqual(m.labs.map(x=>x.id),['opamp.lab.opamp-step','opamp.lab.opamp-sine','opamp.lab.opamp-diagnose']);
});

test('OP AMP formal family has baseline, true transfer and four retention variants',()=>{
  const expanded=Assessment.expandQuestions(Quiz.questions).filter(q=>q.familyId==='opamp-slew-large-signal');
  assert.equal(expanded.length,8);
  assert.equal(expanded.filter(q=>q.assessmentRole==='baseline').length,1);
  assert.equal(expanded.filter(q=>q.assessmentRole==='transfer').length,3);
  assert.equal(expanded.filter(q=>q.assessmentRole==='retention').length,4);
  const representations=new Set(expanded.filter(q=>q.assessmentRole!=='baseline').map(q=>q.representation));
  assert.ok(representations.size>=4);
  assert.notEqual(expanded.find(q=>q.variantId==='B').prompt,expanded.find(q=>q.variantId==='C').prompt);
});

test('OP AMP open-response adds required SR, FPBW and step-time generation',()=>{
  assert.equal(Challenges.numericTasks.length,15);
  for(const id of ['opamp-open-required-sr','opamp-open-fpbw','opamp-open-step-time']){
    const a=Challenges.instantiateNumeric(id,7),b=Challenges.instantiateNumeric(id,11);
    assert.equal(Challenges.evaluateNumeric(id,a.expected(),a.unit,7).correct,true);
    assert.ok(a.prompt.includes('OP')||a.prompt.includes('Slew')||a.prompt.includes('SR')||a.prompt.includes('FPBW')||a.prompt.includes('step'));
    assert.notDeepEqual(a.parameters,b.parameters);
  }
});

test('Bayesian OP AMP diagnosis increases slew-limit posterior from high-information tests',()=>{
  assert.equal(Challenges.diagnosticGames.length,11);
  const score=Challenges.scoreDiagnostic('opamp-slew-vs-bandwidth-game',['reduce-amplitude','measure-slope'],'slew-limit');
  assert.equal(score.solved,true);assert.ok(score.informationGain>0);assert.ok(score.posteriorRoot>.5);
});

test('independent sine oracle validates analytic SR and 20-50 percent margin',()=>{
  const snapshot={controls:{'op-freq':'100','op-vpp':'10','op-sr-plus':'4.1','op-sr-minus':'4.1','op-gbw':'20','op-gain':'1'},observed:{'op-required-sr':{text:'3.142 V/µs'},'op-fpbw':{text:'130.5 kHz'},'op-margin':{text:'1.31'},'op-state':{text:'SAFE / not limited'}},metrics:[]};
  const result=Oracles.verify('opamp.lab.opamp-sine',snapshot,Registry);
  assert.equal(result.supported,true);assert.equal(result.independentValidated,true);assert.equal(result.passed,true,JSON.stringify(result,null,2));
  assert.equal(result.observableContract.labId,'opamp.lab.opamp-sine');
  assert.ok(Math.abs(result.reference.outputs.requiredSr-Math.PI)<.002);
});

test('independent oracle rejects classic missing-2pi / Vpp mistakes',()=>{
  const wrong={controls:{'op-freq':'100','op-vpp':'10','op-sr-plus':'4.1','op-sr-minus':'4.1'},observed:{'op-required-sr':{text:'0.500 V/µs'},'op-fpbw':{text:'260.0 kHz'},'op-margin':{text:'1.30'},'op-state':{text:'SAFE / not limited'}},metrics:[]};
  const result=Oracles.verify('opamp.lab.opamp-sine',wrong,Registry);assert.equal(result.passed,false);assert.equal(result.independentValidated,false);
});

test('A reasoning gate is fail-closed on mechanism and model boundary',()=>{
  const bad=Contracts.reasoningGate('opamp.lab.opamp-sine',{explanation:'波形看起來比較漂亮所以應該是對的',limitations:'沒有'});assert.equal(bad.passed,false);
  const good=Contracts.reasoningGate('opamp.lab.opamp-sine',{explanation:'zero crossing 的最大 dV/dt 由 2πfVpk 決定，若超過 slew rate 就會被斜率限制。',limitations:'這只驗 large-signal SR；GBW、settling、output swing 與 load 仍可能限制實機。'});assert.equal(good.passed,true);
});

test('verification contracts close 41 labs and 13 module A paths',()=>{
  assert.deepEqual(Contracts.validate(curriculum,Oracles),[]);
  const c=Contracts.coverage(curriculum);assert.equal(c.total,41);assert.equal(c.classified,41);assert.equal(c.modules.length,13);assert.equal(c.modules.filter(x=>x.aCapable>0).length,13);
});

test('external anchors and mutation campaign expand from 12 to 13',()=>{
  assert.deepEqual(Anchors.validate(),[]);
  const a=Anchors.summary();assert.equal(a.total,13);assert.equal(a.modules,13);assert.equal(a.passed,13);
  const m=Mutation.run(Oracles,Registry);assert.equal(m.total,13);assert.equal(m.detected,13,JSON.stringify(m.results.filter(x=>!x.detected),null,2));assert.equal(m.rate,1);
});

test('coverage binding exposes OP AMP as independently measurable competency',()=>{
  const questions=Assessment.expandQuestions(Quiz.getQuestions(curriculum));
  const summary=Assessment.coverageSummary(curriculum,questions,Assessment.MEASUREMENT_ORACLE_LABS);
  const row=summary.rows.find(x=>x.competency==='opamp.large-signal.slew-rate');
  assert.ok(row);assert.equal(row.lab,true);assert.equal(row.oracle,true);assert.equal(row.transfer,true);assert.equal(row.retention,true);assert.equal(row.status,'verified');
});
