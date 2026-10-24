import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../8.ad5543_simulator/' + path, import.meta.url), 'utf8');

function lesson(file) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', style: {} });
    return nodes.get(id);
  };
  const math = Object.create(Math);
  // Keep the real quiz shuffle deterministic; the new concept is among the first three questions.
  math.random = () => 0.999999;
  const ctx = vm.createContext({ document: { getElementById: get }, Math: math });
  ctx.window = ctx;
  vm.runInContext(read('assets/common.js'), ctx);
  if (file) {
    const inline = [...read(file).matchAll(/<script>([\s\S]*?)<\/script>/g)];
    for (const script of inline) vm.runInContext(script[1], ctx, { filename: file });
  }
  return { ctx, get, DAC: ctx.DAC };
}

function quizItems(html) {
  return html.split('<div class="qitem">').slice(1).map(item => ({
    html: item,
    question: item.match(/<p class="qq">([^<]+)<\/p>/)?.[1],
    options: [...item.matchAll(/<button class="(qopt[^\"]*)" onclick="__quizPick\((\d+),(\d+)\)">([^<]+)<\/button>/g)]
      .map(([, classes, qi, oi, text]) => ({ classes, qi: Number(qi), oi: Number(oi), text })),
  }));
}

// Break caught: interpreting unsigned D as a signed coefficient, or mistaking a
// polarity inverter for the reference-offset summing circuit (ADI Rev H, p9/p11).
test('both existing AD5543 topologies keep one gain sign for every unsigned code', () => {
  const { DAC } = lesson();
  const fixtures = [
    { mode: 'standard', vref: 8, want: [0, -2, -4, -7.9998779296875], unavailable: 2 },
    { mode: 'standard', vref: -8, want: [0, 2, 4, 7.9998779296875], unavailable: -2 },
    { mode: 'positive', vref: 8, want: [0, 2, 4, 7.9998779296875], unavailable: -2 },
    { mode: 'positive', vref: -8, want: [0, -2, -4, -7.9998779296875], unavailable: 2 },
  ];
  const codes = [0, 16384, 32768, 65535];
  for (const { mode, vref, want, unavailable } of fixtures) {
    for (let i = 0; i < codes.length; i++) {
      const actual = DAC.compute({ mode, vref, code: codes[i] });
      assert.ok(Math.abs(actual.finalV - want[i]) < 1e-12, `${mode}, VREF=${vref}, D=${codes[i]}`);
    }
    assert.equal(DAC.solveCode(unavailable, vref, mode).reachable, false);
    // Midcode is +/-4 V here; the datasheet's bipolar summing topology would be 0 V.
    assert.notEqual(DAC.compute({ mode, vref, code: 32768 }).finalV, 0);
  }
});

test('an AC reference reverses the output while the standard digital gain stays negative', () => {
  const { DAC } = lesson();
  // Independent quarter-cycle reference samples, D=32768: -1/2 gain throughout.
  const samples = [0, 8, 0, -8, 0];
  const want = [0, -4, 0, 4, 0];
  for (let i = 0; i < samples.length; i++) {
    const out = DAC.compute({ vref: samples[i], code: 32768, mode: 'standard' }).finalV;
    assert.ok(Math.abs(out - want[i]) < 1e-12);
    if (samples[i] !== 0) assert.equal(out / samples[i], -0.5);
  }
});

// Explicit teaching-contract regression: reject the erroneous premise in the
// rendered reference explanation without snapshotting a particular sentence.
test('the rendered quadrant reference cannot claim AC VREF alone supplies four-quadrant gain', () => {
  const refs = lesson('01-ratio.html').get('refs').innerHTML;
  assert.doesNotMatch(refs, /(?:VREF|AC)[^<。]*?(?:時為|就(?:是|成為)|即為)\s*(?:4|四)\s*象限/);
});

for (const file of ['01-ratio.html', '09-applications.html']) {
  // Break caught: lesson grading rewards the false AC => four-quadrant inference.
  test(`${file}: actual quiz rejects AC-only four-quadrant reasoning`, () => {
    const l = lesson(file);
    const find = () => quizItems(l.get('quiz').innerHTML).find(q => /AC/.test(q.question) && /象限/.test(q.question));
    const q = find();
    assert.ok(q, 'the lesson must assess whether AC VREF alone changes the multiplying quadrants');
    const wrong = q.options.find(o => /^會，AC/.test(o.text));
    const right = q.options.find(o => /仍是二象限/.test(o.text) && /偏移加總/.test(o.text));
    assert.ok(wrong && right, 'the assessment must distinguish reference sign from bipolar gain');
    l.ctx.__quizPick(wrong.qi, wrong.oi);
    assert.match(find().options.find(o => o.oi === wrong.oi).classes, /\bwrong\b/);
    l.ctx.__quizPick(right.qi, right.oi);
    assert.match(find().options.find(o => o.oi === right.oi).classes, /\bcorrect\b/);
    assert.doesNotMatch(find().html, /class="qopt wrong"/);
  });
}
