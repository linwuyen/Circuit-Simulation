import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../assets/learning/workspace-core.js';

test('readout uses registered kernel results and does not create a second physics solver',()=>{
 for(const l of W.experimentLessons()){
  const p=W.experimentPlan(l.id);
  const before=W.experimentRun(p.prepared), after=W.experimentRun(p.after);
  const output=W.experimentReadout(l.id,before,after);
  assert.ok(output,l.id);
  assert.ok(output.rows.length>0,l.id);
  assert.match(output.source,/generic-power-causal-kernel/);
  assert.ok(output.rows.every(x=>Number.isFinite(x.before)&&Number.isFinite(x.after)),l.id);
  assert.equal(W.experimentReadout(l.id,before,null),null);
 }
});

test('energy and sensing readouts report actual source values, not guessed teaching constants',()=>{
 const e=W.experimentPlan('energy');
 const a=W.experimentRun(e.prepared),b=W.experimentRun(e.after);
 const r=W.experimentReadout('energy',a,b);
 assert.equal(r.rows[0].before,a.summary.avgV);
 assert.equal(r.rows[0].after,b.summary.avgV);
 assert.ok(r.rows[0].after>r.rows[0].before);
 const s=W.experimentPlan('sensing'),sa=W.experimentRun(s.prepared),sb=W.experimentRun(s.after),sr=W.experimentReadout('sensing',sa,sb);
 assert.equal(sr.rows[0].after,sb.trace.at(-1).samplePhysicalV);
 assert.equal(sr.rows[1].after,sb.trace.at(-1).sampledV);
 assert.ok(sr.rows[1].after<sr.rows[1].before);
});

test('off-time current, missed PWM writes and protection are preserved as event/trace evidence',()=>{
 const p=W.experimentPlan('storage'),a=W.experimentRun(p.prepared),b=W.experimentRun(p.after);
 const off=b.waveform.filter(x=>!x.gate);
 const st=W.experimentReadout('storage',a,b);
 assert.equal(st.rows[0].before,off[0].iL);
 assert.equal(st.rows[0].after,off.at(-1).iL);
 assert.match(st.context,/同一輪/);
 const d=W.experimentPlan('deadline'),da=W.experimentRun(d.prepared),db=W.experimentRun(d.after),dt=W.experimentReadout('deadline',da,db);
 assert.equal(dt.rows[0].after,db.trace[0].scheduledApplyCycle);
 assert.equal(dt.rows[1].after,db.summary.missedCommits);
 assert.ok(dt.rows[1].after>dt.rows[1].before);
 const q=W.experimentPlan('protection'),qa=W.experimentRun(q.prepared),qb=W.experimentRun(q.after),qr=W.experimentReadout('protection',qa,qb);
 assert.equal(qr.rows[0].after,qb.trace.at(-1).appliedDuty*100);
 assert.ok(qb.summary.tripSeen);
 assert.equal(qr.rows[0].after,0);
});
