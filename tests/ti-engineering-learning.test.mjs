import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validateManifest } from "../tools/learning/ti-docs.mjs";
import { applyGrade, buildPlan, renderSession, validateLearningModel } from "../tools/learning/engineering-learning.mjs";

const manifest = JSON.parse(await readFile(new URL("../learning/ti/manifest.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../learning/ti/concept-cards.json", import.meta.url), "utf8"));

test("TI manifest contains the full recommended library and official sources only", () => {
  const result = validateManifest(manifest);
  assert.equal(result.documentCount, 17);
  assert.equal(new Set(result.ids).size, 17);
});

test("concept cards are source-closed and include prediction/diagnosis/transfer", () => {
  const result = validateLearningModel(manifest, cards);
  assert.ok(result.conceptCount >= 12);
});

test("new plan starts from prerequisite-free concepts", () => {
  const plan = buildPlan(cards.cards, { version: 1, concepts: {} }, "2026-09-24");
  assert.equal(plan.newCount, 1);
  assert.equal(plan.items[0].type, "new");
  assert.equal(plan.items[0].mode, "predict");
});

test("grading schedules explicit 1/3/7/30 day retrieval windows", () => {
  const base = { version: 1, concepts: {} };
  assert.equal(applyGrade(base, "buck-energy-flow", "fail", "2026-09-24").concepts["buck-energy-flow"].nextReview, "2026-09-25");
  assert.equal(applyGrade(base, "buck-energy-flow", "partial", "2026-09-24").concepts["buck-energy-flow"].nextReview, "2026-09-27");
  assert.equal(applyGrade(base, "buck-energy-flow", "pass", "2026-09-24").concepts["buck-energy-flow"].nextReview, "2026-10-01");
  assert.equal(applyGrade(base, "buck-energy-flow", "transfer", "2026-09-24").concepts["buck-energy-flow"].nextReview, "2026-10-24");
});

test("high-mastery due reviews use transfer questions", () => {
  const state = { version: 1, concepts: { "buck-energy-flow": { level: 2, mastery: 0.8, attempts: 2, lastResult: "pass", lastReviewed: "2026-09-17", nextReview: "2026-09-24", history: [] } } };
  const plan = buildPlan(cards.cards, state, "2026-09-24", { maxReviews: 1, maxNew: 0 });
  assert.equal(plan.items[0].mode, "transfer");
});

test("session hides answers and names authoritative source documents", () => {
  const plan = buildPlan(cards.cards, { version: 1, concepts: {} }, "2026-09-24");
  const text = renderSession(plan, manifest);
  assert.match(text, /Ask one item at a time/);
  assert.match(text, /SLVA057/);
  assert.doesNotMatch(text, /Answer:/);
});
