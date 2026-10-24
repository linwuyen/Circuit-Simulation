import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/learning/workspace-ui.js',import.meta.url),'utf8');
function harness(initial){
 let state=structuredClone(initial),writes=0;
 const node=new Proxy({},{get:(_t,k)=>k==='hidden'?false:()=>node,set:()=>true});
 const c={E:{load:()=>structuredClone(state),save:s=>{state=structuredClone(s);writes++;},storageStatus:()=>({saved:true})},W:{bucket:()=> 'beginnerLessons'},id:'duty',record:{first:{answer:'up',correct:true}},model:{vin:48},mode:'lesson',workspace:structuredClone(initial.benchmark.learningWorkspace),$:()=>node,document:{querySelector:()=>node,querySelectorAll:()=>[],createElement:()=>node},el:()=>node,renderProgress:()=>{},blocked:false,saving:false,expectedRecord:JSON.stringify(initial.benchmark.beginnerLessons?.rows?.duty)};
 vm.createContext(c);
 const start=source.indexOf(' function legacyFields('),end=source.indexOf(' function log(');
 // Production helpers and save, excluding one mount-only guard invocation.
 const code=(start>=0?source.slice(start,end):source.slice(source.indexOf(' function save(){'),end)).replace(' if(protectRecord())return;','');
 vm.runInContext(code,c);
 if(c.legacyFields)c.expectedWorkspace=JSON.stringify(c.legacyFields(c.workspace));
 return {save:()=>c.save(),change:fn=>fn(state),state:()=>state,writes:()=>writes};
}
const base=()=>({benchmark:{learningWorkspace:{version:1,history:[],experiment:{version:1,rows:{old:{}}}},beginnerLessons:{version:1,rows:{}}}});
test('legacy lesson save preserves freshly written continuous/topology records',()=>{
 const h=harness(base());
 h.change(s=>{s.benchmark.learningWorkspace.experiment={version:1,rows:{new:{first:{answer:'down'}}}};s.benchmark.learningWorkspace.topologyApplications={version:1,rows:{pfc:{first:'new'}}};});
 h.save();
 assert.equal(h.writes(),1);
 assert.equal(h.state().benchmark.learningWorkspace.experiment.rows.new.first.answer,'down');
 assert.equal(h.state().benchmark.learningWorkspace.topologyApplications.rows.pfc.first,'new');
});
test('legacy save refuses an unsupported workspace root instead of resetting it',()=>{
 const h=harness(base());h.change(s=>s.benchmark.learningWorkspace={version:99,sentinel:'preserve'});h.save();
 assert.equal(h.writes(),0);assert.equal(h.state().benchmark.learningWorkspace.sentinel,'preserve');
});
test('legacy save cannot overwrite a same-version first answer from another page',()=>{
 const h=harness(base());h.change(s=>s.benchmark.beginnerLessons.rows.duty={first:{answer:'external',correct:false}});h.save();
 assert.equal(h.writes(),0);assert.equal(h.state().benchmark.beginnerLessons.rows.duty.first.answer,'external');
});
test('legacy save preserves a competing legacy history rather than replaying a stale snapshot',()=>{
 const h=harness(base());h.change(s=>s.benchmark.learningWorkspace.history.push({label:'external event'}));h.save();
 assert.equal(h.writes(),0);assert.equal(h.state().benchmark.learningWorkspace.history[0].label,'external event');
});
