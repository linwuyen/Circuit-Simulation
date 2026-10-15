import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../assets/learning/workspace-core.js';
import S from '../assets/learning/switching-lesson-v1.js';

test('real generic-kernel microsteps drive ON/freewheel explanation without a second solver',()=>{
 const cfg=W.experimentPlan('energy').after,run=W.experimentRun(cfg);
 const rows=run.waveform;
 assert.ok(rows.length>10);
 const onIndex=rows.findIndex(x=>x.gate&&x.iL>1e-6);
 const offIndex=rows.findIndex(x=>!x.gate&&x.iL>1e-6);
 assert.ok(onIndex>=0&&offIndex>onIndex,'both switching states must be present');
 const on=S.snapshot(run,onIndex),off=S.snapshot(run,offIndex);
 assert.equal(on.phase,'on');assert.equal(off.phase,'freewheel');
 assert.equal(on.currentA,rows[onIndex].iL);
 assert.equal(off.phaseUs,rows[offIndex].phaseUs);
 assert.equal(on.inductorV,rows[onIndex].vL);
 assert.equal(on.slopeAperMs,rows[onIndex].diDtAperS/1000);
 assert.equal(off.inductorV,rows[offIndex].vL);
 assert.ok(on.inductorV>0&&off.inductorV<0);
 assert.match(off.explanation,/二極體/);
 assert.match(off.source,/不是實測/);
});

test('zero-current OFF section does not pretend clamped DCM slope is physical',()=>{
 const sample={waveform:[{phaseUs:2,iL:0,vOut:12,gate:false,vL:-12,diDtAperS:-10000}]};
 const s=S.snapshot(sample,0);
 assert.equal(s.phase,'idle');
 assert.equal(s.inductorV,null);assert.equal(s.slopeAperMs,null);
 assert.match(s.explanation,/DCM/);
 assert.equal(S.snapshot(null,0),null);
 assert.equal(S.snapshot({waveform:[]},0),null);
});
