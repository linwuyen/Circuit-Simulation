const {expect}=require('@playwright/test');
async function machineCount(page,labId){return page.evaluate(id=>CircuitEvidence.machineEvents(id).length,labId);}
async function waitForMachineEvidence(page,labId,before,inputs){
 // Read the durable store, not the in-memory draft. Require a new event with
 // this interaction's typed inputs so an earlier oracle result cannot satisfy it.
 await expect.poll(()=>page.evaluate(({labId,before,inputs})=>{
  const rows=JSON.parse(localStorage.getItem(CircuitEvidence.KEY)||'{}').evidence?.[labId]?.machine||[];
  return rows.slice(before).some(event=>{const contract=event.verification?.observableContract,actual=contract?.typed?.inputs||contract?.inputs;return actual&&Object.entries(inputs).every(([key,value])=>actual[key]===value);});
 },{labId,before,inputs})).toBe(true);
 await expect(page.locator('html')).toHaveAttribute('data-evidence-persistence','saved');
}
module.exports={machineCount,waitForMachineEvidence};
