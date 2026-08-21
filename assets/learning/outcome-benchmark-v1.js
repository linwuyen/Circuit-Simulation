(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeBenchmarkV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PHASE_INDEX = Object.freeze({ pre: 0, post: 1, r1: 2, r2: 3, r3: 4, r4: 5 });
  const RETENTION_DAYS = Object.freeze({ r1: 1, r2: 7, r3: 30, r4: 90 });
  const COMPETENCIES = Object.freeze(["physics", "timing", "next-measurement", "transfer"]);
  const MAX_CASES_PER_COMPETENCY = 16;
  const round = (value, digits = 6) => Number(value.toFixed(digits));

  function normalizedSeed(seed) {
    const value = Number(seed);
    if (!Number.isFinite(value)) throw new RangeError("seed must be finite");
    return value >>> 0;
  }

  function choose(values, seed, slot, salt = 0) {
    return values[(normalizedSeed(seed) + slot * 31 + salt * 17) % values.length];
  }

  function variantSlot(phase, index) {
    if (!(phase in PHASE_INDEX)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_CASES_PER_COMPETENCY) {
      throw new RangeError(`benchmark index must be 0..${MAX_CASES_PER_COMPETENCY - 1}`);
    }
    return PHASE_INDEX[phase] * MAX_CASES_PER_COMPETENCY + index;
  }

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

  function caseId(seed, phase, competency, slot) {
    return `${phase}-${competency}-v${slot}-s${normalizedSeed(seed)}`;
  }

  function physicsCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const inductanceUh = 80 + slot * 5;
    const factor = choose([0.5, 2], seed, slot, 1);
    const changedUh = inductanceUh * factor;
    const expected = factor < 1 ? "increase" : "decrease";
    return Object.freeze({
      id: caseId(seed, phase, "physics", slot), phase, competency: "physics", answerType: "choice",
      prompt: `Buck operating point is unchanged. L changes from ${inductanceUh} uH to ${changedUh} uH. What happens to inductor ripple ΔiL?`,
      choices: ["increase", "decrease", "same"], expected,
      parameters: Object.freeze({ inductanceUh, changedUh, variantSlot: slot })
    });
  }

  function timingCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const switchingHz = 70000 + slot * 1000;
    const periodS = 1 / switchingHz;
    const ratio = choose([0.55, 0.82, 1.0, 1.08, 1.35], seed, slot, 2);
    const completionS = periodS * ratio;
    const truth = strictSampleToActuate({ switchingHz, completionS });
    return Object.freeze({
      id: caseId(seed, phase, "timing", slot), phase, competency: "timing", answerType: "timing",
      prompt: `PWM=${switchingHz} Hz and ADC+ISR+compute completes at ${round(completionS * 1e6, 3)} us after ZERO. Does the new CMPA reach the first ZERO load event?`,
      expected: Object.freeze({ judgement: truth.firstLoadMet ? "met" : "missed", commitUs: round(truth.commitS * 1e6, 3) }),
      parameters: Object.freeze({ switchingHz, completionUs: round(completionS * 1e6, 3), periodUs: round(periodS * 1e6, 3), variantSlot: slot })
    });
  }

  const DIAGNOSTIC_CHOICES = Object.freeze(["trip-path", "adc-scale-chain", "command-sequence-age", "sample-to-actuate-delay"]);

  function nextMeasurementCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const family = choose(DIAGNOSTIC_CHOICES, seed, slot, 3);
    let scenario;
    let rationale;
    let parameters;

    if (family === "trip-path") {
      const commandDutyPct = round(10 + slot * 0.5, 1);
      const requestedDutyPct = round(commandDutyPct + 12.5, 1);
      scenario = `CMPA command changes from ${commandDutyPct}% to ${requestedDutyPct}% but the physical gate remains LOW.`;
      rationale = "Measure Trip Zone / gate-veto path before retuning PI.";
      parameters = { commandDutyPct, requestedDutyPct, variantSlot: slot };
    } else if (family === "adc-scale-chain") {
      const physicalVout = round(8 + slot * 0.05, 2);
      const firmwareVout = round(physicalVout * choose([0.82, 1.18], seed, slot, 4), 2);
      scenario = `DMM Vout is ${physicalVout} V while firmware reports ${firmwareVout} V at the same operating point.`;
      rationale = "Measure sensor/scale/ADC chain before touching the controller.";
      parameters = { physicalVout, firmwareVout, variantSlot: slot };
    } else if (family === "command-sequence-age") {
      const staleBudgetMs = 120 + slot * 3;
      scenario = `A running converter reports COMMAND_TIMEOUT after a ${staleBudgetMs} ms freshness budget even though PWM timing is unchanged.`;
      rationale = "Inspect producer sequence/freshness age before changing control gains.";
      parameters = { staleBudgetMs, variantSlot: slot };
    } else {
      const switchingHz = 75000 + slot * 900;
      scenario = `The loop is stable at its original rate but becomes unstable after switching frequency is changed to ${switchingHz} Hz with the same compute path.`;
      rationale = "Measure SOC→compute→PWM-load timing and effective delay.";
      parameters = { switchingHz, variantSlot: slot };
    }

    return Object.freeze({
      id: caseId(seed, phase, "next-measurement", slot), phase, competency: "next-measurement", answerType: "choice",
      prompt: `${scenario} Which measurement is highest information first?`,
      choices: DIAGNOSTIC_CHOICES, expected: family,
      rationale,
      parameters: Object.freeze(parameters)
    });
  }

  function transferCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const baseHz = 65000 + slot * 700;
    const factor = choose([1.5, 2, 2.5], seed, slot, 5);
    const transferHz = Math.round(baseHz * factor);
    const basePeriodS = 1 / baseHz;
    const completionRatio = choose([0.62, 0.78, 0.9], seed, slot, 6);
    const completionS = basePeriodS * completionRatio;
    const base = strictSampleToActuate({ switchingHz: baseHz, completionS });
    const transfer = strictSampleToActuate({ switchingHz: transferHz, completionS });
    return Object.freeze({
      id: caseId(seed, phase, "transfer", slot), phase, competency: "transfer", answerType: "choice",
      prompt: `The same ADC+ISR+compute path takes ${round(completionS * 1e6, 3)} us. It meets first-load timing at ${baseHz} Hz. Switching moves to ${transferHz} Hz with no code change. What happens?`,
      choices: ["still-met", "now-missed"], expected: transfer.firstLoadMet ? "still-met" : "now-missed",
      parameters: Object.freeze({ baseHz, transferHz, completionUs: round(completionS * 1e6, 3), baseMet: base.firstLoadMet, variantSlot: slot })
    });
  }

  const GENERATORS = Object.freeze({ physics: physicsCase, timing: timingCase, "next-measurement": nextMeasurementCase, transfer: transferCase });

  function contentFingerprint(item) {
    return JSON.stringify({
      competency: item.competency,
      prompt: item.prompt,
      choices: item.choices,
      expected: item.expected,
      parameters: item.parameters
    });
  }

  function assertUniqueContent(cases, label) {
    const fingerprints = new Set();
    for (const item of cases) {
      const fingerprint = contentFingerprint(item);
      if (fingerprints.has(fingerprint)) throw new Error(`${label} contains duplicate benchmark content`);
      fingerprints.add(fingerprint);
    }
  }

  function assertDisjointContent(groups, label) {
    const owner = new Map();
    for (const group of groups) {
      for (const item of group.cases) {
        const fingerprint = contentFingerprint(item);
        if (owner.has(fingerprint)) {
          throw new Error(`${label} reuses benchmark content between ${owner.get(fingerprint)} and ${group.name}`);
        }
        owner.set(fingerprint, group.name);
      }
    }
  }

  function generateBenchmarkSet({ seed = 20260821, phase = "pre", countPerCompetency = 2 } = {}) {
    if (!(phase in PHASE_INDEX)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1 || countPerCompetency > MAX_CASES_PER_COMPETENCY) {
      throw new RangeError(`countPerCompetency must be an integer from 1 to ${MAX_CASES_PER_COMPETENCY}`);
    }
    const cases = [];
    for (const competency of COMPETENCIES) {
      for (let index = 0; index < countPerCompetency; index += 1) {
        cases.push(GENERATORS[competency](seed, phase, index));
      }
    }
    assertUniqueContent(cases, phase);
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
    assertUniqueContent(preCases, "pre");
    assertUniqueContent(postCases, "post");
    assertDisjointContent([{ name: "pre", cases: preCases }, { name: "post", cases: postCases }], "pre/post benchmark");
    const pre = scoreFirstAttempts(preCases, preAttempts);
    const post = scoreFirstAttempts(postCases, postAttempts);
    const delta = pre.accuracy == null || post.accuracy == null ? null : post.accuracy - pre.accuracy;
    const status = Math.min(pre.attempted, post.attempted) < 4 ? "insufficient" : Math.min(pre.attempted, post.attempted) < 8 ? "provisional" : "usable";
    return Object.freeze({ pre, post, delta, status, causalClaimAllowed: false, interpretation: "measured learner change on content-disjoint unseen sets; not a causal course-effect claim" });
  }

  function retentionPlan({ seed = 20260821, countPerCompetency = 1 } = {}) {
    const plan = Object.entries(RETENTION_DAYS).map(([phase, dueAfterDays]) => Object.freeze({
      phase,
      dueAfterDays,
      cases: generateBenchmarkSet({ seed, phase, countPerCompetency })
    }));
    assertDisjointContent(plan.map(item => ({ name: item.phase, cases: item.cases })), "retention benchmark");
    return Object.freeze(plan);
  }

  return Object.freeze({
    COMPETENCIES,
    RETENTION_DAYS,
    MAX_CASES_PER_COMPETENCY,
    strictSampleToActuate,
    contentFingerprint,
    generateBenchmarkSet,
    answerCorrect,
    scoreFirstAttempts,
    compareSessions,
    retentionPlan
  });
});
