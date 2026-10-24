const {test,expect}=require('@playwright/test');
const {flushEvidence,resetEvidence}=require('./evidence-fixture');

test('fixture reset drains queued evidence and resets owner before clearing auxiliary state',async({page})=>{
 await page.goto('/tests/');await page.addScriptTag({url:'/assets/learning/learning-evidence.js'});
 await page.evaluate(()=>{
  const s=CircuitEvidence.load();s.evidence.fixture={level:1};CircuitEvidence.save(s);
  localStorage.setItem('fixture-auxiliary','old');
 });
 await resetEvidence(page);
 expect(await page.evaluate(()=>({primary:localStorage.getItem(CircuitEvidence.KEY),aux:localStorage.getItem('fixture-auxiliary'),status:CircuitEvidence.storageStatus()}))).toEqual({primary:null,aux:null,status:{saved:true,reason:null}});
 await page.evaluate(()=>{const s=CircuitEvidence.load();s.evidence.fresh={level:2};CircuitEvidence.save(s);});
 await flushEvidence(page);await page.reload();await page.addScriptTag({url:'/assets/learning/learning-evidence.js'});
 expect(await page.evaluate(()=>CircuitEvidence.load().evidence)).toEqual({fresh:{level:2}});
});
