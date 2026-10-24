import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const routes = ['9.afe-tutorial/afe.html', '9.afe-tutorial/simulator-core.html'];

function loadAfe(route) {
  const source = fs.readFileSync(new URL('../' + route, import.meta.url), 'utf8');
  const canvasText = [];
  // Only the browser drawing/DOM boundary is replaced; both production renderers run.
  const drawing = {
    clearRect() { canvasText.length = 0; },
    scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    setLineDash() {}, fillRect() {}, strokeRect() {},
    fillText(value) { canvasText.push(value); }
  };
  const nodes = new Map();
  const getNode = id => {
    if (!nodes.has(id)) nodes.set(id, { innerText: '', style: {} });
    return nodes.get(id);
  };
  nodes.set('scope-canvas', {
    parentElement: { clientWidth: 800, clientHeight: 400 },
    getContext() { return drawing; }
  });
  const context = vm.createContext({
    document: { getElementById: getNode },
    window: { devicePixelRatio: 1, addEventListener() {} }
  });
  const start = source.indexOf('const TS =');
  const end = source.indexOf('const styleSheet =');
  assert.ok(start >= 0 && end > start, 'AFE engine and renderer script boundary');
  vm.runInContext(source.slice(start, end) +
    '\nthis.engine = {runAfeEngine, settings, scopeBuffer, drawScope, updateWidgets};',
    context, { filename: route });
  return { ...context.engine, canvasText, getNode };
}

function displayedRms(engine) {
  engine.drawScope();
  engine.updateWidgets();
  const ch1 = engine.canvasText.find(text => text.startsWith('CH1 '));
  assert.ok(ch1, 'canvas CH1 measurement is rendered');
  return {
    CH1: Number(ch1.split(':')[1].trim().split(' ')[0]),
    topology: Number(engine.getNode('topo-vgrid').innerText.split(' ')[0])
  };
}

function replaceVoltage(engine, samples) {
  engine.scopeBuffer.v_grid.splice(0, engine.scopeBuffer.v_grid.length, ...samples);
}

for (const route of routes) {
  for (const binding of ['CH1', 'topology']) {
    test(`${route}: ${binding} measures harmonic energy rather than positive peak`, () => {
      const e = loadAfe(route), r2 = Math.SQRT2;
      // Eight equally spaced samples of 10 sin(theta) + A sin(3 theta).
      // Orthogonality gives mean squares (100 + A^2)/2: 50, 58, 82.
      for (const { samples, want } of [
        { samples: [0, 5*r2, 10, 5*r2, 0, -5*r2, -10, -5*r2], want: 7.1 },
        { samples: [0, 7*r2, 6, 7*r2, 0, -7*r2, -6, -7*r2], want: 7.6 },
        { samples: [0, 9*r2, 2, 9*r2, 0, -9*r2, -2, -9*r2], want: 9.1 }
      ]) {
        replaceVoltage(e, samples);
        assert.equal(displayedRms(e)[binding], want, `${binding}: harmonic amplitude`);
      }
    });

    test(`${route}: ${binding} preserves whole-cycle RMS when harmonic phase reverses`, () => {
      const e = loadAfe(route), r2 = Math.SQRT2;
      // 10 sin(theta) - 4 sin(3 theta): still sqrt(58), despite peak 14.
      replaceVoltage(e, [0, 3*r2, 14, 3*r2, 0, -3*r2, -14, -3*r2]);
      assert.equal(displayedRms(e)[binding], 7.6);
    });

    test(`${route}: ${binding} uses the entire finite window including negative samples`, () => {
      const e = loadAfe(route), r2 = Math.SQRT2;
      // Partial-cycle mean squares are 134/3 and 214/3; phase now matters.
      for (const { samples, want } of [
        { samples: [0, 7*r2, 6], want: 6.7 },
        { samples: [0, 3*r2, 14], want: 8.4 },
        { samples: [-3, -4], want: 3.5 }
      ]) {
        replaceVoltage(e, samples);
        assert.equal(displayedRms(e)[binding], want);
      }
    });

    test(`${route}: ${binding} stays finite for initial, first-sample, and empty windows`, () => {
      const e = loadAfe(route);
      assert.equal(displayedRms(e)[binding], 0);
      e.runAfeEngine();
      // First sample is 155 sin(0.006 pi) = 2.9215 V; 399 startup zeros remain.
      // sqrt(2.9215^2 / 400) = 0.1461 V, displayed to one decimal place.
      assert.equal(displayedRms(e)[binding], 0.1);
      replaceVoltage(e, []);
      assert.equal(displayedRms(e)[binding], 0);
    });

    test(`${route}: ${binding} follows the rolling 400-sample harmonic window`, () => {
      const e = loadAfe(route);
      e.settings.thdPercent = 20;
      e.settings.phaseShiftDeg = 45;
      for (let n = 0; n < 400; n++) e.runAfeEngine();
      // Independent grid-vector sums at theta_n = 0.006*pi*n + pi/4:
      // n=1..400 => sqrt(mean(v_n^2)) = 115.2380901449 V.
      assert.equal(displayedRms(e)[binding], 115.2);
      e.runAfeEngine();
      // n=2..401 => 115.2859296970 V; the oldest sample must leave the window.
      assert.equal(displayedRms(e)[binding], 115.3);
    });
  }
}
