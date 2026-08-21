import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Calibration = require(path.join(repoRoot, "assets", "learning", "outcome-calibration-v1.js"));
const CORE = Calibration.PROFILE_COMPETENCIES.core8;

function phaseStatus(phase, learner) {
  const cases = CORE.map((competency, index) => ({
    id:`${phase}-${competency}-v${index}-s20260821`,
    phase,
    competency,
    answerType:"choice",
    prompt:`${phase}-${competency}`,
    choices:["a","b"],
    expected:"a",
    parameters:{index}
  }));
  const complete = phase === "post";
  return {
    phase,
    attempted:complete ? 8 : 0,
    total:8,
    completed:complete,
    cases,
    score:complete ? {
      rows:cases.map((item,index)=>({
        caseId:item.id,
        phase,
        competency:item.competency,
        attempted:true,
        correct:(learner+index)%2===0
      }))
    } : null
  };
}

function summary(learner) {
  return {
    seed:20260821,
    profile:"core8",
    countPerCompetency:1,
    pre:phaseStatus("pre",learner),
    post:phaseStatus("post",learner),
    retention:["r1","r2","r3","r4"].map(phase=>phaseStatus(phase,learner))
  };
}

test("calibration CLI emits phase-specific JSON summary", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-cal-"));
  const files = [0,1].map(index => {
    const file = path.join(dir, `p_${index}.json`);
    fs.writeFileSync(file, JSON.stringify(Calibration.exportParticipant(summary(index), { participantId:`p_${index}` })));
    return file;
  });
  const cli = path.join(repoRoot, "tools", "learning", "calibrate-outcome-items.mjs");
  const run = spawnSync(process.execPath, [cli, "--phase", "post", ...files], { encoding:"utf8" });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.phase, "post");
  assert.equal(result.completed, 2);
  assert.equal(result.evidenceStatus, "insufficient");
});
