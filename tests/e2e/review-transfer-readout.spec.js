const { test, expect } = require('@playwright/test');
const { resetEvidence } = require('./evidence-fixture');

// Break caught: passing the original 48 V before/after objects to
// experimentReadout while the active transfer's first/result objects use 36 V.
// Independent fixed oracle: integrate di/dt=(gate*Vin-v)/500uH and
// dv/dt=(i-v/12ohm)/220uF using RK4 at 25 ns, clamping diode current at zero.
// PWM is 10 us, duty is .25/.40, startup is zero, cycle 0 has no loaded command,
// and mean/peak use cycle endpoints over 1600 cycles (mean: last 320).
// Production uses 250 ns Euler, so allow 30 mV including 2-decimal formatting;
// the 36 V and stale 48 V vectors differ by at least 3 V.
const VOLTAGE_TOLERANCE = .03;
const ACTIVE_36V = { average: [8.9902, 14.3819], peak: [16.3853, 26.2167] };
const ORIGINAL_48V = { average: [11.9869, 19.1759], peak: [21.8471, 34.9556] };

async function answer(page, value) {
  await page.locator(`input[name="experiment-answer"][value="${value}"]`).check();
  await page.locator('#workspace-submit').click();
}

async function expectNumbers(locator, expected, tolerance = VOLTAGE_TOLERANCE) {
  await expect(locator).toBeVisible();
  const text = await locator.innerText();
  const actual = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  expect(actual, `Numeric fields in visible readout: ${text}`).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(Math.abs(actual[index] - value), `${text}: number ${index + 1} should be ${value}`).toBeLessThanOrEqual(tolerance);
  });
}

async function expectEvidence(page, vector) {
  const rows = page.locator('#experiment-causal-evidence li');
  await expect(rows).toHaveCount(2);
  await expectNumbers(rows.nth(0), vector.average);
  await expectNumbers(rows.nth(1), vector.peak);
}

test('revealed 36 V transfer displays active numeric results instead of original 48 V evidence', async ({ page }) => {
  // Opt-in negative control changes only this browser response, never repo code.
  // Run REVIEW_TRANSFER_STALE_SELECTOR=1 to prove the active numeric assertion
  // fails for the historical before/after selector used in the same closure.
  if (process.env.REVIEW_TRANSFER_STALE_SELECTOR === '1') {
    await page.route('**/assets/learning/workspace-experiment-ui.js', async route => {
      const response = await route.fetch();
      const body = await response.text();
      const active = 'W.experimentReadout(id,first,result)';
      if (body.split(active).length !== 2) throw new Error('Expected exactly one active readout selector for mutation control');
      await route.fulfill({ response, body: body.replace(active, 'W.experimentReadout(id,before,after)') });
    });
  }

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#experiment-energy');
  await resetEvidence(page);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-continuous-experiment', 'true');

  // Operate the real lesson first: the original 48 V vectors genuinely coexist
  // with the later 36 V trial, rather than being supplied by a display mock.
  await answer(page, 'up');
  await page.locator('#experiment-run').click();
  await expectEvidence(page, ORIGINAL_48V);
  await answer(page, 'up');
  await answer(page, 'reason');
  await expect(page.locator('body')).toHaveAttribute('data-workspace-stage', '3');
  await expect(page.locator('#ws-voltage')).toHaveText('先預測');
  await expect(page.locator('#experiment-causal-evidence')).toBeHidden();

  await answer(page, 'up');
  await expect(page.locator('#ws-result')).toBeVisible();
  await expectEvidence(page, ACTIVE_36V);
  await expectNumbers(page.locator('#ws-voltage'), [14.3819]);
  await expectNumbers(page.locator('#ws-current'), [1.1985], .01);
  // 12-bit ADC with 80 V full scale: round(14.29005/80*4095)*80/4095.
  await expectNumbers(page.locator('#ws-display'), [14.2808]);

  const stored = await page.evaluate(() => {
    const session = CircuitEvidence.load().benchmark.learningWorkspace.experiment;
    return {
      originalVin: session.currentConfig.vin,
      transferVin: session.history.at(-1).config.vin,
      transferPassed: session.rows.energy.transferPassed,
    };
  });
  expect(stored).toEqual({ originalVin: 48, transferVin: 36, transferPassed: true });

  // Restoring the durable completion must select the active trial again.
  await page.reload();
  await expect(page.locator('#ws-result')).toBeVisible();
  await expectEvidence(page, ACTIVE_36V);
  await expectNumbers(page.locator('#ws-voltage'), [14.3819]);
  expect(errors).toEqual([]);
});
