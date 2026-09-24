import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
const require=createRequire(import.meta.url);
const E=require("../assets/learning/ti-evidence-ladder-core.js");
const board=JSON.parse(fs.readFileSync(new URL("../19_c2000_buck_firmware_lab/board/board-closure.template.json",import.meta.url),"utf8"));
const control=JSON.parse(fs.readFileSync(new URL("../19_c2000_buck_firmware_lab/board/control-validation.template.json",import.meta.url),"utf8"));

test("committed templates remain fail-closed",()=>{
  const r=E.summarize(board,control);
  assert.equal(r.board.computedClaim,"UNCLAIMED");
  assert.equal(r.control.overallPass,false);
  assert.equal(r.boardPassImpliedByControl,false);
  assert.equal(r.levels.at(-1).status,"UNCLAIMED");
});

test("browser dashboard never promotes unevaluated software layers",()=>{
  const r=E.summarize(board,control);
  for(const id of ["model","sil","hil","compile","link"]) assert.equal(r.levels.find(x=>x.id===id).status,"NOT_EVALUATED");
});

test("remaining actions enumerate physical closure work",()=>{
  const r=E.summarize(board,control);
  assert.ok(r.remainingActions.length>=10);
  assert.match(r.invariant,/cannot certify/);
});
