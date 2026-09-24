const { test, expect } = require('@playwright/test');

async function openFresh(page) {
  await page.goto('/learn.html#ti-learning');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/learn.html#ti-learning');
  await expect(page.locator('#ws-title')).toContainText('Duty');
}

test('TI Buck learner loop persists PASS evidence and seven-day review in V5', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openFresh(page);

  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();

  const duty = page.locator('#ws-control');
  await expect(duty).toBeEnabled();
  await duty.fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();

  await expect(page.locator('#ws-plot [data-trace="pwm"]')).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="vl"]')).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="il"]').first()).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="vout"]')).toBeVisible();

  await page.locator('input[name="ti-observe"][value="net-rise"]').check();
  await page.getByRole('button', { name: 'Check observation' }).click();

  await page.locator('input[name="ti-reason"][value="volt-second"]').check();
  await page.getByRole('button', { name: 'Complete loop' }).click();

  await expect(page.locator('.ti-grade')).toContainText('Grade: PASS');

  const result = await page.evaluate(() => {
    const state = CircuitEvidence.load();
    const row = state.benchmark.tiEngineeringLearning.concepts['buck-energy-flow'];
    const evidence = state.evidence['ti:buck-energy-flow'];
    const prediction = state.predictions['ti:buck-energy-flow'].revisions[0];
    const start = new Date(row.lastReviewed + 'T12:00:00');
    const due = new Date(row.nextReview + 'T12:00:00');
    return {
      version: state.version,
      lastResult: row.lastResult,
      lastReviewed: row.lastReviewed,
      nextReview: row.nextReview,
      days: Math.round((due - start) / 86400000),
      evidenceLevel: evidence.level,
      sourceIds: evidence.data.sourceIds,
      preRegistered: prediction.preRegistered
    };
  });

  expect(result.version).toBe(5);
  expect(result.lastResult).toBe('pass');
  expect(result.days).toBe(7);
  expect(result.evidenceLevel).toBeGreaterThanOrEqual(2);
  expect(result.sourceIds).toContain('SLVA057');
  expect(result.preRegistered).toBe(true);

  await page.reload();
  await expect(page.locator('.ti-grade')).toContainText('Grade: PASS');
  await expect(page.locator('#workspace-progress')).toContainText(result.nextReview);
  expect(errors).toEqual([]);
});

test('TI Buck workbench keeps circuit scope and tutor in first 1080p viewport and links circuit to traces', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFresh(page);

  const inductorHit = page.locator('.ti-component-hit[data-component="inductor"]');
  await inductorHit.click();
  await expect(page.locator('#ti-component-inspector')).toContainText('L');
  await expect(page.locator('#ti-component-inspector input[type="range"]')).toBeEnabled();

  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();
  await page.locator('#ws-control').fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();

  const surface = await page.locator('#workspace-surface').boundingBox();
  const tutor = await page.locator('.coach').boundingBox();
  const scope = await page.locator('#ws-plot').boundingBox();
  expect(surface).not.toBeNull();
  expect(tutor).not.toBeNull();
  expect(scope).not.toBeNull();
  expect(surface.y + Math.min(surface.height, scope.y + scope.height - surface.y)).toBeLessThanOrEqual(1080);
  expect(tutor.y + Math.min(tutor.height, 800)).toBeLessThanOrEqual(1080);

  await page.getByRole('button', { name: 'vL positive dwell ↑' }).click();
  await expect(page.locator('.ti-component-hit[data-component="inductor"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#ws-plot [data-trace="vl"]')).toHaveClass(/ti-trace-focus/);
  await expect(page.locator('#ws-plot [data-trace="pwm"]')).toHaveClass(/ti-trace-dim/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});


test('scope scrubbing drives circuit ON/OFF state and waveform hover maps back to components', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFresh(page);

  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();
  await page.locator('#ws-control').fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();
  await page.getByRole('button', { name: 'Ⅱ' }).click();

  const scope=page.locator('#ws-plot');
  const box=await scope.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await expect(page.locator('#circuit-state')).toContainText('ON');

  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
  await expect(page.locator('#circuit-state')).toContainText('OFF');

  const vl=page.locator('#ws-plot [data-trace="vl"]');
  await vl.hover({ force: true });
  await expect(page.locator('.ti-component-hit[data-component="inductor"]')).toHaveClass(/is-preview/);

  await vl.click({ force: true });
  await expect(page.locator('.ti-component-hit[data-component="inductor"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#ws-plot [data-trace="vl"]')).toHaveClass(/ti-trace-focus/);
});


test('TI Buck workbench stays usable on 375px mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFresh(page);

  await page.locator('.ti-component-hit[data-component="inductor"]').click();
  const inspector=page.locator('#ti-component-inspector');
  await expect(inspector).toBeVisible();

  const layout=await page.evaluate(() => {
    const inspector=document.getElementById('ti-component-inspector');
    const coach=document.querySelector('.coach');
    const surface=document.getElementById('workspace-surface');
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      inspectorPosition: getComputedStyle(inspector).position,
      inspectorWidth: inspector.getBoundingClientRect().width,
      coachWidth: coach.getBoundingClientRect().width,
      surfaceWidth: surface.getBoundingClientRect().width,
      viewport: innerWidth
    };
  });

  expect(layout.overflow).toBe(false);
  expect(layout.inspectorPosition).toBe('static');
  expect(layout.inspectorWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.coachWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.surfaceWidth).toBeLessThanOrEqual(layout.viewport);

  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();
  await page.locator('#ws-control').fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();

  await expect(page.locator('#ws-plot [data-trace="pwm"]')).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="vl"]')).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="il"]').first()).toBeVisible();
  await expect(page.locator('#ws-plot [data-trace="vout"]')).toBeVisible();

  const finalOverflow=await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(finalOverflow).toBe(false);
});


test('physics views expose steady conduction region and full transient without replacing first-cycle evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFresh(page);
  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();
  await page.locator('#ws-control').fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();

  await page.getByRole('button', { name: 'STEADY' }).click();
  await expect(page.locator('#ws-plot [data-trace="ic"]')).toBeVisible();
  await expect(page.locator('#ws-comparison')).toContainText('Rcrit');

  await page.getByRole('button', { name: 'TRANSIENT' }).click();
  await expect(page.locator('#ws-comparison')).toContainText('Full transient');
  await expect(page.locator('#ws-comparison')).toContainText('FIRST view intentionally freezes old Vout');

  await page.getByRole('button', { name: 'FIRST' }).click();
  await expect(page.locator('#ws-comparison')).toContainText('first-cycle');
});


test('completed loop unlocks DCM exploration while prediction stage stays in CCM', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFresh(page);

  await page.getByRole('button', { name: /R 5 Ω/ }).click();
  const preRange=page.locator('#ti-component-inspector input[type="range"]');
  await preRange.fill('100');
  await expect(page.locator('#ws-feedback')).toContainText('先固定在 CCM');

  await page.locator('input[name="ti-predict"][value="time-first"]').check();
  await page.getByRole('button', { name: 'Lock prediction' }).click();
  await page.locator('#ws-control').fill('50');
  await page.getByRole('button', { name: 'Run first cycle' }).click();
  await page.locator('input[name="ti-observe"][value="net-rise"]').check();
  await page.getByRole('button', { name: 'Check observation' }).click();
  await page.locator('input[name="ti-reason"][value="volt-second"]').check();
  await page.getByRole('button', { name: 'Complete loop' }).click();

  await page.getByRole('button', { name: /R 5 Ω/ }).click();
  const postRange=page.locator('#ti-component-inspector input[type="range"]');
  await expect(postRange).toBeEnabled();
  await postRange.fill('100');

  await page.getByRole('button', { name: 'STEADY' }).click();
  await expect(page.locator('.ti-mode')).toContainText('DCM');
  await expect(page.locator('#ws-comparison')).toContainText('DCM');
});
