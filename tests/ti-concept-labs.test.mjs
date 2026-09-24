import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require=createRequire(import.meta.url);
const Core=require("../assets/learning/ti-concept-lab-core.js");
const cards=JSON.parse(await readFile(new URL("../learning/ti/concept-cards.json",import.meta.url),"utf8"));
const labs=JSON.parse(await readFile(new URL("../learning/ti/concept-labs.json",import.meta.url),"utf8"));

test("all 15 TI Concept Cards have deterministic web lab closure",()=>{
  const v=Core.validate(cards,labs);
  assert.equal(v.valid,true,v.errors.join("\n"));
  assert.equal(v.cardCount,15);
  assert.equal(v.labCount,15);
});

test("concept lab preserves first attempt while allowing correction",()=>{
  let r={};
  r=Core.applyAttempt(r,"predict","wrong","right","2026-09-24T00:00:00Z");
  assert.equal(r.session.attempts.predict.firstAnswer,"wrong");
  assert.equal(r.session.attempts.predict.firstCorrect,false);
  assert.equal(Core.grade(r),"fail");
  r=Core.applyAttempt(r,"predict","right","right","2026-09-24T00:01:00Z");
  assert.equal(r.session.attempts.predict.firstAnswer,"wrong");
  assert.equal(r.session.attempts.predict.firstCorrect,false);
  assert.equal(r.session.attempts.predict.passed,true);
  assert.equal(Core.nextStage(r),"diagnose");
  assert.equal(Core.grade(r),"partial");
});

test("perfect predict diagnose transfer session grades TRANSFER",()=>{
  let r={};
  for(const stage of Core.STAGES)r=Core.applyAttempt(r,stage,"ok","ok");
  assert.equal(r.completed,true);
  assert.equal(Core.grade(r),"transfer");
  const review=Core.startReview(r,"2026-10-24T00:00:00Z");
  assert.equal(review.session.id,2);
  assert.equal(review.sessions.length,1);
  assert.equal(review.session.attempts.predict,undefined);
});

test("prerequisites accept either generic concept completion or specialized Buck completion",()=>{
  const boost=cards.cards.find(c=>c.id==="boost-rhpz");
  assert.equal(Core.prerequisiteStatus(boost,{benchmark:{}}).unlocked,false);
  assert.equal(Core.prerequisiteStatus(boost,{benchmark:{tiConceptLabs:{"buck-energy-flow":{completed:true}}}}).unlocked,true);
  assert.equal(Core.prerequisiteStatus(boost,{benchmark:{tiEngineeringLearning:{concepts:{"buck-energy-flow":{progress:4}}}}}).unlocked,true);
});
