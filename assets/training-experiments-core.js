(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitTrainingExperiments = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "1.0.0";
  const BUCK_INPUTS = Object.freeze(Object.fromEntries(Object.entries({
    vin: { default:48, min:5, max:100, unit:'V' },
    duty: { default:.25, min:.05, max:.9, unit:'ratio' },
    inductanceUh: { default:100, min:20, max:2000, unit:'µH' },
    fswKhz: { default:100, min:20, max:500, unit:'kHz' },
    loadOhm: { default:5, min:.5, max:500, unit:'Ω' },
    capacitanceUf: { default:220, min:10, max:5000, unit:'µF' },
    esrOhm: { default:0, min:0, max:.5, unit:'Ω' }
  }).map(([key, value]) => [key, Object.freeze(value)])));
  const clone = value => JSON.parse(JSON.stringify(value));
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  function number(value, fallback, lo, hi) {
    if (value === null || value === "") throw new RangeError("數值不能留白");
    const n = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(n) || n < lo || n > hi) throw new RangeError(`Value must be within ${lo}..${hi}`);
    return n;
  }
  function buckConfig(input = {}) {
    return Object.fromEntries(Object.entries(BUCK_INPUTS).map(([key, spec]) =>
      [key, number(input[key], spec.default, spec.min, spec.max)]));
  }
  // Ideal diode Buck, fixed duty, resistive load, steady state and small output ripple.
  // DCM: K*M^2 = D^2*(1-M), K = 2*L*fs/R; boundary K = 1-D.
  function buck(input = {}) {
    const c = buckConfig(input), D = c.duty, L = c.inductanceUh * 1e-6, f = c.fswKhz * 1000;
    const K = 2 * L * f / c.loadOhm, boundaryK = 1 - D;
    const regime = Math.abs(K - boundaryK) < 1e-9 ? "BCM" : K < boundaryK ? "DCM" : "CCM";
    const M = regime === "DCM" ? 2 * D / (D + Math.sqrt(D * D + 4 * K)) : D;
    const vout = M * c.vin, avgI = vout / c.loadOhm, ripple = (c.vin - vout) * D / (L * f);
    const minI = regime === "CCM" ? Math.max(0, avgI - ripple / 2) : 0;
    const discharge = regime === "DCM" ? D * (1 - M) / M : 1 - D;
    const current = phase => phase <= D ? minI + ripple * phase / D
      : phase < D + discharge ? minI + ripple * (1 - (phase - D) / discharge) : minI;
    const n = 512, T = 1 / f;
    const rows = Array.from({ length: n + 1 }, (_, i) => ({ tUs: i / n * T * 1e6, iL: current(i / n) }));
    let chargeV = 0;
    rows.forEach((row, i) => {
      if (i) chargeV += ((rows[i - 1].iL + row.iL) / 2 - avgI) * T / n / (c.capacitanceUf * 1e-6);
      row.capRipple = chargeV;
    });
    const offset = mean(rows.map(row => row.capRipple));
    rows.forEach(row => { row.vout = vout + row.capRipple - offset + c.esrOhm * (row.iL - avgI); });
    const vRipple = Math.max(...rows.map(x => x.vout)) - Math.min(...rows.map(x => x.vout));
    return {
      version: VERSION, config: c, regime, vout, avgI, minI, peakI: minI + ripple, ripple,
      boundaryOhm: 2 * L * f / (1 - D), idealCcmVout: D * c.vin,
      zeroFraction: Math.max(0, 1 - D - discharge), periodUs: T * 1e6, vRipple,
      validSmallRipple: vRipple <= .1 * vout, rows,
      boundary: "固定 duty、二極體續流、穩態小漣波估算；不含閉環、磁飽和、開關損耗或熱模型。ESR 僅估計輸出漣波。"
    };
  }
  function scopeConfig(input = {}) {
    return {
      sampleRateKhz: number(input.sampleRateKhz, 2000, 10, 2000),
      bandwidthKhz: number(input.bandwidthKhz, 1000, 1, 1000),
      actualProbe: number(input.actualProbe, 10, 1, 10), selectedProbe: number(input.selectedProbe, 10, 1, 10),
      triggerA: number(input.triggerA, 2.4, 0, 100), windowUs: number(input.windowUs, 100, 100, 2000)
    };
  }
  function acquire(model, input = {}) {
    const c = scopeConfig(input), rows = model.rows, T = model.periodUs;
    const dtUs = T / (rows.length - 1), alpha = Math.exp(-2 * Math.PI * c.bandwidthKhz * 1000 * dtUs * 1e-6);
    // Solve the periodic initial condition of a first-order analog bandwidth filter.
    let end = 0;
    for (let i = 0; i < rows.length - 1; i++) end = alpha * end + (1 - alpha) * rows[i].iL;
    let filtered = end / (1 - Math.pow(alpha, rows.length - 1));
    const analog = rows.slice(0, -1).map(row => { filtered = alpha * filtered + (1 - alpha) * row.iL; return filtered; });
    const probeRatio = c.selectedProbe / c.actualProbe;
    const displayed = analog.map(x => x * probeRatio);
    let triggerIndex = -1;
    for (let i = 1; i < displayed.length; i++) if (displayed[i - 1] < c.triggerA && displayed[i] >= c.triggerA) { triggerIndex = i; break; }
    const startUs = triggerIndex < 0 ? 0 : triggerIndex * dtUs;
    const samplePeriodUs = 1000 / c.sampleRateKhz;
    const samples = [];
    let clipped = false;
    for (let tUs = 0; tUs <= c.windowUs; tUs += samplePeriodUs) {
      const pos = ((tUs + startUs) % T) / dtUs, index = Math.floor(pos), mix = pos - index;
      const actual = analog[index % analog.length] * (1 - mix) + analog[(index + 1) % analog.length] * mix;
      const connectorV = actual / c.actualProbe; // 1 V/A transducer, +/-5 V scope range.
      if (Math.abs(connectorV) > 5) clipped = true;
      const code = Math.round((Math.max(-5, Math.min(5, connectorV)) + 5) / 10 * 1023);
      samples.push({ tUs, value: (code / 1023 * 10 - 5) * c.selectedProbe });
    }
    const f = model.config.fswKhz, aliasKhz = Math.abs(f - Math.round(f / c.sampleRateKhz) * c.sampleRateKhz);
    return {
      config: c, samples, triggered: triggerIndex >= 0, clipped, probeRatio,
      aliasKhz, undersampled: c.sampleRateKhz <= 2 * f, pointsPerPeriod: c.sampleRateKhz / f,
      bandwidthLimited: c.bandwidthKhz < f, avg: mean(samples.map(x => x.value)),
      peakToPeak: Math.max(...samples.map(x => x.value)) - Math.min(...samples.map(x => x.value))
    };
  }
  function question(kind, seed = 1, transfer = false) {
    const slot = Math.abs(Math.floor(Number(seed) || 1)) % 17;
    const first = transfer ? 200 + slot * 10 : 100 + slot * 5;
    if (kind === "physics") return { kind, seed, transfer,
      prompt: transfer ? `同一理想 CCM Buck，fsw 從 ${first} kHz 增至 ${first * 2} kHz；Vin、Vout、L 固定，ΔIL 比值？` : `同一理想 CCM Buck，L 從 ${first} µH 增至 ${first * 2} µH；Vin、Vout、fsw 固定，ΔIL 比值？`,
      choices: [["half", "0.5 倍"], ["double", "2 倍"], ["same", "不變"]], expected: "half",
      mistake: "物理方向", explanation: "di/dt = vL/L；漣波還取決於斜率作用時間。固定電壓時，L 或 fsw 加倍會使漣波減半。" };
    if (kind === "unit") {
      const uh = transfer ? 680 + slot * 10 : 470 + slot * 10;
      return { kind, seed, transfer, prompt: transfer ? `${uh} µH 要寫進以 H 為單位的模型，應輸入多少 H？` : `${uh / 1000} mH 換成 µH 是多少？`,
        expected: transfer ? uh * 1e-6 : uh, unit: transfer ? "H" : "µH", mistake: "單位換算", explanation: "1 mH = 1000 µH；1 µH = 10⁻⁶ H。先把單位換到模型要求的單位，再代入。" };
    }
    if (kind === "timing") {
      const T = transfer ? 5 : 10, done = transfer ? 5.1 + slot * .01 : 10;
      return { kind, seed, transfer, prompt: `ZERO 每 ${T} µs 發生一次。這拍從 0 起算，shadow write 在 ${done.toFixed(2)} µs 完成；必須嚴格早於 ZERO，最早在哪個時刻 active？`,
        choices: [[String(T), `${T} µs`], [String(2 * T), `${2 * T} µs`], ["immediate", "算完立刻"]], expected: String(2 * T),
        mistake: "取樣／致動時序", explanation: "算完是 command ready；嚴格早於 load event 才能套用。同時或太晚都必須等下一個 ZERO。" };
    }
    if (kind !== "model") throw new Error("Unknown remediation category");
    if (transfer) {
      const L = 80 + slot * 10, fs = 120, D = .4;
      const boundary = 2 * L * 1e-6 * fs * 1000 / (1 - D);
      const load = slot % 2 ? boundary / 2 : boundary * 2;
      return { kind, seed, transfer,
        prompt: `換成 D=0.4、L=${L} µH、fsw=120 kHz 的 Buck；Rcrit=2·L·fsw/(1−D)=${boundary.toFixed(1)} Ω，負載為 ${load.toFixed(1)} Ω。穩態應用哪個模型？`,
        choices: [["dcm", "DCM：輸出需納入負載"], ["ccm", "CCM：本例可用 D·Vin"], ["pi", "無法判斷，先調 PI"]], expected: slot % 2 ? "ccm" : "dcm",
        mistake: "模型適用範圍", explanation: "R 高於臨界值代表較輕負載，iL 有零電流區間，使用 DCM；R 低於臨界值則使用 CCM。" };
    }
    return { kind, seed, transfer,
      prompt: "固定 duty 的二極體 Buck，iL 每拍降到零並停留；還能直接用 CCM 的 Vout=D·Vin 嗎？",
      choices: [["dcm", "改用 DCM 模型，納入負載"], ["ccm", "永遠使用 D·Vin"], ["pi", "先加大 PI"]], expected: "dcm",
      mistake: "模型適用範圍", explanation: "零電流區間改變能量傳輸；固定 duty 的 DCM 輸出還依賴負載，不能沿用 CCM 比例。" };
  }
  function checkAnswer(q, answer) {
    const correct = typeof q.expected === "number" ? String(answer).trim() !== "" && Number.isFinite(Number(answer)) && Math.abs(Number(answer) - q.expected) <= Math.max(1e-10, Math.abs(q.expected) * .005) : answer === q.expected;
    return { correct, mistake: correct ? null : q.mistake };
  }
  function miniExperiment(kind) {
    if (kind === "physics") { const a = buck(), b = buck({ inductanceUh: 200 }); return { text: `L 100→200 µH：ΔIL ${a.ripple.toFixed(3)}→${b.ripple.toFixed(3)} A；換一個變數 fsw 再驗證。`, values: [a.ripple, b.ripple] }; }
    if (kind === "unit") { const a = buck({ inductanceUh: 470 }), b = buck({ inductanceUh: 47 }); return { text: `470 µH 與誤少一位的 47 µH：ΔIL ${a.ripple.toFixed(3)}→${b.ripple.toFixed(3)} A。輸入前先做 mH/µH/H 單位核對。`, values: [a.ripple, b.ripple] }; }
    if (kind === "timing") { const times = [9.9, 10, 10.1].map(t => (Math.floor(t / 10) + 1) * 10); return { text: `shadow write 9.9、10、10.1 µs → active ${times.join('、')} µs。等於 deadline 也來不及。`, values: times }; }
    const a = buck({ loadOhm: 5 }), b = buck({ loadOhm: 100 });
    return { text: `負載 5→100 Ω：${a.regime}→${b.regime}；Vout ${a.vout.toFixed(2)}→${b.vout.toFixed(2)} V，D·Vin 仍是 12 V。`, values: [a.vout, b.vout] };
  }
  function fingerprint(value) {
    function canonical(x) { if (Array.isArray(x)) return x.map(canonical); if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map(key => [key, canonical(x[key])])); return x; }
    let hash = 2166136261;
    for (const char of JSON.stringify(canonical(value))) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function snapshot(config, instrument) {
    const model = buck(config), scope = acquire(model, instrument);
    return { modelVersion: VERSION, model: model.config, instrument: scope.config,
      metrics: { vout: model.vout, ripple: model.ripple, regime: model.regime, measuredRipple: scope.peakToPeak, triggered: scope.triggered },
      waveform: scope.samples, digest: fingerprint({ model: model.config, instrument: scope.config }) };
  }
  function createExperiment(config, instrument, id) {
    const initial = snapshot(config, instrument);
    return { schema: "circuit-training-experiment", version: 1, modelVersion: VERSION,
      id: id || `experiment-${Date.now()}`, seed: 1, initial: { model: initial.model, instrument: initial.instrument }, actions: [], snapshots: [{ label: "原始", ...initial }] };
  }
  function replay(value) {
    if (!value || value.schema !== "circuit-training-experiment" || value.version !== 1 || value.modelVersion !== VERSION) throw new Error("不相容的實驗或模型版本");
    if (!Array.isArray(value.actions) || value.actions.length > 100 || !value.initial) throw new Error("實驗操作格式錯誤");
    let model = buckConfig(value.initial.model), instrument = scopeConfig(value.initial.instrument);
    for (const action of value.actions) {
      if (!action || !["model", "instrument"].includes(action.target)) throw new Error("未知操作");
      const target = action.target === "model" ? model : instrument;
      if (!Object.hasOwn(target, action.key)) throw new Error("未知參數");
      target[action.key] = action.value;
      model = buckConfig(model); instrument = scopeConfig(instrument);
    }
    return snapshot(model, instrument); // Never trust imported waveform/metrics as computed truth.
  }
  function changeExperiment(record, target, key, value) {
    const next = clone(record);
    next.actions.push({ target, key, value });
    replay(next);
    return next;
  }
  function capture(record, label) {
    const next = clone(record), frame = replay(next);
    if (next.snapshots.length >= 3) throw new Error("三組對照已滿，請開新實驗");
    next.snapshots.push({ label: String(label).slice(0, 40), atAction: next.actions.length, ...frame });
    return next;
  }
  function validateExperiment(value) {
    const final = replay(value);
    if (!Array.isArray(value.snapshots) || value.snapshots.length > 3) throw new Error("實驗快照格式錯誤");
    const clean = createExperiment(value.initial.model, value.initial.instrument, String(value.id || "imported").slice(0, 80));
    clean.actions = value.actions.map(x => ({ target: x.target, key: x.key, value: Number(x.value) }));
    clean.snapshots = value.snapshots.map((frame, index) => {
      const count = index === 0 ? 0 : frame.atAction;
      if (!Number.isInteger(count) || count < 0 || count > clean.actions.length) throw new Error("快照操作位置錯誤");
      return { label: String(frame.label || "對照").slice(0, 40), atAction: count, ...replay({ ...clean, actions: clean.actions.slice(0, count) }) };
    });
    return { record: clean, final };
  }
  return { VERSION, BUCK_INPUTS, buckConfig, buck, scopeConfig, acquire, question, checkAnswer, miniExperiment, fingerprint, snapshot, createExperiment, replay, changeExperiment, capture, validateExperiment };
});
