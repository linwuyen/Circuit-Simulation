(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitCoreFlowV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "circuit-core-flow-v1";
  const VERSION = 2;
  const layers = Object.freeze([
    { key: "physics", number: "01", label: "物理", question: "開關每一拍如何搬運能量？", measurement: "switch node + iL ripple" },
    { key: "sensing", number: "02", label: "量測", question: "物理量如何變成可信的 ADC count？", measurement: "DMM → ADC pin → raw count" },
    { key: "feedback", number: "03", label: "回授", question: "error 如何先變成 Iref，再由 current loop 變成 duty？", measurement: "reference、V feedback、Iref、iL、duty request" },
    { key: "timing", number: "04", label: "時序", question: "算出的 duty 何時真的生效？", measurement: "SOCA → EOC → ISR → shadow → ZERO" },
    { key: "dynamics", number: "05", label: "動態", question: "儲能與 delay 如何限制閉環？", measurement: "load step + sample-to-actuate delay" },
    { key: "safety", number: "06", label: "安全", question: "危險發生時哪條 veto 最先贏？", measurement: "fault edge → Trip Zone → gate LOW" },
    { key: "production", number: "07", label: "量產", question: "誰擁有 command freshness 與 re-arm？", measurement: "sequence、age、clear token、authority" },
    { key: "evidence", number: "08", label: "證據", question: "目前證據真正能支持哪一層主張？", measurement: "Model → SIL → HIL → Image → Binding → Board" }
  ]);
  const layerKeys = layers.map(layer => layer.key);
  let memoryState = null;
  let pending = false;
  let corruptRaw = null;
  const Evidence = root.CircuitEvidence || (typeof require === "function" ? require("./learning-evidence.js") : null);
  function notifyStorage() { Evidence?.refreshStorageStatus?.(); }

  function now() { return new Date().toISOString(); }
  function isLayer(key) { return layerKeys.includes(key); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function emptyState() {
    return { version: VERSION, currentLayer: layerKeys[0], completed: {}, predictions: {}, remediations: {}, interactions: {}, updatedAt: null };
  }
  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const completed = {};
    const predictions = {};
    const remediations = {};
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
      const remediation = source.remediations && source.remediations[key];
      if (remediation) remediations[key] = typeof remediation === "string" ? remediation : now();
      const interaction = source.interactions && source.interactions[key];
      if (interaction) interactions[key] = typeof interaction === "string" ? interaction : now();
    });
    const firstIncomplete = layerKeys.find(key => !completed[key]) || layerKeys[layerKeys.length - 1];
    return {
      version: VERSION,
      currentLayer: isLayer(source.currentLayer) ? source.currentLayer : firstIncomplete,
      completed,
      predictions,
      remediations,
      interactions,
      updatedAt: source.updatedAt || null
    };
  }
  function read() {
    if (pending && memoryState) return normalize(memoryState);
    let saved;
    try {
      saved = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || ![1, VERSION].includes(parsed.version)) throw new Error("Invalid core flow state");
        return normalize(parsed);
      }
    } catch (_) {
      if (saved) corruptRaw = saved;
    }
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
    pending = true;
    flush();
    emit(state, reason);
    return clone(state);
  }
  function flush() {
    if (!pending) return true;
    try {
      if (!root.localStorage) throw new Error("Storage unavailable");
      if (corruptRaw !== null) {
        root.localStorage.setItem(STORAGE_KEY + "-corrupt-backup", corruptRaw);
        corruptRaw = null;
      }
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
      pending = false;
    } catch (_) { pending = true; }
    notifyStorage();
    return !pending;
  }
  function restore(raw) {
    if (!raw || ![1, VERSION].includes(raw.version)) throw new Error("Unsupported core flow backup");
    const incoming = normalize(raw), current = read();
    for (const key of layerKeys) {
      const original = current.predictions[key];
      if (!original && incoming.predictions[key]) current.predictions[key] = incoming.predictions[key];
      const compatible = !original || (incoming.predictions[key]?.choice === original.choice && incoming.predictions[key]?.correct === original.correct);
      if (compatible && incoming.remediations[key] && !current.remediations[key]) current.remediations[key] = incoming.remediations[key];
      if (incoming.interactions[key] && !current.interactions[key]) current.interactions[key] = incoming.interactions[key];
      const prediction = current.predictions[key];
      if (incoming.completed[key] && prediction && (prediction.correct || current.remediations[key]) && current.interactions[key]) {
        current.completed[key] ||= incoming.completed[key];
      }
    }
    current.currentLayer = layerKeys.find(key => !current.completed[key]) || layerKeys.at(-1);
    return write(current, "restore");
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
  function recordRemediation(key, correct) {
    if (!isLayer(key) || !correct) return snapshot();
    const state = read();
    if (!state.predictions[key] || state.predictions[key].correct) return clone(state);
    if (!state.remediations[key]) state.remediations[key] = now();
    state.currentLayer = key;
    return write(state, "remediation");
  }
  function recordInteraction(key) {
    if (!isLayer(key)) return snapshot();
    const state = read();
    if (!state.interactions[key]) state.interactions[key] = now();
    state.currentLayer = key;
    return write(state, "interaction");
  }
  function mastered(key) {
    const state = read();
    const prediction = state.predictions[key];
    return Boolean(isLayer(key) && prediction && (prediction.correct || state.remediations[key]));
  }
  function needsRemediation(key) {
    const state = read();
    const prediction = state.predictions[key];
    return Boolean(isLayer(key) && prediction && !prediction.correct && !state.remediations[key]);
  }
  function ready(key) {
    const state = read();
    const prediction = state.predictions[key];
    const conceptReady = Boolean(prediction && (prediction.correct || state.remediations[key]));
    return Boolean(isLayer(key) && conceptReady && state.interactions[key]);
  }
  function complete(key) {
    if (!isLayer(key)) return snapshot();
    const state = read();
    const prediction = state.predictions[key];
    const conceptReady = Boolean(prediction && (prediction.correct || state.remediations[key]));
    if (!conceptReady || !state.interactions[key]) return clone(state);
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
    pending = true;
    flush();
    emit(memoryState, "reset");
    return clone(memoryState);
  }

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) emit(read(), "storage");
    });
  }

  Evidence?.registerStore?.("coreFlow", {
    key: STORAGE_KEY, snapshot, restore, retry: flush, isPending: () => pending,
    validate: raw => Boolean(raw && [1, VERSION].includes(raw.version) && typeof raw.predictions === "object")
  });
  return Object.freeze({ storageStatus: () => ({ saved: !pending }), retrySave: flush, restore, STORAGE_KEY, VERSION, layers, layerKeys: Object.freeze(layerKeys), snapshot, select, recordPrediction, recordRemediation, recordInteraction, mastered, needsRemediation, ready, complete, progress, href, reset });
});