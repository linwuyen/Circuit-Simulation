const { test, expect } = require('@playwright/test');

test('capstone exposes the integrated engineering sandbox without creating a new framework page', async ({ page }) => {
  await page.goto('/15_power_capstone/index.html');
  await expect(page.getByText('Engineering Sandbox 2.0')).toBeVisible();
  for(const href of ['lab_sandbox.html','lab_dma.html','lab_state_v2.html','lab_multifault.html','lab_code_trace.html']) await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
});

test('dynamic converter shares closed-loop waveform, CC/CV state and timing evidence', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_sandbox.html');
  await expect(page.locator('#sb-final-v')).toContainText('V');
  await expect(page.locator('#sandbox-scope polyline')).toHaveCount(3);
  const initial=await page.evaluate(()=>window.__sandboxLast.summary.finalV);
  expect(initial).toBeGreaterThan(45);
  await page.locator('#sb-ilim').fill('4');
  await expect(page.locator('#sb-mode')).toHaveText('CC');
  const limited=await page.evaluate(()=>window.__sandboxLast.summary.finalV);
  expect(limited).toBeLessThan(initial-8);
  await page.locator('#sb-ilim').fill('12');
  await page.locator('#sb-miss').fill('10');
  const missed=await page.evaluate(()=>window.__sandboxLast.summary.missedCommits);
  expect(missed).toBeGreaterThan(0);
  const hasMiss=await page.evaluate(()=>window.__sandboxLast.events.some(e=>e.type==='PWM_COMMIT_MISSED'));
  expect(hasMiss).toBe(true);
});

test('DMA lab fails closed on publication before completion', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_dma.html');
  await expect(page.locator('#dma-status')).toContainText('PASS');
  await page.locator('#dma-mode').selectOption('early-publish');
  await expect(page.locator('#dma-status')).toContainText('FAIL');
  await expect(page.locator('#dma-violations')).toContainText('published-before-complete');
});

test('state lab rejects RUN without prerequisites and keeps fault clear from auto-restarting', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_state_v2.html');
  await page.getByRole('button',{name:'RUN request'}).click();
  await expect(page.locator('#state-status')).toContainText('FAIL');
  await page.locator('#state-reset').click();
  await page.getByRole('button',{name:'PRECHECK pass'}).click();
  await page.getByRole('button',{name:'READY'}).click();
  await page.getByRole('button',{name:'RUN request'}).click();
  await expect(page.locator('#state-current')).toHaveText('RUN');
  await page.getByRole('button',{name:'Inject fault'}).click();
  await page.getByRole('button',{name:'Clear fault input'}).click();
  await expect(page.locator('#state-current')).toHaveText('FAULT');
});

test('multi-fault lab requires both simultaneous causes within five measurements', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_multifault.html');
  for(const m of ['raw','duty','seq']) await page.locator(`[data-measure="${m}"]`).click();
  const faults=await page.evaluate(()=>window.__multiFault.scenario.faults);
  for(const f of faults) await page.locator(`[name="fault-guess"][value="${f}"]`).check();
  await expect(page.locator('#mf-status')).toContainText('PASS');
  const score=await page.evaluate(()=>window.__multiFault.score);
  expect(score.measurementCost).toBe(3);expect(score.accuracy).toBe(1);
});

test('code trace links firmware semantics to electrical consequence and next measurement', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_code_trace.html');
  await page.locator('#code-bug').selectOption('shadow');
  await expect(page.locator('#code-effect')).toContainText('one PWM period late');
  await expect(page.locator('#code-measure')).toContainText('CONTROL_DONE');
  await page.locator('#code-bug').selectOption('unit');
  await expect(page.locator('#code-effect')).toContainText('1000×');
});

test('engineering sandbox remains usable on mobile without document overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/15_power_capstone/lab_sandbox.html','/15_power_capstone/lab_dma.html','/15_power_capstone/lab_state_v2.html','/15_power_capstone/lab_multifault.html','/15_power_capstone/lab_code_trace.html']){
    await page.goto(path);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
