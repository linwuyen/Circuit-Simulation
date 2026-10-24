import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function afe(path='9.afe-tutorial/afe.html') {
 const src=read(path), ctx=vm.createContext({});
 vm.runInContext(src.slice(src.indexOf('const TS ='),src.indexOf('// 3. UI 渲染'))+'\nthis.engine={runAfeEngine,pll,settings,sysState,scopeBuffer};',ctx);
 return {ctx,...ctx.engine};
}
function dds(){
 const src=read('11.c2000_dds_dashboard/index.html'),ctx=vm.createContext({});
 vm.runInContext(src.slice(src.indexOf('let isRunning ='),src.indexOf('// --- 2. 硬體'))+src.slice(src.indexOf('const runPML ='),src.indexOf('// --- 5. 數據'))+'\nthis.engine={pml,runPML};',ctx);
 return {ctx,...ctx.engine};
}

function armDds(e){
 e.runPML(1000,2048); // observe a real negative sample
 e.runPML(3000,2048); // acquire the first genuine rising boundary
 e.runPML(1000,2048); // next rising sample is now a measured interval
}

for(const path of ['9.afe-tutorial/afe.html','9.afe-tutorial/simulator-core.html']){
 test(path+': SOGI tracks sinusoidal grid with independent quadrature states',()=>{
  const e=afe(path); for(let n=0;n<40000;n++)e.runAfeEngine();
  assert.ok(Number.isFinite(e.pll.theta));
  const amplitude=Math.hypot(e.pll.v_alpha,e.pll.v_beta);
  assert.ok(amplitude>150&&amplitude<160,`${amplitude}`);
  const tail=e.scopeBuffer; let err=0;
  for(let i=0;i<tail.theta.length;i++)err+=(tail.v_grid[i]/155-Math.sin(tail.theta[i]))**2;
  assert.ok(Math.sqrt(err/tail.theta.length)<.03,`phase RMS ${Math.sqrt(err/tail.theta.length)}`);
 });
 test(path+': PF is zero for zero current, not fabricated unity',()=>{
  const e=afe(path); e.settings.innerKp=0;e.settings.innerKi=0;
  for(let n=0;n<1000;n++)e.runAfeEngine();
  assert.equal(e.sysState.pf,0);
 });
 test(path+': capacitor energy uses instantaneous signed grid v times i',()=>{
  const e=afe(path); e.settings.innerKp=0;e.settings.innerKi=0;
  e.sysState.i_grid_actual=10; const before=e.sysState.v_bus_actual;
  e.runAfeEngine();
  const expectedEnergy=.5*.0012*before**2+(e.sysState.v_grid_sampled*e.sysState.i_grid_actual-e.settings.loadWatts)*.00005;
  assert.ok(Math.abs(.5*.0012*e.sysState.v_bus_actual**2-expectedEnergy)<1e-9);
 });
}
test('DDS dynamic correction does not bias RMS or quadrature PF',()=>{
 const e=dds();
 for(let n=0;n<60000;n++){
  const theta=2*Math.PI*60*n/20000;
  e.runPML(2200+120*Math.sin(theta)*(1.2*4095/3.3)/155,2048+15*Math.cos(theta)*(1.2*4095/3.3)/30);
 }
 assert.ok(Math.abs(e.pml.vRms-120/Math.sqrt(2))<.25,`Vrms ${e.pml.vRms}`);
 assert.ok(Math.abs(e.pml.powerFactor)<.005,`PF ${e.pml.powerFactor}`);
});
test('DDS timeout clears every partial-cycle and multi-cycle accumulator',()=>{
 const e=dds();armDds(e);Object.assign(e.pml,{nSamples:e.pml.nSamplesMax,vSum:12,vSqrSum:34,iSqrSum:56,pSum:78,pRmsSumMul:90,vaSumMul:100,acFreqSum:110,slewPowerUpdate:9});
 e.runPML(2048,2048);
 for(const key of ['nSamples','vSum','vSqrSum','iSqrSum','pSum','pRmsSumMul','vaSumMul','acFreqSum','slewPowerUpdate'])assert.equal(e.pml[key],0,key);
});
test('ADC acquisition lesson uses SYSCLK and CPU-CM lesson uses dedicated message RAM',()=>{
 const adc=read('6.10μs 高頻控制迴路模擬器/教學版/03-adc.html');
 assert.match(adc,/15 個 SYSCLK/); assert.doesNotMatch(adc,/15 個 ADCCLK/);
 const ipc=read('7.28388d_bms_tutorial/07_coordinate.html');
 assert.match(ipc,/CPU1-to-CM MSGRAM/); assert.doesNotMatch(ipc,/資料放在 <code>GSRAM/);
});
test('DDS overlong window crossing is invalid and clears old batch power',()=>{
 const e=dds();armDds(e);Object.assign(e.pml,{nSamples:e.pml.nSamplesMax,prevSign:0,pRmsSumMul:90,vaSumMul:100,acFreqSum:110,slewPowerUpdate:9});
 e.runPML(3000,2100);
 assert.equal(e.pml.pRmsSumMul,0);assert.equal(e.pml.slewPowerUpdate,0);
});
test('DDS short jitter rejects both sample numerator and denominator',()=>{
 const e=dds();armDds(e);Object.assign(e.pml,{nSamples:20,prevSign:0,vSqrSum:100,pSum:200});e.runPML(3000,2100);
 assert.equal(e.pml.nSamples,0);assert.equal(e.pml.vSqrSum,0);assert.equal(e.pml.pSum,0);
});
test('AFE recovers sine-phase lock after 45 degree step with harmonic injection',()=>{
 const e=afe();for(let n=0;n<20000;n++)e.runAfeEngine();
 e.settings.phaseShiftDeg=45;e.settings.thdPercent=20;
 for(let n=0;n<20000;n++)e.runAfeEngine();
 const phase=2*Math.PI*60*2+Math.PI/4;
 assert.ok(Math.abs(Math.sin(e.pll.theta)-Math.sin(phase))<.06);
 assert.ok(Number.isFinite(e.sysState.v_bus_actual));
});
test('AFE signed sampled PF reflects reverse power rather than a positive score',()=>{
 const e=afe();e.settings.innerKp=0;e.settings.innerKi=0;
 e.scopeBuffer.v_grid.fill(100);e.scopeBuffer.i_grid.fill(-2);
 e.runAfeEngine();assert.ok(e.sysState.pf<-.99);
});
test('DDS recovers cleanly after timeout and retains reverse-power PF sign',()=>{
 const e=dds();armDds(e);Object.assign(e.pml,{nSamples:e.pml.nSamplesMax,vSqrSum:1e12,pSum:1e12,pRmsSumMul:1e12,slewPowerUpdate:9});e.runPML(2048,2048);
 for(let n=0;n<30000;n++){
  const theta=2*Math.PI*50*n/20000;
  e.runPML(2048+120*Math.sin(theta)*(1.2*4095/3.3)/155,2048+15*Math.sin(theta-5*Math.PI/6)*(1.2*4095/3.3)/30);
 }
 assert.ok(Math.abs(e.pml.vRms-120/Math.sqrt(2))<.25);
 assert.ok(Math.abs(e.pml.powerFactor+Math.sqrt(3)/2)<.005,`${e.pml.powerFactor}`);
});
test('active BMS architecture, glossary and quiz distinguish CPU-CM message RAM from GS RAM',()=>{
 for(const path of ['7.28388d_bms_tutorial/index.html','7.28388d_bms_tutorial/01_overview.html','7.28388d_bms_tutorial/assets/bms-learn.js'])assert.match(read(path),/CPU1-to-CM MSGRAM/);
 assert.match(read('7.28388d_bms_tutorial/assets/bms-learn.js'),/CM 不可直接存取/);
});
test('BMS active entry points mark historical simulators as unverified archives',()=>{
 assert.match(read('7.28388d_bms_tutorial/index.html'),/歷史三核心示意（未驗證）/);
 assert.match(read('7.28388d_bms_tutorial/09_integrate.html'),/ARCHIVE.*未驗證/);
});
test('ADC RC lesson cannot mark 600 ns at tau 180 ns as accurate 12-bit settling',()=>{
 const html=read('6.10μs 高頻控制迴路模擬器/教學版/03-adc.html');
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'600',style:{},setAttribute(){}});return nodes.get(id);};
 const ctx=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[]}});
 const src=html.slice(html.indexOf('var X0 ='),html.indexOf('</script>',html.indexOf('var X0 =')));
 vm.runInContext(src,ctx);
 assert.match(get('statusBox').innerHTML,/3\.57%/);assert.match(get('statusBox').innerHTML,/未達 12-bit/);
 get('acq').value='1800';vm.runInContext('render()',ctx);assert.match(get('statusBox').innerHTML,/符合本 RC 模型/);
});
test('full timing lesson separates external converter readiness from internal ACQPS',()=>{
 const html=read('6.10μs 高頻控制迴路模擬器/教學版/07-full.html');
 assert.match(html,/不是內部 ADC 的 ACQPS/);assert.doesNotMatch(html,/讓內部 ADC 取樣窗口涵蓋外部 ADC/);
 assert.match(html,/外部 ADC 結果就緒等待/);
});
