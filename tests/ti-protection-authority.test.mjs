import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const A=require("../assets/learning/ti-protection-authority-core.js");

test("software grant requires every production condition",()=>{
  assert.equal(A.evaluate({}).softwareGrant,true);
  for(const key of ["run","commandFresh","sensingValid","noFault","peripheralsReady","calibrationValid"]){
    const r=A.evaluate({[key]:false});
    assert.equal(r.softwareGrant,false,key);
    assert.equal(r.pwmAllowed,false,key);
  }
});

test("hardware trip vetoes a valid software grant",()=>{
  const r=A.evaluate({cmpFault:true,tripEnabled:true});
  assert.equal(r.softwareGrant,true);
  assert.equal(r.hardwareTrip,true);
  assert.equal(r.pwmAllowed,false);
  assert.equal(r.owner,"HARDWARE_TRIP");
  assert.ok(r.hardwareSafeUs<r.softwareSafeUs);
});

test("trip disabled exposes the difference between software and hardware authority",()=>{
  const r=A.evaluate({cmpFault:true,tripEnabled:false});
  assert.equal(r.hardwareTrip,false);
  assert.equal(r.pwmAllowed,true);
  assert.equal(r.hardwareSafeUs,null);
});

test("authority matrix covers stale command sensing calibration and trip",()=>{
  const rows=A.matrix();
  assert.ok(rows.find(r=>r.id==="stale-command"&&!r.softwareGrant));
  assert.ok(rows.find(r=>r.id==="hardware-trip"&&r.owner==="HARDWARE_TRIP"));
});
