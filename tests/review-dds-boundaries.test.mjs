import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../11.c2000_dds_dashboard/index.html', import.meta.url), 'utf8');
function dds() {
 const initial = {vpeak:'120',freq:'60',offset:'1.65',ipeak:'15',phase:'30',sampling:'20',noise:'0'};
 const nodes = new Map();
 const get = id => {
  if (!nodes.has(id)) nodes.set(id, {value:initial[id.replace('input-','')] || '', style:{}, listeners:{}, addEventListener(type, handler){this.listeners[type]=handler;}});
  return nodes.get(id);
 };
 const ctx = vm.createContext({document:{getElementById:get}});
 vm.runInContext(source.slice(source.indexOf('let isRunning ='),source.indexOf('// --- 5.')) + '\nthis.engine={pml,param,setupInputs,runPML,runDDSAndADC,waveHistory};',ctx);
 ctx.engine.setupInputs(); get('cal-none').listeners.click();
 return {...ctx.engine,nodes,rate(khz){get('input-sampling').value=String(khz); get('input-sampling').listeners.input();}};
}
function feed(e,fsHz,freq,seconds=1.2) {
 let accepted=0; const windows=[];
 const voltageCountsPerV=(1.2*4095/3.3)/155;
 const currentCountsPerA=(1.2*4095/3.3)/30;
 for(let n=0;n<Math.ceil(fsHz*seconds);n++){
  const theta=2*Math.PI*freq*n/fsHz;
  e.runPML(Math.round(2048+120*Math.sin(theta)*voltageCountsPerV),Math.round(2048+15*Math.sin(theta-Math.PI/6)*currentCountsPerA));
  if(e.pml.zcd && n>fsHz*.2){accepted++;windows.push(fsHz/e.pml.acFreq);}
 }
 return {fsHz,freq,accepted,uniqueWindows:[...new Set(windows)],vrms:e.pml.vRms,frequency:e.pml.acFreqAvg,powerFactor:e.pml.powerFactor,min:e.pml.nSamplesMin,max:e.pml.nSamplesMax};
}

for (const frequency of [45, 65]) {
 test('DDS accepts all quantized '+frequency+' Hz endpoint cycles from 5 to 40 kHz', () => {
  for (let khz=5;khz<=40;khz++) {
   const e=dds(); e.rate(khz);
   const result=feed(e,khz*1000,frequency);
   const label=JSON.stringify(result);
   assert.ok(result.accepted>=frequency-1, 'complete endpoint cycles were dropped: '+label);
   assert.ok(Math.abs(result.frequency-frequency)<0.15, 'settled frequency: '+label);
   assert.ok(Math.abs(result.vrms-84.8528137424)<0.8, '120 Vpeak sampled RMS: '+label);
   assert.ok(Math.abs(result.powerFactor-0.8660254038)<0.01, '30 degree PF: '+label);
  }
 });
}
test('DDS 60 Hz interior remains measurable at every advertised sampling rate', () => {
 for(let khz=5;khz<=40;khz++){
  const e=dds();e.rate(khz);const result=feed(e,khz*1000,60);
  assert.ok(result.accepted>=59,JSON.stringify(result));
  assert.ok(Math.abs(result.frequency-60)<0.15,JSON.stringify(result));
 }
});
test('sampling-rate input discards mixed-rate partial and ten-cycle batches plus stale readouts', () => {
 const e=dds();feed(e,20000,60,0.21);
 Object.assign(e.pml,{nSamples:200,vSum:12,vSqrSum:34,iSqrSum:56,pSum:78,offsetSum:90,pRmsSumMul:91,vaSumMul:92,acFreqSum:93,slewPowerUpdate:9,batchSamples:1234,frequencyQualified:true,cycleArmed:true,signReady:true,jitterCount:2,prevSign:1,currSign:1,zcd:1,vAvg:8,vRms:9,iRms:10,pRms:11,vaRms:12,powerFactor:0.9,acFreq:60,acFreqAvg:60});
 for(const wave of Object.values(e.waveHistory))wave.fill(17);
 e.rate(5);
 for(const key of ['nSamples','vSum','vSqrSum','iSqrSum','pSum','offsetSum','pRmsSumMul','vaSumMul','acFreqSum','batchSamples','slewPowerUpdate','jitterCount','prevSign','currSign','zcd','vAvg','vRms','iRms','pRms','vaRms','powerFactor','acFreq','acFreqAvg'])assert.equal(e.pml[key],0,key);
 for(const key of ['frequencyQualified','cycleArmed','signReady'])assert.equal(e.pml[key],false,key);
 assert.equal(e.pml.sampleFreq,5000);
 assert.equal(e.pml.vEma,2048,'a sampling-rate change does not change the ADC offset');
 for(const wave of Object.values(e.waveHistory))assert.ok(wave.every(value=>value===0),'scope must not mix sample intervals');
});
test('DDS reacquires complete endpoint cycles after real sampling-rate changes', () => {
 for(const [before,after,frequency] of [[20,5,45],[5,40,65],[40,20,45],[40,5,65]]){
  const e=dds();e.rate(before);feed(e,before*1000,60,.217);e.rate(after);
  const result=feed(e,after*1000,frequency);
  assert.ok(result.accepted>=frequency-1,JSON.stringify({before,after,...result}));
  assert.ok(Math.abs(result.vrms-84.8528137424)<.8,JSON.stringify(result));
  assert.ok(Math.abs(result.frequency-frequency)<.15,JSON.stringify(result));
 }
});
test('DDS rejects clearly out-of-band 44 and 66 Hz rather than broadening the analogue range', () => {
 for(let khz=5;khz<=40;khz++) for(const frequency of [44,66]){
  const e=dds();e.rate(khz);const result=feed(e,khz*1000,frequency);
  assert.equal(result.accepted,0,JSON.stringify(result));
  assert.equal(result.frequency,0,JSON.stringify(result));
  assert.equal(result.vrms,0,JSON.stringify(result));
 }
});


test('phase-continuous sampling-rate changes arm on a genuine crossing before accepting a full cycle', () => {
 const voltageCountsPerV=(1.2*4095/3.3)/155;
 for(const [frequency,before,after,presamples] of [[45,20,5,71],[65,5,40,31],[45,40,20,200],[65,40,5,244]]){
  const e=dds();
  e.nodes.get('input-freq').value=String(frequency);e.nodes.get('input-freq').listeners.input();
  e.rate(before);
  let previousPositive=false;
  for(let n=0;n<presamples;n++){
   const hardware=e.runDDSAndADC();
   previousPositive=(hardware.adcV-2048)/voltageCountsPerV>20;
   e.runPML(hardware.adcV,hardware.adcI);
  }
  e.rate(after);
  let crossings=0;
  for(let n=0;n<after*1000*.6;n++){
   const hardware=e.runDDSAndADC();
   const positive=(hardware.adcV-2048)/voltageCountsPerV>20;
   const rising=!previousPositive&&positive;
   if(rising)crossings++;
   e.runPML(hardware.adcV,hardware.adcI);
   const label=JSON.stringify({frequency,before,after,presamples,sample:n+1,crossings,vrms:e.pml.vRms,acFreq:e.pml.acFreq,batch:e.pml.slewPowerUpdate});
   if(crossings<2){
    assert.equal(e.pml.zcd,0,'unarmed partial cycle: '+label);
    assert.equal(e.pml.slewPowerUpdate,0,'partial cycle entered averaging batch: '+label);
    assert.equal(e.pml.vRms,0,'partial RMS published: '+label);
    assert.equal(e.pml.acFreq,0,'partial frequency published: '+label);
   }
   if(rising&&crossings===2)assert.equal(e.pml.slewPowerUpdate,1,'second crossing completes exactly one new-rate cycle: '+label);
   previousPositive=positive;
  }
  assert.ok(Math.abs(e.pml.acFreqAvg-frequency)<.15,JSON.stringify({frequency,before,after,actual:e.pml.acFreqAvg}));
  assert.ok(Math.abs(e.pml.vRms-84.8528137424)<.8,JSON.stringify({frequency,before,after,actual:e.pml.vRms}));
 }
});
