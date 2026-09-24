import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-evidence-ladder-core.js");
const Closure=require("../assets/learning/physical-board-closure-v1.js");
const Control=require("../assets/learning/control-validation-v1.js");
const boardTemplate=JSON.parse(fs.readFileSync("19_c2000_buck_firmware_lab/board/board-closure.template.json","utf8"));
const controlTemplate=JSON.parse(fs.readFileSync("19_c2000_buck_firmware_lab/board/control-validation.template.json","utf8"));
const when="2026-09-24T12:00:00.000Z";
const sha="a".repeat(64);
const provenance=name=>({status:"PASS",artifact:"artifact/"+name,sha256:sha,generatedAt:when});

function completeSoftware(){
  return Object.fromEntries(Core.SOFTWARE_STAGES.map(x=>[x.id,provenance(x.id)]));
}
function completeBoard(){
  const pkg=structuredClone(boardTemplate);
  pkg.requestedClaim="BOARD_PASS";
  pkg.boardIdentity={target:"sanitized-f2838x-lab",revision:"rev-a",mcu:"TMS320F2838x"};
  pkg.flash={status:"PASS",imageArtifact:"firmware.out",ccxmlArtifact:"target.ccxml",probe:"XDS110",flashedAt:when,resetBootObserved:true};
  for(const[id,b]of Object.entries(pkg.bindings)){
    b.status="VERIFIED";b.source={kind:"sanitized-record",ref:"bindings/"+id,verifiedAt:when};
  }
  for(const item of pkg.evidence){
    item.status="PASS";item.accepted=true;
    item.artifact={ref:"capture/"+item.id+".png",sha256:sha,instrument:"scope",capturedAt:when};
  }
  return pkg;
}
function capture(id){return{artifact:"capture/"+id,sha256:sha,instrument:"scope",capturedAt:when};}
function completeControl(){
  const bundle=structuredClone(controlTemplate);
  bundle.captures={loadStep:capture("load"),timing:capture("timing"),trip:capture("trip"),sfra:capture("sfra")};
  bundle.loadStep={
    stepAtMs:1,vref:12,tolerancePct:2,maxDroopPct:10,maxOvershootPct:10,maxSettlingMs:20,
    samples:[
      {tMs:0,vout:12},{tMs:1,vout:11.4},{tMs:2,vout:11.8},
      {tMs:3,vout:11.9},{tMs:4,vout:12.0},{tMs:5,vout:12.05}
    ]
  };
  bundle.timing={periodUs:10,computeDoneUs:4,observedCommitUs:10,minSlackUs:.5,commitToleranceUs:.05};
  bundle.trip={faultAtNs:100,pwmLowAtNs:500,maxLatencyNs:1000};
  bundle.sfra={
    magToleranceDb:3,phaseToleranceDeg:20,
    model:[
      {frequencyHz:100,magnitudeDb:20,phaseDeg:-80},
      {frequencyHz:1000,magnitudeDb:0,phaseDeg:-120},
      {frequencyHz:10000,magnitudeDb:-20,phaseDeg:-170}
    ],
    measured:[
      {frequencyHz:100,magnitudeDb:20,phaseDeg:-80},
      {frequencyHz:1000,magnitudeDb:0,phaseDeg:-120},
      {frequencyHz:10000,magnitudeDb:-20,phaseDeg:-170}
    ]
  };
  return bundle;
}

test("software evidence ladder cannot skip dependencies or omit provenance",()=>{
  const skipped={linkedImage:provenance("linked")};
  const result=Core.evaluateSoftware(skipped);
  assert.equal(result.highest,null);
  assert.equal(result.rows.find(x=>x.id==="linkedImage").pass,false);
  assert.match(result.rows.find(x=>x.id==="linkedImage").reason,/dependency/);

  const missingDigest=completeSoftware();delete missingDigest.hil.sha256;
  const broken=Core.evaluateSoftware(missingDigest);
  assert.equal(broken.highest,"hostSil");
  assert.equal(broken.rows.find(x=>x.id==="hil").pass,false);
  assert.equal(broken.rows.find(x=>x.id==="c2000Compile").pass,false);
});

test("repository P4 templates remain fail-closed and unclaimed",()=>{
  const result=Core.evaluate({software:{},boardPackage:boardTemplate,controlBundle:controlTemplate},{Closure,Control});
  assert.equal(result.claimCeiling,"UNCLAIMED");
  assert.equal(result.boardPass,false);
  assert.equal(result.controlPass,false);
  assert.equal(result.board.computedClaim,"UNCLAIMED");
  assert.equal(result.control.status,"INCOMPLETE_OR_FAIL");
  assert.ok(result.blockers.length>10);
});

test("complete software provenance reaches linked-image ceiling without manufacturing hardware truth",()=>{
  const result=Core.evaluate({software:completeSoftware(),boardPackage:boardTemplate,controlBundle:controlTemplate},{Closure,Control});
  assert.equal(result.software.allPassed,true);
  assert.equal(result.software.highest,"linkedImage");
  assert.equal(result.claimCeiling,"LINKEDIMAGE");
  assert.equal(result.boardPass,false);
  assert.equal(result.controlPass,false);
});

test("BOARD_PASS and CONTROL_VALIDATION_PASS remain independent authoritative gates",()=>{
  const boardOnly=Core.evaluate({software:completeSoftware(),boardPackage:completeBoard(),controlBundle:controlTemplate},{Closure,Control});
  assert.equal(boardOnly.boardPass,true);
  assert.equal(boardOnly.controlPass,false);
  assert.equal(boardOnly.claimCeiling,"BOARD_PASS");
  assert.equal(boardOnly.control.boardPassImplied,false);

  const both=Core.evaluate({software:completeSoftware(),boardPackage:completeBoard(),controlBundle:completeControl()},{Closure,Control});
  assert.equal(both.boardPass,true);
  assert.equal(both.controlPass,true);
  assert.equal(both.board.computedClaim,"BOARD_PASS");
  assert.equal(both.control.status,"CONTROL_VALIDATION_PASS");
  assert.equal(both.claimCeiling,"BOARD_PASS + CONTROL_VALIDATION_PASS");
});

test("failed measured control criterion cannot be hidden by a valid physical closure",()=>{
  const bad=completeControl();bad.trip.pwmLowAtNs=2000;
  const result=Core.evaluate({software:completeSoftware(),boardPackage:completeBoard(),controlBundle:bad},{Closure,Control});
  assert.equal(result.boardPass,true);
  assert.equal(result.controlPass,false);
  assert.equal(result.control.trip.pass,false);
  assert.equal(result.claimCeiling,"BOARD_PASS");
});
