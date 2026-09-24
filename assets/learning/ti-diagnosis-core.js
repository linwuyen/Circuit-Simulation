(function(root,factory){
  const api=factory(root,typeof require==="function"?require("../engineering-sandbox-core.js"):root.CircuitEngineeringSandboxCore);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIDiagnosis=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,S){
  "use strict";
  const measurements=["dmm","raw","scaled","duty","seq","timing","state"];
  const faults=Object.keys(S.FAULT_PRESETS);
  function caseFromSeed(seed=23){
    const c=S.multiFault(seed);
    return {seed:Number(seed),faults:[...c.faults],config:c.config,system:c.system,measurements:[],revealed:[],guess:[]};
  }
  function measure(session,id){
    if(!measurements.includes(id))throw new RangeError("unknown measurement");
    const row=S.measureSystem({system:session.system},id);
    return {...session,measurements:[...new Set([...session.measurements,id])],revealed:[...session.revealed,row]};
  }
  function diagnose(session,guess=[]){
    return S.diagnosticScore(session.faults,session.measurements,guess);
  }
  function symptom(session){
    const r=session.system,last=r.trace.at(-1);
    return {
      avgV:Number(r.summary.avgV.toFixed(2)),
      error:Number(r.summary.voltageError.toFixed(2)),
      misses:r.summary.missedCommits,
      commandLag:r.communication.maxLag,
      finalDuty:Number((last?.appliedDuty??0).toFixed(3)),
      state:r.state.state
    };
  }
  function recommendedInformation(fault){
    return {
      sensorGain:["dmm","raw","scaled"],
      staleCommand:["seq"],
      controlSign:["duty","dmm"],
      dutyClamp:["duty"],
      missedCommit:["timing","duty"]
    }[fault]||[];
  }
  function idealMeasurementSet(session){return [...new Set(session.faults.flatMap(recommendedInformation))];}
  function codeCase(id){return S.codeTrace(id);}
  return{measurements,faults,caseFromSeed,measure,diagnose,symptom,recommendedInformation,idealMeasurementSet,codeCase};
});
