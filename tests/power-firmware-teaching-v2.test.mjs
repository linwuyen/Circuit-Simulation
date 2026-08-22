import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

global.window = global;
for (const file of ['assets/learning/power-system-state-v1.js','assets/learning/power-system-models-v1.js','assets/learning/power-firmware-teaching-v2-models.js']) vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
const Store = global.CircuitPowerSystemStateV1;
const Models = global.CircuitPowerTeachingModelsV2;

test('system contract exposes requirement boundaries before control details', () => { Store.reset(); const rows=Models.contractRows(Store.snapshot()); assert.equal(rows.length,6); assert.ok(rows.some(row=>row.id==='deadline'&&row.value.includes('10'))); assert.ok(rows.some(row=>row.id==='safety'&&row.value.includes('12'))); });

test('Buck operating-region classifier invalidates CCM shortcut in DCM', () => { Store.reset(); assert.equal(Models.buckRegion(Store.snapshot()).region,'CCM'); Store.set('plant.load',120); const dcm=Models.buckRegion(Store.snapshot()); assert.equal(dcm.region,'DCM'); assert.equal(dcm.idealRuleValid,false); assert.ok(dcm.iavg<dcm.boundaryA); });

test('resolution budget includes both ADC observation and PWM actuation floors', () => { Store.reset(); const b=Models.resolutionBudget(Store.snapshot()); assert.ok(Math.abs(b.adcLsbOutputV-0.0120879)<1e-4); assert.equal(b.dutyLsbPct,0.05); assert.equal(b.pwmEquivalentOutputV,0.024); assert.equal(b.effectiveFloorV,0.024); });

test('sampling phase, jitter and asynchronous sampling expose switching-ripple measurement errors', () => { Store.reset(); Store.set('timing.sampleUs',1.0); const sample=Models.sampleInductorCurrent(Store.snapshot()); assert.ok(Math.abs(sample.rippleErrorA)>0.1); assert.ok(sample.jitterBandA>=0); assert.ok(sample.settlingResidual>0&&sample.settlingResidual<1); assert.equal(sample.aliasRisk,'PHASE_LOCKED'); assert.equal(sample.aliasBeatHz,0); assert.equal(sample.aliasRateSource,'PWM_LOCKED'); Store.set('sampling.synchronous',false); const asyncSample=Models.sampleInductorCurrent(Store.snapshot()); assert.equal(asyncSample.aliasRisk,'ALIAS_BEAT_RISK'); assert.equal(asyncSample.sampleHz,100700); assert.equal(asyncSample.aliasBeatHz,700); assert.equal(asyncSample.aliasRateSource,'EXPLICIT_SAMPLE_RATE'); });

test('asynchronous alias beat is computed from an explicit sample rate when supplied', () => { Store.reset(); const s=Store.snapshot(); s.sampling.synchronous=false; s.sampling.sampleHz=99750; const sample=Models.sampleInductorCurrent(s); assert.equal(sample.aliasRisk,'ALIAS_BEAT_RISK'); assert.equal(sample.sampleHz,99750); assert.equal(sample.aliasOrder,1); assert.equal(sample.aliasBeatHz,250); assert.equal(sample.aliasRateSource,'EXPLICIT_SAMPLE_RATE'); });

test('legacy offset only derives a sample rate explicitly labeled as fallback', () => { Store.reset(); const s=Store.snapshot(); s.sampling.synchronous=false; delete s.sampling.sampleHz; s.sampling.freeRunOffsetPct=0.7; const sample=Models.sampleInductorCurrent(s); assert.ok(Math.abs(sample.sampleHz-100700)<1e-9); assert.ok(Math.abs(sample.aliasBeatHz-700)<1e-9); assert.equal(sample.aliasRateSource,'OFFSET_DERIVED_SAMPLE_RATE'); });

test('CC/CV authority hands control to current limit under overload', () => { Store.reset(); const normal=Models.ccCvPoint(Store.snapshot(),6), overload=Models.ccCvPoint(Store.snapshot(),2); assert.equal(normal.mode,'CV'); assert.equal(overload.mode,'CC'); assert.equal(overload.currentA,10); assert.equal(overload.targetV,20); });

test('anti-windup reduces recovery overshoot after an unreachable Vin sag', () => { Store.reset(); const on=Models.simulateWindup(Store.snapshot(),true),off=Models.simulateWindup(Store.snapshot(),false); assert.ok(on.overshootPct<off.overshootPct); assert.ok(on.integralPeak<off.integralPeak); });

test('Vin feed-forward reduces transient droop before feedback catches up', () => { Store.reset(); const on=Models.simulateFeedForward(Store.snapshot(),true),off=Models.simulateFeedForward(Store.snapshot(),false); assert.ok(on.droopV<off.droopV); assert.ok(off.droopV>1); });

test('bumpless CC/CV handoff preloads incoming controller state', () => { Store.reset(); Store.set('plant.load',2); const smooth=Models.bumplessHandoff(Store.snapshot(),true),cold=Models.bumplessHandoff(Store.snapshot(),false); assert.equal(smooth.commandJumpPct,0); assert.ok(cold.commandJumpPct>10); });

test('cascaded-loop budget keeps inner loop faster and exposes delay phase cost', () => { Store.reset(); const b=Models.loopBandwidthBudget(Store.snapshot()); assert.equal(b.separation,5); assert.ok(b.innerHz>b.outerHz); assert.ok(b.phaseLagInnerDeg>b.phaseLagOuterDeg); });

test('startup state machine refuses RUN until qualifiers are satisfied', () => { Store.reset(); let startup=Store.snapshot().startup; startup=Models.startupTransition(startup,'power_on').next; const blocked=Models.startupTransition(startup,'advance'); assert.equal(blocked.next.state,'INIT'); assert.equal(blocked.blocked,'ADC_NOT_VALID'); startup.adcValid=true; startup=Models.startupTransition(startup,'advance').next; assert.equal(startup.state,'SELF_TEST'); const faulted=Models.startupTransition(startup,'fault'); assert.equal(faulted.next.state,'FAULT_LATCHED'); assert.equal(faulted.view.pwmAllowed,false); });

test('plant library makes operating region explicit for every topology', () => { for(const id of ['buck','boost','pfc','psfb','llc','inverter']){const region=Models.plantRegion(id);assert.ok(region.axis.length>0);assert.ok(region.regions.length>=4);assert.ok(region.boundary.length>0);} });

test('verification ladder spans model, SIL, HIL and real board energy', () => { const ladder=Models.verificationLadder(); assert.deepEqual(ladder.map(x=>x.id),['model','sil','hil','board']); assert.ok(ladder.find(x=>x.id==='hil').faults.includes('trip')); });

test('ownership freshness and instrumentation budget quantify observability', () => { Store.reset(); const record=Store.snapshot().data.vref; assert.equal(Models.dataFreshness(record,record.maxAgeMs).fresh,true); assert.equal(Models.dataFreshness({...record,ageMs:250},record.maxAgeMs).label,'STALE'); const score=Models.instrumentationScore(Store.snapshot().instrumentation.selected); assert.equal(score.slots,8); assert.equal(score.score,100); assert.deepEqual(score.missing,[]); });
