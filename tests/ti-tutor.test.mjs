import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-tutor-core.js");
const cards=JSON.parse(fs.readFileSync("learning/ti/concept-cards.json","utf8")).cards;
const manifest=JSON.parse(fs.readFileSync("learning/ti/manifest.json","utf8")).documents;
const buck=cards.find(x=>x.id==="buck-energy-flow");
const docs=manifest.filter(x=>buck.sourceIds.includes(x.id));

function stateWithPrediction(answer){
  return {
    predictions:{
      "ti:buck-energy-flow":{
        revisions:[{prediction:answer,preRegistered:true,committedAt:"2026-09-24T12:00:00Z"}]
      }
    },
    evidence:{}
  };
}

test("tutor has an explicit causal chain for every TI Concept Card",()=>{
  const ids=cards.map(x=>x.id).sort();
  const covered=Object.keys(Core.CHAINS).sort();
  assert.deepEqual(covered,ids);
  assert.ok(Object.values(Core.CHAINS).every(chain=>Array.isArray(chain)&&chain.length>=3));
});

test("prediction integrity blocks model coaching before a committed prediction",()=>{
  const packet=Core.buildPacket({concept:buck,record:{},state:{predictions:{},evidence:{}},sourceDocs:docs});
  const gap=Core.firstGap(packet);
  assert.equal(packet.predictionCommitted,false);
  assert.equal(gap.id,"prediction-lock");
  assert.match(gap.question,/先不要看來源或答案/);
  const request=Core.providerRequest(packet);
  assert.equal(request.policy.revealSolutionBeforePrediction,false);
  assert.equal(request.policy.evidenceEscalationAllowed,false);
});

test("tutor asks only the first missing causal link, then asks for falsifying evidence",()=>{
  const state=stateWithPrediction("Duty changes ON time.");
  const packet=Core.buildPacket({concept:buck,record:{},state,sourceDocs:docs});
  const gap=Core.firstGap(packet);
  assert.equal(gap.id,"state-vl");
  assert.equal(gap.dimension,"causal-link");

  const complete="Duty changes ON time; switch state sets vL; vL=L di/dt sets slope; over time this produces ΔiL and changes iL.";
  const completePacket=Core.buildPacket({concept:buck,record:{firstAnswer:complete},state:stateWithPrediction(complete),sourceDocs:docs});
  assert.equal(Core.firstGap(completePacket).id,"missing-evidence");

  const machineState=stateWithPrediction(complete);
  machineState.evidence["ti:buck-energy-flow"]={
    strength:"none",
    machine:[{at:"2026-09-24T12:01:00Z",snapshot:{deltaI:1.2},verification:{passed:false}}]
  };
  const evidencePacket=Core.buildPacket({concept:buck,record:{firstAnswer:complete},state:machineState,sourceDocs:docs});
  assert.equal(Core.firstGap(evidencePacket).id,"falsification");
});

test("transfer mode asks for boundary failure after causal and machine evidence exist",()=>{
  const answer="Duty changes ON time; switch state sets vL; vL=L di/dt sets slope; over time this produces ΔiL and changes iL.";
  const state=stateWithPrediction(answer);
  state.evidence["ti:buck-energy-flow"]={machine:[{at:"2026-09-24T12:01:00Z",snapshot:{deltaI:1.2}}]};
  const packet=Core.buildPacket({concept:buck,record:{firstAnswer:answer,activeMode:"transfer"},state,sourceDocs:docs});
  assert.equal(Core.firstGap(packet).id,"transfer-boundary");
});

test("provider packet is source-closed and coach response cannot fabricate citations or evidence grade",()=>{
  const answer="Duty changes ON time.";
  const packet=Core.buildPacket({concept:buck,record:{firstAnswer:answer},state:stateWithPrediction(answer),sourceDocs:docs});
  const req=Core.providerRequest(packet);
  assert.deepEqual(req.groundTruth.sources.map(x=>x.id),buck.sourceIds);

  const valid=Core.validateCoachResponse({
    grade:"partial",
    correctiveQuestion:"What does switch state do to vL?",
    evidenceRequest:"Which waveform changes first?",
    sourceIds:["SLVA057"],
    evidenceStrength:"none"
  },packet);
  assert.equal(valid.valid,true);

  const foreign=Core.validateCoachResponse({
    grade:"pass",correctiveQuestion:"q",evidenceRequest:"e",sourceIds:["SLVA061"],evidenceStrength:"none"
  },packet);
  assert.equal(foreign.valid,false);
  assert.ok(foreign.errors.some(x=>/sourceIds/.test(x)));

  const fakePage=Core.validateCoachResponse({
    grade:"pass",correctiveQuestion:"See page 12",evidenceRequest:"e",sourceIds:["SLVA057"],evidenceStrength:"B"
  },packet);
  assert.equal(fakePage.valid,false);
  assert.ok(fakePage.errors.some(x=>/page\/section/.test(x)));
  assert.ok(fakePage.errors.some(x=>/upgrade evidence/.test(x)));
});

test("provider request never contains invented page or section locations",()=>{
  const packet=Core.buildPacket({concept:buck,record:{},state:stateWithPrediction("Duty changes ON time."),sourceDocs:docs});
  const serialized=JSON.stringify(Core.providerRequest(packet));
  assert.doesNotMatch(serialized,/pageNumber|sectionNumber|page\s*:\s*\d/i);
  assert.match(serialized,/SLVA057/);
});
