(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeSessionV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const Benchmark = root.CircuitOutcomeBenchmarkV1 || (typeof require === "function" ? require("./outcome-benchmark-v1.js") : null);
  const Evidence = root.CircuitEvidence || null;
  if (!Benchmark) throw new Error("CircuitOutcomeBenchmarkV1 is required");

  const PHASES = Object.freeze(["pre", "post", "r1", "r2", "r3", "r4"]);
  const RETENTION_DAYS = Benchmark.RETENTION_DAYS;
  const nowIso = () => new Date().toISOString();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function memoryEvidence() {
    let state = { benchmark: {}, events: [] };
    return {
      load: () => clone(state),
      save: value => { state = clone(value); return clone(state); }
    };
  }

  const fallback = memoryEvidence();
  const store = () => Evidence && Evidence.load && Evidence.save ? Evidence : fallback;

  function rootRecord(state) {
    state.benchmark = state.benchmark && typeof state.benchmark === "object" ? state.benchmark : {};
    state.benchmark.outcomeV1 = state.benchmark.outcomeV1 && typeof state.benchmark.outcomeV1 === "object"
      ? state.benchmark.outcomeV1
      : { seed: 20260821, countPerCompetency: 2, sessions: {}, retention: {}, createdAt: nowIso() };
    return state.benchmark.outcomeV1;
  }

  function loadRecord() {
    const state = store().load();
    return clone(rootRecord(state));
  }

  function saveRecord(record) {
    const state = store().load();
    state.benchmark = state.benchmark && typeof state.benchmark === "object" ? state.benchmark : {};
    state.benchmark.outcomeV1 = clone(record);
    store().save(state);
    return clone(record);
  }

  function phaseCases(record, phase) {
    return Benchmark.generateBenchmarkSet({ seed: record.seed, phase, countPerCompetency: record.countPerCompetency });
  }

  function ensurePhase(record, phase) {
    if (!PHASES.includes(phase)) throw new RangeError(`unknown outcome phase: ${phase}`);
    record.sessions = record.sessions || {};
    if (!record.sessions[phase]) {
      record.sessions[phase] = {
        phase,
        startedAt: nowIso(),
        completedAt: null,
        firstAttempts: {},
        retries: [],
        score: null
      };
    }
    return record.sessions[phase];
  }

  function configure({ seed, countPerCompetency } = {}) {
    const record = loadRecord();
    const hasAttempts = Object.values(record.sessions || {}).some(session => Object.keys(session.firstAttempts || {}).length > 0);
    if (hasAttempts) throw new Error("benchmark configuration is immutable after the first attempt");
    if (seed != null) record.seed = Number(seed) >>> 0;
    if (countPerCompetency != null) {
      if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1 || countPerCompetency > Benchmark.MAX_CASES_PER_COMPETENCY) {
        throw new RangeError("invalid countPerCompetency");
      }
      record.countPerCompetency = countPerCompetency;
    }
    return saveRecord(record);
  }

  function startPhase(phase) {
    const record = loadRecord();
    ensurePhase(record, phase);
    return saveRecord(record).sessions[phase];
  }

  function recordAttempt(phase, caseId, answer) {
    const record = loadRecord();
    const session = ensurePhase(record, phase);
    const cases = phaseCases(record, phase);
    const item = cases.find(testCase => testCase.id === caseId);
    if (!item) throw new Error(`case does not belong to ${phase}: ${caseId}`);
    session.firstAttempts = session.firstAttempts || {};
    session.retries = Array.isArray(session.retries) ? session.retries : [];
    if (!session.firstAttempts[caseId]) {
      session.firstAttempts[caseId] = { caseId, answer: clone(answer), at: nowIso(), attemptIndex: 0 };
    } else {
      session.retries.push({ caseId, answer: clone(answer), at: nowIso(), attemptIndex: session.retries.filter(row => row.caseId === caseId).length + 1 });
    }

    const attempts = Object.values(session.firstAttempts);
    session.score = Benchmark.scoreFirstAttempts(cases, attempts);
    if (attempts.length === cases.length && !session.completedAt) {
      session.completedAt = nowIso();
      if (phase === "post") scheduleRetention(record, session.completedAt);
    }
    saveRecord(record);
    return Object.freeze({
      firstAttempt: clone(session.firstAttempts[caseId]),
      immutable: true,
      correct: Benchmark.answerCorrect(item, session.firstAttempts[caseId].answer),
      completed: Boolean(session.completedAt),
      score: clone(session.score)
    });
  }

  function scheduleRetention(record, postCompletedAt) {
    const base = new Date(postCompletedAt).getTime();
    record.retention = record.retention || {};
    for (const [phase, days] of Object.entries(RETENTION_DAYS)) {
      record.retention[phase] = {
        phase,
        dueAfterDays: days,
        dueAt: new Date(base + days * 86400000).toISOString()
      };
    }
  }

  function phaseStatus(phase, at = Date.now()) {
    const record = loadRecord();
    const session = record.sessions && record.sessions[phase] || null;
    const cases = phaseCases(record, phase);
    const attempts = session ? Object.values(session.firstAttempts || {}) : [];
    const retention = record.retention && record.retention[phase] || null;
    const due = retention ? at >= new Date(retention.dueAt).getTime() : phase === "pre" || phase === "post";
    return Object.freeze({
      phase,
      total: cases.length,
      attempted: attempts.length,
      completed: Boolean(session && session.completedAt),
      started: Boolean(session),
      due,
      dueAt: retention && retention.dueAt || null,
      score: session && session.score || null,
      cases: Object.freeze(cases)
    });
  }

  function summary(at = Date.now()) {
    const record = loadRecord();
    const pre = record.sessions && record.sessions.pre;
    const post = record.sessions && record.sessions.post;
    let comparison = null;
    if (pre && pre.completedAt && post && post.completedAt) {
      comparison = Benchmark.compareSessions(
        phaseCases(record, "pre"), Object.values(pre.firstAttempts || {}),
        phaseCases(record, "post"), Object.values(post.firstAttempts || {})
      );
    }
    const retention = ["r1", "r2", "r3", "r4"].map(phase => phaseStatus(phase, at));
    return Object.freeze({
      seed: record.seed,
      countPerCompetency: record.countPerCompetency,
      pre: phaseStatus("pre", at),
      post: phaseStatus("post", at),
      comparison,
      retention: Object.freeze(retention),
      nextDue: retention.find(item => item.due && !item.completed) || retention.find(item => !item.completed) || null
    });
  }

  function reset() {
    const state = store().load();
    if (state.benchmark) delete state.benchmark.outcomeV1;
    store().save(state);
    return loadRecord();
  }

  return Object.freeze({ PHASES, configure, startPhase, recordAttempt, phaseStatus, summary, reset, loadRecord });
});
