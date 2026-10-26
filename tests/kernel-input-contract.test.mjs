import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import K from '../assets/engineering-sandbox-core.js';

test('nonphysical or unfinished kernel inputs cannot return a RUN trace',()=>{
 for(const key of ['inductanceUh','capacitanceUf','controlPeriodUs','plantDtUs','vin','voltageFullScale','currentFullScale'])
  for(const value of [0,-1,'',' ',null,NaN,Infinity])
   assert.throws(()=>K.simulateSystem({cycles:20,[key]:value}),RangeError,`${key}=${String(value)}`);
 for(const input of [{cycles:Infinity},{cycles:1000000},{samplePct:-1},{samplePct:100},{adcBits:0},{loadProfile:[{cycle:0,ohm:0}]}])
  assert.throws(()=>K.simulateSystem(input),RangeError,JSON.stringify(input));
});

function sandbox(){
 const html=fs.readFileSync(new URL('../15_power_capstone/lab_sandbox.html',import.meta.url),'utf8'),nodes=new Map();
 class Node {constructor(value=''){this.value=value;this.textContent='';this.children=[];this.attrs={};this.handlers={};this.validity={valid:true};} addEventListener(type,fn){this.handlers[type]=fn;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}appendChild(n){this.children.push(n);}replaceChildren(){this.children=[];}querySelector(sel){return this.children.find(x=>x.attrs.class===sel.slice(1))||null;}checkValidity(){return this.validity.valid;}setCustomValidity(){} }
 for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g))nodes.set(m[1],new Node(m[0].match(/\bvalue="([^"]*)"/)?.[1]||''));
 for(const m of html.matchAll(/<select[^>]*id="([^"]+)"[^>]*>\s*<option value="([^"]*)"/g))nodes.get(m[1]).value=m[2];
 const doc={body:{dataset:{sandbox:'converter'}},getElementById:id=>nodes.get(id)||null,createElementNS:()=>new Node(),querySelectorAll:()=>[]};
 let writes=0;const ctx=vm.createContext({document:doc,CircuitEngineeringSandboxCore:K,CircuitEvidence:{recordMachine(){writes++;}}});
 vm.runInContext(fs.readFileSync(new URL('../assets/engineering-sandbox-ui.js',import.meta.url),'utf8'),ctx);
 return {nodes,writes:()=>writes,edit(id,value){const n=nodes.get(id);n.value=value;n.handlers.input();}};
}

test('invalid sandbox edits clear results and never create valid machine evidence; valid edits recover',()=>{
 const ui=sandbox(),initial=ui.writes();
 for(const value of ['0','','-5']){
  ui.edit('sb-inductance',value);
  assert.match(ui.nodes.get('sb-status').className,/fail/);
  assert.doesNotMatch(ui.nodes.get('sb-status').textContent,/因果鏈正常/);
  assert.equal(ui.nodes.get('sb-final-v').textContent,'—');
  assert.equal(ui.writes(),initial);
 }
 ui.edit('sb-inductance','500');
 assert.notEqual(ui.nodes.get('sb-final-v').textContent,'—');assert.equal(ui.writes(),initial+1);
});
