const { test, expect } = require('@playwright/test');

async function seedTransfer(page, familyId) {
  await page.evaluate((id) => {
    const curriculum = CircuitSchema.normalizeCurriculum(CircuitCurriculum);
    const questions = CircuitAssessment.expandQuestions(CircuitQuizBank.getQuestions(curriculum));
    const family = questions.filter(q => q.familyId === id);
    const baseline = family.find(q => q.assessmentRole === 'baseline');
    const transfer = family.find(q => q.assessmentRole === 'transfer');
    if (!baseline || !transfer) throw new Error(`family not found: ${id}`);
    const state = CircuitEvidence.load();
    CircuitAssessment.recordAttempt(state, baseline, baseline.options.find(o => o.correct), {
      at: '2026-08-01T00:00:00.000Z', confidence: 0.7
    });
    CircuitAssessment.recordAttempt(state, transfer, transfer.options.find(o => o.correct), {
      at: '2026-08-01T00:01:00.000Z', confidence: 0.7
    });
    CircuitEvidence.save(state);
  }, familyId);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('FOC has a seeded family and the prerequisite DAG changes sequencing eligibility', async ({ page }) => {
  const family = await page.evaluate(() => {
    const curriculum = CircuitSchema.normalizeCurriculum(CircuitCurriculum);
    return CircuitAssessment.expandQuestions(CircuitQuizBank.getQuestions(curriculum))
      .filter(q => q.familyId === 'foc-park-frame')
      .map(q => ({ role: q.assessmentRole, variantId: q.variantId, seed: q.seed, representation: q.representation, prompt: q.prompt }));
  });
  expect(family.map(q => q.role)).toEqual(['baseline', 'transfer', 'transfer', 'retention']);
  expect(new Set(family.slice(1).map(q => q.seed)).size).toBe(3);
  expect(new Set(family.slice(1).map(q => q.prompt)).size).toBe(3);

  const before = await page.evaluate(() => {
    const curriculum = CircuitSchema.normalizeCurriculum(CircuitCurriculum);
    const questions = CircuitAssessment.expandQuestions(CircuitQuizBank.getQuestions(curriculum));
    return CircuitAssessment.moduleUnlocked('foc', CircuitEvidence.load(), questions, Date.now());
  });
  expect(before).toBe(false);

  await seedTransfer(page, 'inv-shoot-through-safety');
  const after = await page.evaluate(() => {
    const curriculum = CircuitSchema.normalizeCurriculum(CircuitCurriculum);
    const questions = CircuitAssessment.expandQuestions(CircuitQuizBank.getQuestions(curriculum));
    return CircuitAssessment.moduleUnlocked('foc', CircuitEvidence.load(), questions, Date.now());
  });
  expect(after).toBe(true);

  await page.goto('/quiz.html?module=foc');
  await expect(page.locator('#mainContent')).toContainText('foc.park.frame');
  await expect(page.locator('[data-current-question]')).toHaveCount(1);
  await expect(page.locator('#adaptiveV8')).toContainText('Adaptive next actions');
});

test('Bayesian diagnostic coverage expands to eleven real engineering scenarios', async ({ page }) => {
  await page.goto('/troubleshooting.html');
  await expect(page.locator('#diagnosticGames .diagnostic-game')).toHaveCount(11);
  await expect(page.locator('#diagnosticCoverageV8')).toContainText('11 Bayesian cases');
  const game = page.locator('[data-game="foc-angle-game"]');
  await game.locator('[data-test="lock-rotor"]').click();
  await expect(game.locator('.game-evidence')).toContainText('IG');
  await game.locator('[data-cause="angle-offset"]').click();
  await expect(game.locator('.game-score')).toContainText('Root cause 正確');
});

test('progress exposes 13 external anchors and complete measurement capability coverage', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('.v8-validity-summary')).toContainText('13/13 golden anchors pass');
  await expect(page.locator('#externalAnchorMatrix + .fault-table .fault-row')).toHaveCount(13);
  await expect(page.locator('#adaptiveV8')).toContainText('Psychometric evidence');
  const foc = page.locator('#coverageMatrix .fault-row').filter({ hasText: 'foc.park.frame' });
  await expect(foc).toHaveCount(1);
  await expect(foc).toContainText('✓ / ✓');
  await expect(foc).toContainText('verified');
});

test('lesson Tutor writes typed observable provenance into independent oracle evidence', async ({ page }) => {
  await page.goto('/4_PI/02_integrator.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ki-slider').fill('6000');
  await page.waitForTimeout(700);
  const evidence = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('circuit-learning-state-v5') || '{}');
    return (state.evidence && state.evidence['pi.lab.pi-ki'] && state.evidence['pi.lab.pi-ki'].machine) || [];
  });
  const typed = evidence.find(event => event.verification && event.verification.observableContract);
  expect(typed).toBeTruthy();
  expect(typed.verification.passed).toBe(true);
  expect(typed.verification.observableContract.version).toBe('1.0.0');
  expect(typed.verification.observableContract.labId).toBe('pi.lab.pi-ki');
});

test('V8 open-response tasks render outside the original three benchmark modules', async ({ page }) => {
  await page.goto('/quiz.html?module=pi');
  await expect(page.locator('[data-numeric-answer="pi-open-crossover"]')).toHaveCount(1);
  await expect(page.locator('#mainContent')).toContainText('0 dB crossover');
});
