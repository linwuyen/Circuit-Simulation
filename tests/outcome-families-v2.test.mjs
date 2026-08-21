import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;
const Families = require(path.join(repoRoot, "assets", "learning", "outcome-families-v2.js"));
const Instrument = require(path.join(repoRoot, "assets", "learning", "outcome-core8-instrument-v2.js"));

function fingerprints(cases) { return cases.map(item => Benchmark.contentFingerprint(item)); }

test("core8 v2 keeps eight questions while exposing two families per competency", () => {
  assert.equal(Instrument.VERSION, 2);
  assert.deepEqual(Instrument.COMPETENCIES, Benchmark.CORE8_COMPETENCIES);
  for (const competency of Instrument.COMPETENCIES) {
    assert.equal(Instrument.FAMILY_CATALOG[competency].length, 2);
    assert.equal(new Set(Instrument.FAMILY_CATALOG[competency].map(row => row.id)).size, 2);
  }
  const cases = Instrument.generateBenchmarkSet({ seed:20260821, phase:"pre" });
  assert.equal(cases.length, 8);
  assert.deepEqual(cases.map(item => item.competency), Benchmark.CORE8_COMPETENCIES);
  assert.ok(cases.every(item => item.instrumentVersion === 2));
  assert.ok(cases.every(item => typeof item.familyId === "string" && typeof item.variantId === "string"));
});

test("family forms vary across seeds without changing phase burden", () => {
  const seen = Object.fromEntries(Benchmark.CORE8_COMPETENCIES.map(key => [key, new Set()]));
  for (const seed of [1,2,3,4,5,6,7,8]) {
    const cases = Instrument.generateBenchmarkSet({ seed, phase:"post" });
    assert.equal(cases.length, 8);
    for (const item of cases) seen[item.competency].add(item.familyId);
  }
  for (const competency of Benchmark.CORE8_COMPETENCIES) assert.equal(seen[competency].size, 2, competency);
});

test("scheduled v2 PRE/POST/R1-R4 remain visibly content-disjoint for one learner seed", () => {
  const phases = ["pre","post","r1","r2","r3","r4"];
  const all = phases.flatMap(phase => Instrument.generateBenchmarkSet({ seed:20260821, phase }));
  assert.equal(all.length, 48);
  assert.equal(new Set(fingerprints(all)).size, 48);
  assert.equal(new Set(all.map(item => item.id)).size, 48);
  assert.equal(Instrument.assertAllPhasesDisjoint({ seed:20260821 }), true);
});

test("same seed and phase is deterministic, and family contract fingerprint is seed-independent", () => {
  const a = Instrument.generateBenchmarkSet({ seed:77, phase:"pre" });
  const b = Instrument.generateBenchmarkSet({ seed:77, phase:"pre" });
  assert.deepEqual(a, b);
  assert.match(Instrument.familyContractFingerprint(), /^core8-families-v2-[0-9a-f]{8}$/);
});

test("timing v2 family delegates to authoritative strict shadow-load truth", () => {
  const seen = new Set();
  for (let seed = 0; seed < 16; seed += 1) {
    const item = Instrument.generateBenchmarkSet({ seed, phase:"pre" }).find(testCase =>
      testCase.competency === "timing" && testCase.familyId === "timing.shadow-load-deadline"
    );
    if (!item) continue;
    const truth = Benchmark.strictSampleToActuate({
      switchingHz:item.parameters.switchingHz,
      completionS:item.parameters.completionUs * 1e-6
    });
    assert.equal(item.expected.judgement, truth.firstLoadMet ? "met" : "missed");
    assert.equal(item.expected.commitUs, Number((truth.commitS * 1e6).toFixed(3)));
    seen.add(item.expected.judgement);
  }
  assert.equal(seen.has("met"), true);
  assert.equal(seen.has("missed"), true);

  const exact = Benchmark.strictSampleToActuate({ switchingHz:100000, completionS:10e-6 });
  assert.equal(exact.firstLoadMet, false);
  assert.equal(exact.commitCycle, 2);
});

test("v2 refuses longer forms instead of silently increasing learner burden", () => {
  assert.throws(() => Instrument.generateBenchmarkSet({ seed:1, phase:"pre", countPerCompetency:2 }), /exactly one item per competency/);
});
