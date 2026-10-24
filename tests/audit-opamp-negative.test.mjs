import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const O=require('../12_opamp_slew_rate/assets/opamp.js');
const T=require('../12_opamp_slew_rate/assets/opamp-dc-trainer.js');
test('step settling and trace solve the same slew-limited first-order ODE',()=>{
  const m=O.calculateMetrics({step:8,srp:2,srn:.5,gbw:1/(2*Math.PI),gain:1,tol:1},'step');
  // tau=1 us: ramp until error=SR*tau=2 V, then exponential from 2 V.
  const expected=3+Math.log(2/.08);
  assert.ok(Math.abs(m.settleUs-expected)<1e-10);
  const s=O.simulate(m,'step');
  const idx=s.timeUs.findIndex(t=>t>=s.stepStartUs+expected);
  assert.ok(Math.abs(s.actual[idx]-8)<=.08);
  assert.ok(Math.abs(s.actual[idx-1]-8)>.08);
  const ramp=s.timeUs.findIndex(t=>t>s.stepStartUs+1);
  assert.ok(Math.abs(s.actual[ramp]-2*(s.timeUs[ramp]-s.stepStartUs))<1e-10);
});
test('small step never slews and zero step settles immediately',()=>{
 const m=O.calculateMetrics({step:.1,srp:2,srn:2,gbw:1/(2*Math.PI),gain:1,tol:1},'step');
 assert.ok(Math.abs(m.settleUs-Math.log(100))<1e-10);
 assert.equal(O.calculateMetrics({step:0},'step').settleUs,0);
});
test('zero ampere KCL answer cannot accept milliamperes or an empty answer',()=>{
 const q=new T.ErrorDiagnoser().remediation({errorType:'KCL',skill:'KCL'},{errorType:'KCL'})[0];
 const e=new T.AnswerEvaluator();
 assert.equal(e.evaluate(q,'0.005').correct,false);
 assert.equal(e.evaluate(q,'').correct,false);
 assert.equal(e.evaluate(q,'0').correct,true);
});
test('small nonzero voltage cannot be graded as zero by a unit-blind absolute tolerance',()=>{
 const e=new T.AnswerEvaluator(),q={answerType:'number',expected:.005,unit:'V',tolerance:.01};
 assert.equal(e.evaluate(q,'0').correct,false);
 assert.equal(e.evaluate(q,'.005').correct,true);
});
test('AD5543 polarity inverter is explicitly not a bipolar code transfer',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../8.ad5543_simulator/assets/common.js',import.meta.url),'utf8'),c);
 const D=c.window.DAC;
 assert.equal(D.compute({code:32768,vref:10,mode:'positive'}).finalV,5);
 assert.equal(D.solveCode(-5,10,'positive').reachable,false);
 const html=fs.readFileSync(new URL('../8.ad5543_simulator/05-polarity.html',import.meta.url),'utf8');
 assert.match(html,/D\/32768 − 1/);
 assert.match(html,/不是四象限/);
});
test('negative step uses SR minus for both ramp/tail and the displayed settling time',()=>{
 const m=O.calculateMetrics({step:-8,srp:20,srn:.5,gbw:1/(2*Math.PI),gain:1,tol:1},'step');
 const expected=15+Math.log(.5/.08);
 assert.ok(Math.abs(m.settleUs-expected)<1e-10);
 const s=O.simulate(m,'step'),idx=s.timeUs.findIndex(t=>t>=s.stepStartUs+expected);
 assert.ok(Math.abs(s.actual[idx]+8)<=.08);
 assert.ok(Math.abs(s.actual[idx-1]+8)>.08);
});
test('a wide settling band reached during ramp does not wait for an exponential tail',()=>{
 const m=O.calculateMetrics({step:8,srp:.01,srn:.01,gbw:1/(2*Math.PI),gain:1,tol:1},'step');
 assert.ok(Math.abs(m.settleUs-792)<1e-10);
});
test('explicit tighter numerical tolerance remains authoritative',()=>{
 const e=new T.AnswerEvaluator(),q={answerType:'number',expected:1,unit:'V',tolerance:.0001};
 assert.equal(e.evaluate(q,'1.001').correct,false);
 assert.equal(e.evaluate(q,'1.00001').correct,true);
});
