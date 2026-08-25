import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};
const require = createRequire(import.meta.url);
const Flow = require("../assets/learning/core-flow-v1.js");

test("CoreFlow gates completion on concept mastery plus interaction", () => {
  Flow.reset();
  assert.equal(Flow.snapshot().currentLayer, "physics");
  assert.equal(Flow.ready("physics"), false);
  Flow.complete("physics");
  assert.equal(Flow.progress().done, 0);

  Flow.recordPrediction("physics", "lower", true);
  assert.equal(Flow.mastered("physics"), true);
  assert.equal(Flow.ready("physics"), false);
  Flow.recordInteraction("physics");
  assert.equal(Flow.ready("physics"), true);
  Flow.complete("physics");
  assert.deepEqual(Flow.progress(), { done: 1, total: 8, percent: 13, currentLayer: "sensing" });
});

test("wrong first attempt cannot complete until a corrective unseen check passes", () => {
  Flow.reset();
  Flow.recordPrediction("sensing", "same", false);
  Flow.recordInteraction("sensing");
  assert.equal(Flow.needsRemediation("sensing"), true);
  assert.equal(Flow.mastered("sensing"), false);
  assert.equal(Flow.ready("sensing"), false);
  Flow.complete("sensing");
  assert.equal(Flow.progress().done, 0);

  Flow.recordRemediation("sensing", false);
  assert.equal(Flow.ready("sensing"), false);
  Flow.recordRemediation("sensing", true);
  assert.equal(Flow.needsRemediation("sensing"), false);
  assert.equal(Flow.mastered("sensing"), true);
  assert.equal(Flow.ready("sensing"), true);
  Flow.complete("sensing");
  assert.equal(Flow.progress().done, 1);
});

test("CoreFlow preserves the immutable first attempt across remediation and reload reads", () => {
  Flow.reset();
  Flow.recordPrediction("sensing", "same", false);
  Flow.recordPrediction("sensing", "increase", true);
  Flow.recordRemediation("sensing", true);
  const saved = JSON.parse(values.get(Flow.STORAGE_KEY));
  assert.equal(saved.predictions.sensing.choice, "same");
  assert.equal(saved.predictions.sensing.correct, false);
  assert.ok(saved.remediations.sensing);
  assert.equal(Flow.snapshot().predictions.sensing.choice, "same");
});