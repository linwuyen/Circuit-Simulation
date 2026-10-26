import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function engine(path){
 const source=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),listeners={};
 const ctx=vm.createContext({document:{getElementById:id=>({addEventListener:(type,fn)=>listeners[id+':'+type]=fn})}});
 vm.runInContext(source.slice(source.indexOf('const TS ='),source.indexOf('// 3. UI 渲染'))+'\nthis.e={runAfeEngine,pll,ctrl,dds,settings,sysState,scopeBuffer,step:n=>{for(let j=0;j<n;j++)runAfeEngine();}};',ctx);
 vm.runInContext('function updateWidgets(){} function drawScope(){}\n'+source.slice(source.indexOf('// 重新載入復位'),source.indexOf('// 引擎高速實時運算迴圈')),ctx);
 return {...ctx.e,reset:()=>listeners['btn-reset:click']()};
}
for(const path of ['9.afe-tutorial/afe.html','9.afe-tutorial/simulator-core.html']){
 test(path+': default load regulates for multiple line cycles instead of exhausting the bus',()=>{
  const e=engine(path);e.step(40000);const mean=e.scopeBuffer.v_bus.reduce((s,x)=>s+x,0)/400;
  assert.ok(Math.abs(mean-400)<4,`mean bus ${mean}`);assert.ok(e.scopeBuffer.v_bus.every(x=>x>390&&x<410));
 });
 test(path+': reset preserves chosen settings and reproduces a fresh dynamic trajectory',()=>{
  const a=engine(path),b=engine(path);a.settings.loadWatts=b.settings.loadWatts=900;
  a.step(12000);a.reset();a.step(40);b.step(40);
  assert.equal(a.settings.loadWatts,900);
  for(const key of ['v_bus_actual','i_grid_actual','pf'])assert.ok(Math.abs(a.sysState[key]-b.sysState[key])<1e-12,key);
  assert.deepEqual(JSON.parse(JSON.stringify(a.pll)),JSON.parse(JSON.stringify(b.pll)));
  assert.deepEqual(JSON.parse(JSON.stringify(a.ctrl)),JSON.parse(JSON.stringify(b.ctrl)));
  assert.deepEqual(JSON.parse(JSON.stringify(a.scopeBuffer)),JSON.parse(JSON.stringify(b.scopeBuffer)));
 });
 test(path+': capacitor energy has no hidden upper-voltage clamp',()=>{
  const e=engine(path);e.settings.innerKp=e.settings.innerKi=0;e.settings.loadWatts=-3000;
  e.sysState.v_bus_actual=600;e.sysState.i_grid_actual=0;e.step(1);
  assert.ok(Math.abs(.5*.0012*e.sysState.v_bus_actual**2-216.15)<1e-9);
  assert.equal(e.sysState.modelLimit,'OVERVOLTAGE_MODEL_LIMIT');
 });
 test(path+': exhausted constant-power load reports its unserved energy instead of inventing a 50V floor',()=>{
  const e=engine(path);e.settings.innerKp=e.settings.innerKi=0;e.settings.loadWatts=5000;e.sysState.v_bus_actual=1;e.step(1);
  assert.equal(e.sysState.v_bus_actual,0);assert.equal(e.sysState.modelLimit,'ENERGY_EXHAUSTED');
  assert.ok(Math.abs(e.sysState.unservedEnergyJ-.2494)<1e-12);
 });
 test(path+': unclipped cycle energy equals signed instantaneous grid power minus load',()=>{
  const e=engine(path);for(let n=0;n<4000;n++){
   const before=.5*.0012*e.sysState.v_bus_actual**2;e.step(1);
   const delta=.5*.0012*e.sysState.v_bus_actual**2-before;
   assert.ok(Math.abs(delta-(e.sysState.v_grid_sampled*e.sysState.i_grid_actual-e.settings.loadWatts)*.00005)<1e-10);
  }
 });
}
