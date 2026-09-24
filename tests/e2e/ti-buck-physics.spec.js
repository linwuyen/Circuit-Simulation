const { test, expect } = require('@playwright/test');

async function fresh(page){
  await page.goto('/learn.html#ti-buck-physics');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/learn.html#ti-buck-physics');
  await expect(page.locator('#surface-title')).toHaveText('Buck Physics');
}

test('Buck physics keeps prediction, equation, waveform, boundary and transfer in one flow',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fresh(page);

  await expect(page.locator('#ti-physics-scenarios button')).toHaveCount(7);
  await expect(page.locator('#ws-plot .ti-physics-before')).toBeVisible();
  await expect(page.locator('#ws-plot .ti-physics-after')).toHaveCount(0);

  await page.locator('input[name="ti-physics-predict"][value="up"]').check();
  await page.getByRole('button',{name:'Lock prediction → reveal evidence'}).click();

  await expect(page.locator('#ws-plot .ti-physics-after')).toBeVisible();
  await expect(page.locator('.ti-physics-evidence code')).toContainText('Vout');
  await page.locator('input[name="ti-physics-transfer"][value="up"]').check();
  await page.getByRole('button',{name:'Check transfer'}).click();
  await expect(page.locator('.ti-physics-transfer')).toContainText('TRANSFER PASS');

  const saved=await page.evaluate(()=>CircuitEvidence.load().benchmark.tiBuckPhysics.duty);
  expect(saved.predictionCorrect).toBe(true);
  expect(saved.transferPassed).toBe(true);

  await page.getByRole('button',{name:'Rload',exact:true}).click();
  await page.locator('input[name="ti-physics-predict"][value="boundary"]').check();
  await page.getByRole('button',{name:'Lock prediction → reveal evidence'}).click();
  await expect(page.locator('.ti-physics-evidence')).toContainText('CCM → DCM');
  await expect(page.getByRole('button',{name:'First-cycle'})).toBeDisabled();

  await page.getByRole('button',{name:'Duty',exact:true}).click();
  await page.getByRole('button',{name:'First-cycle'}).click();
  await expect(page.locator('#ws-comparison')).toContainText('first-cycle causal approximation');

  await page.getByRole('button',{name:'Full transient'}).click();
  await expect(page.locator('#ws-comparison')).toContainText('generic-power-causal-kernel');
  await expect(page.locator('#scope-note')).toContainText('teaching surrogate');

  await page.reload();
  await expect(page.locator('.ti-physics-evidence')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Buck physics comparison uses a shared before/after plotting scale',async({page})=>{
  await fresh(page);
  await page.getByRole('button',{name:'L',exact:true}).click();
  await page.locator('input[name="ti-physics-predict"][value="down"]').check();
  await page.getByRole('button',{name:'Lock prediction → reveal evidence'}).click();
  const points=await page.locator('#ws-plot polyline').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('points')));
  expect(points).toHaveLength(2);
  expect(points[0]).not.toBe(points[1]);
  await expect(page.locator('.ti-physics-evidence code')).toContainText('ΔIL');
});
