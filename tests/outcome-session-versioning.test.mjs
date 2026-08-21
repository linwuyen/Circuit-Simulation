import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Benchmark = require(path.join(repoRoot, "assets", "learning", "outcome-benchmark-v1.js"));
globalThis.CircuitOutcomeBenchmarkV1 = Benchmark;

test("pre-version core8 evidence remains pinned to instrumentVersion 1", () => {
  let state = {
    benchmark:{
      outcomeV1:{
        seed:20260821,
        profile:"core8",
        countPerCompetency:1,
        sessions:{},
        retention:{},
        createdAt:"2026-08-21T00:00:00Z"
      }
    },
    events:[]
  };
  globalThis.CircuitEvidence = {
    load:() => JSON.parse(JSON.stringify(state)),
    save:value => { state = JSON.parse(JSON.stringify(value)); return JSON.parse(JSON.stringify(state)); }
  };
  const modulePath = path.join(repoRoot, "assets", "learning", "outcome-session-v1.js");
  delete require.cache[require.resolve(modulePath)];
  const Session = require(modulePath);
  const record = Session.loadRecord();
  assert.equal(record.instrumentVersion, 1);
  const cases = Session.phaseStatus("pre").cases;
  assert.ok(cases.every(item => item.instrumentVersion == null));
  assert.equal(cases[0].id, Benchmark.generateBenchmarkSet({ seed:20260821, phase:"pre", profile:"core8" })[0].id);
  delete globalThis.CircuitEvidence;
});

test("fresh core8 evidence uses instrumentVersion 2 family forms", () => {
  delete globalThis.CircuitEvidence;
  const modulePath = path.join(repoRoot, "assets", "learning", "outcome-session-v1.js");
  delete require.cache[require.resolve(modulePath)];
  const Session = require(modulePath);
  Session.reset();
  const record = Session.loadRecord();
  assert.equal(record.profile, "core8");
  assert.equal(record.instrumentVersion, 2);
  const summary = Session.summary();
  assert.match(summary.familyContractFingerprint, /^core8-families-v2-[0-9a-f]{8}$/);
  assert.equal(summary.pre.total, 8);
  assert.ok(summary.pre.cases.every(item => item.instrumentVersion === 2));
  assert.ok(summary.pre.cases.every(item => typeof item.familyId === "string"));
});

test("instrument version can change only before first evidence", () => {
  delete globalThis.CircuitEvidence;
  const modulePath = path.join(repoRoot, "assets", "learning", "outcome-session-v1.js");
  delete require.cache[require.resolve(modulePath)];
  const Session = require(modulePath);
  Session.reset();
  Session.configure({ instrumentVersion:1 });
  assert.equal(Session.loadRecord().instrumentVersion, 1);
  Session.configure({ instrumentVersion:2 });
  const item = Session.phaseStatus("pre").cases[0];
  Session.recordAttempt("pre", item.id, item.expected);
  assert.throws(() => Session.configure({ instrumentVersion:1 }), /immutable/);
});
