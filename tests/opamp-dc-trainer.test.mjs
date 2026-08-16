import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const T=require('../12_opamp_slew_rate/assets/opamp-dc-trainer.js');

test('Level 0-5 skill graph follows the causal first-principles dependency chain',()=>{
  assert.equal(T.VERSION,'1.1.0');
  assert.equal(T.STORAGE_KEY,'opamp-dc-reasoning-trainer-v2');
  assert.deepEqual(T.SKILL_ORDER,['UNIT_CONVERSION','VIRTUAL_SHORT','VOLTAGE_DIFFERENCE','OHMS_LAW','CURRENT_DIRECTION','KCL','FEEDBACK_DROP','VOUT_CALCULATION']);
  assert.deepEqual(T.SKILL_GRAPH.VIRTUAL_SHORT.prerequisites,['UNIT_CONVERSION']);
  assert.deepEqual(T.SKILL_GRAPH.VOLTAGE_DIFFERENCE.prerequisites,['VIRTUAL_SHORT']);
  assert.deepEqual(T.SKILL_GRAPH.OHMS_LAW.prerequisites,['VOLTAGE_DIFFERENCE']);
  assert.deepEqual(T.SKILL_GRAPH.CURRENT_DIRECTION.prerequisites,['OHMS_LAW']);
  assert.deepEqual(T.SKILL_GRAPH.KCL.prerequisites,['CURRENT_DIRECTION']);
  assert.deepEqual(T.SKILL_GRAPH.VOUT_CALCULATION.prerequisites,['FEEDBACK_DROP']);
  assert.equal(T.SKILL_GRAPH.VOUT_CALCULATION.level,5);
  assert.ok(!T.SKILL_ORDER.includes('SATURATION_CHECK'));
  assert.ok(!T.SKILL_ORDER.includes('SLEW_RATE'));
});

test('deterministic solver derives biased feedback from node physics instead of gain formula',()=>{
  const m=new T.CircuitModel({vplus:1.8,vleft:1.2,rleftK:20,rfK:40});
  const s=T.Solver.solve(m);
  assert.equal(s.vminus,1.8);
  assert.equal(s.leftDv,.6);
  assert.equal(s.leftCurrentMagnitudeUa,30);
  assert.equal(s.leftDirection,'NODE_TO_LEFT');
  assert.equal(s.feedbackDirection,'VOUT_TO_NODE');
  assert.equal(s.feedbackDropV,1.2);
  assert.equal(s.vout,3);
  assert.equal(s.voutRelativeToNode,'HIGHER');
});

test('solver preserves current direction and Vout polarity when bias reverses',()=>{
  const s=T.Solver.solve(new T.CircuitModel({vplus:1.2,vleft:1.8,rleftK:20,rfK:40}));
  assert.equal(s.leftDv,-.6);
  assert.equal(s.iLeftUa,-30);
  assert.equal(s.leftDirection,'LEFT_TO_NODE');
  assert.equal(s.feedbackDirection,'NODE_TO_VOUT');
  assert.equal(s.feedbackDropV,1.2);
  assert.equal(Math.abs(s.vout),0);
  assert.equal(s.voutRelativeToNode,'LOWER');
});

test('engineering unit helpers cover mV, V/kOhm and uA*kOhm conversions',()=>{
  assert.equal(T.Solver.mvToV(1200),1.2);
  assert.equal(T.Solver.unitDivideVKohm(.6,20),30);
  assert.equal(T.Solver.unitMultiplyUaKohm(30,40),1.2);
});

test('question generation is parameterized and every expected answer comes from deterministic ground truth',()=>{
  const a=new T.QuestionGenerator('seed-A'),b=new T.QuestionGenerator('seed-B');
  const qa=a.fullFeedback(0),qb=b.fullFeedback(0);
  assert.equal(qa.length,8);assert.equal(qb.length,8);
  assert.notEqual(qa[0].signature,qb[0].signature);
  const model=qa[0].model,sol=T.Solver.solve(model);
  assert.equal(qa[0].expected,sol.vminus);
  assert.equal(qa[1].expected,sol.leftDv);
  assert.equal(qa[2].expected,sol.leftCurrentMagnitudeUa);
  assert.equal(qa[3].expected,sol.leftDirection);
  assert.equal(qa[4].expected,sol.feedbackDirection);
  assert.equal(qa[5].expected,sol.feedbackDropV);
  assert.equal(qa[6].expected,sol.voutRelativeToNode);
  assert.equal(qa[7].expected,sol.vout);
});

test('feedback-drop error diagnosis decomposes arithmetic then units before retry',()=>{
  const q={id:'fb',kind:'main',skill:'FEEDBACK_DROP',level:5,prompt:'30 uA x 40 kOhm',answerType:'number',expected:1.2,errorType:'FEEDBACK_DROP',meta:{currentUa:30,resistanceK:40},signature:'x',highlight:'rf'};
  const d=new T.ErrorDiagnoser();
  const seq=d.remediation(q,{errorType:'FEEDBACK_DROP'});
  assert.equal(seq.length,3);
  assert.equal(seq[0].expected,1200);
  assert.equal(seq[0].errorType,'ARITHMETIC');
  assert.equal(seq[1].expected,'mV');
  assert.equal(seq[2].expected,1.2);
});

test('mastery requires 4 of recent 5, three clean correct, and three parameter sets',()=>{
  const m=new T.MasteryTracker();
  m.record('UNIT_CONVERSION',false,{signature:'a',errorType:'UNIT_CONVERSION'});
  m.record('UNIT_CONVERSION',true,{signature:'b'});
  m.record('UNIT_CONVERSION',true,{signature:'c'});
  m.record('UNIT_CONVERSION',true,{signature:'d'});
  m.record('UNIT_CONVERSION',true,{signature:'e'});
  assert.equal(m.mastered('UNIT_CONVERSION'),true);
  assert.ok(m.score('UNIT_CONVERSION')>0&&m.score('UNIT_CONVERSION')<=1);
  const snapshot=m.snapshot().skills.UNIT_CONVERSION;
  for(const field of ['skill_id','attempts','correct_count','incorrect_count','current_streak','best_streak','mastery_score','hint_count','last_error_type','last_seen_at'])assert.ok(field in snapshot,field);
});

test('hinted answers do not build the clean mastery streak',()=>{
  const m=new T.MasteryTracker();
  for(let i=0;i<5;i++)m.record('UNIT_CONVERSION',true,{signature:String(i),hinted:i>=2});
  assert.equal(m.mastered('UNIT_CONVERSION'),false);
  assert.equal(m.cleanStreak('UNIT_CONVERSION'),0);
  assert.equal(m.snapshot().skills.UNIT_CONVERSION.hint_count,3);
});

test('a prerequisite miss decays dependent skill confidence',()=>{
  const m=new T.MasteryTracker(),g=new T.SkillGraph();
  for(let i=0;i<5;i++)m.record('VOLTAGE_DIFFERENCE',true,{signature:`v${i}`});
  for(let i=0;i<5;i++)m.record('OHMS_LAW',true,{signature:`o${i}`});
  const before=m.score('OHMS_LAW');
  m.decayDependents('VOLTAGE_DIFFERENCE',g);
  assert.ok(m.score('OHMS_LAW')<before);
});

test('session injects prerequisite remediation and then retries the exact original step',()=>{
  const session=new T.SessionManager({seed:'remediation',targetQuestions:10,storage:null});
  const q={id:'original',kind:'main',skill:'FEEDBACK_DROP',level:5,prompt:'30 uA x 40 kOhm',answerType:'number',expected:1.2,unit:'V',errorType:'FEEDBACK_DROP',meta:{currentUa:30,resistanceK:40},signature:'same',highlight:'rf',hints:[]};
  session.current=q;
  const wrong=session.submit(.75);
  assert.equal(wrong.correct,false);
  assert.equal(wrong.diagnosis.errorType,'FEEDBACK_DROP');
  let r=session.next();assert.equal(r.kind,'remediation');assert.equal(r.expected,1200);assert.equal(session.submit(1200).correct,true);
  r=session.next();assert.equal(r.expected,'mV');assert.equal(session.submit('mV').correct,true);
  r=session.next();assert.equal(r.expected,1.2);assert.equal(session.submit(1.2).correct,true);
  r=session.next();assert.equal(r.kind,'retry');assert.equal(r.prompt,q.prompt);assert.equal(r.expected,q.expected);
  assert.equal(session.submit(1.2).correct,true);
});

test('full-feedback chain matches the causal graph and never embeds saturation logic',()=>{
  const g=new T.QuestionGenerator('chain');
  const chain=g.fullFeedback(1);
  assert.equal(chain.length,8);
  assert.deepEqual(chain.map(q=>q.skill),['VIRTUAL_SHORT','VOLTAGE_DIFFERENCE','OHMS_LAW','CURRENT_DIRECTION','KCL','FEEDBACK_DROP','VOUT_CALCULATION','VOUT_CALCULATION']);
  assert.equal(T.SKILL_ORDER.indexOf('VIRTUAL_SHORT')<T.SKILL_ORDER.indexOf('VOLTAGE_DIFFERENCE'),true);
  assert.ok(chain.every(q=>!q.prompt.toLowerCase().includes('saturation')));
  assert.ok(chain.every(q=>q.expected!==undefined));
});