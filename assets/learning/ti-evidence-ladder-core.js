(function(root,factory){
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIEvidenceLadderCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const SOFTWARE_STAGES=Object.freeze([
    {id:"model",label:"Web / deterministic model",claim:"MODEL_EVIDENCE"},
    {id:"hostSil",label:"Host SIL",claim:"HOST_SIL"},
    {id:"hil",label:"Deterministic HIL",claim:"DETERMINISTIC_HIL"},
    {id:"c2000Compile",label:"C2000 compile",claim:"C2000_COMPILE"},
    {id:"linkedImage",label:"C2000 link + Flash image",claim:"TARGET_IMAGE_EVIDENCE"}
  ]);
  const nonEmpty=v=>typeof v==="string"&&v.trim().length>0;
  const iso=v=>nonEmpty(v)&&Number.isFinite(Date.parse(v));
  const digest=v=>nonEmpty(v)&&/^[a-f0-9]{64}$/i.test(v);
  function softwareRow(id,label,input,priorPassed){
    const value=input&&typeof input==="object"?input:{};
    const provenance=nonEmpty(value.artifact)&&digest(value.sha256)&&iso(value.generatedAt);
    const declared=value.status==="PASS";
    const pass=priorPassed&&declared&&provenance;
    const reason=!priorPassed?"dependency not PASS":!declared?"status not PASS":!provenance?"artifact/sha256/generatedAt provenance missing":"PASS";
    return Object.freeze({id,label,declared,provenance,pass,reason,artifact:provenance?value.artifact:null});
  }
  function evaluateSoftware(input={}){
    let prior=true;
    const rows=SOFTWARE_STAGES.map(stage=>{
      const row=softwareRow(stage.id,stage.label,input[stage.id],prior);
      prior=row.pass;
      return row;
    });
    const highestRow=[...rows].reverse().find(row=>row.pass)||null;
    const stage=highestRow?SOFTWARE_STAGES.find(x=>x.id===highestRow.id):null;
    return Object.freeze({rows:Object.freeze(rows),allPassed:rows.every(r=>r.pass),highest:highestRow?.id||null,claim:stage?.claim||null});
  }
  function evaluate({software={},boardPackage={},controlBundle={}}={},deps={}){
    const Closure=deps.Closure||root.CircuitPhysicalBoardClosureV1;
    const Control=deps.Control||root.CircuitControlValidationV1;
    if(!Closure||!Control)throw new Error("physical closure/control validation dependencies missing");
    const softwareResult=evaluateSoftware(software);
    const board=Closure.validatePackage(boardPackage);
    const control=Control.validateBundle(controlBundle);
    const boardPass=board.computedClaim==="BOARD_PASS"&&board.claimValid;
    const controlPass=control.status==="CONTROL_VALIDATION_PASS"&&control.overallPass;
    const claimCeiling=boardPass&&controlPass
      ?"BOARD_PASS + CONTROL_VALIDATION_PASS"
      :boardPass?"BOARD_PASS"
      :softwareResult.claim?softwareResult.claim
      :"UNCLAIMED";
    const blockers=[];
    for(const row of softwareResult.rows.filter(r=>!r.pass))blockers.push("software:"+row.id+" — "+row.reason);
    if(!boardPass)blockers.push(...board.remainingActions.map(x=>"board:"+x));
    if(!controlPass){
      if(!control.capturesValid)blockers.push("control:four provenance-bound captures required");
      if(!control.analysesReady)blockers.push("control:load-step/timing/trip/SFRA analyses incomplete");
      else if(!control.analysesPass)blockers.push("control:one or more measured acceptance criteria failed");
    }
    return Object.freeze({
      software:softwareResult,
      board,
      control,
      boardPass,
      controlPass,
      claimCeiling,
      blockers:Object.freeze(blockers),
      invariant:"lower-layer PASS never upgrades physical or measured-control truth"
    });
  }
  return Object.freeze({SOFTWARE_STAGES,evaluateSoftware,evaluate});
});
