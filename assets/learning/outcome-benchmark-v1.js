(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeBenchmarkV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PHASE_OFFSETS = Object.freeze({ pre: 0, post: 1000003, r1: 2000003, r2: 3000017, r3: 4000037, r4: 5000081 });
  const RETENTION_DAYS = Object.freeze({ r1: 1, r2: 7, r3: 30, r4: 90 });
  const COMPETENCIES = Object.freeze(["physics", "timing", "next-measurement", "transfer"]);

  function rng(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return function next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pick = (random, values) => values[Math.floor(random() * values.length) % values.length];
  const round = (value, digits = 6) => Number(value.toFixed(digits));

  function strictSampleToActuate({ switchingHz, completionS }) {
    const periodS = 1 / switchingHz;
    const epsilon = Math.max(1e-15, periodS * 1e-12);
    const commitCycle = Math.floor((completionS + epsilon) / periodS) + 1;
    return Object.freeze({
      periodS,
      completionS,
      commitCycle,
      commitS: commitCycle * periodS,
      firstLoadMet: commitCycle === 1
    });
  }

  function physicsCase(random, id, phase) {
    const inductanceUh = pick(random, [100, 150, 220, 330, 470]);
    const factor = pick(random, [0.5, 2]);
    const changedUh = inductanceUh * factor;
    const expected = factor < 1 ? "increase" : "decrease";
    return Object.freeze({
      id, phase, competency: "physics", answerType: "choice",
      prompt: `Buck operating point is unchanged. L changes from ${inductanceUh} uH to ${changedUh} uH. What happens to inductor ripple ΔiL?`,
      choices: ["increase", "decrease", "same"], expected,
      parameters: Object.freeze({ inductanceUh, changedUh })
    });
  }

  function timingCase(random, id, phase) {
    const switchingHz = pick(random, [80000, 100000, 125000, 160000]);
    const periodS = 1 / switchingHz;
    const ratio = pick(random, [0.55, 0.82, 1.0, 1.08, 1.35]);
    const completionS = periodS * ratio;
    const truth = strictSampleToActuate({ switchingHz, completionS });
    return Object.freeze({
      id, phase, competency: "timing", answerType: "timing",
      prompt: `PWM=${switchingHz} Hz and ADC+ISR+compute completes at ${round(completionS * 1e6, 3)} us after ZERO. Does the new CMPA reach the first ZERO load event?`,
      expected: Object.freeze({ judgement: truth.firstLoadMet ? "met" : "missed", commitUs: round(truth.commitS * 1e6, 3) }),
      parameters: Object.freeze({ switchingHz, completionUs: round(completionS * 1e6, 3), periodUs: round(periodS * 1e6, 3) })
    });
  }

  const DIAGNOSTIC_CASES = Object.freeze([
    { scenario: "CMPA command changes but the physical gate remains LOW.", expected: "trip-path", label: "Measure Trip Zone / gate-veto path before retuning PI." },
    { scenario: "Physical Vout is correct but firmware Vout is wrong.", expected: "adc-scale-chain", label: "Measure sensor/scale/ADC chain before touching the controller." },
    { scenario: "A running converter suddenly reports COMMAND_TIMEOUT.", expected: "command-sequence-age", label: "Inspect producer sequence/freshness age before changing control gains." },
    { scenario: "The loop becomes unstable only after switching frequency is increased.", expected: "sample-to-actuate-delay", label: "Measure SOC→compute→PWM-load timing and effective delay." }
  ]);

  function nextMeasurementCase(random, id, phase) {
    const item = pick(random, DIAGNOSTIC_CASES);
    return Object.freeze({
      id, phase, competency: "next-measurement", answerType: "choice",
      prompt: `${item.scenario} Which measurement is highest information first?`,
      choices: DIAGNOSTIC_CASES.map(entry => entry.expected), expected: item.expected,
      rationale: item.label,
      parameters: Object.freeze({ scenario: item.scenario })
    });
  }

  function transferCase(random, id, phase) {
    const baseHz = pick(random, [80000, 100000, 120000]);
    const factor = pick(random, [1.5, 2, 2.5]);
    const transferHz = Math.round(baseHz * factor);
    const basePeriodS = 1 / baseHz;
    const completionRatio = pick(random, [0.62, 0.78, 0.9]);
    const completionS = basePeriodS * completionRatio;
    const base = strictSampleToActuate({ switchingHz: baseHz, completionS });
    const transfer = strictSampleToActuate({ switchingHz: transferHz, completionS });
    return Object.freeze({
      id, phase, competency: "transfer", answerType: "choice",
      prompt: `The same ADC+ISR+compute path takes ${round(completionS * 1e6, 3)} us. It meets first-load timing at ${baseHz} Hz. Switching moves to ${transferHz} Hz with no code change. What happens?`,
      choices: ["still-met", "now-missed"], expected: transfer.firstLoadMet ? "still-met" : "now-missed",
      parameters: Object.freeze({ baseHz, transferHz, completionUs: round(completionS * 1e6, 3), baseMet: base.firstLoadMet })
    });
  }

  const GENERATORS = Object.freeze({ physics: physicsCase, timing: timingCase, "next-measurement": nextMeasurementCase, transfer: transferCase });

  function generateBenchmarkSet({ seed = 20260821, phase = "pre", countPerCompetency = 2 } = {}) {
    if (!(phase in PHASE_OFFSETS)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1) throw new RangeError("countPerCompetency must be a positive integer");
    const cases = [];
    let ordinal = 0;
    for (const competency of COMPETENCIES) {
      for (let index = 0; index < countPerCompetency; index += 1) {
        const caseSeed = Number(seed) + PHASE_OFFSETS[phase] + ordinal * 7919;
        const random = rng(caseSeed);
        cases.push(GENERATORS[competency](random, `${phase}-${competency}-${caseSeed}`, phase));
        ordinal += 1;
      }
    }
    return Object.freeze(cases);
  }

  function answerCorrect(item, answer) {
    if (item.answerType === "timing") {
      if (!answer || answer.judgement !== item.expected.judgement) return false;
      return Math.abs(Number(answer.commitUs) - item.expected.commitUs) <= 0.001;
    }
    return answer === item.expected;
  }

  function scoreFirstAttempts(cases, attempts = []) {
    const caseById = new Map(cases.map(item => [item.id, item]));
    const first = new Map();
    attempts.forEach((attempt, order) => {
      if (!caseById.has(attempt.caseId)) return;
      const rank = Number.isFinite(attempt.attemptIndex) ? attempt.attemptIndex : order;
      const current = first.get(attempt.caseId);
      if (!current || rank < current.rank) first.set(attempt.caseId, { ...attempt, rank });
    });

    const rows = cases.map(item => {
      const attempt = first.get(item.id);
      return Object.freeze({
        caseId: item.id,
        phase: item.phase,
        competency: item.competency,
        attempted: Boolean(attempt),
        correct: attempt ? answerCorrect(item, attempt.answer) : false
      });
    });
    const attemptedRows = rows.filter(row => row.attempted);
    const correctRows = attemptedRows.filter(row => row.correct);
    const byCompetency = {};
    for (const competency of COMPETENCIES) {
      const subset = attemptedRows.filter(row => row.competency === competency);
      byCompetency[competency] = Object.freeze({
        attempted: subset.length,
        correct: subset.filter(row => row.correct).length,
        accuracy: subset.length ? subset.filter(row => row.correct).length / subset.length : null
      });
    }
    const status = attemptedRows.length < 4 ? "insufficient" : attemptedRows.length < 8 ? "provisional" : "usable";
    return Object.freeze({
      attempted: attemptedRows.length,
      correct: correctRows.length,
      accuracy: attemptedRows.length ? correctRows.length / attemptedRows.length : null,
      nextMeasurementAccuracy: byCompetency["next-measurement"].accuracy,
      transferAccuracy: byCompetency.transfer.accuracy,
      status,
      byCompetency: Object.freeze(byCompetency),
      rows: Object.freeze(rows)
    });
  }

  function compareSessions(preCases, preAttempts, postCases, postAttempts) {
    const overlap = new Set(preCases.map(item => item.id));
    if (postCases.some(item => overlap.has(item.id))) throw new Error("pre/post benchmark sets must be unseen and disjoint");
    const pre = scoreFirstAttempts(preCases, preAttempts);
    const post = scoreFirstAttempts(postCases, postAttempts);
    const delta = pre.accuracy == null || post.accuracy == null ? null : post.accuracy - pre.accuracy;
    const status = Math.min(pre.attempted, post.attempted) < 4 ? "insufficient" : Math.min(pre.attempted, post.attempted) < 8 ? "provisional" : "usable";
    return Object.freeze({ pre, post, delta, status, causalClaimAllowed: false, interpretation: "measured learner change on disjoint unseen sets; not a causal course-effect claim" });
  }

  function retentionPlan({ seed = 20260821, countPerCompetency = 1 } = {}) {
    return Object.freeze(Object.entries(RETENTION_DAYS).map(([phase, dueAfterDays]) => Object.freeze({
      phase,
      dueAfterDays,
      cases: generateBenchmarkSet({ seed, phase, countPerCompetency })
    })));
  }

  return Object.freeze({ COMPETENCIES, RETENTION_DAYS, strictSampleToActuate, generateBenchmarkSet, answerCorrect, scoreFirstAttempts, compareSessions, retentionPlan });
});
