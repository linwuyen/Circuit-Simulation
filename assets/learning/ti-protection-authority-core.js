(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIProtectionAuthorityCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const defaults=Object.freeze({
    run:true,commandFresh:true,sensingValid:true,peripheralsReady:true,calibrationValid:true,
    softwareFault:false,faultInput:false,tripLatched:false,rearmQualified:false,
    requestedDuty:.5
  });

  function normalize(input={}){
    const s={...defaults,...input};
    for(const k of ["run","commandFresh","sensingValid","peripheralsReady","calibrationValid","softwareFault","faultInput","tripLatched","rearmQualified"])s[k]=!!s[k];
    s.requestedDuty=Number(s.requestedDuty);
    if(!Number.isFinite(s.requestedDuty)||s.requestedDuty<0||s.requestedDuty>1)throw new Error("requestedDuty out of range");
    return s;
  }

  function evaluate(input={}){
    const s=normalize(input);
    const blockers=[];
    if(!s.run)blockers.push("STATE_NOT_RUN");
    if(!s.commandFresh)blockers.push("COMMAND_STALE");
    if(!s.sensingValid)blockers.push("SENSING_INVALID");
    if(!s.peripheralsReady)blockers.push("PERIPHERALS_NOT_READY");
    if(!s.calibrationValid)blockers.push("CALIBRATION_INVALID");
    if(s.softwareFault)blockers.push("SOFTWARE_FAULT");
    const softwareGrant=blockers.length===0;
    const hardwareVeto=s.faultInput||s.tripLatched;
    const physicalPwm=softwareGrant&&!hardwareVeto;
    return Object.freeze({
      ...s,softwareGrant,hardwareVeto,physicalPwm,
      physicalDuty:physicalPwm?s.requestedDuty:0,
      blockers:Object.freeze(blockers),
      invariant:hardwareVeto?physicalPwm===false:true
    });
  }

  function injectFault(input={}){
    const s=normalize(input);
    return evaluate({...s,faultInput:true,tripLatched:true,rearmQualified:false});
  }

  function clearFaultSource(input={}){
    const s=normalize(input);
    return evaluate({...s,faultInput:false,rearmQualified:true});
  }

  function rearm(input={}){
    const s=normalize(input);
    if(s.faultInput)return Object.freeze({state:evaluate(s),accepted:false,reason:"fault input still active"});
    if(!s.tripLatched)return Object.freeze({state:evaluate(s),accepted:true,reason:"already clear"});
    if(!s.rearmQualified)return Object.freeze({state:evaluate(s),accepted:false,reason:"qualified clear not established"});
    return Object.freeze({state:evaluate({...s,tripLatched:false,rearmQualified:false}),accepted:true,reason:"qualified re-arm"});
  }

  function softwarePath(sandbox,input={}){
    if(!sandbox)throw new Error("timing owner required");
    const t=sandbox.timingWindow({
      controlPeriodUs:Number(input.controlPeriodUs??10),
      samplePct:Number(input.samplePct??50),
      adcLatencyUs:Number(input.adcLatencyUs??1.2),
      isrLatencyUs:Number(input.isrLatencyUs??.8),
      computeUs:Number(input.computeUs??1.7),
      pwmCommitUs:Number(input.pwmCommitUs??.3)
    });
    return Object.freeze({
      sampleUs:t.soc,
      decisionReadyUs:t.done,
      compareWriteUs:t.commit,
      nextHardwareLoadUs:t.closed?t.period:Math.ceil(t.commit/t.period)*t.period,
      boundary:"ISR-only shutdown cannot react before the next observation/decision/actuation opportunity."
    });
  }

  function analyzeMeasuredTrip(validation,capture={}){
    if(!validation)throw new Error("control validation owner required");
    const result=validation.analyzeTripLatency(capture);
    const provenance=capture.provenance&&capture.provenance.instrument&&capture.provenance.artifact&&capture.provenance.capturedAt;
    return Object.freeze({
      ...result,
      evidence:result.ready?(provenance?"PROVENANCE_BOUND_MEASURED":"UNVERIFIED_IMPORT"):"NONE",
      boardPassImplied:false
    });
  }

  function stateSequence(sandbox){
    if(!sandbox)throw new Error("state-machine owner required");
    return sandbox.runStateMachine(["precheck-pass","ready","run","fault","fault-clear","rearm","recover"]);
  }

  return {defaults,normalize,evaluate,injectFault,clearFaultSource,rearm,softwarePath,analyzeMeasuredTrip,stateSequence};
});
