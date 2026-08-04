import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Schema = require('../assets/learning/curriculum-schema-v3.js');

test('lesson identity survives href rename', () => {
  const a = { modules: [{ id:'buck', title:'Buck', entry:'buck/index.html', lessons:[['old.html','Current ripple','goal','act','see']], labs:[], faults:[] }] };
  const b = { modules: [{ id:'buck', title:'Buck', entry:'buck/index.html', lessons:[['new.html','Current ripple','goal','act','see']], labs:[], faults:[] }] };
  assert.equal(Schema.normalizeCurriculum(a).modules[0].lessons[0].id, Schema.normalizeCurriculum(b).modules[0].lessons[0].id);
});

test('explicit ids survive title and href changes', () => {
  const a = { modules: [{ id:'spi', title:'SPI', entry:'spi/index.html', lessons:[{id:'frame-timing',href:'a.html',title:'A'}], labs:[], faults:[] }] };
  const b = { modules: [{ id:'spi', title:'SPI', entry:'spi/index.html', lessons:[{id:'frame-timing',href:'b.html',title:'B'}], labs:[], faults:[] }] };
  assert.equal(Schema.normalizeCurriculum(a).modules[0].lessons[0].id, 'spi.lesson.frame-timing');
  assert.equal(Schema.normalizeCurriculum(b).modules[0].lessons[0].id, 'spi.lesson.frame-timing');
});

test('legacy path ids migrate to semantic ids', () => {
  const raw = { modules: [{ id:'buck', title:'Buck', entry:'buck/index.html', lessons:[['2_current_ripple.html','Current ripple','goal','act','see']], labs:[], faults:[] }] };
  const c = Schema.normalizeCurriculum(raw);
  assert.equal(Schema.resolveLegacyId(c, 'buck.lesson.2-current-ripple'), 'buck.lesson.current-ripple');
});

test('validator rejects duplicate ids', () => {
  const raw = { modules: [{ id:'x', title:'X', entry:'x/index.html', lessons:[{id:'same',href:'a.html',title:'A'},{id:'same',href:'b.html',title:'B'}], labs:[], faults:[] }] };
  assert.ok(Schema.validate(raw).some(error => error.includes('duplicate id')));
});
