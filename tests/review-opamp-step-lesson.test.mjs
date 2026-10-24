import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const O = require('../12_opamp_slew_rate/assets/opamp.js');
const lesson = fs.readFileSync(new URL('../12_opamp_slew_rate/02_step_response.html', import.meta.url), 'utf8');

// Evaluate the visible mathematical claim, not its prose or exact spelling.
// Replacing the actual clamp duration with the full-excursion scale must fail.
function lessonRampClaim(A, S, T) {
  const formula = lesson.match(/<div\b[^>]*class="formula"[^>]*>([\s\S]*?)<\/div>/)?.[1]
    .replace(/<[^>]*>/g, '').trim();
  const relation = formula?.match(/^t_(?:slew|ramp)\s*(>=|=|≳|≥)\s*(.+)$/);
  assert.ok(relation, `Expected an evaluable ramp-time relation, got ${formula}`);
  const rhs = relation[2].replace(/\|ΔV\|/g, 'A').replace(/SRdirection/g, 'S')
    .replace(/τ/g, 'T').replace(/−/g, '-').replace(/[×·]/g, '*');
  assert.match(rhs.replace(/\b(?:max|A|S|T)\b/g, ''), /^[\d\s().,+*/-]+$/);
  const value = vm.runInNewContext(rhs, { A, S, T, max: Math.max }, { timeout: 100 });
  assert.ok(Number.isFinite(value));
  return { operator: relation[1], value };
}

// Hand-derived fixtures: tau=1 us, directional threshold=SR*tau.
// The literal ramp durations distinguish the clamp from the A/SR scale.
const cases = [
  { name: 'positive subthreshold step has no clamped interval', step: 1, sr: 2, threshold: 2, ramp: 0, scale: .5, settle: 4.605170185988092 },
  { name: 'positive threshold step has no clamped interval', step: 2, sr: 2, threshold: 2, ramp: 0, scale: 1, settle: 4.605170185988092 },
  { name: 'negative subthreshold step has no clamped interval', step: -.25, sr: .5, threshold: .5, ramp: 0, scale: .5, settle: 4.605170185988092 },
  { name: 'negative threshold step has no clamped interval', step: -.5, sr: .5, threshold: .5, ramp: 0, scale: 1, settle: 4.605170185988092 },
  { name: 'large positive step leaves the clamp before the full-excursion scale', step: 8, sr: 2, threshold: 2, ramp: 3, scale: 4, settle: 6.218875824868201 },
  { name: 'large negative step uses SR minus at the clamp boundary', step: -8, sr: .5, threshold: .5, ramp: 15, scale: 16, settle: 16.83258146374831 },
  { name: 'zero step has neither a clamped interval nor precision settling', step: 0, sr: 2, threshold: 2, ramp: 0, scale: 0, settle: 0 }
];

for (const c of cases) {
  test(c.name, () => {
    const m = O.calculateMetrics({ step: c.step, srp: 2, srn: .5, gbw: 1 / (2 * Math.PI), gain: 1, tol: 1 }, 'step');
    assert.equal(m.activeStepSr, c.sr);
    assert.ok(Math.abs(m.tauUs - 1) < 1e-12);
    assert.ok(Math.abs(m.slewUs - c.scale) < 1e-12, 'full-excursion slew scale');
    assert.ok(Math.abs(m.settleUs - c.settle) < 1e-12, 'one-percent precision settling');

    // Observe the real trace crossing the hand-derived remaining-error threshold.
    const trace = O.simulate(m, 'step');
    const end = trace.timeUs.findIndex((t, i) => t >= trace.stepStartUs && Math.abs(c.step - trace.actual[i]) <= c.threshold);
    assert.ok(end >= 0, 'trace must leave the clamp');
    const observedEnd = trace.timeUs[end] - trace.stepStartUs;
    assert.ok(observedEnd >= c.ramp - 1e-12 && observedEnd <= c.ramp + trace.dtUs + 1e-12,
      `trace clamp end ${observedEnd} us must bracket ${c.ramp} us within one sample`);

    const claim = lessonRampClaim(Math.abs(c.step), c.sr, 1);
    const consistent = claim.operator === '=' ? Math.abs(c.ramp - claim.value) < 1e-12 : c.ramp >= claim.value - 1e-12;
    assert.ok(consistent, `lesson claims t_ramp ${claim.operator} ${claim.value} us, but the trace has ${c.ramp} us of clamp`);
  });
}
