import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const schema = require("../assets/learning/curriculum-schema.js");
const quizBank = require("../assets/learning/quiz-bank.js");
const modelRegistry = require("../assets/learning/model-registry.js");

function sampleCurriculum(lessonOrder = ["a", "b"]) {
  return {
    modules: [{
      id: "buck",
      number: "0",
      tag: "Buck",
      title: "Buck",
      entry: "buck/index.html",
      lessons: lessonOrder.map(name => [name + ".html", "Lesson " + name, "goal", "action", "result"]),
      labs: [["ripple", "Ripple Lab", "buck/ripple.html", "task", "success", "value"]],
      faults: [["Too hot", "cause", "verify", "fix", "buck/ripple.html"]]
    }, {
      id: "adc",
      number: "1",
      tag: "ADC",
      title: "ADC",
      entry: "adc/index.html",
      lessons: [], labs: [], faults: []
    }, {
      id: "spi",
      number: "5",
      tag: "SPI",
      title: "SPI",
      entry: "spi/index.html",
      lessons: [], labs: [], faults: []
    }]
  };
}

test("lesson IDs remain stable when curriculum order changes", () => {
  const first = schema.normalizeCurriculum(sampleCurriculum(["a", "b"]));
  const second = schema.normalizeCurriculum(sampleCurriculum(["b", "a"]));
  const firstIds = Object.fromEntries(first.moduleById.buck.lessons.map(item => [item.localId, item.id]));
  const secondIds = Object.fromEntries(second.moduleById.buck.lessons.map(item => [item.localId, item.id]));
  assert.deepEqual(firstIds, secondIds);
  assert.equal(firstIds.a, "buck.lesson.a");
});

test("legacy index completion migrates to stable IDs", () => {
  const migrated = schema.migrateLegacyDone(sampleCurriculum(), {
    "buck:lesson:1": true,
    "buck:lab:ripple": true
  });
  assert.equal(migrated["buck.lesson.b"], true);
  assert.equal(migrated["buck.lab.ripple"], true);
});

test("normalized curriculum validates unique stable IDs", () => {
  const curriculum = schema.normalizeCurriculum(sampleCurriculum());
  assert.deepEqual(schema.validate(curriculum), []);
});

test("diagnostic questions have one correct option and explicit misconception feedback", () => {
  for (const question of quizBank.questions) {
    assert.equal(question.options.filter(option => option.correct).length, 1, question.id);
    for (const option of question.options.filter(option => !option.correct)) {
      assert.ok(option.misconception, question.id + " missing misconception");
      assert.ok(option.feedback, question.id + " missing feedback");
    }
  }
});

test("quiz bank only returns questions for modules that exist", () => {
  const curriculum = schema.normalizeCurriculum({ modules: [sampleCurriculum().modules[0]] });
  const questions = quizBank.getQuestions(curriculum);
  assert.ok(questions.length > 0);
  assert.ok(questions.every(question => question.moduleId === "buck"));
});

test("benchmark modules expose model cards and validity boundaries", () => {
  for (const moduleId of ["buck", "adc", "spi"]) {
    const cards = modelRegistry.forModule(moduleId);
    assert.ok(cards.length > 0, moduleId);
    assert.ok(cards.every(card => card.assumptions.length && card.invalidWhen.length && card.source));
  }
});
