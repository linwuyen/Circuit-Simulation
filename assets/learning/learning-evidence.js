(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitEvidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const KEY = "circuit-learning-state-v5";
  const V4_KEY = "circuit-learning-state-v4";
  const V3_KEY = "circuit-learning-state-v3";
  const V2_KEY = "circuit-learning-state-v2";
  const SCHEMA = "circuit-learning-state";
  const VERSION = 5;
  const MAX_EVENTS = 800;
  const MAX_MACHINE_PER_ITEM = 40;
  const STRENGTH = { none: 0, C: 1, B: 2, A: 3 };
  const memory = new Map();
  let pending = false;
  let corruptRaw = null;
  let persistence = { saved: true, reason: null };
  const stores = new Map();
  const browser = root.window === root && !!root.document;
  const snapshots = new WeakMap();
  let observedRaw = null, pendingBaseline = null, localRevision = 0;
  let pendingObject = null, writePromise = null, conflict = false, committedRevision = null;
  const rejectedDrafts = [];
  const pendingAuxiliary = new Map();
  const remember = state => { snapshots.set(state, { raw: pending ? pendingBaseline : observedRaw, revision: localRevision }); return state; };
  if (browser && root.addEventListener) for (const type of ['click','input','change','submit','keydown']) root.addEventListener(type, event => {
    if (!conflict || event.target?.closest?.('#learning-storage-status')) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  if (browser && root.addEventListener) root.addEventListener('beforeunload', event => {
    if (!pending && !conflict && !pendingAuxiliary.size) return;
    event.preventDefault(); event.returnValue = '';
  });
  function registerStore(name, store) { stores.set(name, store); refreshStorageStatus(); }
  function refreshStorageStatus() { updatePersistence(!pending && !conflict && !pendingAuxiliary.size, conflict ? "conflict" : pending ? persistence.reason || "pending" : null); }


  function updatePersistence(saved, reason) {
    saved = saved && !pending && !conflict && !pendingAuxiliary.size && [...stores.values()].every(store => !store.isPending());
    persistence = { saved, reason: saved ? null : reason || "unavailable" };
    const emitted = persistence;
    if (browser && root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('circuit:evidence-persistence', { detail: { ...persistence } }));
    if (persistence !== emitted) return;
    const doc = root && root.document;
    if (!doc || !doc.body) return;
    if (doc.documentElement) doc.documentElement.dataset.evidencePersistence = saved ? 'saved' : persistence.reason;
    let notice = doc.getElementById('learning-storage-status');
    if (saved) { if (notice) notice.remove(); return; }
    if (notice) {
      const message = notice.querySelector('p');
      if (message) message.textContent = persistenceMessage();
      return;
    }
    notice = doc.createElement('aside');
    notice.id = 'learning-storage-status';
    notice.setAttribute('role', 'alert');
    notice.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:10000;padding:16px;background:#fff3cd;color:#332701;border:2px solid #856404;border-radius:8px';
    const message = doc.createElement('p');
    message.textContent = persistenceMessage();
    notice.appendChild(message);
    const retry = doc.createElement('button');
    retry.textContent = '重試儲存';
    retry.onclick = () => retrySave();
    notice.appendChild(retry);
    const download = doc.createElement('button');
    download.textContent = '匯出備份';
    download.onclick = () => {
      const url = root.URL.createObjectURL(new root.Blob([exportBackup()], { type: 'application/json' }));
      const link = doc.createElement('a');
      link.href = url; link.download = 'circuit-learning-backup.json';
      link.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
    };
    notice.appendChild(download);
    doc.body.appendChild(notice);
  }

  function persistenceMessage() {
    if (persistence.reason === 'conflict') return '紀錄已衝突，未覆蓋既有證據。本頁結果尚未提交，不計為已保存正式證據；操作已暫停。本頁草稿尚未儲存；請先匯出備份，再重新載入比較。重試不會覆蓋另一頁。';
    if (persistence.reason === 'concurrency-lock-unavailable') return '此瀏覽器無法安全鎖定跨頁紀錄，目前只保留本頁暫存。請匯出備份，或改用支援 Web Locks 的瀏覽器／本機伺服器。';
    return '學習紀錄或八層主線進度尚未儲存，關閉或重新整理可能遺失。請等待、重試或先匯出完整備份。';
  }

  function exportBackup() {
    const state = clone(load());
    if (rejectedDrafts.length) state.unsavedConflictDrafts = clone(rejectedDrafts);
    state.auxiliary = {};
    for (const [name, store] of stores) state.auxiliary[name] = store.snapshot();
    for (const [name, raw] of pendingAuxiliary) state.auxiliary[name] = clone(raw);
    // Lesson pages may not load CoreFlow, but their backups must still contain it.
    if (!state.auxiliary.coreFlow) {
      const core = read("circuit-core-flow-v1", null);
      if (core) state.auxiliary.coreFlow = core;
    }
    return JSON.stringify(state);
  }
  function retrySave() {
    save(load());
    for (const store of stores.values()) store.retry();
    refreshStorageStatus();
    return { ...persistence };
  }

  const now = () => new Date().toISOString();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function storage() {
    try { if (root && root.localStorage) return root.localStorage; } catch (_) {}
    return {
      getItem(key) { return memory.has(key) ? memory.get(key) : null; },
      setItem(key, value) { memory.set(key, String(value)); },
      removeItem(key) { memory.delete(key); }
    };
  }

  function read(key, fallback) {
    if (key === KEY && pending && memory.has(key)) return JSON.parse(memory.get(key));
    let raw;
    try {
      raw = storage().getItem(key);
      if (key === KEY) observedRaw = raw;
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      if (key === KEY && (!value || value.schema !== SCHEMA || value.version !== VERSION)) throw new Error('Invalid learning state');
      return value == null ? fallback : value;
    } catch (_) {
      if (key === KEY && raw) corruptRaw = raw;
      updatePersistence(false, raw ? 'corrupt' : 'unavailable');
      return memory.has(key) ? JSON.parse(memory.get(key)) : fallback;
    }
  }

  function emptyState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      evidence: {},
      questions: {},
      reports: {},
      predictions: {},
      openResponses: {},
      diagnosticGames: {},
      events: [],
      benchmark: {},
      migrations: {},
      identityAliases: {},
      updatedAt: now()
    };
  }

  function normalizeState(value) {
    const state = value && value.schema === SCHEMA && value.version === VERSION ? value : emptyState();
    for (const key of ["evidence", "questions", "reports", "predictions", "openResponses", "diagnosticGames", "benchmark", "migrations", "identityAliases"]) {
      state[key] = state[key] && typeof state[key] === "object" ? state[key] : {};
    }
    state.events = Array.isArray(state.events) ? state.events : [];
    return state;
  }

  function copyLegacyState(target, source, label) {
    if (!source || typeof source !== "object") return;
    Object.assign(target.evidence, source.evidence || {});
    Object.assign(target.questions, source.questions || {});
    Object.assign(target.reports, source.reports || {});
    Object.assign(target.identityAliases, source.identityAliases || {});
    Object.assign(target.benchmark, source.benchmark || {});
    target.migrations[label] = now();
  }

  function migrate() {
    const current = read(KEY, null);
    if (current && current.version === VERSION) return normalizeState(current);

    const state = emptyState();
    const v4 = read(V4_KEY, null);
    const v3 = read(V3_KEY, null);
    const v2 = read(V2_KEY, null);

    if (v4 && v4.schema === SCHEMA) copyLegacyState(state, v4, "v4");
    else if (v3 && v3.schema === SCHEMA) copyLegacyState(state, v3, "v3");
    else if (v2 && typeof v2 === "object") {
      Object.entries(v2.completed || {}).forEach(([id, value]) => {
        const verified = value && value.evidence === "worksheet";
        state.evidence[id] = {
          level: verified ? 3 : 2,
          stage: verified ? "verified" : "practiced",
          strength: verified ? "C" : "none",
          source: value && value.evidence || "v2",
          at: value && value.at || now(),
          sources: [value && value.evidence || "v2"]
        };
      });
      Object.assign(state.questions, v2.questions || {});
      Object.assign(state.reports, v2.reports || {});
      state.migrations.v2 = now();
    }
    save(remember(state));
    return state;
  }

  function load() { return remember(normalizeState(migrate())); }

  function commitPending() {
    if ((!pending && !pendingAuxiliary.size) || conflict) return;
    try {
      const target = root.localStorage;
      const baseline = pending ? pendingBaseline : observedRaw;
      // Compare while holding the one lock for the ENTIRE JSON storage key.
      if (browser && target.getItem(KEY) !== baseline) {
        conflict = true; updatePersistence(false, "conflict"); return;
      }
      if (pending) {
        const serialized = memory.get(KEY);
        if (corruptRaw !== null) { target.setItem(KEY + '-corrupt-backup', corruptRaw); corruptRaw = null; }
        target.setItem(KEY, serialized);
        committedRevision = { revision: localRevision, from: pendingBaseline, to: serialized };
        observedRaw = serialized; pending = false;
        if (pendingObject) snapshots.set(pendingObject, { raw: serialized, revision: localRevision });
      }
      // Delete only successfully restored entries. A throwing auxiliary remains
      // exportable and retryable against the now-committed primary baseline.
      for (const [name, raw] of pendingAuxiliary) {
        stores.get(name).restore(raw); pendingAuxiliary.delete(name);
      }
      updatePersistence(true);
    } catch (error) { updatePersistence(false, error && error.name || "unavailable"); }
  }

  function scheduleCommit() {
    if (conflict || (!pending && !pendingAuxiliary.size)) return;
    if (!browser) { commitPending(); return; }
    if (!root.navigator?.locks?.request) { updatePersistence(false, "concurrency-lock-unavailable"); return; }
    updatePersistence(false, "pending");
    if (writePromise) return;
    // Drain newer revisions queued by commit notifications, but never spin on
    // a quota/security failure of the same revision. Explicit retry owns that.
    writePromise = Promise.resolve().then(async () => {
      let attempted;
      do {
        attempted = localRevision;
        await root.navigator.locks.request(KEY, { mode: 'exclusive' }, () => {
          attempted = localRevision; commitPending();
        });
      } while ((pending || pendingAuxiliary.size) && !conflict && localRevision > attempted);
    }).catch(() => updatePersistence(false, "concurrency-lock-unavailable"))
      .finally(() => { writePromise = null; });
  }

  async function flush() {
    scheduleCommit();
    if (writePromise) await writePromise;
    return { ...persistence };
  }

  function save(state) {
    const normalized = normalizeState(state), snapshot = snapshots.get(state);
    if (browser && (!snapshot || snapshot.revision !== localRevision)) {
      rejectedDrafts.push(clone(normalized)); conflict = true;
      updatePersistence(false, "conflict"); return normalized;
    }
    // Read-normalization must not create writes or move a stale baseline.
    if (JSON.stringify(normalized) === (pending ? memory.get(KEY) : observedRaw)) { if (pending || pendingAuxiliary.size) scheduleCommit(); return remember(normalized); }
    if (!pending) pendingBaseline = snapshot ? (committedRevision?.revision === snapshot.revision && committedRevision.from === snapshot.raw ? committedRevision.to : snapshot.raw) : observedRaw;
    normalized.updatedAt = now();
    memory.set(KEY, JSON.stringify(normalized));
    pending = true; pendingObject = normalized; localRevision++;
    snapshots.set(normalized, { raw: pendingBaseline, revision: localRevision });
    scheduleCommit();
    return normalized;
  }

  function pushEvent(state, event) {
    state.events.push({ id: "evt:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8), at: now(), ...event });
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  }

  const stageFromLevel = level => ["not-started", "viewed", "practiced", "verified", "retained"][Math.max(0, Math.min(4, Number(level) || 0))];
  const evidenceLevel = (state, itemId) => Number(state && state.evidence && state.evidence[itemId] && state.evidence[itemId].level || 0);
  const strongestStrength = (a, b) => (STRENGTH[a] || 0) >= (STRENGTH[b] || 0) ? (a || "none") : (b || "none");

  function recordEvidence(itemId, level, source, data, meta) {
    if (!itemId) return null;
    const state = load();
    const current = state.evidence[itemId] || {};
    const nextLevel = Math.max(Number(current.level || 0), Number(level || 0));
    const strength = strongestStrength(current.strength, meta && meta.strength);
    state.evidence[itemId] = {
      ...current,
      level: nextLevel,
      stage: meta && meta.stage || current.stage || stageFromLevel(nextLevel),
      strength,
      source: source || current.source || "unknown",
      sources: Array.from(new Set([...(current.sources || []), source || "unknown"])),
      data: data == null ? current.data : data,
      at: now()
    };
    pushEvent(state, { type: "evidence", itemId, level: nextLevel, strength, source: source || "unknown" });
    save(state);
    return clone(state.evidence[itemId]);
  }

  function recordStep(itemId, step, checked) {
    if (!itemId || !step) return null;
    const state = load();
    const current = state.evidence[itemId] || { level: 1 };
    const steps = { ...(current.steps || {}), [step]: !!checked };
    const practiced = !!(steps.operate || steps.interpret);
    const level = Math.max(Number(current.level || 0), practiced ? 2 : 1);
    state.evidence[itemId] = {
      ...current,
      steps,
      level,
      stage: stageFromLevel(level),
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

  function recordMachine(itemId, source, snapshot, verification) {
    if (!itemId || !snapshot) return null;
    const state = load();
    const current = state.evidence[itemId] || {};
    const machine = Array.isArray(current.machine) ? current.machine.slice() : [];
    const record = { snapshot: clone(snapshot), verification: verification ? clone(verification) : null };
    const digest = stableJson(record);
    const last = machine[machine.length - 1];
    const capturedAt = now();

    if (!last || last.digest !== digest) {
      machine.push({ at: capturedAt, source: source || "simulator", digest, ...record });
      if (machine.length > MAX_MACHINE_PER_ITEM) machine.splice(0, machine.length - MAX_MACHINE_PER_ITEM);
    }

    const verified = !!(verification && verification.passed === true);
    const provenance = verified && verification.model ? clone(verification.model) : current.modelProvenance || null;
    const strength = strongestStrength(current.strength, verified ? "B" : "none");
    state.evidence[itemId] = {
      ...current,
      level: Math.max(Number(current.level || 0), 2),
      stage: current.stage || "practiced",
      strength,
      source: source || "simulator",
      sources: Array.from(new Set([...(current.sources || []), source || "simulator"])),
      machine,
      machineCount: machine.length,
      machineVerified: verified || !!current.machineVerified,
      modelProvenance: provenance,
      firstMachineAt: current.firstMachineAt || capturedAt,
      at: capturedAt
    };
    pushEvent(state, { type: verified ? "machine-verified" : "machine", itemId, source: source || "simulator", machineCount: machine.length });
    save(state);
    return clone(state.evidence[itemId]);
  }

  function machineEvents(itemId) {
    const item = load().evidence[itemId] || {};
    return clone(Array.isArray(item.machine) ? item.machine : []);
  }

  function getEvidence(itemId) { return clone(load().evidence[itemId] || {}); }

  function commitPrediction(itemId, prediction) {
    if (!itemId) throw new Error("prediction requires item id");
    const state = load();
    const record = state.predictions[itemId] || { revisions: [] };
    const revisions = Array.isArray(record.revisions) ? record.revisions : [];
    const evidence = state.evidence[itemId] || {};
    const revision = {
      id: itemId + ":prediction:" + (revisions.length + 1),
      revision: revisions.length + 1,
      committedAt: now(),
      prediction: String(prediction && prediction.prediction || "").trim(),
      parameters: String(prediction && prediction.parameters || "").trim(),
      confidence: Number(prediction && prediction.confidence || 0),
      preRegistered: !evidence.firstMachineAt
    };
    if (!revision.prediction || !revision.parameters) throw new Error("預測與參數不可空白");
    revisions.push(revision);
    state.predictions[itemId] = { revisions, active: clone(revision) };
    pushEvent(state, { type: "prediction-commit", itemId, revision: revision.revision, preRegistered: revision.preRegistered });
    save(state);
    return clone(revision);
  }

  function getPrediction(itemId) {
    const record = load().predictions[itemId];
    return record ? clone(record) : { revisions: [], active: null };
  }

  function predictionStatus(itemId) {
    const state = load();
    const record = state.predictions[itemId] || { revisions: [] };
    const first = Array.isArray(record.revisions) ? record.revisions[0] : null;
    const firstMachineAt = state.evidence[itemId] && state.evidence[itemId].firstMachineAt || null;
    return {
      committed: !!first,
      first,
      active: record.active || null,
      firstMachineAt,
      preRegistered: !!(first && first.preRegistered === true)
    };
  }

  function reportRecord(value) {
    if (!value) return { revisions: [], active: null, draft: null };
    if (Array.isArray(value.revisions)) return { ...value, draft: value.draft || null };
    return { revisions: [{ id: "legacy", at: value.updatedAt || now(), ...value }], active: value, draft: null };
  }

  function setReport(itemId, report) {
    const state = load();
    const current = reportRecord(state.reports[itemId]);
    if (report && report.draft) {
      current.draft = { ...(current.draft || {}), ...report, updatedAt: now() };
      delete current.draft.draft;
      state.reports[itemId] = current;
      save(state);
      return clone(current.draft);
    }
    const revision = { id: itemId + ":report:" + (current.revisions.length + 1), revision: current.revisions.length + 1, at: now(), ...(report || {}) };
    current.revisions.push(revision);
    current.active = clone(revision);
    current.draft = null;
    state.reports[itemId] = current;
    pushEvent(state, { type: "report", itemId, revision: revision.revision });
    save(state);
    return clone(revision);
  }

  function getReport(itemId) {
    const record = reportRecord(load().reports[itemId]);
    return clone(record.draft || record.active || {});
  }

  function getReportHistory(itemId) { return clone(reportRecord(load().reports[itemId]).revisions); }

  function recordOpenResponse(taskId, result) {
    const state = load();
    const history = Array.isArray(state.openResponses[taskId]) ? state.openResponses[taskId] : [];
    history.push({ id: taskId + ":" + now(), at: now(), ...(result || {}) });
    state.openResponses[taskId] = history;
    pushEvent(state, { type: "open-response", taskId, correct: !!(result && result.correct) });
    save(state);
    return clone(history[history.length - 1]);
  }

  function recordDiagnosticGame(gameId, result) {
    const state = load();
    const history = Array.isArray(state.diagnosticGames[gameId]) ? state.diagnosticGames[gameId] : [];
    history.push({ id: gameId + ":" + now(), at: now(), ...(result || {}) });
    state.diagnosticGames[gameId] = history;
    pushEvent(state, { type: "diagnostic-game", gameId, solved: !!(result && result.solved) });
    save(state);
    return clone(history[history.length - 1]);
  }

  function strongestEvidence(values) {
    return values.filter(Boolean).sort((a, b) => {
      const level = Number(b.level || 0) - Number(a.level || 0);
      if (level) return level;
      const strength = (STRENGTH[b.strength] || 0) - (STRENGTH[a.strength] || 0);
      if (strength) return strength;
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
      const aliases = Array.from(new Set([item.id, ...(item.legacyIds || [])].filter(Boolean)));
      const existing = strongestEvidence(aliases.map(id => state.evidence[id]));
      const report = aliases.map(id => state.reports[id]).find(Boolean) || null;
      const prediction = aliases.map(id => state.predictions[id]).find(Boolean) || null;
      aliases.forEach(alias => {
        if (state.identityAliases[alias] !== item.id) { state.identityAliases[alias] = item.id; changed = true; }
        if (existing && !state.evidence[alias]) { state.evidence[alias] = { ...clone(existing), canonicalId: item.id }; changed = true; }
        if (report && !state.reports[alias]) { state.reports[alias] = clone(report); changed = true; }
        if (prediction && !state.predictions[alias]) { state.predictions[alias] = clone(prediction); changed = true; }
      });
    });
    if (changed) { pushEvent(state, { type: "identity-reconcile" }); save(state); }
    return state;
  }

  function unionById(a, b, fallbackKey) {
    const map = new Map();
    [...(a || []), ...(b || [])].forEach(item => {
      const key = item && item.id || (fallbackKey ? fallbackKey(item) : stableJson(item));
      if (!map.has(key)) map.set(key, clone(item));
    });
    return [...map.values()].sort((x, y) => Date.parse(x.at || x.committedAt || 0) - Date.parse(y.at || y.committedAt || 0));
  }

  // Viewing/selecting a practice can save an empty shell. Only recognized
  // initialization shapes may yield to a backup; actual work stays local.
  function untouchedPractice(record, child) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!record || record.version !== 1 || record.completed !== false || !object(record.rows) ||
      !Object.values(record.rows).every(row => object(row) && Object.keys(row).length === 0)) return false;
    let fields = ['version', 'rows', 'completed'];
    if (child === 'experiment') {
      if (typeof record.currentLesson !== 'string' || !object(record.currentConfig) || !Array.isArray(record.history) || record.history.length) return false;
      fields.push('history', 'currentLesson', 'currentConfig');
    } else if (child === 'topologyTransfer') {
      if (record.protocol !== 'topology-workbench-v1' || record.operated !== false || !object(record.params) || typeof record.source !== 'string' || !Array.isArray(record.models)) return false;
      fields.push('protocol', 'operated', 'params', 'source', 'models');
    } else if (child === 'topologyApplications') {
      if (typeof record.currentLesson !== 'string') return false;
      fields.push('currentLesson');
    } else return false;
    return Object.keys(record).every(key => fields.includes(key));
  }

  function merge(payload) {
    if (!payload || payload.schema !== SCHEMA) throw new Error("不支援的學習狀態格式");
    for (const [name, raw] of Object.entries(payload.auxiliary || {})) {
      const store = stores.get(name);
      if (!store || !store.validate(raw)) throw new Error("請在完整實驗備份頁面匯入，或檢查主線備份格式");
    }
    const state = load();

    Object.entries(payload.evidence || {}).forEach(([id, incoming]) => {
      const current = state.evidence[id];
      const strongest = strongestEvidence([current, incoming]);
      const machine = unionById(current && current.machine, incoming && incoming.machine, item => item.digest);
      state.evidence[id] = { ...clone(strongest || {}), machine, machineCount: machine.length };
    });

    Object.entries(payload.questions || {}).forEach(([id, incoming]) => {
      const current = state.questions[id] || {};
      const history = unionById(current.history, incoming && incoming.history);
      state.questions[id] = { ...current, ...(incoming || {}), history, attempts: history.length, updatedAt: history.length ? history[history.length - 1].at : current.updatedAt };
    });

    Object.entries(payload.predictions || {}).forEach(([id, incoming]) => {
      const current = state.predictions[id] || { revisions: [] };
      const revisions = unionById(current.revisions, incoming && incoming.revisions);
      state.predictions[id] = { revisions, active: revisions[revisions.length - 1] || null };
    });

    Object.entries(payload.reports || {}).forEach(([id, incoming]) => {
      const current = reportRecord(state.reports[id]);
      const other = reportRecord(incoming);
      const revisions = unionById(current.revisions, other.revisions);
      state.reports[id] = { revisions, active: revisions[revisions.length - 1] || null, draft: current.draft || other.draft || null };
    });

    Object.entries(payload.openResponses || {}).forEach(([id, items]) => { state.openResponses[id] = unionById(state.openResponses[id], items); });
    Object.entries(payload.diagnosticGames || {}).forEach(([id, items]) => { state.diagnosticGames[id] = unionById(state.diagnosticGames[id], items); });
    Object.assign(state.identityAliases, payload.identityAliases || {});
    // A fresh device must restore the complete formal PRE/POST/retention protocol.
    // If this device already has first attempts, keep that protocol intact rather
    // than mixing cached scores or seeds; preserve the incoming protocol in backup archives.
    for (const [key, incoming] of Object.entries(payload.benchmark || {})) {
      if (["trainingPractice", "__proto__", "constructor", "prototype"].includes(key)) continue;
      if (key === "learningWorkspace" && incoming?.version === 1) {
        const current = state.benchmark.learningWorkspace;
        if (!current) state.benchmark.learningWorkspace = clone(incoming);
        else {
          for(const child of ['experiment','topologyTransfer','topologyConcepts','topologyApplications']) if((!current[child]||untouchedPractice(current[child],child))&&incoming[child]?.version===1) current[child]=clone(incoming[child]);
          if(!current.experiment&&!current.topologyTransfer&&!current.topologyConcepts&&!current.topologyApplications&&!current.history?.length&&!current.freeModel) state.benchmark.learningWorkspace=clone(incoming);
        }
      } else if (key === "unifiedLearning" && incoming?.version === 1) {
        const current = state.benchmark.unifiedLearning;
        if (!current) state.benchmark.unifiedLearning = clone(incoming);
        else {
          current.scenarios ||= {};
          if (!current.scenarios['buck-steady-v1'] && incoming.scenarios?.['buck-steady-v1']) current.scenarios['buck-steady-v1'] = clone(incoming.scenarios['buck-steady-v1']);
        }
      } else if (["beginnerLessons", "bridgeLessons"].includes(key) && incoming?.version === 1 && incoming.rows) {
        const current = state.benchmark[key];
        if (!current || current.version !== 1) state.benchmark[key] = clone(incoming);
        else for (const id of (key === "bridgeLessons" ? ["error", "adjust", "overshoot"] : ["duty", "inductor", "load", "probe", "timing"])) {
          current.rows ||= {};
          if (!current.rows[id]?.first && incoming.rows[id]) current.rows[id] = clone(incoming.rows[id]);
        }
      } else if (key === "outcomeV1") {
        const current = state.benchmark.outcomeV1;
        const hasAttempts = current && Object.values(current.sessions || {}).some(phase =>
          Object.keys(phase?.firstAttempts || {}).length > 0 || (phase?.retries || []).length > 0);
        if (!hasAttempts) state.benchmark.outcomeV1 = clone(incoming);
        else if (stableJson(current) !== stableJson(incoming)) {
          state.benchmark.outcomeBackupArchives ||= [];
          if (!state.benchmark.outcomeBackupArchives.some(record => stableJson(record) === stableJson(incoming))) {
            state.benchmark.outcomeBackupArchives.push(clone(incoming));
          }
          state.benchmark.outcomeImportPreservedLocal = true;
        }
      } else if (!Object.hasOwn(state.benchmark, key)) state.benchmark[key] = clone(incoming);
    }
    // Preserve experiment logs carried by full backups without replacing local first attempts.
    const imported = payload.benchmark && payload.benchmark.trainingPractice;
    if (imported && Array.isArray(imported.sessions)) {
      const current = state.benchmark.trainingPractice || { sessions: [] };
      current.sessions = unionById(current.sessions, imported.sessions).slice(-12);
      current.studySessions = unionById(current.studySessions, Array.isArray(imported.studySessions) ? imported.studySessions : []);
      const incomingSeeds = Array.isArray(imported.seenRepairSeeds) ? imported.seenRepairSeeds.filter(seed => Number.isInteger(seed) && seed >= 1 && seed <= 1000000) : [];
      current.seenRepairSeeds = [...new Set([...(current.seenRepairSeeds || []), ...incomingSeeds])];
      if (!current.pilot && imported.pilot) current.pilot = imported.pilot;
      state.benchmark.trainingPractice = current;
    }
    for (const [name, raw] of Object.entries(payload.auxiliary || {})) {
      if (browser) pendingAuxiliary.set(name, clone(raw));
      else stores.get(name).restore(raw);
    }
    pushEvent(state, { type: "import", fromVersion: payload.version || "unknown" });
    return save(state);
  }

  function resetForTests() {
    const clear = () => {
      [KEY, V4_KEY, V3_KEY, V2_KEY].forEach(key => storage().removeItem(key));
      memory.clear(); pending = false; conflict = false; corruptRaw = null;
      observedRaw = null; pendingBaseline = null; pendingObject = null; committedRevision = null;
      localRevision++; rejectedDrafts.length = 0; pendingAuxiliary.clear();
      persistence = { saved: true, reason: null };
    };
    if (!browser) { clear(); return; }
    const baseline = pending ? pendingBaseline : observedRaw;
    if (!root.navigator?.locks?.request) { updatePersistence(false, 'concurrency-lock-unavailable'); return Promise.resolve(false); }
    return root.navigator.locks.request(KEY, { mode: 'exclusive' }, () => {
      if (conflict || storage().getItem(KEY) !== baseline) { updatePersistence(false, 'conflict'); return false; }
      clear(); return true;
    });
  }

  const api = {
    KEY, SCHEMA, VERSION, STRENGTH,
    emptyState, normalizeState, load, save, flush, retrySave, exportBackup, registerStore, refreshStorageStatus,
    storageStatus: () => ({ ...persistence }),
    evidenceLevel, recordEvidence, recordStep, recordMachine, machineEvents, getEvidence,
    commitPrediction, getPrediction, predictionStatus,
    setReport, getReport, getReportHistory,
    recordOpenResponse, recordDiagnosticGame,
    reconcileAliases, merge,
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
