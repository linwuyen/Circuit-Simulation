(function (global) {
  "use strict";

  const initial = Object.freeze({
    contract: { vinMin: 36, vinMax: 60, voutMin: 12, voutMax: 40, regulationPct: 1, currentLimitA: 10, rippleMvpp: 100, ocpA: 12, controlDeadlineUs: 10 },
    plant: { topology: "buck", vin: 48, duty: 0.50, fsw: 100000, inductance: 200e-6, capacitance: 470e-6, load: 6, esr: 0.05 },
    sensing: { divider: 15, adcVref: 3.3, adcMax: 4095, gainError: 0, offsetCounts: 0 },
    timing: { sampleUs: 2.5, acquisitionUs: 0.25, conversionUs: 0.45, irqUs: 0.35, computeUs: 1.2 },
    sampling: { jitterNs: 20, sourceTauUs: 0.08, synchronous: true, sampleHz: 100700, freeRunOffsetPct: 0.7 },
    actuator: { tbclkHz: 200000000, tbprd: 2000 },
    limits: { dutyMin: 0.02, dutyMax: 0.90, currentLimitA: 10 },
    control: { vref: 30, kp: 0.40, ki: 120, antiWindup: true, feedForward: true, bumpless: true },
    safety: { thresholdA: 12, currentA: 18, filterSamples: 3, tripLatched: false },
    startup: { state: "POWER_OFF", adcValid: false, selfTestPass: false, busReady: false, prechargeDone: false, softStartComplete: false, faultInput: false },
    data: {
      vref: { owner: "HOST", writer: "SPI / Modbus parser", reader: "control ISR", ageMs: 0, version: 1, maxAgeMs: 100 },
      adc: { owner: "ADC/DMA", writer: "ADC EOC / DMA", reader: "control ISR", ageMs: 0.01, version: 1, maxAgeMs: 0.02 },
      pwm: { owner: "CONTROL ISR", writer: "C(z) + limiter", reader: "ePWM shadow load", ageMs: 0.005, version: 1, maxAgeMs: 0.02 },
      trip: { owner: "SAFETY HW", writer: "CMPSS / TZ", reader: "state machine", ageMs: 0, version: 1, maxAgeMs: 1 }
    },
    instrumentation: { slots: 8, selected: ["physical_vout", "adc_raw", "pwm_cmd", "pwm_pin", "timing_gpio", "trip_flags", "state_log", "command_age"] },
    ui: { activeStage: 0, topologyPreview: "buck" }
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  let state = clone(initial);
  const listeners = new Set();

  function pathParts(path) { return Array.isArray(path) ? path : String(path).split("."); }
  function get(path) {
    if (!path) return state;
    return pathParts(path).reduce((node, key) => node == null ? undefined : node[key], state);
  }
  function set(path, value, meta) {
    const parts = pathParts(path);
    const next = clone(state);
    let node = next;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (node[parts[i]] == null || typeof node[parts[i]] !== "object") node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    state = next;
    listeners.forEach(fn => fn(state, { path: parts.join("."), value, meta: meta || null }));
    return value;
  }
  function patch(path, values, meta) {
    const current = get(path) || {};
    return set(path, Object.assign({}, current, values), meta);
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function reset() {
    state = clone(initial);
    listeners.forEach(fn => fn(state, { path: "*", value: state, meta: { reset: true } }));
  }
  function snapshot() { return clone(state); }

  global.CircuitPowerSystemStateV1 = { get, set, patch, subscribe, reset, snapshot, initial: clone(initial) };
})(window);
