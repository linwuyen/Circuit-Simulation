import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/learning/learning-evidence.js',import.meta.url),'utf8');
function fixture({locks=true}={}){
 const data=new Map();let queue=Promise.resolve(),blocked=false;
 const lockManager={request(name,options,fn){const p=queue.then(()=>fn({name}));queue=p.catch(()=>{});return p;}};
 function tab(){const listeners=new Map();const c={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(blocked)throw Object.assign(new Error('full'),{name:'QuotaExceededError'});data.set(k,String(v));},removeItem:k=>data.delete(k)},document:{body:null},navigator:locks?{locks:lockManager}:{},addEventListener(type,fn){const a=listeners.get(type)||[];a.push(fn);listeners.set(type,a);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};c.window=c;vm.createContext(c);vm.runInContext(source,c);c.CircuitEvidence.onStatus=fn=>c.addEventListener('circuit:evidence-persistence',fn);return c.CircuitEvidence;}
 return {data,tab,block:value=>{blocked=value;}};
}
test('durable browser saves are pending until the shared key lock commits',async()=>{
 const {tab,data}=fixture(),a=tab();const s=a.load();s.evidence.first={level:1};a.save(s);
 assert.equal(a.storageStatus().saved,false);assert.equal(data.get(a.KEY),undefined);
 assert.equal((await a.flush()).saved,true);assert.equal(JSON.parse(data.get(a.KEY)).evidence.first.level,1);
});
test('two tabs cannot overwrite different same-version updates from stale snapshots',async()=>{
 const {tab,data}=fixture(),a=tab();a.save(a.load());await a.flush();const b=tab(),sa=a.load(),sb=b.load();
 sa.evidence.one={level:1};sb.evidence.two={level:2};a.save(sa);b.save(sb);await Promise.all([a.flush(),b.flush()]);
 assert.equal(a.storageStatus().saved,true);assert.equal(b.storageStatus().saved,false);assert.equal(b.storageStatus().reason,'conflict');
 assert.equal(JSON.parse(data.get(a.KEY)).evidence.one.level,1);assert.equal(JSON.parse(data.get(a.KEY)).evidence.two,undefined);
 assert.equal(JSON.parse(b.exportBackup()).evidence.two.level,2);b.retrySave();await b.flush();assert.equal(b.storageStatus().reason,'conflict');
});
test('successive same-tab updates coalesce without dropping evidence',async()=>{
 const {tab,data}=fixture(),a=tab();a.recordEvidence('one',1,'test');a.recordEvidence('two',2,'test');await a.flush();
 const saved=JSON.parse(data.get(a.KEY));assert.equal(saved.evidence.one.level,1);assert.equal(saved.evidence.two.level,2);
});
test('unsupported browser locking preserves export but never pretends durable success',async()=>{
 const {tab,data}=fixture({locks:false}),a=tab();a.recordEvidence('one',1,'test');await a.flush();
 assert.equal(data.get(a.KEY),undefined);assert.equal(a.storageStatus().saved,false);assert.equal(a.storageStatus().reason,'concurrency-lock-unavailable');assert.equal(JSON.parse(a.exportBackup()).evidence.one.level,1);
});
test('stale same-tab object cannot drop a later update and remains exportable',async()=>{
 const {tab,data}=fixture(),a=tab();a.save(a.load());await a.flush();const stale=a.load();a.recordEvidence('newer',2,'test');await a.flush();stale.evidence.stale={level:1};a.save(stale);await a.flush();
 assert.equal(a.storageStatus().reason,'conflict');assert.equal(JSON.parse(data.get(a.KEY)).evidence.newer.level,2);
 assert.equal(JSON.parse(a.exportBackup()).unsavedConflictDrafts[0].evidence.stale.level,1);
});
test('remote deletion while a draft waits is a conflict, never resurrection',async()=>{
 const {tab,data}=fixture(),a=tab();a.save(a.load());await a.flush();const s=a.load();s.evidence.draft={level:1};a.save(s);data.delete(a.KEY);await a.flush();assert.equal(data.has(a.KEY),false);assert.equal(a.storageStatus().reason,'conflict');
});
test('no-op normalization reads do not create spurious durable writes',async()=>{
 const {tab,data}=fixture(),a=tab();await a.flush();a.save(a.load());await a.flush();const raw=data.get(a.KEY);a.save(a.load());assert.equal(a.storageStatus().saved,true);await a.flush();assert.equal(data.get(a.KEY),raw);
});
test('quota failure retains draft and safely retries against the original baseline',async()=>{
 const {tab,data,block}=fixture(),a=tab();a.save(a.load());await a.flush();
 block(true);a.recordEvidence('draft',1,'test');await a.flush();assert.equal(a.storageStatus().saved,false);assert.equal(a.storageStatus().reason,'QuotaExceededError');
 assert.equal(JSON.parse(a.exportBackup()).evidence.draft.level,1);block(false);a.retrySave();await a.flush();assert.equal(a.storageStatus().saved,true);assert.equal(JSON.parse(data.get(a.KEY)).evidence.draft.level,1);
});
test('import is pending until commit and conflict never replaces durable evidence',async()=>{
 const {tab,data}=fixture(),a=tab();a.save(a.load());await a.flush();const b=tab();const original=b.load();
 a.recordEvidence('winner',1,'test');await a.flush();original.evidence.loser={level:2};b.save(original);await b.flush();
 const imported=JSON.parse(b.exportBackup());imported.evidence.imported={level:1};b.merge(imported);await b.flush();
 assert.equal(b.storageStatus().saved,false);assert.equal(JSON.parse(data.get(a.KEY)).evidence.winner.level,1);assert.equal(JSON.parse(data.get(a.KEY)).evidence.imported,undefined);
});
test('conflicted import does not mutate auxiliary stores before the primary lock gate',async()=>{
 const {tab}=fixture(),a=tab();a.save(a.load());await a.flush();const b=tab();let restored=0;
 b.registerStore('extra',{validate:()=>true,snapshot:()=>({original:true}),restore:()=>{restored++;},isPending:()=>false,retry:()=>{}});
 const draft=b.load();a.recordEvidence('newer',1,'test');await a.flush();draft.evidence.stale={level:1};b.save(draft);
 const payload=JSON.parse(b.exportBackup());payload.auxiliary.extra={incoming:true};b.merge(payload);await b.flush();
 assert.equal(restored,0);assert.equal(JSON.parse(b.exportBackup()).auxiliary.extra.incoming,true);
});

test('snapshot read during own pending write remains valid after that exact revision commits',async()=>{
 const {tab,data}=fixture(),a=tab();a.load();await a.flush();a.recordEvidence('one',1,'test');const s=a.load();await a.flush();s.evidence.two={level:2};a.save(s);await a.flush();assert.equal(a.storageStatus().saved,true);assert.equal(JSON.parse(data.get(a.KEY)).evidence.two.level,2);
});

test('flush drains a new revision saved reentrantly by its success notification',async()=>{
 const {tab,data}=fixture(),a=tab();a.load();await a.flush();let once=false;
 a.onStatus(event=>{if(event.detail.saved&&!once){once=true;a.recordEvidence('during-status',1,'test');}});
 a.recordEvidence('first',1,'test');const result=await a.flush();assert.equal(result.saved,true);
 const saved=JSON.parse(data.get(a.KEY));assert.equal(saved.evidence.first.level,1);assert.equal(saved.evidence['during-status'].level,1);
});
test('throwing auxiliary import remains unsaved and is actually restored on safe retry',async()=>{
 const {tab}=fixture(),a=tab();a.load();await a.flush();let fail=true,restored=0;
 a.registerStore('extra',{validate:()=>true,snapshot:()=>({}),restore:()=>{if(fail)throw Error('temporary');restored++;},isPending:()=>false,retry:()=>{}});
 const payload=JSON.parse(a.exportBackup());payload.auxiliary.extra={incoming:true};a.merge(payload);await a.flush();assert.equal(a.storageStatus().saved,false);assert.equal(restored,0);
 fail=false;a.retrySave();await a.flush();assert.equal(a.storageStatus().saved,true);assert.equal(restored,1);
});
