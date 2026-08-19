const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');

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

const pages = formalCurriculumPages();

test.describe('Module 0-15 visual language audit', () => {
  test('formal curriculum pages contain no legacy pale surfaces', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Run the expensive full-site surface audit once on desktop.');
    test.setTimeout(240000);

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
      await page.waitForTimeout(140);

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
        const classPattern = /(panel|card|block|metric|surface|box|callout|note|challenge|goal|recap|diagram|schematic|quiz|scope|workspace|status|route|scenario|lesson|module|step|flow-node|table-wrap|control|stat|viz|teach|trythis|takeaways|sim-shell|ms-|trainer)/i;
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
    expect(failures, `16/17 theme audit found ${failures.length} page-level issue(s) across ${pages.length} formal Module 0-15 pages:\n\n${failures.join('\n\n')}`).toEqual([]);
  });
});
