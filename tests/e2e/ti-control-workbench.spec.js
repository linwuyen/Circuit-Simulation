const { test, expect } = require('@playwright/test');

async function fresh(page){
  await page.goto('/learn.html#ti-control');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/learn.html#ti-control');
  await expect(page.locator('#surface-title')).toHaveText('Buck CCM control loop');
}

test('control workbench reacts to Kp Ki Ts and delay with visible evidence',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fresh(page);

  const baseline=await page.locator('#ws-current').textContent();
  expect(Number.parseFloat(baseline)).toBeGreaterThan(45);

  const delay=page.locator('[data-control-key="delayUs"] input');
  await delay.fill('100');
  await delay.dispatchEvent('change');
  const after=Number.parseFloat(await page.locator('#ws-current').textContent());
  expect(after).toBeLessThan(Number.parseFloat(baseline));

  await page.getByRole('button',{name:'Timing'}).click();
  await expect(page.locator('#ws-plot')).toContainText('sample→actuate');

  await page.getByRole('button',{name:'Model ↔ SFRA'}).click();
  await expect(page.locator('#ws-plot')).toContainText('UNVERIFIED_IMPORT');

  const sfraDelay=page.locator('[data-control-key="sfraDelay"] input');
  await sfraDelay.fill('50');
  await sfraDelay.dispatchEvent('change');
  await expect(page.locator('#ws-plot')).toContainText('RMS phase error');

  const saved=await page.evaluate(()=>CircuitEvidence.load().benchmark.tiControlWorkbench);
  expect(saved.config.delayUs).toBe(100);
  expect(saved.mismatchDelayUs).toBe(50);
  expect(errors).toEqual([]);
});

test('control workbench remains MODEL_ONLY until real provenance is attached',async({page})=>{
  await fresh(page);
  await page.getByRole('button',{name:'Model ↔ SFRA'}).click();
  await expect(page.locator('#scope-note')).toContainText('local small-signal model');
  await expect(page.locator('#surface-help')).toContainText('synthetic');
  await expect(page.locator('#surface-help')).not.toContainText('BOARD_PASS');
});
