import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function importHandler(saved){
 const source=read('assets/learning/learning-v3.js');const prefix='document.getElementById("stateFile").onchange=';const tail=source.slice(source.indexOf(prefix)+prefix.length).split('\n')[0].trim().replace(/;$/,'');
 let reload=0,flushed=0;const status={textContent:''};const ctx={Evidence:{merge(){},async flush(){flushed++;return {saved,reason:saved?null:'conflict'};}},location:{reload(){reload++;}},document:{getElementById(){return status;}}};vm.createContext(ctx);const handler=vm.runInContext('('+tail+')',ctx);
 return {handler,status,get reload(){return reload;},get flushed(){return flushed;}};
}
test('backup import never reloads when durable save reports conflict',async()=>{const h=importHandler(false);await h.handler({target:{files:[{size:2,text:async()=>'{}'}]}});assert.equal(h.flushed,1);assert.equal(h.reload,0);assert.match(h.status.textContent,/conflict|衝突/);});
test('backup import reloads only after successful durable flush',async()=>{const h=importHandler(true);await h.handler({target:{files:[{size:2,text:async()=>'{}'}]}});assert.equal(h.flushed,1);assert.equal(h.reload,1);});
for(const path of ['assets/beginner-lab.js','assets/learning/control-basics-ui.js','assets/learning/workspace-ui.js','assets/learning/workspace-experiment-ui.js','assets/learning/workspace-topology-ui.js','assets/learning/topology-application-ui.js']){
 test(path+': navigation remains blocked until durable flush succeeds',async()=>{
  const line=read(path).split('\n').find(l=>l.includes('async function durableNavigate'));
  let saved=false,navigations=0;const message={textContent:''};const c={CircuitEvidence:{async flush(){return {saved,reason:'conflict'};}},document:{getElementById(){return message;}}};vm.createContext(c);vm.runInContext(line,c);
  await c.durableNavigate(()=>navigations++);assert.equal(navigations,0);assert.match(message.textContent,/取消離開/);saved=true;await c.durableNavigate(()=>navigations++);assert.equal(navigations,1);
 });
}
test('formal outcome does not display accepted answer or schedule next question on failed durability',async()=>{
 const src=read('19_c2000_buck_firmware_lab/outcome-ui.js');const part=src.slice(src.indexOf('  async function submit('),src.indexOf('  function loadScript('));const status={dataset:{},textContent:''};let advances=0;
 const c={activePhase:'pre',saving:false,Session:{recordAttempt(){return {correct:true};}},window:{CircuitEvidence:{async flush(){return {saved:false,reason:'conflict'};}},setTimeout(){advances++;}},$:()=>status,$$:()=>[],renderQuestion(){}};vm.createContext(c);vm.runInContext(part,c);await c.submit({id:'q'},'yes');assert.equal(advances,0);assert.notEqual(status.dataset.result,'pass');
});
test('repair seed claim conflict cannot display a new formal case',async()=>{
 const src=read('assets/repair-training-ui.js'),part=src.slice(src.indexOf('  async function start()'),src.indexOf('  $("repair-new")'));
 const previous={id:'previous'},c={Number,Date,session:previous,rehearsal:false,started:0,recordId:'old',Core:{create:()=>({id:'new'})},Records:{claimSeed:()=>true},$:()=>({value:'123'}),text(){},CircuitEvidence:{async flush(){return {saved:false,reason:'conflict'};}}};vm.createContext(c);vm.runInContext(part,c);await assert.rejects(c.start(),/資格未儲存/);assert.equal(c.session,previous);assert.equal(c.recordId,'old');
});
