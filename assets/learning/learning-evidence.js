(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitEvidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const KEY = "circuit-learning-state-v4";
  const V3_KEY = "circuit-learning-state-v3";
  const V2_KEY = "circuit-learning-state-v2";
  const SCHEMA = "circuit-learning-state";
  const VERSION = 4;
  const MAX_EVENTS = 600;
  const MAX_MACHINE_PER_ITEM = 30;
  const memory = new Map();

  const now = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));

  function storage() {
    try {
      if (root && root.localStorage) return root.localStorage;
    } catch (_) {}
    return {
      getItem(key) { return memory.has(key) ? memory.get(key) : null; },
      setItem(key, value) { memory.set(key, String(value)); },
      removeItem(key) { memory.delete(key); }
    };
  }

  function read(key, fallback) {
    try {
      const raw = storage().getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function emptyState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      evidence: {},
      questions: {},
      reports: {},
      events: [],
      benchmark: {},
      migrations: {},
      identityAliases: {},
      updatedAt: now()
    };
  }

  function normalizeState(value) {
    const state = value && value.schema === SCHEMA && value.version === VERSION ? value : emptyState();
    state.evidence = state.evidence && typeof state.evidence === "object" ? state.evidence : {};
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    state.reports = state.reports && typeof state.reports === "object" ? state.reports : {};
    state.events = Array.isArray(state.events) ? state.events : [];
    state.benchmark = state.benchmark && typeof state.benchmark === "object" ? state.benchmark : {};
    state.migrations = state.migrations && typeof state.migrations === "object" ? state.migrations : {};
    state.identityAliases = state.identityAliases && typeof state.identityAliases === "object" ? state.identityAliases : {};
    return state;
  }

  function migrate() {
    const current = read(KEY, null);
    if (current && current.version === VERSION) return normalizeState(current);

    const state = emptyState();
    const v3 = read(V3_KEY, null);
    if (v3 && v3.schema === SCHEMA) {
      Object.assign(state.evidence, v3.evidence || {});
      Object.assign(state.questions, v3.questions || {});
      Object.assign(state.reports, v3.reports || {});
      state.migrations.v3 = now();
    } else {
      const v2 = read(V2_KEY, null);
      if (v2 && typeof v2 === "object") {
        Object.entries(v2.completed || {}).forEach(([id, value]) => {
          state.evidence[id] = {
            level: value && value.evidence === "worksheet" ? 3 : 2,
            source: value && value.evidence || "v2",
            at: value && value.at || now(),
            sources: [value && value.evidence || "v2"]
          };
        });
        Object.assign(state.questions, v2.questions || {});
        Object.assign(state.reports, v2.reports || {});
        state.migrations.v2 = now();
      }
    }
    save(state);
    return state;
  }

  function load() {
    return normalizeState(migrate());
  }

  function save(state) {
    const normalized = normalizeState(state);
    normalized.updatedAt = now();
    storage().setItem(KEY, JSON.stringify(normalized));
    return normalized;
  }

  function pushEvent(state, event) {
    state.events.push({ at: now(), ...event });
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  }

  function strongest(values) {
    return values.filter(Boolean).sort((a, b) => {
      const levelDelta = Number(b.level || 0) - Number(a.level || 0);
      if (levelDelta) return levelDelta;
      return Date.parse(b.at || 0) - Date.parse(a.at || 0);
    })[0] || null;
  }

  function reconcileAliases(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return load();
    const state = load();
    let changed = false;

    list.forEach(item => {
      if (!item || !item.id) return;
      const aliases = Array.from(new Set([item.id, ...(Array.isArray(item.legacyIds) ? item.legacyIds : [])].filter(Boolean)));
      const existing = strongest(aliases.map(id => state.evidence[id]));
      const report = aliases.map(id => state.reports[id]).find(Boolean) || null;
      aliases.forEach(alias => {
        if (state.identityAliases[alias] !== item.id) {
          state.identityAliases[alias] = item.id;
          changed = true;
        }
        if (existing) {
          const mirrored = { ...existing, canonicalId: item.id };
          if (JSON.stringify(state.evidence[alias] || null) !== JSON.stringify(mirrored)) {
            state.evidence[alias] = clone(mirrored);
            changed = true;
          }
        }
        if (report && !state.reports[alias]) {
          state.reports[alias] = clone(report);
          changed = true;
        }
      });
    });

    if (changed) {
      pushEvent(state, { type: "identity-reconcile", aliases: Object.keys(state.identityAliases).length });
      save(state);
    }
    return state;
  }

  function evidenceLevel(state, itemId) {
    return Number(state && state.evidence && state.evidence[itemId] && state.evidence[itemId].level || 0);
  }

  function recordEvidence(itemId, level, source, data) {
    if (!itemId) return null;
    const state = load();
    const current = state.evidence[itemId] || {};
    const sources = Array.isArray(current.sources) ? current.sources.slice() : [];
    if (source && !sources.includes(source)) sources.push(source);
    state.evidence[itemId] = {
      ...current,
      level: Math.max(Number(current.level || 0), Number(level || 0)),
      source: source || current.source || "unknown",
      sources,
      data: data == null ? current.data : data,
      at: now()
    };
    pushEvent(state, { type: "evidence", itemId, level: Number(level || 0), source: source || "unknown" });
    save(state);
    return clone(state.evidence[itemId]);
  }

  function recordStep(itemId, step, checked) {
    if (!itemId || !step) return null;
    const state = load();
    const current = state.evidence[itemId] || { level: 1 };
    const steps = { ...(current.steps || {}), [step]: !!checked };
    const practiced = !!(steps.operate || steps.interpret);
    state.evidence[itemId] = {
      ...current,
      steps,
      level: Math.max(Number(current.level || 0), practiced ? 2 : 1),
      source: "tutor",
      sources: Array.from(new Set([...(current.sources || []), "tutor"])),
      at: now()
    };
    pushEvent(state, { type: "step", itemId, step, checked: !!checked });
    save(state);
    return clone(state.evidence[itemId]);
  }

  function stableJson(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }

  function recordMachine(itemId, source, snapshot) {
    if (!itemId || !snapshot) return null;
    const state = load();
    const current = state.evidence[itemId] || {};
    const machine = Array.isArray(current.machine) ? current.machine.slice() : [];
    const digest = stableJson(snapshot);
    const last = machine[machine.length - 1];
    if (!last || last.digest !== digest) {
      machine.push({ at: now(), source: source || "simulator", digest, snapshot });
      if (machine.length > MAX_MACHINE_PER_ITEM) machine.splice(0, machine.length - MAX_MACHINE_PER_ITEM);
    }
    state.evidence[itemId] = {
      ...current,
      level: Math.max(Number(current.level || 0), 2),
      source: source || "simulator",
      sources: Array.from(new Set([...(current.sources || []), source || "simulator"])),
      machine,
      machineCount: machine.length,
      at: now()
    };
    pushEvent(state, { type: "machine", itemId, source: source || "simulator", machineCount: machine.length });
    save(state);
    return clone(state.evidence[itemId]);
  }

  function machineEvents(itemId) {
    const state = load();
    const item = state.evidence[itemId] || {};
    return clone(Array.isArray(item.machine) ? item.machine : []);
  }

  function getEvidence(itemId) {
    const state = load();
    return clone(state.evidence[itemId] || {});
  }

  function setReport(itemId, report) {
    const state = load();
    state.reports[itemId] = { ...(report || {}), updatedAt: now() };
    pushEvent(state, { type: "report", itemId });
    save(state);
    return clone(state.reports[itemId]);
  }

  function getReport(itemId) {
    const state = load();
    return clone(state.reports[itemId] || {});
  }

  function merge(payload) {
    if (!payload || payload.schema !== SCHEMA) throw new Error("不支援的學習狀態格式");
    const state = load();
    Object.assign(state.evidence, payload.evidence || {});
    Object.assign(state.questions, payload.questions || {});
    Object.assign(state.reports, payload.reports || {});
    Object.assign(state.benchmark, payload.benchmark || {});
    Object.assign(state.identityAliases, payload.identityAliases || {});
    pushEvent(state, { type: "import", fromVersion: payload.version || "unknown" });
    return save(state);
  }

  function resetForTests() {
    storage().removeItem(KEY);
    storage().removeItem(V3_KEY);
    storage().removeItem(V2_KEY);
    memory.clear();
  }

  const api = {
    KEY,
    SCHEMA,
    VERSION,
    emptyState,
    normalizeState,
    load,
    save,
    reconcileAliases,
    evidenceLevel,
    recordEvidence,
    recordStep,
    recordMachine,
    machineEvents,
    getEvidence,
    setReport,
    getReport,
    merge,
    _resetForTests: resetForTests
  };

  try {
    if (root && root.CircuitSchema && root.CircuitCurriculum) {
      const curriculum = root.CircuitSchema.normalizeCurriculum(root.CircuitCurriculum);
      const items = curriculum.modules.flatMap(module => [...module.lessons, ...module.labs, ...module.faults]);
      reconcileAliases(items);
    }
  } catch (error) {
    if (root && root.console && root.console.warn) root.console.warn("Unable to reconcile curriculum identities", error);
  }

  return api;
});