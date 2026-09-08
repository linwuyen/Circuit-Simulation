const { test, expect } = require('@playwright/test');
async function downloadJson(page, click) {
  const pending = page.waitForEvent('download'); await click();
  const download = await pending, stream = await download.createReadStream();
  let json = ''; for await (const chunk of stream) json += chunk.toString();
  return JSON.parse(json);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/15_power_capstone/lab_sandbox.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test('model boundary and measurement controls produce finite real waveforms', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.locator('#tr-regime')).toHaveText('CCM');
  const badPoints = await page.locator('#sandbox-scope polyline').evaluateAll(nodes => nodes.some(node => /NaN|Infinity/.test(node.getAttribute('points'))));
  expect(badPoints).toBe(false);
  await page.locator('#tr-load').fill('100'); await page.locator('#tr-load').blur();
  await expect(page.locator('#tr-regime')).toHaveText('DCM');
  await expect(page.locator('#tr-voltage')).toContainText('20.36');
  await page.locator('#tr-probe-setting').selectOption('1');
  await expect(page.locator('#tr-scope-status')).toContainText('倍率不符');
  await page.locator('#tr-samplerate').fill('99'); await page.locator('#tr-samplerate').blur();
  await expect(page.locator('#tr-scope-status')).toContainText('混疊');
  expect(errors).toEqual([]);
});
test('three snapshots export and import recomputes poisoned metrics', async ({ page }) => {
  await page.locator('#experiment-replay > summary').click();
  await page.locator('#tr-load').fill('100'); await page.locator('#tr-load').blur();
  await page.locator('#tr-capture').click();
  await page.locator('#tr-probe-setting').selectOption('1');
  await page.locator('#tr-capture').click();
  await expect(page.locator('#tr-comparison tr')).toHaveCount(3);
  const record = await downloadJson(page, () => page.locator('#tr-export').click());
  expect(record.actions).toHaveLength(2);
  record.snapshots[1].metrics.vout = 999;
  await page.locator('#tr-import').setInputFiles({ name:'replay.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(record)) });
  await expect(page.locator('#tr-replay-status')).toContainText('重新計算');
  await expect(page.locator('#tr-comparison')).not.toContainText('999');
  await page.locator('#tr-replay').click();
  await expect(page.locator('#tr-replay-status')).toContainText('重播 2 個操作');
});
test('targeted unit remediation preserves the wrong first attempt after transfer success', async ({ page }) => {
  await page.locator('#training-remediation > summary').click();
  await page.locator('#tr-remediation-kind').selectOption('unit'); await page.locator('#tr-question-new').click();
  await page.locator('#tr-answer-controls input').fill('1'); await page.locator('#tr-answer').click();
  await expect(page.locator('#tr-feedback')).toContainText('單位換算');
  await page.locator('#tr-mini').click();
  const prompt = await page.locator('#tr-transfer-question').innerText();
  const uh = Number(prompt.match(/([\d.]+) µH/)[1]);
  await page.locator('#tr-transfer-controls input').fill(String(uh * 1e-6));
  await page.locator('#tr-transfer-answer').click();
  await expect(page.locator('#tr-transfer-result')).toContainText('驗證通過');
  const row = await page.evaluate(() => CircuitTrainingRecords.read().sessions.find(x => x.kind === 'remediation'));
  expect(row.first.correct).toBe(false); expect(row.transferPassed).toBe(true);
});
test('blind repair locks first judgment, fixes real faults and validates changed conditions', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_multifault.html#repair-training');
  await expect(page.locator('#repair-verdict')).toBeEmpty();
  for (const id of ['seq','duty']) await page.locator(`[data-measurement="${id}"]`).click();
  for (const id of ['staleCommand','dutyClamp']) await page.locator(`#repair-guesses input[value="${id}"]`).check();
  await expect(page.locator('#repair-verdict')).toBeEmpty();
  for (const id of ['seq','duty']) await page.locator(`#repair-evidence input[value="${id}"]`).check();
  await page.locator('#repair-submit').click();
  await expect(page.locator('#repair-submit')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#repair-status')).toContainText('續接');
  await expect(page.locator('#repair-guesses input[value="staleCommand"]')).toBeChecked();
  for (const id of ['staleCommand','dutyClamp']) await page.locator(`[data-repair="${id}"]`).click();
  await page.locator('#repair-verify').click();
  await expect(page.locator('#repair-status')).toContainText('完成本次盲測維修');
  const record = await downloadJson(page, () => page.locator('#repair-export').click());
  await page.locator('#repair-import').setInputFiles({name:'repair.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
  await expect(page.locator('#repair-mode')).toContainText('練習模式');
  const rows = await page.evaluate(() => CircuitTrainingRecords.read().studySessions);
  expect(rows.filter(x => x.passed && !x.rehearsal)).toHaveLength(1);
});
test('mainline storage failure participates in the common retry and full backup UI', async ({ page }) => {
  await page.evaluate(() => {
    CircuitCoreFlowV1.select('physics');
    window.storageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'circuit-core-flow-v1') throw new Error('quota'); return window.storageSetItem.call(this,key,value); };
    CircuitCoreFlowV1.recordPrediction('physics','half',true);
    CircuitCoreFlowV1.recordInteraction('physics'); CircuitCoreFlowV1.complete('physics');
  });
  await expect(page.locator('#learning-storage-status')).toBeVisible();
  const backup = await downloadJson(page, () => page.locator('#learning-storage-status').getByRole('button',{name:'匯出備份'}).click());
  expect(backup.auxiliary.coreFlow.completed.physics).toBeTruthy();
  await page.evaluate(() => { Storage.prototype.setItem = window.storageSetItem; });
  await page.locator('#learning-storage-status').getByRole('button',{name:'重試儲存'}).click();
  await expect(page.locator('#learning-storage-status')).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#training-restore').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('#pilot-status')).toContainText('已合併');
  expect(await page.evaluate(() => CircuitCoreFlowV1.progress().done)).toBe(1);
});
test('pilot export is opt-in and does not manufacture learner evidence', async ({ page }) => {
  await expect(page.locator('#pilot-summary')).toContainText('尚無');
  await page.locator('#pilot-export').click(); await expect(page.locator('#pilot-status')).toContainText('同意');
  await page.locator('#pilot-consent').check();
  const bundle = await downloadJson(page, () => page.locator('#pilot-export').click());
  expect(bundle.metrics.repairAttempted).toBe(0); expect(bundle.containsRawAnswers).toBe(false); expect(bundle.causalClaimAllowed).toBe(false);
});
test('training panels fit a mobile viewport with expanded comparisons', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  for (const url of ['/15_power_capstone/lab_sandbox.html','/15_power_capstone/lab_multifault.html']) {
    await page.goto(url);
    await page.locator('.training-lab details').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});
