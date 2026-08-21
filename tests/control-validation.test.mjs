import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Validation = require(path.join(root, "assets", "learning", "control-validation-v1.js"));

const sha = "b".repeat(64);
const capturedAt = "2026-08-21T03:30:48.000Z";
const capture = id => ({ artifact:`evidence/${id}.csv`, sha256:sha, instrument:"sanitized-scope", capturedAt });

function passingBundle() {
  const samples = [];
  for (let i = 0; i <= 40; i += 1) {
    const tMs = i * 0.5;
    let vout = 12;
    if (tMs >= 5 && tMs < 7) vout = 11.2 + (tMs - 5) * 0.3;
    else if (tMs >= 7 && tMs < 9) vout = 11.8 + (tMs - 7) * 0.1;
    samples.push({ tMs, vout, iL:4 + (tMs >= 5 ? 1 : 0) });
  }
  const model = [100, 300, 1000, 3000, 10000].map((frequencyHz, index) => ({ frequencyHz, magnitudeDb:20-index*5, phaseDeg:-10-index*15 }));
  const measured = model.map(row => ({ frequencyHz:row.frequencyHz, magnitudeDb:row.magnitudeDb+0.5, phaseDeg:row.phaseDeg-2 }));
  return {
    captures:{ loadStep:capture("load"), timing:capture("timing"), trip:capture("trip"), sfra:capture("sfra") },
    loadStep:{ stepAtMs:5, vref:12, tolerancePct:2, maxDroopPct:10, maxOvershootPct:10, maxSettlingMs:10, samples },
    timing:{ periodUs:10, computeDoneUs:5.5, observedCommitUs:10, minSlackUs:0.5, commitToleranceUs:0.05 },
    trip:{ faultAtNs:1000, pwmLowAtNs:1230, maxLatencyNs:500 },
    sfra:{ magToleranceDb:3, phaseToleranceDeg:20, model, measured }
  };
}

test("P4-B strict timing retains exactly-on-load miss semantics", () => {
  assert.equal(Validation.strictCommit(10, 5.5).commitUs, 10);
  assert.equal(Validation.strictCommit(10, 10).commitUs, 20);
  assert.equal(Validation.strictCommit(10, 10).firstLoadMet, false);
});

test("P4-B passing physical bundle yields CONTROL_VALIDATION_PASS but never BOARD_PASS", () => {
  const result = Validation.validateBundle(passingBundle());
  assert.equal(result.overallPass, true);
  assert.equal(result.status, "CONTROL_VALIDATION_PASS");
  assert.equal(result.loadStep.pass, true);
  assert.equal(result.timing.pass, true);
  assert.equal(result.trip.pass, true);
  assert.equal(result.sfra.pass, true);
  assert.equal(result.boardPassImplied, false);
});

test("P4-B bad hardware trip or missing provenance fails closed", () => {
  const slowTrip = passingBundle();
  slowTrip.trip.pwmLowAtNs = 2500;
  assert.equal(Validation.validateBundle(slowTrip).trip.pass, false);
  assert.equal(Validation.validateBundle(slowTrip).overallPass, false);

  const noCapture = passingBundle();
  noCapture.captures.sfra.sha256 = "bad";
  const result = Validation.validateBundle(noCapture);
  assert.equal(result.capturesValid, false);
  assert.equal(result.overallPass, false);
});

test("P4-B Bode comparator interpolates model points on log frequency", () => {
  const result = Validation.compareBode({
    model:[
      { frequencyHz:100, magnitudeDb:20, phaseDeg:-10 },
      { frequencyHz:1000, magnitudeDb:0, phaseDeg:-70 },
      { frequencyHz:10000, magnitudeDb:-20, phaseDeg:-130 }
    ],
    measured:[
      { frequencyHz:316.227766, magnitudeDb:10.5, phaseDeg:-38 },
      { frequencyHz:3162.27766, magnitudeDb:-9.5, phaseDeg:-102 }
    ],
    magToleranceDb:2,
    phaseToleranceDeg:10
  });
  assert.equal(result.ready, true);
  assert.equal(result.pass, true);
  assert.equal(result.matchedPoints, 2);
});
