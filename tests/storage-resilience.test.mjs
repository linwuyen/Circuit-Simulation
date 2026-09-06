import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../assets/learning/learning-evidence.js', import.meta.url), 'utf8');
function fixture() {
  const data = new Map();
  let blocked = false;
  const localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (blocked) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); data.set(key, value); },
    removeItem: key => data.delete(key)
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(source, context);
  return { api: context.CircuitEvidence, data, block: value => { blocked = value; } };
}
test('failed writes preserve successive progress and can retry without restoring stale state', () => {
  const { api, data, block } = fixture();
  api.recordEvidence('first', 1, 'test');
  block(true);
  api.recordEvidence('second', 2, 'test');
  api.recordEvidence('third', 2, 'test');
  assert.equal(api.storageStatus().saved, false);
  assert.equal(api.load().evidence.second.level, 2);
  assert.equal(JSON.parse(api.exportBackup()).evidence.third.level, 2);
  block(false);
  assert.equal(api.retrySave().saved, true);
  assert.equal(JSON.parse(data.get(api.KEY)).evidence.third.level, 2);
});
test('corrupt state is backed up before replacement, including a failed backup write', () => {
  const { api, data, block } = fixture();
  data.set(api.KEY, '{broken');
  block(true);
  api.recordEvidence('new', 1, 'test');
  assert.equal(data.get(api.KEY), '{broken');
  block(false);
  api.retrySave();
  assert.equal(data.get(api.KEY + '-corrupt-backup'), '{broken');
  assert.equal(JSON.parse(data.get(api.KEY)).evidence.new.level, 1);
});
test('disabled browser storage preserves session progress and reports unsaved state', () => {
  const context = vm.createContext({});
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('denied'); } });
  vm.runInContext(source, context);
  const api = context.CircuitEvidence;
  api.recordEvidence('lesson', 2, 'test');
  assert.equal(api.load().evidence.lesson.level, 2);
  assert.equal(api.storageStatus().saved, false);
});
