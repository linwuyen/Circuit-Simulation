import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function physics(topology, current=2, loadCurrent=-1, full=false){
 const source=read(full?'2_code_artifact/code_artifact.html':'2_code_artifact/course/shared/widget.js');
 const body=source.slice(source.indexOf('    function stepPhysicsNumerical()'),source.indexOf('    function updateVisualFlowPaths('));
 const c={Math,param_ma:.8,param_freq:50,param_fc:10000,t_time:0,autoMode:false,currentTopology:topology,loadType:'LC',switchStates:Array(6).fill(false),diodeStates:[],V_half:200,current_L:loadCurrent,current_L_b:loadCurrent,current_L_c:loadCurrent,il_filter:current,il_filter_b:-current,il_filter_c:0,vc_filter:loadCurrent*10,vc_filter_b:0,vc_filter_c:0,R_val:10,L_val:.01,L_f:.001,C_f:.00001,dt:1e-7,acc_n:0,acc_v2:0,acc_a1:0,acc_b1:0,updateVisualFlowPaths(){},renderSwitchesUI(){},renderDiodesUI(){}};
 vm.createContext(c);vm.runInContext(body+'; result=stepPhysicsNumerical()',c);return c;
}
test('LC half bridge all-off commutates by filter inductor current, not load current',()=>{
 for(const i of [2,-2,.001,-.001]){const c=physics('half',i);assert.equal(c.result.v1,i>0?-200:200);assert.equal(c.diodeStates[i>0?1:0],true);}
});
test('LC full bridge opposing load current cannot reverse diode commutation',()=>{
 const c=physics('full',2,-1);assert.equal(c.result.v1,-400);assert.equal(c.diodeStates[1],true);assert.equal(c.diodeStates[2],true);
});
test('LC three-phase bridge uses each filter inductor for its diode',()=>{
 const c=physics('three',2,-1);assert.equal(c.diodeStates[1],true);assert.equal(c.diodeStates[2],true);assert.equal(c.diodeStates[4],false);assert.equal(c.diodeStates[5],false);
});
function duties(mag,useCM,angle){const html=read('3_foc_course/L2_5-inverse-svpwm.html');const body=html.slice(html.indexOf('function duties(a)'),html.indexOf('function resize()'));const c={Math,mag,useCM};vm.createContext(c);vm.runInContext(read('3_foc_course/foc-core.js')+'\n'+body+`; result=duties(${angle})`,c);return c.result;}
test('SVPWM unit inscribed-circle command reaches duty rails at 30 degrees',()=>{
 const d=duties(1,true,Math.PI/6);assert.ok(Math.abs(d.da-1)<1e-12);assert.ok(Math.abs(d.dc)<1e-12);
});
test('SPWM linear limit is sqrt(3)/2 in the same normalized frame',()=>{
 assert.ok(Math.abs(duties(Math.sqrt(3)/2,false,0).da-1)<1e-12);
 assert.ok(duties(1,false,0).da>1,'unit command must expose SPWM overmodulation');
});
test('ACMC load command is apparent VA and watt readout retains power factor',()=>{
 const html=read('10.acmc-pro_power_simulator/index.html');assert.match(html,/id="lbl-load">1200 VA/);
 const block=html.slice(html.indexOf('            // Live metrics variables'),html.indexOf('            // Draw waveforms'));
 const c={Math,loadApparentVA:1200,powerFactor:.5,isTripped:false,runProtectionChecks(){},lblCalcVrms:{},lblCalcIrms:{},lblCalcWatts:{}};vm.createContext(c);vm.runInContext(block,c);
 assert.equal(c.lblCalcWatts.innerText,'600 W');assert.equal(c.lblCalcIrms.innerText,'10.91 A');
});

test('full simulator route applies identical LC diode-current rule',()=>{
 for(const top of ['half','full','three']){const c=physics(top,2,-1,true);assert.equal(c.diodeStates[1],true);if(top!=='half')assert.equal(c.diodeStates[2],true);assert.equal(c.result.v1,top==='half'?-50:-100);}
});
test('ACMC PF input refreshes the active-power dependent ZVS estimate',()=>{
 const html=read('10.acmc-pro_power_simulator/index.html');const block=html.slice(html.indexOf("        pfSlider.addEventListener('input'"),html.indexOf("        ddsSelect.addEventListener('change'"));
 let handler,refresh=0;const c={Math,parseInt,powerFactor:1,lblPf:{},pfSlider:{addEventListener(type,fn){handler=fn;}},updateZvsStatus(){refresh++;}};vm.createContext(c);vm.runInContext(block,c);handler({target:{value:'20'}});assert.equal(c.powerFactor,.2);assert.equal(refresh,1);
});
