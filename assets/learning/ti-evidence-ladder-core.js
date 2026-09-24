(function(root,factory){
  const api=factory(
    root,
    typeof require==="function"?require("./physical-board-closure-v1.js"):root.CircuitPhysicalBoardClosureV1,
    typeof require==="function"?require("./control-validation-v1.js"):root.CircuitControlValidationV1
  );
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIEvidenceLadder=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,Closure,Validation){
  "use strict";
  const levels=Object.freeze([
    {id:"model",label:"Teaching model",truth:"MODEL_ONLY"},
    {id:"sil",label:"Host SIL",truth:"SOFTWARE_SIMULATION"},
    {id:"hil",label:"Deterministic HIL",truth:"DETERMINISTIC_HIL"},
    {id:"compile",label:"TI C2000 compile",truth:"TARGET_COMPILE"},
    {id:"link",label:"Linked Flash image",truth:"TARGET_IMAGE"},
    {id:"physical",label:"P4-A physical closure",truth:"PHYSICAL_CLOSURE"},
    {id:"control",label:"P4-B control validation",truth:"MEASURED_CONTROL"},
    {id:"board",label:"BOARD_PASS",truth:"PHYSICAL_BOARD_EVIDENCE"}
  ]);
  function summarize(boardPackage={},controlBundle={},software={}){
    const board=Closure.validatePackage(boardPackage),control=Validation.validateBundle(controlBundle);
    const sw={model:software.model||"NOT_EVALUATED",sil:software.sil||"NOT_EVALUATED",hil:software.hil||"NOT_EVALUATED",compile:software.compile||"NOT_EVALUATED",link:software.link||"NOT_EVALUATED"};
    const state={
      model:{status:sw.model,detail:"Browser dashboard does not fabricate model test results."},
      sil:{status:sw.sil,detail:"Use repository validation evidence."},
      hil:{status:sw.hil,detail:"Use deterministic HIL workflow evidence."},
      compile:{status:sw.compile,detail:"Use pinned TI toolchain build evidence."},
      link:{status:sw.link,detail:"Require linked .out/.map/.hex evidence."},
      physical:{status:board.flashPassed&&board.bindingsVerified&&board.evidencePassed?"PASS":"MISSING",detail:`bindings ${board.bindingRows.filter(r=>r.valid).length}/${board.bindingRows.length} · physical captures ${board.evidenceRows.filter(r=>r.valid).length}/${board.evidenceRows.length}`},
      control:{status:control.overallPass?"CONTROL_VALIDATION_PASS":"INCOMPLETE_OR_FAIL",detail:`captures ${control.captureRows.filter(r=>r.valid).length}/${control.captureRows.length} · analyses ${control.analysesPass?"PASS":"INCOMPLETE/FAIL"}`},
      board:{status:board.computedClaim,detail:board.computedClaim==="BOARD_PASS"?"all physical closure gates passed":"lower-layer PASS cannot promote this level"}
    };
    return {
      levels:levels.map(x=>({...x,...state[x.id]})),
      board,control,
      boardPassImpliedByControl:false,
      remainingActions:board.remainingActions,
      invariant:"A lower truth level cannot certify a higher truth level."
    };
  }
  return{levels,summarize};
});
