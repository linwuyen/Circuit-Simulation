const { test, expect } = require('@playwright/test');

async function fresh(page){
  await page.goto('/learn.html#ti-timing');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/learn.html#ti-timing');
  await expect(page.locator('#surface-title')).toHaveText('100 kHz timing workbench');
}

test('C2000 timing workbench makes deadline miss visible',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fresh(page);

  await expect(page.locator('.ti-timing-verdict')).toContainText('DEADLINE MET');
  await expect(page.locator('#ws-display')).toHaveText('0');
  await expect(page.locator('#ws-plot')).toContainText('SHADOW_LOAD');

  await page.getByRole('button',{name:'Miss 11 µs'}).click();
  await expect(page.locator('.ti-timing-verdict')).toContainText('DEADLINE MISSED');
  await expect(page.locator('#ws-display')).toHaveText('1');
  await expect(page.locator('#ws-plot')).toContainText('missed load → +1 cycle');
  await expect(page.locator('#ws-plot')).toContainText('20.00µs');

  await page.getByRole('button',{name:'Two-cycle 15 µs'}).click();
  await expect(page.locator('#ws-display')).toHaveText('2');

  const saved=await page.evaluate(()=>CircuitEvidence.load().benchmark.tiC2000Timing);
  expect(saved.config.computeUs).toBe(15);
  expect(saved.last.extraCycleDelay).toBe(2);
  expect(errors).toEqual([]);
});

test('timing workbench exposes hardware/software ownership mapping',async({page})=>{
  await fresh(page);
  const rows=page.locator('#ti-timing-api > div');
  await expect(rows).toHaveCount(7);
  await expect(rows.filter({hasText:'ADC_SOC'})).toContainText('EPWM_setADCTriggerSource');
  await expect(rows.filter({hasText:'PWM_SHADOW_LOAD'})).toContainText('shadow-load');
  await expect(page.locator('#scope-note')).toContainText('target ePWM/ADC register configuration');
});
