import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(__dirname,'../assets/learning/power-firmware-teaching-v3-models.js');
const context={window:{}};context.window.window=context.window;
vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const M=context.window.CircuitPowerTeachingModelsV3;
function state(){return {contract:{regulationPct:1},plant:{vin:48,duty:.5,fsw:100000,inductance:200e-6,load:6,topology:'buck'},sensing:{adcMax:4095},timing:{sampleUs:2.5,acquisitionUs:.25,conversionUs:.45,irqUs:.35,computeUs:1.2},switching:{deadTimeNs:120,mosfetRdsOnOhm:.018,diodeDropV:.8,riseNs:35,fallNs:35,inductorSatA:18},peakCurrent:{slopeCompRatio:0,currentCommandA:8,blankingNs:120},c2000:{sysclkHz:200e6,claEnabled:true,hrpwmEnabled:false},calibration:{dividerGainErrorPct:.5,vrefErrorPpm:500,adcInlLsb:1.5,offsetCounts:2,tempDriftPpmC:60,deltaTempC:50,residualPct:.15},bidirectional:{powerCommandW:1200,portAV:48,portBV:24,currentLimitA:20},production:{commandTimeoutMs:100,commandAgeMs:20,configCrcValid:true,configVersionMatch:true,activeBank:'A',rollbackReady:true,faultLogDepth:64},ui:{topologyPreview:'buck'}};}
test('switching cycle satisfies ideal volt-second balance',()=>{const x=M.switchingCycle(state());assert.ok(Math.abs(x.voltSecondMismatchA)<1e-9);assert.ok(x.imaxA>x.iavgA);});
test('peak current mode exposes subharmonic risk and slope compensation restores stability',()=>{const s=state();s.plant.duty=.7;let x=M.peakCurrentMode(s);assert.equal(x.stable,false);assert.ok(x.requiredRatio>0);s.peakCurrent.slopeCompRatio=.5;x=M.peakCurrentMode(s);assert.equal(x.stable,true);assert.ok(Math.abs(x.perturbationPole)<1);});
test('C2000 pipeline converts deadline into SYSCLK cycles',()=>{const x=M.c2000Pipeline(state());assert.equal(x.periodCycles,2000);assert.ok(x.activeCycles>0);assert.equal(x.deadlineMet,true);});
test('calibration budget is bounded against product regulation contract',()=>{const x=M.calibrationBudget(state());assert.ok(x.worstCasePct>0);assert.equal(x.qualified,x.worstCasePct<=1);});
test('bidirectional sign changes source-sink authority',()=>{const s=state();assert.equal(M.bidirectionalFlow(s).mode,'SOURCE');s.bidirectional.powerCommandW=-800;assert.equal(M.bidirectionalFlow(s).mode,'SINK / REGEN');});
test('production command timeout fails safe',()=>{const s=state();s.production.commandAgeMs=250;const x=M.productionFirmware(s);assert.equal(x.commandFresh,false);assert.equal(x.safeToRun,false);});
