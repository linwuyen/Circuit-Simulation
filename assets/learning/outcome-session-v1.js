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
  const NEW_RECORD_PROFILE = "core8";
  const NEW_RECORD_INSTRUMENT_VERSION = 2;
  const nowIso = () => new Date().toISOString();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function familyEngine() {
    return root.CircuitOutcomeCore8InstrumentV2 || (typeof require === "function" ? require("./outcome-core8-instrument-v2.js") : null);
  }

  function assertInstrumentVersion(profile, version) {
    const value = Number(version);
    const valid = profile === "legacy4" ? value === 1 : profile === "core8" ? (value === 1 || value === 2) : false;
    if (!valid) throw new RangeError(`unsupported ${profile} instrumentVersion: ${version}`);
    return value;
  }

  function memoryEvidence() {
    let state = { benchmark: {}, events: [] };
    return {
      load: () => clone(state),
      save: value => { state = clone(value); return clone(state); }
    };
  }

  const fallback = memoryEvidence();
  const store = () => Evidence && Evidence.load && Evidence.save ? Evidence : fallback;

  function normalizeRecord(record, existed) {
    if (!record.profile) {
      // Records created before profile support must keep the original four-competency instrument.
      record.profile = existed ? "legacy4" : NEW_RECORD_PROFILE;
    }
    const definition = Benchmark.profileDefinition(record.profile);
    if (!Number.isInteger(record.instrumentVersion)) {
      // Evidence created before versioned item families must remain on the exact V1 generator.
      record.instrumentVersion = existed ? 1 : (record.profile === "core8" ? NEW_RECORD_INSTRUMENT_VERSION : 1);
    }
    assertInstrumentVersion(record.profile, record.instrumentVersion);
    if (!Number.isInteger(record.countPerCompetency) || record.countPerCompetency < 1 || record.countPerCompetency > Benchmark.MAX_CASES_PER_COMPETENCY) {
      record.countPerCompetency = definition.defaultCountPerCompetency;
    }
    if (record.profile === "core8" && record.instrumentVersion === 2 && record.countPerCompetency !== 1) {
      throw new RangeError("core8 instrumentVersion 2 requires countPerCompetency=1");
    }
    record.sessions = record.sessions && typeof record.sessions === "object" ? record.sessions : {};
    record.retention = record.retention && typeof record.retention === "object" ? record.retention : {};
    return record;
  }

  function rootRecord(state) {
    state.benchmark = state.benchmark && typeof state.benchmark === "object" ? state.benchmark : {};
    const existed = Boolean(state.benchmark.outcomeV1 && typeof state.benchmark.outcomeV1 === "object");
    state.benchmark.outcomeV1 = existed
      ? state.benchmark.outcomeV1
      : {
          seed: 20260821,
          profile: NEW_RECORD_PROFILE,
          instrumentVersion: NEW_RECORD_INSTRUMENT_VERSION,
          countPerCompetency: Benchmark.PROFILES[NEW_RECORD_PROFILE].defaultCountPerCompetency,
          sessions: {},
          retention: {},
          createdAt: nowIso()
        };
    return normalizeRecord(state.benchmark.outcomeV1, existed);
  }

  function loadRecord() {
    const state = store().load();
    return clone(rootRecord(state));
  }

  function saveRecord(record) {
    const state = store().load();
    state.benchmark = state.benchmark && typeof state.benchmark === "object" ? state.benchmark : {};
    state.benchmark.outcomeV1 = clone(normalizeRecord(record, true));
    store().save(state);
    return clone(state.benchmark.outcomeV1);
  }

  function phaseCases(record, phase) {
    if (record.profile === "core8" && record.instrumentVersion === 2) {
      const Instrument = familyEngine();
      if (!Instrument || Instrument.VERSION !== 2) throw new Error("CircuitOutcomeCore8InstrumentV2 is required for core8 instrumentVersion 2");
      return Instrument.generateBenchmarkSet({
        seed: record.seed,
        phase,
        countPerCompetency: record.countPerCompetency
      });
    }
    return Benchmark.generateBenchmarkSet({
      seed: record.seed,
      phase,
      countPerCompetency: record.countPerCompetency,
      profile: record.profile
    });
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

  function phasePermission(record, phase, at = Date.now()) {
    if (!PHASES.includes(phase)) return Object.freeze({ allowed: false, reason: `unknown outcome phase: ${phase}` });
    if (phase === "pre") return Object.freeze({ allowed: true, reason: null });
    if (phase === "post") {
      const pre = record.sessions && record.sessions.pre;
      return pre && pre.completedAt
        ? Object.freeze({ allowed: true, reason: null })
        : Object.freeze({ allowed: false, reason: "POST requires completed PRE" });
    }
    const post = record.sessions && record.sessions.post;
    if (!post || !post.completedAt) return Object.freeze({ allowed: false, reason: `${phase.toUpperCase()} requires completed POST` });
    const retention = record.retention && record.retention[phase];
    if (!retention || !retention.dueAt) return Object.freeze({ allowed: false, reason: `${phase.toUpperCase()} has no retention due date` });
    if (at < new Date(retention.dueAt).getTime()) return Object.freeze({ allowed: false, reason: `${phase.toUpperCase()} is not due until ${retention.dueAt}` });
    return Object.freeze({ allowed: true, reason: null });
  }

  function assertPhasePermission(record, phase, at) {
    const permission = phasePermission(record, phase, at);
    if (!permission.allowed) throw new Error(permission.reason);
    return permission;
  }

  function configure({ seed, countPerCompetency, profile, instrumentVersion } = {}) {
    const record = loadRecord();
    const hasAttempts = Object.values(record.sessions || {}).some(session => Object.keys(session.firstAttempts || {}).length > 0);
    if (hasAttempts) throw new Error("benchmark configuration is immutable after the first attempt");
    if (seed != null) record.seed = Number(seed) >>> 0;
    if (profile != null) {
      const definition = Benchmark.profileDefinition(profile);
      record.profile = definition.id;
      record.instrumentVersion = instrumentVersion == null ? (record.profile === "core8" ? NEW_RECORD_INSTRUMENT_VERSION : 1) : Number(instrumentVersion);
      assertInstrumentVersion(record.profile, record.instrumentVersion);
      if (countPerCompetency == null) record.countPerCompetency = definition.defaultCountPerCompetency;
    } else if (instrumentVersion != null) {
      record.instrumentVersion = assertInstrumentVersion(record.profile, instrumentVersion);
    }
    if (countPerCompetency != null) {
      if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1 || countPerCompetency > Benchmark.MAX_CASES_PER_COMPETENCY) {
        throw new RangeError("invalid countPerCompetency");
      }
      record.countPerCompetency = countPerCompetency;
    }
    if (record.profile === "core8" && record.instrumentVersion === 2 && record.countPerCompetency !== 1) {
      throw new RangeError("core8 instrumentVersion 2 requires countPerCompetency=1");
    }
    return saveRecord(record);
  }

  function startPhase(phase, at = Date.now()) {
    const record = loadRecord();
    assertPhasePermission(record, phase, at);
    ensurePhase(record, phase);
    return saveRecord(record).sessions[phase];
  }

  function recordAttempt(phase, caseId, answer, at = Date.now()) {
    const record = loadRecord();
    assertPhasePermission(record, phase, at);
    const session = ensurePhase(record, phase);
    const cases = phaseCases(record, phase);
    const item = cases.find(testCase => testCase.id === caseId);
    if (!item) throw new Error(`case does not belong to ${phase}: ${caseId}`);
    session.firstAttempts = session.firstAttempts || {};
    session.retries = Array.isArray(session.retries) ? session.retries : [];
    const attemptedAt = new Date(at).toISOString();
    if (!session.firstAttempts[caseId]) {
      session.firstAttempts[caseId] = { caseId, answer: clone(answer), at: attemptedAt, attemptIndex: 0 };
    } else {
      session.retries.push({ caseId, answer: clone(answer), at: attemptedAt, attemptIndex: session.retries.filter(row => row.caseId === caseId).length + 1 });
    }

    const attempts = Object.values(session.firstAttempts);
    session.score = Benchmark.scoreFirstAttempts(cases, attempts);
    if (attempts.length === cases.length && !session.completedAt) {
      session.completedAt = attemptedAt;
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
    if (!PHASES.includes(phase)) throw new RangeError(`unknown outcome phase: ${phase}`);
    const session = record.sessions && record.sessions[phase] || null;
    const cases = phaseCases(record, phase);
    const attempts = session ? Object.values(session.firstAttempts || {}) : [];
    const retention = record.retention && record.retention[phase] || null;
    const permission = phasePermission(record, phase, at);
    const due = /^r[1-4]$/.test(phase) ? permission.allowed : phase === "pre" || (phase === "post" && permission.allowed);
    return Object.freeze({
      phase,
      profile: record.profile,
      instrumentVersion: record.instrumentVersion,
      total: cases.length,
      attempted: attempts.length,
      completed: Boolean(session && session.completedAt),
      started: Boolean(session),
      due,
      allowed: permission.allowed,
      blockedReason: permission.reason,
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
    const Instrument = record.profile === "core8" && record.instrumentVersion === 2 ? familyEngine() : null;
    return Object.freeze({
      seed: record.seed,
      profile: record.profile,
      instrumentVersion: record.instrumentVersion,
      familyContractFingerprint: Instrument ? Instrument.familyContractFingerprint() : null,
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

  return Object.freeze({ PHASES, configure, startPhase, recordAttempt, phaseStatus, summary, reset, loadRecord, phasePermission });
});
