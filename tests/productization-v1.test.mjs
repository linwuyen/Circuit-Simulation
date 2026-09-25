import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const P=require("../assets/learning/productization-v1.js");
test("product tiers never upgrade engineering evidence",()=>{assert.equal(P.assertEvidenceInvariant(),true);for(const id of ["free","pro","engineering"])assert.equal(P.tier(id).evidenceCeiling,"unchanged");});
test("productization reuses V5 backup boundary",()=>{assert.equal(P.STATE_SCHEMA,"circuit-learning-state-v5");let calls=0;const payload=P.exportBoundary({exportBackup(){calls++;return "v5-backup";}});assert.equal(payload,"v5-backup");assert.equal(calls,1);});
test("packaging changes access only, not truth",()=>{assert.equal(P.canAccess("free","board-evidence-import"),false);assert.equal(P.canAccess("engineering","board-evidence-import"),true);assert.throws(()=>P.tier("enterprise"),/unknown product tier/);assert.equal(P.releaseDescriptor().evidenceRule,"tier-never-upgrades-evidence");});
