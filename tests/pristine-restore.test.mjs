import test from 'node:test';import assert from 'node:assert/strict';import{createRequire}from'node:module';const require=createRequire(import.meta.url),E=require('../assets/learning/learning-evidence.js');
const pristine=()=>({version:1,rows:{energy:{}},history:[],currentLesson:'energy',currentConfig:{vin:48},completed:false});
function merge(local){E._resetForTests();const s=E.load();s.benchmark.learningWorkspace={version:1,experiment:local};E.save(s);const p=E.emptyState();p.benchmark.learningWorkspace={version:1,experiment:{version:1,rows:{energy:{first:{correct:false,answer:'saved'}}},history:[]}};E.merge(p);return E.load().benchmark.learningWorkspace.experiment;}
test('an untouched automatically initialized experiment does not block backup restoration',()=>{assert.equal(merge(pristine()).rows.energy.first.answer,'saved');});
test('restore preserves activity, history, unknown fields and unsupported versions',()=>{
 for(const change of [{rows:{energy:{first:{correct:false,answer:'local'}}}},{rows:{energy:{operated:true}}},{history:[{kind:'saved'}]},{futureField:{note:'keep'}},{version:99},{completed:true}]){const local={...pristine(),...change};assert.deepEqual(merge(local),local);}
});
