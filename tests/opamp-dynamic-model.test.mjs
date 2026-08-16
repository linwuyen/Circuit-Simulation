import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const O=require('../12_opamp_slew_rate/assets/opamp.js');

test('positive step uses SR+ rather than worst-direction slew rate',()=>{
  const m=O.calculateMetrics({step:8,srp:20,srn:.2,gbw:5,gain:2,tol:.1},'step');
  assert.equal(m.stepDirection,'POSITIVE');
  assert.equal(m.activeStepSr,20);
  assert.ok(Math.abs(m.slewUs-.4)<1e-12);
});

test('negative step uses SR- rather than SR+',()=>{
  const m=O.calculateMetrics({step:-8,srp:20,srn:.2,gbw:5,gain:2,tol:.1},'step');
  assert.equal(m.stepDirection,'NEGATIVE');
  assert.equal(m.activeStepSr,.2);
  assert.ok(Math.abs(m.slewUs-40)<1e-12);
});

test('sine slew margin still uses the worst slew direction',()=>{
  const m=O.calculateMetrics({fKHz:100,vpp:10,srp:4,srn:2,gbw:20,gain:1,step:8,tol:.1},'sine');
  assert.ok(Math.abs(m.required-Math.PI)<.002);
  assert.equal(m.worst,2);
  assert.ok(Math.abs(m.fpbw-63.662)<.01);
  assert.ok(m.margin<1);
  assert.equal(m.slewLimited,true);
});

test('combined simulator follows signed step direction',()=>{
  const pos=O.calculateMetrics({step:8,srp:2,srn:.5,gbw:5,gain:1,tol:.1},'step');
  const neg=O.calculateMetrics({step:-8,srp:2,srn:.5,gbw:5,gain:1,tol:.1},'step');
  const p=O.simulate(pos,'step').actual;
  const n=O.simulate(neg,'step').actual;
  assert.ok(p.at(-1)>0);
  assert.ok(n.at(-1)<0);
});

test('step lab exposes signed delta-V and labels the estimate as a teaching model',()=>{
  const html=fs.readFileSync(new URL('../12_opamp_slew_rate/lab_step.html',import.meta.url),'utf8');
  assert.match(html,/id="op-step"[^>]*min="-12"[^>]*max="12"/);
  assert.match(html,/Directional pure-slew lower bound/);
  assert.match(html,/First-order teaching estimate/);
  assert.match(html,/不等於 datasheet settling time/);
});

test('DC trainer SVG routes the summing node to the minus input pin',()=>{
  const html=fs.readFileSync(new URL('../12_opamp_slew_rate/reasoning_trainer.html',import.meta.url),'utf8');
  assert.match(html,/M 355 130 L 310 130 L 310 230 L 355 230/);
  assert.doesNotMatch(html,/x1="355" y1="205" x2="355" y2="130"/);
  assert.ok(html.indexOf('VIRTUAL_SHORT')<html.indexOf('VOLTAGE_DIFFERENCE'));
});