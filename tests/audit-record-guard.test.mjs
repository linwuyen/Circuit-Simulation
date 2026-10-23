import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const [file,key] of [['workspace-experiment-ui.js','experiment'],['workspace-topology-ui.js','topologyTransfer'],['topology-application-ui.js','topologyApplications']]){
 test(`${key} same-version changed record fails closed before save`,()=>{
  const source=fs.readFileSync(new URL('../assets/learning/'+file,import.meta.url),'utf8');
  const guard=source.slice(source.indexOf('  function protectRecord(){'),source.indexOf('\n  }',source.indexOf('  function protectRecord(){'))+4);
  const node=new Proxy({},{get:(_,k)=>k==='hidden'?false:()=>node,set:()=>true});
  const state={benchmark:{learningWorkspace:{[key]:{version:1,rows:{first:'new answer'}}}}};
  const context={E:{load:()=>state},blocked:false,expectedRecord:JSON.stringify({version:1,rows:{first:'original answer'}}),$:()=>node,el:()=>node,document:{querySelector:()=>node,querySelectorAll:()=>[]},run:node,nav:node,content:node,progress:node,status:node};
  vm.createContext(context);vm.runInContext(guard+';result=protectRecord()',context);assert.equal(context.result,true);
 });
}
