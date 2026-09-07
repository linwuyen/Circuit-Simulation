import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Core = require('../assets/training-experiments-core.js');
const Engine = require('../assets/engineering-sandbox-core.js');
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
test('Buck CCM and DCM conserve mean current and join continuously at the boundary', () => {
  for (const R of [5, 20, 100, 400]) {
    const m = Core.buck({ loadOhm: R });
    const avg = m.rows.slice(1).reduce((sum, row, i) => sum + (row.iL + m.rows[i].iL) / 2 / 512, 0);
    close(avg, m.vout / R, .00005);
    assert.ok(m.rows.every(row => row.iL >= 0));
    close(m.rows[0].iL, m.rows.at(-1).iL);
  }
  const critical = Core.buck().boundaryOhm;
  assert.equal(Core.buck({ loadOhm: critical }).regime, 'BCM');
  close(Core.buck({ loadOhm: critical * .99999 }).vout, Core.buck({ loadOhm: critical * 1.00001 }).vout, .001);
  assert.ok(Core.buck({ loadOhm: 100 }).vout > 12);
});
test('CCM ripple scales with inverse L and f; ESR and large ripple boundaries are visible', () => {
  const a = Core.buck(), b = Core.buck({ inductanceUh: 200 }), c = Core.buck({ fswKhz: 200 });
  close(a.ripple, b.ripple * 2); close(a.ripple, c.ripple * 2);
  assert.ok(Core.buck({ esrOhm: .1 }).vRipple > a.vRipple);
  assert.equal(Core.buck({ vin: 100, duty: .5, fswKhz: 20, inductanceUh: 20, capacitanceUf: 10, esrOhm: .5 }).validSmallRipple, false);
  assert.throws(() => Core.buck({ inductanceUh: 0 }));
});
test('scope attenuation, bandwidth, sampling and trigger alter acquisition rather than plant truth', () => {
  const m = Core.buck(), original = JSON.stringify(m);
  const normal = Core.acquire(m), wrongProbe = Core.acquire(m, { selectedProbe: 1, triggerA: .24 });
  close(wrongProbe.avg * 10, normal.avg);
  assert.ok(Core.acquire(m, { bandwidthKhz: 5 }).peakToPeak < normal.peakToPeak * .3);
  const aliased = Core.acquire(m, { sampleRateKhz: 99, windowUs: 2000 });
  assert.equal(aliased.undersampled, true); assert.equal(aliased.aliasKhz, 1);
  assert.equal(Core.acquire(m, { triggerA: 99 }).triggered, false);
  assert.equal(Core.acquire(Core.buck({ loadOhm: .5 }), { actualProbe: 1 }).clipped, true);
  assert.equal(JSON.stringify(m), original);
});
test('replay regenerates poisoned snapshots, enforces versions and keeps chronological changes', () => {
  let record = Core.createExperiment({}, {}, 'fixed-test');
  record = Core.changeExperiment(record, 'model', 'loadOhm', 100);
  record = Core.capture(record, 'single');
  record = Core.changeExperiment(record, 'instrument', 'selectedProbe', 1);
  record = Core.capture(record, 'third');
  const output = Core.replay(record);
  record.snapshots[1].metrics.vout = 999;
  const clean = Core.validateExperiment(JSON.parse(JSON.stringify(record)));
  close(clean.record.snapshots[1].metrics.vout, Core.buck({ loadOhm: 100 }).vout);
  assert.deepEqual(clean.final, output);
  assert.throws(() => Core.replay({ ...record, modelVersion: '99' }));
  assert.throws(() => Core.changeExperiment(record, 'model', '__proto__', 1));
  assert.throws(() => Core.replay({ ...record, actions: Array(101).fill(record.actions[0]) }));
});
test('remediation changes representation or parameters and identifies four error categories', () => {
  const categories = new Set();
  for (const kind of ['physics', 'unit', 'timing', 'model']) {
    const q = Core.question(kind, 3), transfer = Core.question(kind, 7, true);
    assert.notEqual(q.prompt, transfer.prompt);
    assert.equal(Core.checkAnswer(q, q.expected).correct, true);
    categories.add(Core.checkAnswer(q, 'wrong').mistake);
    assert.ok(Core.miniExperiment(kind).values.length >= 2);
  }
  assert.equal(categories.size, 4);
  assert.notEqual(Core.question('model', 7, true).expected, Core.question('model', 8, true).expected);
});
test('optional differential-inductance saturation changes physical current and DCR changes response', () => {
  const config = { cycles: 800, loadProfile: [{ cycle: 0, ohm: 6 }], tripCurrent: 100 };
  const healthy = Engine.simulateSystem(config);
  const saturated = Engine.simulateSystem({ ...config, saturationCurrentA: 2, saturatedInductanceRatio: .1 });
  const dcr = Engine.simulateSystem({ ...config, inductorDcrOhm: 1 });
  assert.ok(saturated.summary.peakI > healthy.summary.peakI);
  assert.notEqual(dcr.summary.avgV, healthy.summary.avgV);
});
