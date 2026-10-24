import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import E from '../assets/learning/control-engineering-v1.js';
import T from '../assets/learning/topology-transfer-v1.js';

// LCL resonance is 2756.64 Hz for 1 mH, 0.5 mH, 10 uF. A 100 Hz
// PI target still crosses upward near resonance and downward above it.
test('undamped LCL cannot summarize three gain crossings as a safe single PM',()=>{
 const plantAt=f=>T.inverterLclGridCurrentAt({dcBusV:400,l1H:1e-3,l2H:.5e-3,capF:10e-6},f);
 const ts=1e-5,delayS=5e-6,design=E.designPIAtCrossover({plantResponse:plantAt(100),frequencyHz:100,desiredPhaseMarginDeg:60,otherResponse:E.multiplyResponses(E.zohAt(100,ts),E.pureDelayAt(100,delayS))});
 const coeff=E.piDiscreteCoefficients({...design,samplePeriodS:ts});
 const m=E.estimateMargins({responseAt:f=>E.openLoopAt({plantAt,frequencyHz:f,controller:f=>E.discretePiAt(coeff,f),samplePeriodS:ts,delayS}),minHz:1,maxHz:45000,points:4001});
 assert.equal(m.status,'MULTIPLE'); assert.equal(m.crossings.length,3);
 assert.equal(m.phaseMarginDeg,null); assert.equal(m.crossoverHz,null);
});
test('sample exactly on unity gain is counted once and nonfinite scans fail closed',()=>{
 const single=E.estimateMargins({responseAt:f=>E.phasor(100/f,-90),minHz:10,maxHz:1000,points:3});
 assert.equal(single.crossings.length,1); assert.equal(single.phaseMarginDeg,90);
 const invalid=E.estimateMargins({responseAt:f=>f===100?{magnitudeDb:NaN,phaseDeg:NaN}:E.phasor(100/f,-90),minHz:10,maxHz:1000,points:3});
 assert.equal(invalid.status,'INVALID'); assert.equal(invalid.phaseMarginDeg,null);
});
function moduleBode(file){
 const html=fs.readFileSync(new URL('../4_PI/'+file,import.meta.url),'utf8');
 const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('function calculateBode'));
 const end=script.indexOf('function ',script.indexOf('function calculateBode')+10);
 const context=vm.createContext({}); vm.runInContext(script.slice(0,end),context); return context.calculateBode;
}
for(const file of ['pi.html','06_stability.html','07_challenge.html'])test(`${file}: resonant PI's first 84-degree PM is not a single-margin PASS`,()=>{
 const b=moduleBode(file)(.1,3600),m=b.m||b.metrics;
 // |L|^2=1 reduces to cubic in w^2; this vector has three positive
 // roots, not merely the first downward root.
 assert.equal(m.crossingCount,3); assert.equal(m.hasCross,false); assert.equal(m.pm,null);
});

test('Module 16 synthetic 10 us pure delay changes phase, not magnitude',()=>{
 const script=fs.readFileSync(new URL('../16_control_transforms/app.js',import.meta.url),'utf8');
 const fragment=script.slice(script.indexOf('  let sweepTimer = null;'),script.indexOf('  const explanations ='));
 const elements=new Map; let start;
 const $=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',addEventListener:(_event,fn)=>{start=fn}});return elements.get(id)};
 vm.runInNewContext(fragment,{$,fmt:(x,n)=>x.toFixed(n),setInterval:fn=>{for(let i=0;i<80;i++)fn();return 1},clearInterval:()=>{}});
 start();
 assert.equal($('modelMag').textContent,$('measuredMag').textContent);
 const phase=text=>parseFloat(text);
 assert.ok(Math.abs(phase($('measuredPhase').textContent)-phase($('modelPhase').textContent)+36)<.11);
 assert.match($('sweepVerdict').textContent,/synthetic|合成/i);
});
