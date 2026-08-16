const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('capstone explains the unified machine in plain language', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_sandbox.html');
  await expect(page.getByText('不是五個小遊戲')).toBeVisible();
  await expect(page.getByText('ADC 量到什麼，控制器就相信什麼')).toBeVisible();
  await expect(page.locator('#sandbox-scope polyline')).toHaveCount(3);
  const first=await page.evaluate(()=>window.__sandboxLast);
  expect(first.summary.missedCommits).toBe(0);
  expect(first.communication.maxLag).toBe(0);
});

test('late control completion now causes real missed PWM updates', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_sandbox.html');
  await page.locator('#sb-compute').fill('3.2');
  await expect.poll(async()=>page.evaluate(()=>window.__sandboxLast.summary.missedCommits)).toBeGreaterThan(0);
  await expect(page.locator('#sb-status')).toContainText('算得太晚');
  const split=await page.evaluate(()=>window.__sandboxLast.trace.some(x=>x.timingMiss&&x.computedDuty!==x.appliedDuty));
  expect(split).toBe(true);
});

test('stale communication really delays the command seen by control', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_sandbox.html');
  await page.locator('#sb-comm').selectOption('stale');
  await expect.poll(async()=>page.evaluate(()=>window.__sandboxLast.communication.maxLag)).toBeGreaterThan(0);
  await expect(page.locator('#sb-status')).toContainText('舊資料');
  const stale=await page.evaluate(()=>window.__sandboxLast.trace.some(x=>x.producerCommand!==x.consumedCommand));
  expect(stale).toBe(true);
});

test('DMA page connects ownership faults to the same command model', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_dma.html');
  await expect(page.locator('#dma-status')).toContainText('PASS');
  await page.locator('#dma-mode').selectOption('stale');
  await expect.poll(async()=>page.evaluate(()=>window.__dmaLast.communication.maxLag)).toBeGreaterThan(0);
  await expect(page.locator('#dma-status')).toContainText('落後');
  await page.locator('#dma-mode').selectOption('early-publish');
  await expect(page.locator('#dma-status')).toContainText('ownership');
  await expect(page.locator('#dma-violations')).toContainText('published-before-complete');
});

test('state permission really turns the physical plant on and off', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_state_v2.html');
  await page.getByRole('button',{name:'RUN request'}).click();
  await expect(page.locator('#state-status')).toContainText('拒絕');
  await page.locator('#state-reset').click();
  await page.getByRole('button',{name:'PRECHECK pass'}).click();
  await page.getByRole('button',{name:'READY'}).click();
  await page.getByRole('button',{name:'RUN request'}).click();
  await expect(page.locator('#state-current')).toHaveText('RUN');
  const runningV=await page.evaluate(()=>window.__stateLast.system.summary.finalV);
  expect(runningV).toBeGreaterThan(5);
  await page.getByRole('button',{name:'Inject fault'}).click();
  await page.getByRole('button',{name:'Clear fault input'}).click();
  await expect(page.locator('#state-current')).toHaveText('FAULT');
  await expect(page.locator('#state-pwm')).toHaveText('OFF');
  expect(await page.evaluate(()=>window.__stateLast.system.summary.finalV)).toBe(0);
});

test('multi-fault measurements come from the live hidden system and save diagnostic history', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_multifault.html');
  for(const m of ['scaled','seq','duty']) await page.locator(`[data-measure="${m}"]`).click();
  await expect(page.locator('#mf-log')).toContainText('Scaled:');
  await expect(page.locator('#mf-log')).toContainText('Sequence:');
  const faults=await page.evaluate(()=>window.__multiFault.scenario.faults);
  for(const f of faults) await page.locator(`[name="fault-guess"][value="${f}"]`).check();
  await expect(page.locator('#mf-status')).toContainText('PASS');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuit-learning-state-v5')).diagnosticGames['engineering-sandbox.multifault']);
  expect(stored.length).toBeGreaterThan(0);
  expect(stored.at(-1).solved).toBe(true);
});

test('code mutations actually change waveform/timing/data behavior', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_code_trace.html');
  await page.locator('#code-bug').selectOption('sign');
  expect(await page.evaluate(()=>window.__codeTrace.system.summary.finalV)).toBeLessThan(5);
  await page.locator('#code-bug').selectOption('shadow');
  await expect.poll(async()=>page.evaluate(()=>window.__codeTrace.system.summary.missedCommits)).toBeGreaterThan(0);
  await expect(page.locator('#code-measure')).toContainText('Timing:');
  await page.locator('#code-bug').selectOption('stale');
  expect(await page.evaluate(()=>window.__codeTrace.system.communication.maxLag)).toBeGreaterThan(0);
});

test('unified labs remain usable on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/15_power_capstone/lab_sandbox.html','/15_power_capstone/lab_dma.html','/15_power_capstone/lab_state_v2.html','/15_power_capstone/lab_multifault.html','/15_power_capstone/lab_code_trace.html']){
    await page.goto(path);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
