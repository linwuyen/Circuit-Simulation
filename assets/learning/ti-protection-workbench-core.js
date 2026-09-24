(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIProtectionWorkbenchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const bool=v=>v!==false;
  function analyze(input={},deps={}){
    const Models=deps.Models||globalThis.CircuitPowerModelsV1;
    const initial=deps.initial||globalThis.CircuitPowerSystemStateV1?.initial;
    if(!Models||!initial)throw new Error("protection workbench dependencies missing");
    const thresholdA=Number(input.thresholdA??initial.safety.thresholdA);
    const currentA=Number(input.currentA??initial.safety.currentA);
    if(!Number.isFinite(thresholdA)||!Number.isFinite(currentA)||thresholdA<=0)throw new RangeError("invalid protection current");
    const factors=Object.freeze({
      run:bool(input.run),
      commandFresh:bool(input.commandFresh),
      sensingValid:bool(input.sensingValid),
      peripheralsReady:bool(input.peripheralsReady),
      calibrationValid:bool(input.calibrationValid)
    });
    const softwareBlockers=Object.entries(factors).filter(([,ok])=>!ok).map(([name])=>name);
    const softwareGrant=softwareBlockers.length===0;
    const comparatorFault=currentA>=thresholdA;
    const tripLatched=!!input.tripLatched;
    const hardwareVeto=comparatorFault||tripLatched;
    const requestedDuty=Number(input.requestedDuty??initial.plant.duty);
    const physicalDuty=softwareGrant&&!hardwareVeto?requestedDuty:0;
    const timing=Models.timingState(initial);
    const clearEligible=!comparatorFault&&tripLatched&&softwareGrant;
    return Object.freeze({
      factors,softwareBlockers,softwareGrant,
      thresholdA,currentA,comparatorFault,tripLatched,hardwareVeto,
      requestedDuty,physicalDuty,clearEligible,
      softwareBestAlignedUs:timing.actuation,
      hardwareLatencyClaim:"MEASURE_REQUIRED",
      invariant:"hardware veto is independent of software PWM grant"
    });
  }
  function nextLatch(current,input={}){
    if(input.injectFault)return true;
    if(input.requestClear){
      const a=current||{};
      if(a.comparatorFault)throw new Error("cannot clear trip while fault input is active");
      if(!a.softwareGrant)throw new Error("cannot re-arm while software readiness contract is false");
      return false;
    }
    return !!current?.tripLatched;
  }
  return Object.freeze({analyze,nextLatch});
});
