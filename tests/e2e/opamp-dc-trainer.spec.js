const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/12_opamp_slew_rate/reasoning_trainer.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('OPA trainer starts at one Level 0 reasoning step with circuit and mastery visible', async ({ page }) => {
  await expect(page.locator('[data-opamp-dc-trainer]')).toBeVisible();
  await expect(page.locator('[data-current-level]')).toContainText('Level 0');
  await expect(page.locator('[data-current-skill]')).toContainText('UNIT_CONVERSION');
  await expect(page.locator('[data-trainer-prompt]')).not.toHaveText('');
  await expect(page.locator('[data-mastery-list] .mastery-row')).toHaveCount(8);
  await expect(page.locator('svg')).toContainText('Vout = ?');
  await expect(page.locator('[data-trainer-question-card]')).toBeVisible();
  await expect(page.locator('[data-trainer-report]')).toBeHidden();
});

test('wrong feedback-drop answer decomposes arithmetic, units, conversion, then retries original', async ({ page }) => {
  await page.evaluate(() => {
    const host=document.querySelector('[data-opamp-dc-trainer]');
    const ui=host.__trainer;
    const q={id:'e2e-fb',kind:'main',skill:'FEEDBACK_DROP',level:5,prompt:'30 µA × 40 kΩ = ? V',answerType:'number',expected:1.2,unit:'V',errorType:'FEEDBACK_DROP',meta:{currentUa:30,resistanceK:40},signature:'e2e',highlight:'rf',hints:[]};
    ui.session.current=q;
    ui.renderQuestion(q);
  });
  await page.locator('[data-trainer-answer]').fill('0.75');
  await page.locator('[data-trainer-submit]').click();
  await expect(page.locator('[data-trainer-feedback]')).toContainText('先不要看完整答案');
  await expect(page.locator('[data-trainer-prompt]')).toContainText('先只算數字');

  await page.locator('[data-trainer-answer]').fill('1200');
  await page.locator('[data-trainer-submit]').click();
  await expect(page.locator('[data-trainer-prompt]')).toContainText('µA × kΩ');
  await page.getByRole('button',{name:'mV',exact:true}).click();
  await expect(page.locator('[data-trainer-prompt]')).toContainText('1200 mV');
  await page.locator('[data-trainer-answer]').fill('1.2');
  await page.locator('[data-trainer-submit]').click();
  await expect(page.locator('[data-trainer-prompt]')).toHaveText('30 µA × 40 kΩ = ? V');
  await page.locator('[data-trainer-answer]').fill('1.2');
  await page.locator('[data-trainer-submit]').click();
  await expect(page.locator('[data-trainer-feedback]')).toContainText('這一步正確');
});

test('mastery persists locally and hinted answers are tracked', async ({ page }) => {
  const expected=await page.evaluate(() => document.querySelector('[data-opamp-dc-trainer]').__trainer.session.current.expected);
  await page.locator('[data-trainer-hint]').click();
  await expect(page.locator('[data-trainer-hint-text]')).toContainText('Hint 1/');
  await page.locator('[data-trainer-answer]').fill(String(expected));
  await page.locator('[data-trainer-submit]').click();
  await page.waitForTimeout(550);
  const before=await page.evaluate(() => JSON.parse(localStorage.getItem('opamp-dc-reasoning-trainer-v2')).skills.UNIT_CONVERSION);
  expect(before.attempts).toBe(1);
  expect(before.hint_count).toBe(1);
  expect(before.clean_streak).toBe(0);
  await page.reload();
  const after=await page.evaluate(() => document.querySelector('[data-opamp-dc-trainer]').__trainer.session.mastery.skills.UNIT_CONVERSION);
  expect(after.attempts).toBe(1);
  expect(after.hint_count).toBe(1);
});

test('trainer is usable on mobile without horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/12_opamp_slew_rate/reasoning_trainer.html');
  await expect(page.locator('[data-trainer-question-card]')).toBeVisible();
  const overflow=await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});