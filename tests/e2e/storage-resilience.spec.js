const { test, expect } = require('@playwright/test');
test('unsaved progress has a working backup and retry action', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };
    CircuitEvidence.recordEvidence('storage-test', 2, 'browser-test');
  });
  const notice = page.locator('#learning-storage-status');
  await expect(notice).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await notice.getByRole('button', { name: '匯出備份' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('circuit-learning-backup.json');
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(JSON.parse(content).evidence['storage-test'].level).toBe(2);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await notice.getByRole('button', { name: '重試儲存' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => CircuitEvidence.load().evidence['storage-test'].level)).toBe(2);
});
