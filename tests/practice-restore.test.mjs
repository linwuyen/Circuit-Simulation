import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';const E=createRequire(import.meta.url)('../assets/learning/learning-evidence.js');
const samples={topologyTransfer:{version:1,protocol:'topology-workbench-v1',params:{vin:48},source:'default',models:[],rows:{},operated:false,completed:false},topologyApplications:{version:1,rows:{},currentLesson:'psfb',completed:false}};
function restore(key,local,incomingVersion=1){E._resetForTests();const s=E.load();s.benchmark.learningWorkspace={version:1,[key]:local};E.save(s);const p=E.emptyState();p.benchmark.learningWorkspace={version:1,[key]:{version:incomingVersion,rows:{saved:{first:{correct:false}}}}};E.merge(p);return E.load().benchmark.learningWorkspace[key];}
test('empty comparison and lesson-selection shells accept backup progress',()=>{for(const[key,value]of Object.entries(samples))assert.equal(restore(key,value).rows.saved.first.correct,false);});
test('actual work and unrecognized shapes keep their local record',()=>{for(const[key,value]of Object.entries(samples)){
 for(const patch of [{rows:{saved:{first:{correct:false}}}},{rows:{saved:{prepared:true}}},{operated:true},{history:[{note:'keep'}]},{custom:'keep'},{version:99},{completed:true},{protocol:'future'}]){const local={...value,...patch};assert.deepEqual(restore(key,local),local);}
 assert.deepEqual(restore(key,value,99),value);
}});
