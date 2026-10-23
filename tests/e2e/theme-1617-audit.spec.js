const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const shellPages = [
  'catalog.html',
  'beginner.html',
  'labs.html',
  'progress.html',
  'quiz.html',
  'search.html',
  'glossary.html',
  'troubleshooting.html',
  'report.html'
];
const referencePages = [
  '16_control_transforms/index.html',
  '17_power_topology_control/index.html'
];

function formalCurriculumPages() {
  const file = path.join(repoRoot, 'assets', 'learning', 'curriculum.js');
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  const curriculum = context.window.CircuitCurriculum;
  const refs = new Set();

  for (const module of curriculum.modules || []) {
    const moduleNumber = Number(module.number);
    if (!Number.isFinite(moduleNumber) || moduleNumber > 15) continue;
    const base = String(module.entry || '').replace(/[^/]+$/, '');
    if (module.entry) refs.add(module.entry);

    for (const lesson of module.lessons || []) {
      const href = Array.isArray(lesson) ? lesson[0] : lesson.href;
      if (href) refs.add(base + href);
    }
    for (const lab of module.labs || []) {
      const href = Array.isArray(lab) ? lab[2] : lab.href;
      if (href) refs.add(href);
    }
    for (const fault of module.faults || []) {
      const href = Array.isArray(fault) ? fault[4] : fault.href;
      if (href) refs.add(href);
    }
  }
  return [...refs].sort();
}

function asUrlPath(ref) {
  return '/' + ref.split('/').map(encodeURIComponent).join('/');
}

const pages = [...new Set([...shellPages, ...formalCurriculumPages()])];

async function waitForAuditReady(page, { shell = false, reference = false, timeout = 12000 } = {}) {
  await page.waitForFunction(({ shell, reference }) => {
    // goto(DOMContentLoaded) may belong to a zero-delay meta-refresh launcher.
    // Do not sample that document or its still-initializing destination.
    if (document.readyState === 'loading' || document.querySelector('meta[http-equiv="refresh" i]')) return false;
    if (reference) return Boolean(document.querySelector('.clt-root'));
    const themeLoaded = sheet => {
      try {
        const rules = [...sheet.cssRules];
        if (sheet.href && new URL(sheet.href).pathname.endsWith('/theme-1617.css')) return rules.length > 0;
        return rules.some(rule => rule.styleSheet && themeLoaded(rule.styleSheet));
      } catch (_) { return false; }
    };
    // Shell pages import the sheet via learning-v3.css; lessons inject it after
    // async tutor dependencies. The class alone precedes CSS loading.
    return (shell ? Boolean(document.querySelector('#app main')) : document.body.classList.contains('cl-theme-1617'))
      && [...document.styleSheets].some(themeLoaded)
      && Boolean(getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim());
  }, { shell, reference }, { timeout });
}


test.describe('Module 0-15 visual language audit', () => {
  test('redirect readiness waits for delayed target tutor and theme stylesheet', async ({ page }) => {
    const delayed = [];
    await page.route('**/assets/learning/{tutor.js,theme-1617.css}', async route => {
      if (!new URL(route.request().frame().url()).pathname.endsWith('/7.28388d_bms_tutorial/index.html')) { await route.continue(); return; }
      delayed.push(new URL(route.request().url()).pathname);
      // Inject a slow target dependency, not a readiness sleep in the audit.
      await new Promise(resolve => setTimeout(resolve, 450));
      await route.continue();
    });
    await page.goto('/7.28388d_bms_tutorial/START_HERE.html', { waitUntil: 'domcontentloaded' });
    await waitForAuditReady(page);
    expect(new URL(page.url()).pathname).toBe('/7.28388d_bms_tutorial/index.html');
    const ready = await page.evaluate(() => ({
      themed: document.body.classList.contains('cl-theme-1617'),
      stylesheet: getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim()
    }));
    const cardBackground = await page.locator('.card').first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(ready, `Final target card background at sampling: ${cardBackground}`).toEqual({ themed: true, stylesheet: '#07101d' });
    expect(delayed.some(url => url.endsWith('/tutor.js'))).toBe(true);
    expect(delayed.some(url => url.endsWith('/theme-1617.css'))).toBe(true);
  });

  test('readiness fails closed when the compatibility stylesheet is missing', async ({ page }) => {
    await page.route('**/assets/learning/theme-1617.css', route => route.abort());
    await page.goto('/7.28388d_bms_tutorial/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveClass(/cl-theme-1617/);
    await expect(waitForAuditReady(page, { timeout: 1000 })).rejects.toThrow(/Timeout/);
  });

  test('learning shell and formal curriculum pages contain no legacy pale surfaces', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Run the expensive full-site surface audit once on desktop.');
    test.setTimeout(300000);

    const failures = [];
    let currentRef = '';
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(`${currentRef}: ${error.message}`));

    for (const ref of pages) {
      currentRef = ref;
      const response = await page.goto(asUrlPath(ref), { waitUntil: 'domcontentloaded', timeout: 12000 });
      if (!response || !response.ok()) {
        failures.push(`${ref}: navigation failed (${response ? response.status() : 'no response'})`);
        continue;
      }
      await waitForAuditReady(page, { shell: shellPages.includes(ref) });

      const result = await page.evaluate(() => {
        const parseRgb = value => {
          const match = String(value || '').match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d*\.?\d+))?\)/i);
          if (!match) return null;
          return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] == null ? 1 : Number(match[4]) };
        };
        const isPale = color => {
          if (!color || color.a < 0.5) return false;
          const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
          return luminance > 0.72 && Math.min(color.r, color.g, color.b) >= 180;
        };
        const visible = el => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 4 && rect.height > 4;
        };
        const selectorFor = el => {
          if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
          const classes = [...el.classList].slice(0, 3);
          return el.tagName.toLowerCase() + (classes.length ? '.' + classes.join('.') : '');
        };

        const suspects = [];
        const classPattern = /(panel|card|block|metric|surface|box|callout|note|challenge|goal|recap|diagram|schematic|quiz|scope|workspace|status|route|scenario|lesson|module|step|flow-node|table-wrap|control|stat|viz|teach|trythis|takeaways|sim-shell|ms-|trainer|evidence|progress|report)/i;
        const tags = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'DETAILS', 'TABLE', 'BUTTON']);

        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el)) continue;
          const className = typeof el.className === 'string' ? el.className : '';
          if (!tags.has(el.tagName) && !classPattern.test(className)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width * rect.height < 120) continue;
          const style = getComputedStyle(el);
          const color = parseRgb(style.backgroundColor);
          if (isPale(color)) {
            suspects.push(`${selectorFor(el)} background=${style.backgroundColor}`);
            if (suspects.length >= 12) break;
          }
        }

        if (suspects.length < 12) {
          for (const el of document.querySelectorAll('svg rect, svg polygon')) {
            if (!visible(el)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width * rect.height < 700) continue;
            const style = getComputedStyle(el);
            const color = parseRgb(style.fill);
            if (isPale(color)) {
              suspects.push(`${selectorFor(el)} fill=${style.fill}`);
              if (suspects.length >= 12) break;
            }
          }
        }

        return {
          suspects,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });

      if (result.suspects.length) failures.push(`${ref}:\n  - ${result.suspects.join('\n  - ')}`);
      if (result.horizontalOverflow > 24) failures.push(`${ref}: desktop horizontal overflow ${result.horizontalOverflow}px`);
    }

    failures.push(...pageErrors.slice(0, 20));
    expect(failures, `16/17 theme audit found ${failures.length} page-level issue(s) across ${pages.length} learning-shell + Module 0-15 pages:\n\n${failures.join('\n\n')}`).toEqual([]);
  });

  test('Modules 16 and 17 remain independent visual references', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Reference isolation check runs once on desktop.');
    for (const ref of referencePages) {
      const response = await page.goto(asUrlPath(ref), { waitUntil: 'domcontentloaded' });
      expect(response && response.ok(), `${ref} should load`).toBeTruthy();
      await waitForAuditReady(page, { reference: true });
      const themed = await page.evaluate(() => document.body.classList.contains('cl-theme-1617'));
      expect(themed, `${ref} must not receive the Module 0-15 compatibility theme`).toBe(false);
    }
  });
});
