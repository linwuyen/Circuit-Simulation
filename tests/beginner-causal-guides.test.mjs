import test from 'node:test';
import assert from 'node:assert/strict';
import Curriculum from '../assets/learning/engineering-curriculum.js';

test('each continuous lesson has separate beginner concept, observation, feedback and causal explanation',()=>{
 const lessons=Curriculum.workbenchLessons;
 const guides=Curriculum.workbenchGuides;
 assert.equal(lessons.length,8);
 assert.deepEqual(Object.keys(guides).sort(),lessons.map(l=>l.id).sort());
 for(const l of lessons){
  const g=guides[l.id];
  for(const key of ['basics','observe','hint','cause','transfer']){
   assert.equal(typeof g[key],'string',l.id+' '+key);
   assert.ok(g[key].length>=25,l.id+' '+key);
  }
  assert.notEqual(g.basics,g.cause,l.id);
 }
});

test('novice vocabulary is linked to analog physics, ADC, PWM, feedback and protection',()=>{
 const g=Curriculum.workbenchGuides;
 assert.match(g.energy.basics,/PWM/);
 assert.match(g.storage.basics,/di\/dt/);
 assert.match(g.sensing.basics,/ADC/);
 assert.match(g.feedback.basics,/回授/);
 assert.match(g.deadline.basics,/Shadow/);
 assert.match(g.response.basics,/PI/);
 assert.match(g.protection.basics,/保護/);
});

test('before-answer vocabulary avoids leaking the named overshoot or hardware-veto solution',()=>{
 const g=Curriculum.workbenchGuides;
 assert.doesNotMatch(g.response.basics,/過衝增加|更高|過多能量/);
 assert.doesNotMatch(g.protection.basics,/禁止開關|否決權|瞬間歸零/);
 assert.doesNotMatch(g.energy.basics,/輸出提高|平均電壓上升/);
});
