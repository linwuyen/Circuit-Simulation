import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Assessment = require('../assets/learning/learning-assessment.js');
const Oracles = require('../assets/learning/lab-oracles.js');
const Registry = require('../assets/learning/model-registry.js');
const Challenges = require('../assets/learning/engineering-challenges.js');

test('independent oracle rejects a deliberately corrupted production model', () => {
  const badRegistry = {
    get: id => Registry.get(id),
    run: (id, input) => {
      const output = Registry.run(id, input);
      return id === 'buck-ripple-ccm' ? { ...output, deltaIA: output.deltaIA * 1.25 } : output;
    }
  };
  const result = Oracles.verify('buck.lab.buck-ripple', { controls: { ind: '12', fsw: '500', load: '2' } }, badRegistry);
  assert.equal(result.supported, true);
  assert.equal(result.passed, false);
  assert.equal(result.independentValidated, false);
  assert.ok(result.agreement.failures.some(item => item.field === 'deltaIA'));
});

test('independent Buck reference obeys metamorphic invariants', () => {
  const ref = Oracles._reference.buckRipple;
  const a = ref({ vin: 12, vout: 3.3, inductanceH: 4e-6, switchingHz: 500e3, outputCurrentA: 3 });
  const b = ref({ vin: 12, vout: 3.3, inductanceH: 8e-6, switchingHz: 500e3, outputCurrentA: 3 });
  const c = ref({ vin: 12, vout: 3.3, inductanceH: 4e-6, switchingHz: 1e6, outputCurrentA: 3 });
  assert.ok(b.deltaIA < a.deltaIA);
  assert.ok(c.deltaIA < a.deltaIA);
  assert.ok(Math.abs(b.deltaIA * 2 - a.deltaIA) < 1e-12);
});

test('reasoning rubric rejects fluent nonsense and accepts causal Buck reasoning', () => {
  const verification = { passed: true, independentValidated: true, acceptance: { measured: 0.2 } };
  const bad = Assessment.evaluateReasoning('buck.lab.buck-ripple', {
    prediction: '電感增加所以結果下降。', observation: '0.40 A', explanation: '因為月亮比較亮所以結果就是這樣。', limitations: '香蕉是一種限制。', transfer: '換一組條件再看看。'
  }, { verification });
  assert.equal(bad.passed, false);
  const good = Assessment.evaluateReasoning('buck.lab.buck-ripple', {
    prediction: 'L增加時ΔI下降，因為電感限制電流斜率。', observation: 'ΔI=0.40 A，約為Iout=2 A的20%。', explanation: '由di/dt=vL/L與伏秒平衡，ΔI和L、fsw成反比。', limitations: '進入DCM、pulse skipping或電感DCR不可忽略時此近似失效。', transfer: '若fsw加倍而其他條件不變，ΔI預期減半。'
  }, { verification });
  assert.equal(good.passed, true);
  assert.ok(good.total >= 8);
});

test('numeric challenges generate distinct seeded instances', () => {
  const a = Challenges.instantiateNumeric('buck-open-inductance', 1);
  const b = Challenges.instantiateNumeric('buck-open-inductance', 2);
  assert.notEqual(a.seed, b.seed);
  assert.notDeepEqual(a.parameters, b.parameters);
  const answer = a.expected();
  assert.equal(Challenges.evaluateNumeric(a.id, answer, a.unit, a.seed).correct, true);
});

test('Bayesian diagnostic information gain comes from entropy reduction', () => {
  const trace = Challenges.diagnosticTrace('spi-overrun-game', ['fifo-level']);
  assert.ok(trace.informationGain > 0);
  assert.ok(trace.finalEntropy < trace.initialEntropy);
  assert.ok(trace.posterior['fifo-service'] > trace.initial['fifo-service']);
  const efficient = Challenges.scoreDiagnostic('spi-overrun-game', ['fifo-level'], 'fifo-service');
  const wasteful = Challenges.scoreDiagnostic('spi-overrun-game', ['scope-mosi', 'change-cpol', 'fifo-level'], 'fifo-service');
  assert.ok(efficient.efficiency > wasteful.efficiency);
});

test('coverage distinguishes taught, measured and independently verified competencies', () => {
  const base = [{ id:'buck-ripple-inductance-transfer', moduleId:'buck', competency:'buck.current-ripple.relationship', prompt:'x', options:[{id:'ok',text:'ok',correct:true},{id:'bad',text:'bad'}] }];
  const questions = Assessment.expandQuestions(base);
  const curriculum = { modules:[{ id:'buck', title:'Buck', lessons:[{id:'l1',competency:'buck.current-ripple.relationship'},{id:'l2',competency:'buck.other'}], labs:[{id:'buck.lab.buck-ripple',competency:'buck.current-ripple.relationship'}] }] };
  const coverage = Assessment.coverageSummary(curriculum, questions);
  const ripple = coverage.rows.find(row => row.competency === 'buck.current-ripple.relationship');
  const other = coverage.rows.find(row => row.competency === 'buck.other');
  assert.equal(ripple.status, 'verified');
  assert.equal(other.status, 'taught');
  assert.equal(coverage.verified, 1);
});