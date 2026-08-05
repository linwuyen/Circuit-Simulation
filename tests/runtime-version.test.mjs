import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);

const productionPages = [
  'index.html',
  'beginner.html',
  'labs.html',
  'troubleshooting.html',
  'progress.html',
  'quiz.html',
  'glossary.html',
  'search.html',
  'report.html'
];

test('every production page loads only the V3 learning runtime', () => {
  for (const relative of productionPages) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(html, /curriculum-schema-v3\.js/, `${relative}: missing V3 schema`);
    assert.match(html, /learning-v3\.js/, `${relative}: missing V3 runtime`);
    assert.match(html, /learning-v3\.css/, `${relative}: missing V3 CSS`);
    assert.doesNotMatch(html, /learning-v2\.(?:js|css)/, `${relative}: V2 dependency`);
  }
});

test('the canonical schema exports version 3', () => {
  const schema = require(path.join(root, 'assets/learning/curriculum-schema-v3.js'));
  assert.equal(schema.VERSION, 3);
  assert.equal(typeof schema.normalizeCurriculum, 'function');
  assert.equal(typeof schema.validate, 'function');
});

test('the V3 schema remains reviewable source', () => {
  const source = fs.readFileSync(
    path.join(root, 'assets/learning/curriculum-schema-v3.js'),
    'utf8'
  );
  const lines = source.split(/\r?\n/);
  assert.ok(lines.length >= 150, 'schema appears minified or collapsed');
  assert.ok(
    Math.max(...lines.map(line => line.length)) < 160,
    'schema contains an excessively long source line'
  );
});
