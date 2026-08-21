(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeBenchmarkV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PHASE_INDEX = Object.freeze({ pre: 0, post: 1, r1: 2, r2: 3, r3: 4, r4: 5 });
  const RETENTION_DAYS = Object.freeze({ r1: 1, r2: 7, r3: 30, r4: 90 });

  // Backward-compatible public constant: the original V1 API remains legacy4 by default.
  const COMPETENCIES = Object.freeze(["physics", "timing", "next-measurement", "transfer"]);
  const CORE8_COMPETENCIES = Object.freeze([
    "physics", "sensing", "feedback", "timing",
    "dynamics", "safety", "production", "evidence"
  ]);
  const PROFILES = Object.freeze({
    legacy4: Object.freeze({ id: "legacy4", competencies: COMPETENCIES, defaultCountPerCompetency: 2 }),
    core8: Object.freeze({ id: "core8", competencies: CORE8_COMPETENCIES, defaultCountPerCompetency: 1 })
  });
  const DEFAULT_PROFILE = "legacy4";
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

  function profileDefinition(profile = DEFAULT_PROFILE) {
    const definition = PROFILES[profile];
    if (!definition) throw new RangeError(`unknown benchmark profile: ${profile}`);
    return definition;
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

  function choiceCase({ seed, phase, competency, slot, prompt, choices, expected, parameters, choiceLabels, rationale }) {
    return Object.freeze({
      id: caseId(seed, phase, competency, slot),
      phase,
      competency,
      answerType: "choice",
      prompt,
      choices: Object.freeze(choices),
      expected,
      choiceLabels: choiceLabels ? Object.freeze({ ...choiceLabels }) : undefined,
      rationale: rationale || undefined,
      parameters: Object.freeze(parameters)
    });
  }

  function physicsCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const inductanceUh = 80 + slot * 5;
    const factor = choose([0.5, 2], seed, slot, 1);
    const changedUh = inductanceUh * factor;
    const expected = factor < 1 ? "increase" : "decrease";
    return choiceCase({
      seed, phase, competency: "physics", slot,
      prompt: `Buck operating point is unchanged. L changes from ${inductanceUh} uH to ${changedUh} uH. What happens to inductor ripple ΔiL?`,
      choices: ["increase", "decrease", "same"],
      expected,
      choiceLabels: { increase: "ΔiL 變大", decrease: "ΔiL 變小", same: "大致不變" },
      parameters: { inductanceUh, changedUh, variantSlot: slot }
    });
  }

  function sensingCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const physicalV = round(7 + slot * 0.03, 2);
    const divider = round(0.08 + slot * 0.0005, 4);
    const factor = choose([0.75, 1.25], seed, slot, 11);
    const changedDivider = round(divider * factor, 4);
    const expected = factor > 1 ? "increase" : "decrease";
    return choiceCase({
      seed, phase, competency: "sensing", slot,
      prompt: `Physical Vout stays at ${physicalV} V and the ADC remains unsaturated. Divider ratio changes from ${divider} to ${changedDivider}. What should raw ADC count do first?`,
      choices: ["increase", "decrease", "same"],
      expected,
      choiceLabels: { increase: "ADC count 變大", decrease: "ADC count 變小", same: "ADC count 不變" },
      rationale: "Physical truth is unchanged; divider ratio changes ADC-pin voltage before any firmware scaling.",
      parameters: { physicalV, divider, changedDivider, factor, variantSlot: slot }
    });
  }

  function feedbackCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const referenceV = round(9 + slot * 0.04, 2);
    const deltaV = choose([-1.5, 1.5], seed, slot, 12);
    const changedReferenceV = round(referenceV + deltaV, 2);
    const feedbackV = round(referenceV - 0.8, 2);
    const expected = deltaV > 0 ? "duty-increase" : "duty-decrease";
    return choiceCase({
      seed, phase, competency: "feedback", slot,
      prompt: `Reconstructed feedback is frozen at ${feedbackV} V for the first control step. Reference changes from ${referenceV} V to ${changedReferenceV} V. With positive Kp/Ki and no saturation, what is the first duty-request tendency?`,
      choices: ["duty-increase", "duty-decrease", "same"],
      expected,
      choiceLabels: { "duty-increase": "Duty request 增加", "duty-decrease": "Duty request 減少", same: "Duty request 不變" },
      rationale: "For the first step, only r changed, so e = r − ŷ changes in the same direction and the positive PI command follows.",
      parameters: { referenceV, changedReferenceV, feedbackV, deltaV, variantSlot: slot }
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

  function dynamicsCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const probeHz = 4000 + slot * 90;
    const delayUs = round(4 + slot * 0.05, 3);
    const factor = choose([0.5, 2], seed, slot, 13);
    const changedDelayUs = round(delayUs * factor, 3);
    const expected = factor > 1 ? "more-negative" : "less-negative";
    return choiceCase({
      seed, phase, competency: "dynamics", slot,
      prompt: `Probe frequency stays at ${probeHz} Hz. Pure sample-to-actuate delay changes from ${delayUs} us to ${changedDelayUs} us. What happens to the delay-only phase contribution?`,
      choices: ["more-negative", "less-negative", "same"],
      expected,
      choiceLabels: { "more-negative": "Phase 更負、lag 更多", "less-negative": "Phase 較不負、lag 較少", same: "Phase 不變" },
      rationale: "φdelay = −360 f Td, so at fixed f the delay term changes linearly with Td.",
      parameters: { probeHz, delayUs, changedDelayUs, factor, variantSlot: slot }
    });
  }

  function safetyCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const hardwareNs = 150 + slot * 3;
    const softwareUs = round(2.5 + slot * 0.05, 2);
    return choiceCase({
      seed, phase, competency: "safety", slot,
      prompt: `An OCP can force PWM LOW through a ${hardwareNs} ns CMPSS/XBAR/Trip path or be noticed after a ${softwareUs} us ADC+ISR software path. Which path should own the fastest physical veto?`,
      choices: ["hardware-veto", "software-isr", "equivalent"],
      expected: "hardware-veto",
      choiceLabels: { "hardware-veto": "CMPSS / Trip hardware veto", "software-isr": "ADC ISR / CPU software", equivalent: "兩條等價" },
      rationale: "Safety authority must not wait for acquisition, interrupt entry and control compute when a direct hardware veto exists.",
      parameters: { hardwareNs, softwareUs, variantSlot: slot }
    });
  }

  function productionCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const timeoutTicks = 200 + slot * 3;
    const ageOffset = choose([-1, 0, 1, 25], seed, slot, 14);
    const commandAgeTicks = timeoutTicks + ageOffset;
    const expected = commandAgeTicks > timeoutTicks ? "denied" : "granted";
    return choiceCase({
      seed, phase, competency: "production", slot,
      prompt: `Assume RUN, sensing valid, no fault, peripherals ready and calibration valid. Command timeout=${timeoutTicks} ticks and external producer age=${commandAgeTicks} ticks. What is software PWM authority?`,
      choices: ["granted", "denied"],
      expected,
      choiceLabels: { granted: "GRANTED", denied: "DENIED / fail closed" },
      rationale: "Freshness belongs to the external producer; this teaching contract faults only when age is strictly greater than timeout.",
      parameters: { timeoutTicks, commandAgeTicks, ageOffset, variantSlot: slot }
    });
  }

  const EVIDENCE_FAMILIES = Object.freeze(["model", "hil", "target", "binding-only", "board-pass"]);

  function evidenceCase(seed, phase, index) {
    const slot = variantSlot(phase, index);
    const family = choose(EVIDENCE_FAMILIES, seed, slot, 15);
    let prompt;
    if (family === "model") {
      prompt = `Evidence package E-${slot + 1}: ${12 + slot} teaching-model invariant checks PASS, but there is no executable Host SIL/HIL/target evidence. What is the highest claim allowed?`;
    } else if (family === "hil") {
      prompt = `Evidence package E-${slot + 1}: Host SIL plus ${3 + (slot % 7)} deterministic HIL scenarios PASS, but no TI target image has been compiled or linked. What is the highest claim allowed?`;
    } else if (family === "target") {
      prompt = `Evidence package E-${slot + 1}: TI C2000 compile and linked Flash .out/.hex PASS; board bindings are incomplete and there are 0 physical captures. What is the highest claim allowed?`;
    } else if (family === "binding-only") {
      prompt = `Evidence package E-${slot + 1}: target image PASS and all 9/9 board bindings are VERIFIED, but only ${slot % 3}/8 required physical captures exist. What is the highest claim allowed?`;
    } else {
      prompt = `Evidence package E-${slot + 1}: target image PASS, 9/9 board bindings VERIFIED, and all 8/8 required physical captures PASS acceptance criteria. What is the highest claim allowed for this teaching board contract?`;
    }
    return choiceCase({
      seed, phase, competency: "evidence", slot,
      prompt,
      choices: ["model", "hil", "target", "binding-only", "board-pass"],
      expected: family,
      choiceLabels: {
        model: "Teaching model only",
        hil: "HIL tier",
        target: "Target image tier",
        "binding-only": "Board binding only；不可稱 BOARD_PASS",
        "board-pass": "BOARD_PASS for this evidence contract"
      },
      rationale: "Lower evidence tiers never certify higher tiers; board claims require the physical closure contract rather than CI inference.",
      parameters: { family, variantSlot: slot }
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

    return choiceCase({
      seed, phase, competency: "next-measurement", slot,
      prompt: `${scenario} Which measurement is highest information first?`,
      choices: DIAGNOSTIC_CHOICES,
      expected: family,
      rationale,
      parameters
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
    return choiceCase({
      seed, phase, competency: "transfer", slot,
      prompt: `The same ADC+ISR+compute path takes ${round(completionS * 1e6, 3)} us. It meets first-load timing at ${baseHz} Hz. Switching moves to ${transferHz} Hz with no code change. What happens?`,
      choices: ["still-met", "now-missed"],
      expected: transfer.firstLoadMet ? "still-met" : "now-missed",
      parameters: { baseHz, transferHz, completionUs: round(completionS * 1e6, 3), baseMet: base.firstLoadMet, variantSlot: slot }
    });
  }

  const GENERATORS = Object.freeze({
    physics: physicsCase,
    sensing: sensingCase,
    feedback: feedbackCase,
    timing: timingCase,
    dynamics: dynamicsCase,
    safety: safetyCase,
    production: productionCase,
    evidence: evidenceCase,
    "next-measurement": nextMeasurementCase,
    transfer: transferCase
  });

  function contentFingerprint(item) {
    return JSON.stringify({
      competency: item.competency,
      prompt: item.prompt,
      choices: item.choices,
      choiceLabels: item.choiceLabels,
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

  function generateBenchmarkSet({ seed = 20260821, phase = "pre", countPerCompetency, profile = DEFAULT_PROFILE } = {}) {
    if (!(phase in PHASE_INDEX)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    const definition = profileDefinition(profile);
    const count = countPerCompetency == null ? definition.defaultCountPerCompetency : countPerCompetency;
    if (!Number.isInteger(count) || count < 1 || count > MAX_CASES_PER_COMPETENCY) {
      throw new RangeError(`countPerCompetency must be an integer from 1 to ${MAX_CASES_PER_COMPETENCY}`);
    }
    const cases = [];
    for (const competency of definition.competencies) {
      for (let index = 0; index < count; index += 1) {
        cases.push(GENERATORS[competency](seed, phase, index));
      }
    }
    assertUniqueContent(cases, `${phase}/${profile}`);
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
    const competencies = [...new Set(cases.map(item => item.competency))];
    const byCompetency = {};
    for (const competency of competencies) {
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
      nextMeasurementAccuracy: byCompetency["next-measurement"]?.accuracy ?? null,
      transferAccuracy: byCompetency.transfer?.accuracy ?? null,
      attemptedCompetencies: competencies.filter(competency => byCompetency[competency].attempted > 0).length,
      competencyCount: competencies.length,
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

  function retentionPlan({ seed = 20260821, countPerCompetency, profile = DEFAULT_PROFILE } = {}) {
    const plan = Object.entries(RETENTION_DAYS).map(([phase, dueAfterDays]) => Object.freeze({
      phase,
      dueAfterDays,
      cases: generateBenchmarkSet({ seed, phase, countPerCompetency, profile })
    }));
    assertDisjointContent(plan.map(item => ({ name: item.phase, cases: item.cases })), "retention benchmark");
    return Object.freeze(plan);
  }

  return Object.freeze({
    COMPETENCIES,
    CORE8_COMPETENCIES,
    PROFILES,
    DEFAULT_PROFILE,
    RETENTION_DAYS,
    MAX_CASES_PER_COMPETENCY,
    profileDefinition,
    strictSampleToActuate,
    contentFingerprint,
    generateBenchmarkSet,
    answerCorrect,
    scoreFirstAttempts,
    compareSessions,
    retentionPlan
  });
});
