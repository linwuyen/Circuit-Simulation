const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('home exposes the OP AMP dynamic-response module inside the expanded system', async ({ page }) => {
  await expect(page.locator('#mainContent')).toContainText('OP AMP Slew Rate / Dynamic Response');
  await expect(page.locator('.v8-validity-summary')).toContainText('16/16 golden anchors pass');
  await expect(page.locator('.v8-validity-summary')).toContainText('16/16 modules anchored');
  await expect(page.locator('a[href="12_opamp_slew_rate/index.html"]')).toHaveCount(1);
});

test('sine lab calculates the full-power slope and records one independent PASS', async ({ page }) => {
  await page.goto('/12_opamp_slew_rate/lab_sine.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await expect(page.locator('#op-required-sr')).toContainText('3.142 V/µs');
  await expect(page.locator('#op-margin')).toContainText('1.31');
  await expect(page.locator('#op-state')).toContainText('SAFE / not limited');

  await page.locator('#op-sr-plus').fill('4.2');
  await page.locator('#op-sr-minus').fill('4.1');
  await page.waitForTimeout(800);

  const machine = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('circuit-learning-state-v5') || '{}');
    return (state.evidence && state.evidence['opamp.lab.opamp-sine'] && state.evidence['opamp.lab.opamp-sine'].machine) || [];
  });
  const oracleEvents = machine.filter(x => x.source === 'independent-oracle-v7' || (x.verification && x.verification.oracleVersion === 'opamp-1.0'));
  expect(oracleEvents.length).toBe(1);
  const event = oracleEvents[0];
  expect(event.verification.passed).toBe(true);
  expect(event.verification.independentValidated).toBe(true);
  expect(event.verification.observableContract.labId).toBe('opamp.lab.opamp-sine');
  expect(event.verification.observableContract.inputs.frequencyKHz).toBe(100);
  expect(event.verification.observableContract.inputs.vpp).toBe(10);
});

test('OP AMP quiz exposes formal transfer and all three numeric generators', async ({ page }) => {
  await page.goto('/quiz.html?module=opamp');
  await expect(page.locator('#mainContent')).toContainText('opamp.large-signal.slew-rate');
  await expect(page.locator('[data-current-question]')).toHaveCount(1);
  await expect(page.locator('[data-numeric-answer="opamp-open-required-sr"]')).toHaveCount(1);
  await expect(page.locator('[data-numeric-answer="opamp-open-fpbw"]')).toHaveCount(1);
  await expect(page.locator('[data-numeric-answer="opamp-open-step-time"]')).toHaveCount(1);
  const family = await page.evaluate(() => {
    const curriculum = CircuitSchema.normalizeCurriculum(CircuitCurriculum);
    return CircuitAssessment.expandQuestions(CircuitQuizBank.getQuestions(curriculum))
      .filter(q => q.familyId === 'opamp-slew-large-signal')
      .map(q => ({ role: q.assessmentRole, variantId: q.variantId, representation: q.representation, prompt: q.prompt }));
  });
  expect(family.filter(x => x.role === 'baseline')).toHaveLength(1);
  expect(family.filter(x => x.role === 'transfer')).toHaveLength(3);
  expect(family.filter(x => x.role === 'retention')).toHaveLength(4);
  expect(new Set(family.slice(1).map(x => x.representation)).size).toBeGreaterThanOrEqual(4);
});

test('troubleshooting includes Bayesian OP AMP slew-vs-bandwidth diagnosis', async ({ page }) => {
  await page.goto('/troubleshooting.html');
  await expect(page.locator('#diagnosticGames .diagnostic-game')).toHaveCount(14);
  await expect(page.locator('#diagnosticCoverageV8')).toContainText('OP AMP');
  const game = page.locator('[data-game="opamp-slew-vs-bandwidth-game"]');
  await expect(game).toHaveCount(1);
  await game.locator('[data-test="reduce-amplitude"]').click();
  await expect(game.locator('.game-evidence')).toContainText('IG');
  await game.locator('[data-test="measure-slope"]').click();
  await game.locator('[data-cause="slew-limit"]').click();
  await expect(game.locator('.game-score')).toContainText('Root cause 正確');
});

test('progress closes OP AMP coverage and external validity', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('.v8-validity-summary')).toContainText('16/16 golden anchors pass');
  await expect(page.locator('#externalAnchorMatrix + .fault-table .fault-row')).toHaveCount(16);
  await expect(page.locator('#externalAnchorMatrix + .fault-table')).toContainText('OP AMP Slew Rate / Dynamic Response');
  const row = page.locator('#coverageMatrix .fault-row').filter({ hasText: 'opamp.large-signal.slew-rate' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('verified');
});

test('OP AMP sine lab is usable on mobile without horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/12_opamp_slew_rate/lab_sine.html');
  await expect(page.locator('#op-required-sr')).toContainText('3.142 V/µs');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
