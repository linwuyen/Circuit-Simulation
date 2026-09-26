(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitProductizationV1=api;
})(globalThis,function(){
  "use strict";
  const VERSION="1.0.0";
  const STATE_SCHEMA="circuit-learning-state-v5";
  const TIERS=Object.freeze({
    free:Object.freeze({id:"free",capabilities:Object.freeze(["learning-workspace","ti-concept-cards","local-backup"]),evidenceCeiling:"unchanged"}),
    pro:Object.freeze({id:"pro",capabilities:Object.freeze(["learning-workspace","ti-concept-cards","local-backup","advanced-workbenches","ai-tutor-adapter"]),evidenceCeiling:"unchanged"}),
    engineering:Object.freeze({id:"engineering",capabilities:Object.freeze(["learning-workspace","ti-concept-cards","local-backup","advanced-workbenches","ai-tutor-adapter","sil-hil-import","board-evidence-import"]),evidenceCeiling:"unchanged"})
  });
  function tier(id){const value=TIERS[id];if(!value)throw new Error("unknown product tier: "+id);return value;}
  function canAccess(id,capability){return tier(id).capabilities.includes(capability);}
  function assertEvidenceInvariant(){for(const value of Object.values(TIERS))if(value.evidenceCeiling!=="unchanged")throw new Error("product tier must not upgrade engineering evidence");return true;}
  function exportBoundary(evidenceApi){if(!evidenceApi||typeof evidenceApi.exportBackup!=="function")throw new Error("CircuitEvidence.exportBackup required");return evidenceApi.exportBackup();}
  function releaseDescriptor(){return Object.freeze({product:"Circuit Simulation Learning Pack",releaseVersion:VERSION,stateSchema:STATE_SCHEMA,evidenceRule:"tier-never-upgrades-evidence",offlineShell:"cache-static-only",telemetry:"opt-in-no-learner-answers"});}
  return Object.freeze({VERSION,STATE_SCHEMA,TIERS,tier,canAccess,assertEvidenceInvariant,exportBoundary,releaseDescriptor});
});
