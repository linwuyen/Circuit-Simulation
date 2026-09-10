const {test,expect}=require('@playwright/test');
async function open(page){const panel=page.locator('[data-engineering-context]');await panel.locator('summary').first().click();await expect(panel.locator('.ec-tabs button')).toHaveCount(5);return panel;}
test('workspace and debug resolve existing model owners, preserve circuit and use shared five-view facts',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#duty');await expect(page.locator('#ws-title')).toBeVisible();await page.evaluate(()=>window.originalCircuit=document.getElementById('circuit'));
  const panel=await open(page);await expect(panel).toContainText('assets/training-experiments-core.js');await panel.locator('[data-view=authority]').click();await expect(panel.locator('.ec-view')).toContainText('Valid calibration');await expect(panel.locator('.ec-view')).toContainText('Peripherals ready');
  expect(await page.evaluate(()=>window.originalCircuit===document.getElementById('circuit'))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/15_power_capstone/lab_sandbox.html');const debug=await open(page);await expect(debug).toContainText('assets/engineering-sandbox-core.js');await expect(debug).toContainText('契約尚未完整');await expect(debug).toContainText('MODEL_ONLY');expect(errors).toEqual([]);
});
test('partial module mapping stays explicit and source links retain the original task',async({page})=>{
  await page.goto('/4_PI/index.html?learnFrom=core-feedback');const panel=await open(page);await expect(panel).toContainText('模組層級');await expect(panel.getByRole('link',{name:'用既有連續電源核心驗證'})).toHaveAttribute('href',/learnFrom=core-feedback/);
  await panel.locator('[data-view=time]').focus();await page.keyboard.press('Enter');await expect(panel.locator('.ec-view')).toContainText('算完不代表');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('engineering context is read-only and does not manufacture learner or board evidence',async({page})=>{
  await page.goto('/19_c2000_buck_firmware_lab/index.html?layer=physics');await expect(page.locator('#learning-navigation')).toBeVisible();const before=await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark));const panel=await open(page);await panel.locator('[data-view=control]').click();await expect(panel).toContainText('不能宣稱 BOARD_PASS');
  expect(await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark))).toBe(before);await expect(page.locator('[data-mental-view-button]')).toHaveCount(5);await expect(page.locator('[data-engineering-workbench]')).toHaveCount(0);
});
