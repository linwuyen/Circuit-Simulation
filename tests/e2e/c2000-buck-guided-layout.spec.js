const { test, expect } = require('@playwright/test');

const layers = [
  'physics',
  'sensing',
  'feedback',
  'timing',
  'dynamics',
  'safety',
  'production',
  'evidence'
];

async function readLayout(page, layer) {
  const panel = page.locator(`[data-core-layer-panel="${layer}"]`);
  await expect(panel).toBeVisible();

  return panel.evaluate(element => {
    const panelRect = element.getBoundingClientRect();
    const shellRect = document.querySelector('.lab-shell').getBoundingClientRect();
    return {
      panelWidth: panelRect.width,
      shellWidth: shellRect.width,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
}

test.describe('C2000 Buck guided layout', () => {
  test('all eight guided layers fill the desktop workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const layer of layers) {
      await page.goto(`/19_c2000_buck_firmware_lab/index.html?layer=${layer}`);
      const layout = await readLayout(page, layer);

      expect(layout.overflow, `${layer} should not overflow horizontally`).toBe(false);
      expect(
        layout.panelWidth / layout.shellWidth,
        `${layer} should fill the guided workspace`
      ).toBeGreaterThan(0.95);
    }
  });

  test('all eight guided layers remain overflow-free on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const layer of layers) {
      await page.goto(`/19_c2000_buck_firmware_lab/index.html?layer=${layer}`);
      const layout = await readLayout(page, layer);

      expect(layout.overflow, `${layer} should not overflow horizontally on mobile`).toBe(false);
    }
  });
});
