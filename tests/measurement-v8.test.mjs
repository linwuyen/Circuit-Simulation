import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const Assessment = require('../assets/learning/learning-assessment.js');
const Quiz = require('../assets/learning/quiz-bank.js');
const AssessmentV8 = require('../assets/learning/assessment-v8.js');
const Challenges = require('../assets/learning/engineering-challenges.js');
const ChallengesV8 = require('../assets/learning/engineering-challenges-v8.js');
const Anchors = require('../assets/learning/external-anchors-v8.js');
const Oracles = require('../assets/learning/lab-oracles.js');
const Typed = require('../assets/learning/observables-v8.js');
const Mutation = require('../assets/learning/mutation-v8.js');
const Registry = require('../assets/learning/model-registry.js');

AssessmentV8.install(Assessment, Quiz);
ChallengesV8.install(Challenges);
Typed.install(Oracles);

const expectedModules = new Set(['buck','adc','spi','inverter','foc','pi','loop10us','bms','ad5543','afe','acmc-pro','c2000-dds']);

test('official transfer and retention families cover all 12 modules', () => {
  const expanded = Assessment.expandQuestions(Quiz.questions);
  const modules = new Set(expanded.map(q => q.moduleId));
  assert.deepEqual(modules, expectedModules);
  for (const moduleId of expectedModules) {
    const families = Assessment.families(expanded.filter(q => q.moduleId === moduleId));
    assert.ok(families.length >= 1, `${moduleId} must expose at least one family`);
    assert.ok(families.some(f => f.questions.some(q => q.assessmentRole === 'transfer')));
    assert.ok(families.some(f => f.questions.some(q => q.assessmentRole === 'retention')));
  }
});

test('V8 families generate seeded unseen representations instead of prompt clones', () => {
  for (const base of AssessmentV8.baseQuestions) {
    const items = AssessmentV8.expandOne(base);
    assert.equal(items.length, 4);
    const [a,b,c,d] = items;
    assert.equal(a.assessmentRole, 'baseline');
    assert.equal(b.assessmentRole, 'transfer');
    assert.equal(c.assessmentRole, 'transfer');
    assert.equal(d.assessmentRole, 'retention');
    assert.notEqual(b.seed, c.seed);
    assert.notEqual(b.prompt, a.prompt);
    assert.notEqual(c.prompt, b.prompt);
    assert.ok(b.representation);
    assert.ok(c.representation);
  }
});

test('wrong first V8 transfer attempt cannot be washed by retrying the same variant', () => {
  const items = AssessmentV8.expandOne(AssessmentV8.baseQuestions.find(q => q.moduleId === 'pi'));
  const state = { questions: {} };
  const b = items.find(q => q.variantId === 'B');
  const c = items.find(q => q.variantId === 'C');
  const wrong = b.options.find(o => !o.correct);
  const correctB = b.options.find(o => o.correct);
  const correctC = c.options.find(o => o.correct);
  Assessment.recordAttempt(state, b, wrong, { at: '2026-08-01T00:00:00.000Z', confidence: .9 });
  Assessment.recordAttempt(state, b, correctB, { at: '2026-08-01T00:01:00.000Z', confidence: .7 });
  assert.equal(Assessment.metrics(state.questions[b.familyId], Date.parse('2026-08-01T00:02:00Z')).transfer, false);
  Assessment.recordAttempt(state, c, correctC, { at: '2026-08-01T00:03:00.000Z', confidence: .7 });
  assert.equal(Assessment.metrics(state.questions[b.familyId], Date.parse('2026-08-01T00:04:00Z')).transfer, true);
});

test('external golden anchors cover 12 modules and all vectors pass', () => {
  assert.deepEqual(Anchors.validate(), []);
  const summary = Anchors.summary();
  assert.equal(summary.total, 12);
  assert.equal(summary.modules, 12);
  assert.equal(summary.passed, 12);
  assert.ok(summary.results.every(r => r.scope && /^https:\/\//.test(r.url)));
});

test('V8 adds nine seeded numeric tasks and expands Bayesian diagnostics to ten cases', () => {
  assert.equal(Challenges.numericTasks.length, 12);
  assert.equal(Challenges.diagnosticGames.length, 10);
  const a = Challenges.instantiateNumeric('pi-open-crossover', 1);
  const b = Challenges.instantiateNumeric('pi-open-crossover', 2);
  assert.notDeepEqual(a.parameters, b.parameters);
  assert.equal(Challenges.evaluateNumeric('pi-open-crossover', a.expected(), 'Hz', 1).correct, true);
  const score = Challenges.scoreDiagnostic('foc-angle-game', ['lock-rotor'], 'angle-offset');
  assert.equal(score.solved, true);
  assert.ok(score.informationGain > 0);
  assert.ok(score.posteriorRoot > score.steps[0].before['angle-offset']);
});

test('typed observables are attached to oracle evidence and preserve independent verification', () => {
  const result = Oracles.verify('pi.lab.pi-ki', {
    controls: { 'ki-slider': '1000' },
    observed: { 'f0-val': { text: '159.155 Hz', hidden: false } },
    metrics: []
  }, Registry);
  assert.equal(result.passed, true);
  assert.equal(result.independentValidated, true);
  assert.equal(result.observableContract.version, '1.0.0');
  assert.equal(result.observableContract.labId, 'pi.lab.pi-ki');
  assert.equal(result.observableContract.typed.inputs.ki, 1000);
});

test('systematic engineering mutation campaign detects every injected fault', () => {
  const campaign = Mutation.run(Oracles, Registry);
  assert.equal(campaign.total, 12);
  assert.equal(campaign.detected, 12, JSON.stringify(campaign.results.filter(x => !x.detected), null, 2));
  assert.equal(campaign.rate, 1);
});

test('cross-module competency graph is explicit for all V8 families', () => {
  for (const base of AssessmentV8.baseQuestions) {
    const deps = Assessment.prerequisitesFor(base.competency);
    assert.ok(deps.length >= 1, `${base.competency} requires an explicit prerequisite`);
  }
  assert.deepEqual(Assessment.requirementsForModule('acmc-pro'), ['afe.phase.power','buck.model.validity']);
  assert.deepEqual(Assessment.requirementsForModule('loop10us'), ['spi.rx.overrun']);
});

test('psychometric labels remain insufficient until evidence is actually collected', () => {
  const questions = Assessment.expandQuestions(Quiz.questions);
  const summary = Assessment.psychometricSummary({ questions: {} }, questions);
  assert.equal(summary.usable, 0);
  assert.equal(summary.provisional, 0);
  assert.equal(summary.insufficient, Assessment.families(questions).length);
});

test('adaptive sequencing ranks a due retention item above ordinary untouched work', () => {
  const questions = Assessment.expandQuestions(Quiz.questions);
  const base = questions.find(q => q.familyId === 'pi-integrator-crossover' && q.assessmentRole === 'baseline');
  const b = questions.find(q => q.familyId === 'pi-integrator-crossover' && q.variantId === 'B');
  const state = { questions: {} };
  Assessment.recordAttempt(state, base, base.options.find(o => o.correct), { at: '2026-08-01T00:00:00.000Z', confidence: .7 });
  Assessment.recordAttempt(state, b, b.options.find(o => o.correct), { at: '2026-08-01T00:01:00.000Z', confidence: .7 });
  const ranked = Assessment.rankNextTasks(state, questions, Date.parse('2026-08-03T00:01:00.000Z'), 30);
  assert.equal(ranked[0].familyId, 'pi-integrator-crossover');
  assert.equal(ranked[0].reason, 'retention due');
});
