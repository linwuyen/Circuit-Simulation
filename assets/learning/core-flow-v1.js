(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitCoreFlowV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "circuit-core-flow-v1";
  const VERSION = 1;
  const layers = Object.freeze([
    { key: "physics", number: "01", label: "物理", question: "開關每一拍如何搬運能量？", measurement: "switch node + iL ripple" },
    { key: "sensing", number: "02", label: "量測", question: "物理量如何變成可信的 ADC count？", measurement: "DMM → ADC pin → raw count" },
    { key: "feedback", number: "03", label: "回授", question: "error 的方向如何改變 duty？", measurement: "reference、feedback、error、duty request" },
    { key: "timing", number: "04", label: "時序", question: "算出的 duty 何時真的生效？", measurement: "SOCA → EOC → ISR → shadow → ZERO" },
    { key: "dynamics", number: "05", label: "動態", question: "儲能與 delay 如何限制閉環？", measurement: "load step + sample-to-actuate delay" },
    { key: "safety", number: "06", label: "安全", question: "危險發生時哪條 veto 最先贏？", measurement: "fault edge → Trip Zone → gate LOW" },
    { key: "production", number: "07", label: "量產", question: "誰擁有 command freshness 與 re-arm？", measurement: "sequence、age、clear token、authority" },
    { key: "evidence", number: "08", label: "證據", question: "目前證據真正能支持哪一層主張？", measurement: "Model → SIL → HIL → Image → Binding → Board" }
  ]);
  const layerKeys = layers.map(layer => layer.key);
  let memoryState = null;

  function now() { return new Date().toISOString(); }
  function isLayer(key) { return layerKeys.includes(key); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function emptyState() {
    return { version: VERSION, currentLayer: layerKeys[0], completed: {}, predictions: {}, interactions: {}, updatedAt: null };
  }
  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const completed = {};
    const predictions = {};
    const interactions = {};
    layerKeys.forEach(key => {
      const done = source.completed && source.completed[key];
      if (done) completed[key] = typeof done === "string" ? done : now();
      const prediction = source.predictions && source.predictions[key];
      if (prediction && typeof prediction.choice === "string") {
        predictions[key] = {
          choice: prediction.choice,
          correct: Boolean(prediction.correct),
          answeredAt: prediction.answeredAt || now()
        };
      }
      const interaction = source.interactions && source.interactions[key];
      if (interaction) interactions[key] = typeof interaction === "string" ? interaction : now();
    });
    const firstIncomplete = layerKeys.find(key => !completed[key]) || layerKeys[layerKeys.length - 1];
    return {
      version: VERSION,
      currentLayer: isLayer(source.currentLayer) ? source.currentLayer : firstIncomplete,
      completed,
      predictions,
      interactions,
      updatedAt: source.updatedAt || null
    };
  }
  function read() {
    try {
      const saved = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      if (saved) return normalize(JSON.parse(saved));
    } catch (_) {}
    return normalize(memoryState || emptyState());
  }
  function emit(state, reason) {
    if (typeof root.dispatchEvent !== "function") return;
    try {
      root.dispatchEvent(new CustomEvent("circuit:core-flow-change", { detail: { state: clone(state), reason } }));
    } catch (_) {}
  }
  function write(next, reason) {
    const state = normalize({ ...next, updatedAt: now() });
    state.updatedAt = now();
    memoryState = state;
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
    emit(state, reason);
    return clone(state);
  }
  function snapshot() { return clone(read()); }
  function select(key) {
    if (!isLayer(key)) return snapshot();
    return write({ ...read(), currentLayer: key }, "select");
  }
  function recordPrediction(key, choice, correct) {
    if (!isLayer(key) || typeof choice !== "string" || !choice) return snapshot();
    const state = read();
    if (state.predictions[key]) return clone(state);
    state.predictions[key] = { choice, correct: Boolean(correct), answeredAt: now() };
    state.currentLayer = key;
    return write(state, "prediction");
  }
  function recordInteraction(key) {
    if (!isLayer(key)) return snapshot();
    const state = read();
    if (!state.interactions[key]) state.interactions[key] = now();
    state.currentLayer = key;
    return write(state, "interaction");
  }
  function ready(key) {
    const state = read();
    return Boolean(isLayer(key) && state.predictions[key] && state.interactions[key]);
  }
  function complete(key) {
    if (!isLayer(key)) return snapshot();
    const state = read();
    if (!state.predictions[key] || !state.interactions[key]) return clone(state);
    if (!state.completed[key]) state.completed[key] = now();
    const index = layerKeys.indexOf(key);
    state.currentLayer = layerKeys[Math.min(index + 1, layerKeys.length - 1)];
    return write(state, "complete");
  }
  function progress() {
    const state = read();
    const done = layerKeys.filter(key => state.completed[key]).length;
    return { done, total: layerKeys.length, percent: Math.round(done * 100 / layerKeys.length), currentLayer: state.currentLayer };
  }
  function href(key, prefix) {
    const layer = isLayer(key) ? key : read().currentLayer;
    return `${prefix || ""}19_c2000_buck_firmware_lab/index.html?layer=${encodeURIComponent(layer)}`;
  }
  function reset() {
    memoryState = emptyState();
    try { if (root.localStorage) root.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    emit(memoryState, "reset");
    return clone(memoryState);
  }

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) emit(read(), "storage");
    });
  }

  return Object.freeze({ STORAGE_KEY, VERSION, layers, layerKeys: Object.freeze(layerKeys), snapshot, select, recordPrediction, recordInteraction, ready, complete, progress, href, reset });
});
