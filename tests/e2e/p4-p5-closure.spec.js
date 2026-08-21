const { test, expect } = require('@playwright/test');

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('P4-A/P4-B physical workspaces are fail-closed by default', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/');
  await page.locator('[data-learning-mode="firmware"]').click();
  await expect(page.locator('#physicalClosureWorkspace')).toBeVisible();
  await expect(page.locator('#physicalClosureMetrics')).toContainText('UNCLAIMED');
  await expect(page.locator('#physicalClosureMetrics')).toContainText('0/9');
  await expect(page.locator('#physicalClosureMetrics')).toContainText('0/8');
  await expect(page.locator('#physicalClosureStatus')).toContainText('Fail-closed');
  await expect(page.locator('#controlValidationMetrics')).toContainText('MISSING');
  await expect(page.locator('#controlValidationStatus')).toContainText('INCOMPLETE');
  await expect(page.locator('a[href="board/board-closure.template.json"]')).toBeVisible();
  await expect(page.locator('a[href="board/control-validation.template.json"]')).toBeVisible();
});

test('P4-C learner study export is available without exposing raw answers', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/');
  await expect(page.locator('#outcomeStudyExport')).toBeVisible();
  await expect(page.locator('#outcomeStudyExport')).toContainText('不含題目、答案');
  await page.locator('#outcomeParticipantId').fill('p_001');
  await expect(page.locator('#outcomeStudyDownload')).toBeEnabled();
});

test('P5 topology transfer surface renders five live constraints and unseen checks', async ({ page }) => {
  await page.goto('/17_power_topology_control/');
  await expect(page.locator('#p5TransferVerification')).toBeVisible();
  await expect(page.locator('[data-p5-constraint]')).toHaveCount(5);
  await expect(page.locator('[data-p5-case]')).toHaveCount(5);
  await expect(page.locator('[data-p5-constraint="boost"]')).toContainText('RHP_ZERO');

  const before = await page.locator('[data-p5-constraint="boost"] strong').textContent();
  await setRange(page, '#dutyBoost', 75);
  const after = await page.locator('[data-p5-constraint="boost"] strong').textContent();
  expect(after).not.toBe(before);

  await page.locator('[data-p5-case]').first().locator('[data-p5-answer]').first().click();
  await expect(page.locator('#p5ChallengeScore')).toContainText('first attempts');
});

test('P5 transfer atlas remains within viewport on desktop and mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/17_power_topology_control/');
    await expect(page.locator('#p5TransferVerification')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
