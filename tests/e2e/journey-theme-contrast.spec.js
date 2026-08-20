const { test, expect } = require('@playwright/test');

test('Power Firmware Journey keeps the 16/17 dark theme contract readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Contrast contract only needs one desktop pass.');
  await page.goto('/');
  await expect(page.locator('[data-journey-stage]')).toHaveCount(8);
  await expect(page.locator('.journey-system-sticky')).toBeVisible();

  const audit = await page.evaluate(() => {
    const parseRgb = value => {
      const match = String(value || '').match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d*\.?\d+))?\)/i);
      if (!match) return null;
      return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] == null ? 1 : Number(match[4]) };
    };
    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a);
      if (!a) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a
      };
    };
    const luminance = color => {
      const channel = value => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const contrast = (a, b) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const effectiveBackground = el => {
      const layers = [];
      for (let node = el; node; node = node.parentElement) {
        const color = parseRgb(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0) layers.push(color);
        if (color && color.a >= 0.999) break;
      }
      let composed = { r: 7, g: 16, b: 29, a: 1 };
      for (let i = layers.length - 1; i >= 0; i -= 1) composed = over(layers[i], composed);
      return composed;
    };
    const resolvedToken = token => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;left:-9999px;background:${token};color:${token}`;
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const background = parseRgb(style.backgroundColor);
      probe.remove();
      return background;
    };

    const panel = resolvedToken('var(--panel)');
    const ink = resolvedToken('var(--ink)');
    const selectors = [
      '[data-journey-stage="0"]',
      '.journey-system-sticky',
      '[data-v2-region-card]',
      '.power-v3-card'
    ];
    const samples = selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return { selector, missing: true };
      const foreground = parseRgb(getComputedStyle(el).color);
      const background = effectiveBackground(el);
      return {
        selector,
        missing: false,
        foreground,
        background,
        contrast: foreground && background ? contrast(foreground, background) : 0,
        backgroundLuminance: background ? luminance(background) : 1
      };
    });

    return {
      themed: document.body.classList.contains('cl-theme-1617'),
      panel,
      ink,
      panelLuminance: panel ? luminance(panel) : 1,
      inkLuminance: ink ? luminance(ink) : 0,
      tokenContrast: panel && ink ? contrast(panel, ink) : 0,
      samples
    };
  });

  expect(audit.themed, 'index.html must opt into the cl-theme-1617 compatibility token bridge').toBe(true);
  expect(audit.panelLuminance, `--panel must resolve dark, got ${JSON.stringify(audit.panel)}`).toBeLessThan(0.2);
  expect(audit.inkLuminance, `--ink must resolve light, got ${JSON.stringify(audit.ink)}`).toBeGreaterThan(0.7);
  expect(audit.tokenContrast, 'core --ink/--panel contrast must remain comfortably readable').toBeGreaterThanOrEqual(7);

  for (const sample of audit.samples) {
    expect(sample.missing, `${sample.selector} should exist`).toBe(false);
    expect(sample.backgroundLuminance, `${sample.selector} must not regress to a pale surface`).toBeLessThan(0.35);
    expect(sample.contrast, `${sample.selector} foreground/background contrast`).toBeGreaterThanOrEqual(4.5);
  }
});
