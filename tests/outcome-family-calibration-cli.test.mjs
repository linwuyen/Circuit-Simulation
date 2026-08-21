import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;
const Families = require(path.join(repoRoot, "assets", "learning", "outcome-families-v2.js"));
const Calibration = require(path.join(repoRoot, "assets", "learning", "outcome-calibration-v1.js"));

function phaseStatus(seed, phase, learner) {
  const cases = Families.generateBenchmarkSet({ seed, phase });
  const complete = phase === "post";
  return {
    phase,
    profile:"core8",
    instrumentVersion:2,
    attempted:complete ? cases.length : 0,
    total:cases.length,
    completed:complete,
    cases,
    score:complete ? { rows:cases.map((item,index)=>({ caseId:item.id, phase, competency:item.competency, attempted:true, correct:(learner+index)%3!==0 })) } : null
  };
}

function summary(seed, learner) {
  return {
    seed,
    profile:"core8",
    instrumentVersion:2,
    familyContractFingerprint:Families.contractFingerprint(),
    countPerCompetency:1,
    pre:phaseStatus(seed,"pre",learner),
    post:phaseStatus(seed,"post",learner),
    retention:["r1","r2","r3","r4"].map(phase=>phaseStatus(seed,phase,learner))
  };
}

test("family calibration CLI accepts mixed v2 forms and emits family summary", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-family-cal-"));
  const files = [0,1,2,3].map(index => {
    const file = path.join(dir, `f_${index}.json`);
    const bundle = Calibration.exportParticipant(summary(700+index,index), { participantId:`f_${index}` });
    fs.writeFileSync(file, JSON.stringify(bundle));
    return file;
  });
  const cli = path.join(repoRoot, "tools", "learning", "calibrate-outcome-families.mjs");
  const run = spawnSync(process.execPath, [cli, "--phase", "post", ...files], { encoding:"utf8" });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.schema, "circuit-outcome-family-calibration-summary");
  assert.equal(result.phase, "post");
  assert.equal(result.completed, 4);
  assert.equal(result.instrumentVersion, 2);
  assert.ok(result.families.length > 8);
});
