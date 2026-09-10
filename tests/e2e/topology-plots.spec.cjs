const { test, expect } = require('@playwright/test');

async function observePlots(page) {
  await page.addInitScript(() => {
    window.topologyPlotStrokes = {};
    const paths = new WeakMap(), proto = CanvasRenderingContext2D.prototype;
    for (const method of ['beginPath', 'moveTo', 'lineTo', 'stroke', 'clearRect']) {
      const original = proto[method];
      proto[method] = function (...args) {
        const id = this.canvas.id;
        if (method === 'clearRect') window.topologyPlotStrokes[id] = [];
        if (method === 'beginPath') paths.set(this, []);
        if (method === 'moveTo' || method === 'lineTo') paths.get(this)?.push({ method, x: args[0], y: args[1] });
        if (method === 'stroke') {
          (window.topologyPlotStrokes[id] ||= []).push({ color: this.strokeStyle, points: [...(paths.get(this) || [])] });
        }
        return original.apply(this, args);
      };
    }
  });
}

async function plotData(page, id) {
  return page.evaluate(canvasId => {
    const canvas = document.getElementById(canvasId), ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = { '#58d6ff': [88, 214, 255], '#ffcb66': [255, 203, 102] };
    return Object.entries(colors).map(([color, rgb]) => {
      let paintedPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (rgb.every((n, c) => pixels[i + c] === n) && pixels[i + 3] === 255) paintedPixels++;
      }
      return { color, paintedPixels, paths: (window.topologyPlotStrokes[canvasId] || []).filter(s => s.color === color).map(s => s.points) };
    });
  }, id);
}

test('Module 17 paints magnitude and phase data on every Bode canvas, not just axes', async ({ page }) => {
  await observePlots(page);
  await page.goto('/17_power_topology_control/');
  for (const id of ['buckBode', 'boostBode', 'pfcCurrentBode', 'pfcVoltageBode', 'psfbBode', 'invBode']) {
    await expect(page.locator('#' + id)).toBeVisible();
    for (const curve of await plotData(page, id)) {
      expect(curve.paths.length, `${id}: ${curve.color} has a stroked data path`).toBeGreaterThan(0);
      const points = curve.paths.flat();
      expect(points.filter(p => p.method === 'lineTo').length, `${id}: ${curve.color} connects sampled values`).toBeGreaterThan(100);
      expect(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      expect(curve.paintedPixels, `${id}: ${curve.color} reaches actual canvas pixels`).toBeGreaterThan(80);
    }
  }
  // The same drawing helper also accepts the numeric LLC gain samples.
  const llc = (await plotData(page, 'llcGainCanvas'))[0];
  expect(llc.paths.flat().filter(p => p.method === 'lineTo').length).toBeGreaterThan(100);
  expect(llc.paintedPixels).toBeGreaterThan(80);
});

test('changing a topology operating point redraws its actual response curves', async ({ page }) => {
  await observePlots(page);
  await page.goto('/17_power_topology_control/');
  const before = await plotData(page, 'boostBode');
  await page.locator('#dutyBoost').fill('75');
  const after = await plotData(page, 'boostBode');
  for (let i = 0; i < after.length; i++) {
    expect(after[i].paths).not.toEqual(before[i].paths);
    expect(after[i].paintedPixels).toBeGreaterThan(80);
  }
  await page.locator('#invMode').selectOption('lcl');
  for (const curve of await plotData(page, 'invBode')) {
    expect(curve.paths.flat().filter(p => p.method === 'lineTo').length).toBeGreaterThan(100);
    expect(curve.paintedPixels).toBeGreaterThan(80);
  }
});
