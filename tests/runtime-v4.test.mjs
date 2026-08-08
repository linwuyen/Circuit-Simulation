import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html','beginner.html','labs.html','troubleshooting.html','progress.html','quiz.html','search.html','glossary.html','report.html'];

test('all production pages load canonical models, evidence and assessment before learning runtime', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.ok(!html.includes('learning-v2.js'), page + ' must not load v2 runtime');
    const order = [
      'curriculum.js',
      'curriculum-schema-v3.js',
      'quiz-bank.js',
      'engineering-models.js',
      'model-registry.js',
      'learning-evidence.js',
      'learning-assessment.js',
      'learning-v3.js'
    ].map(name => html.indexOf(name));
    assert.ok(order.every(index => index >= 0), page + ' is missing a production dependency');
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], page + ' has invalid dependency order');
  }
});

test('tutor writes full lab ids and uses shared evidence store', () => {
  const tutor = fs.readFileSync(path.join(root, 'assets/learning/tutor.js'), 'utf8');
  assert.ok(tutor.includes('learning-evidence.js'));
  assert.ok(tutor.includes('?labId='));
  assert.ok(!tutor.includes('circuit-tutor-checks-v1'));
  assert.ok(tutor.includes('recordMachine'));
});

test('learning runtime delegates persistence and mastery to shared cores', () => {
  const runtime = fs.readFileSync(path.join(root, 'assets/learning/learning-v3.js'), 'utf8');
  assert.ok(runtime.includes('CircuitEvidence'));
  assert.ok(runtime.includes('CircuitAssessment'));
  assert.ok(!runtime.includes('circuit-learning-state-v3'));
  assert.ok(runtime.includes('benchmarkSummary'));
});
