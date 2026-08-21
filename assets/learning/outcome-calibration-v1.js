(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeCalibrationV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PHASES = Object.freeze(["pre", "post", "r1", "r2", "r3", "r4"]);
  const OUTCOME_PROFILES = Object.freeze(["legacy4", "core8"]);
  const PROFILE_COMPETENCIES = Object.freeze({
    legacy4: Object.freeze(["physics", "timing", "next-measurement", "transfer"]),
    core8: Object.freeze(["physics", "sensing", "feedback", "timing", "dynamics", "safety", "production", "evidence"])
  });
  const CALIBRATION_THRESHOLDS = Object.freeze({
    minimumReviewN: 20,
    usableN: 50,
    tooHardBelow: 0.30,
    tooEasyAbove: 0.90,
    lowDiscriminationBelow: 0.15,
    watchDiscriminationBelow: 0.25
  });
  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  function safeId(value) {
    const id = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("participantId must be 1-64 chars: letters, numbers, _ or -");
    return id;
  }

  function safeCaseId(value) {
    const id = String(value || "").trim();
    if (!/^[A-Za-z0-9._:-]{1,180}$/.test(id)) throw new Error("invalid calibration caseId");
    return id;
  }

  function safeProfile(value) {
    const profile = String(value || "").trim();
    if (!OUTCOME_PROFILES.includes(profile)) throw new Error("invalid outcome profile");
    return profile;
  }

  function safeInstrument(summary) {
    const seed = Number(summary && summary.seed);
    const countPerCompetency = Number(summary && summary.countPerCompetency);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("calibration export requires an integer instrument seed");
    if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1 || countPerCompetency > 16) throw new Error("calibration export requires countPerCompetency 1-16");
    return Object.freeze({ seed, countPerCompetency });
  }

  function calibrationPhase(status, phase, allowedCompetencies) {
    const value = status && typeof status === "object" ? status : {};
    const score = value.score && typeof value.score === "object" ? value.score : {};
    const rows = Array.isArray(score.rows) ? score.rows : [];
    const safeRows = rows
      .filter(row => row && row.attempted === true)
      .map(row => {
        const competency = String(row.competency || "");
        if (!allowedCompetencies.has(competency)) throw new Error(`unknown competency in ${phase}: ${competency}`);
        return Object.freeze({
          caseId: safeCaseId(row.caseId),
          competency,
          correct: row.correct === true
        });
      });
    return Object.freeze({
      completed: value.completed === true,
      attempted: Number(value.attempted || 0),
      total: Number(value.total || 0),
      rows: Object.freeze(safeRows)
    });
  }

  function exportParticipant(summary, { participantId, exportedAt = new Date().toISOString() } = {}) {
    if (!summary || typeof summary !== "object") throw new Error("outcome summary is required");
    const id = safeId(participantId);
    const profile = safeProfile(summary.profile);
    const instrument = safeInstrument(summary);
    const allowedCompetencies = new Set(PROFILE_COMPETENCIES[profile]);
    const phases = {};
    for (const phase of PHASES) {
      const status = phase === "pre" || phase === "post"
        ? summary[phase]
        : Array.isArray(summary.retention) ? summary.retention.find(item => item.phase === phase) : null;
      phases[phase] = calibrationPhase(status, phase, allowedCompetencies);
    }
    return Object.freeze({
      schema: "circuit-outcome-calibration",
      version: 1,
      outcomeProfile: profile,
      instrument,
      participantId: id,
      exportedAt,
      phases: Object.freeze(phases),
      containsItemCorrectness: true,
      containsRawAnswers: false,
      containsPrompts: false,
      causalClaimAllowed: false
    });
  }

  function validateParticipant(bundle) {
    const value = bundle && typeof bundle === "object" ? bundle : {};
    let idValid = true;
    let profileValid = true;
    try { safeId(value.participantId); } catch (_) { idValid = false; }
    try { safeProfile(value.outcomeProfile); } catch (_) { profileValid = false; }
    const profile = profileValid ? safeProfile(value.outcomeProfile) : "legacy4";
    const allowedCompetencies = new Set(PROFILE_COMPETENCIES[profile]);
    const seed = Number(value.instrument && value.instrument.seed);
    const count = Number(value.instrument && value.instrument.countPerCompetency);
    const instrumentValid = Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff && Number.isInteger(count) && count >= 1 && count <= 16;
    const phases = value.phases && typeof value.phases === "object" ? value.phases : {};
    const phaseRows = PHASES.map(phase => {
      const item = phases[phase] && typeof phases[phase] === "object" ? phases[phase] : {};
      const rows = Array.isArray(item.rows) ? item.rows : [];
      const ids = new Set();
      const rowsValid = rows.every(row => {
        if (!row || typeof row !== "object") return false;
        let caseValid = true;
        try { safeCaseId(row.caseId); } catch (_) { caseValid = false; }
        if (ids.has(row.caseId)) caseValid = false;
        ids.add(row.caseId);
        return caseValid && allowedCompetencies.has(row.competency) && typeof row.correct === "boolean";
      });
      const attempted = Number(item.attempted);
      const total = Number(item.total);
      const countsValid = Number.isInteger(attempted) && attempted >= 0 && Number.isInteger(total) && total >= attempted && rows.length === attempted;
      const completionValid = item.completed !== true || (attempted === total && total > 0);
      return Object.freeze({ phase, valid: rowsValid && countsValid && completionValid, rowsValid, countsValid, completionValid });
    });
    const privacyValid = value.containsItemCorrectness === true && value.containsRawAnswers === false && value.containsPrompts === false;
    const valid = value.schema === "circuit-outcome-calibration" && Number(value.version) === 1 && idValid && profileValid && instrumentValid && privacyValid && phaseRows.every(row => row.valid);
    return Object.freeze({ valid, idValid, profileValid, instrumentValid, privacyValid, phaseRows: Object.freeze(phaseRows) });
  }

  function pearson(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return null;
    const xMean = mean(xs), yMean = mean(ys);
    let numerator = 0, xSq = 0, ySq = 0;
    for (let index = 0; index < xs.length; index += 1) {
      const dx = xs[index] - xMean;
      const dy = ys[index] - yMean;
      numerator += dx * dy;
      xSq += dx * dx;
      ySq += dy * dy;
    }
    if (xSq === 0 || ySq === 0) return null;
    return numerator / Math.sqrt(xSq * ySq);
  }

  function evidenceStatus(n) {
    if (n < CALIBRATION_THRESHOLDS.minimumReviewN) return "insufficient";
    if (n < CALIBRATION_THRESHOLDS.usableN) return "provisional";
    return "usable";
  }

  function itemReview(proportionCorrect, discrimination, n) {
    if (n < CALIBRATION_THRESHOLDS.minimumReviewN) return Object.freeze({ status: "insufficient", flags: Object.freeze(["insufficient-sample"]) });
    const flags = [];
    if (proportionCorrect < CALIBRATION_THRESHOLDS.tooHardBelow) flags.push("too-hard");
    else if (proportionCorrect > CALIBRATION_THRESHOLDS.tooEasyAbove) flags.push("too-easy");
    if (discrimination == null) flags.push("discrimination-not-estimable");
    else if (discrimination < 0) flags.push("negative-discrimination");
    else if (discrimination < CALIBRATION_THRESHOLDS.lowDiscriminationBelow) flags.push("low-discrimination");
    else if (discrimination < CALIBRATION_THRESHOLDS.watchDiscriminationBelow) flags.push("watch-discrimination");
    return Object.freeze({ status: evidenceStatus(n), flags: Object.freeze(flags) });
  }

  function instrumentSignature(bundle) {
    return `${bundle.outcomeProfile}|${bundle.instrument.seed}|${bundle.instrument.countPerCompetency}`;
  }

  function aggregate(bundles = [], { phase = "post" } = {}) {
    if (!PHASES.includes(phase)) throw new RangeError(`unknown calibration phase: ${phase}`);
    const validations = bundles.map(bundle => validateParticipant(bundle));
    if (validations.some(result => !result.valid)) throw new Error("invalid calibration bundle in cohort");
    const ids = bundles.map(bundle => bundle.participantId);
    if (new Set(ids).size !== ids.length) throw new Error("duplicate participantId in calibration cohort");
    const signatures = new Set(bundles.map(instrumentSignature));
    if (signatures.size > 1) throw new Error("mixed calibration instruments cannot be aggregated");

    const completed = bundles.filter(bundle => {
      const status = bundle.phases[phase];
      return status.completed === true && status.attempted === status.total && status.total > 0;
    });
    if (completed.length > 1) {
      const firstSet = completed[0].phases[phase].rows.map(row => row.caseId).sort().join("|");
      if (completed.some(bundle => bundle.phases[phase].rows.map(row => row.caseId).sort().join("|") !== firstSet)) {
        throw new Error("calibration phase item sets differ despite matching instrument metadata");
      }
    }

    const participantRows = completed.map(bundle => {
      const rows = bundle.phases[phase].rows;
      const correct = rows.reduce((sum, row) => sum + (row.correct ? 1 : 0), 0);
      return { participantId: bundle.participantId, rows, totalCorrect: correct, accuracy: rows.length ? correct / rows.length : null };
    });
    const itemIds = completed.length ? completed[0].phases[phase].rows.map(row => row.caseId) : [];
    const itemAnalysis = itemIds.map(caseId => {
      const observations = participantRows.map(participant => {
        const row = participant.rows.find(item => item.caseId === caseId);
        const itemScore = row && row.correct ? 1 : 0;
        const denominator = participant.rows.length - 1;
        return {
          competency: row ? row.competency : null,
          itemScore,
          restScore: denominator > 0 ? (participant.totalCorrect - itemScore) / denominator : null
        };
      });
      const itemScores = observations.map(row => row.itemScore);
      const restScores = observations.map(row => row.restScore);
      const proportionCorrect = mean(itemScores);
      const discrimination = restScores.every(finite) ? pearson(itemScores, restScores.map(Number)) : null;
      const review = itemReview(proportionCorrect, discrimination, observations.length);
      return Object.freeze({
        caseId,
        competency: observations[0] && observations[0].competency,
        n: observations.length,
        proportionCorrect,
        correctedDiscrimination: discrimination,
        reviewStatus: review.status,
        reviewFlags: review.flags
      });
    });

    const profile = bundles.length ? bundles[0].outcomeProfile : null;
    const competencyKeys = profile ? PROFILE_COMPETENCIES[profile] : [];
    const byCompetency = {};
    for (const competency of competencyKeys) {
      const learnerAccuracy = participantRows.map(participant => {
        const rows = participant.rows.filter(row => row.competency === competency);
        return rows.length ? rows.filter(row => row.correct).length / rows.length : null;
      }).filter(finite).map(Number);
      byCompetency[competency] = Object.freeze({ n: learnerAccuracy.length, meanAccuracy: mean(learnerAccuracy) });
    }
    const reviewPriorityCompetencies = evidenceStatus(completed.length) === "insufficient"
      ? []
      : Object.entries(byCompetency)
          .filter(([, metric]) => finite(metric.meanAccuracy))
          .sort((a, b) => a[1].meanAccuracy - b[1].meanAccuracy)
          .map(([competency, metric]) => Object.freeze({ competency, meanAccuracy: metric.meanAccuracy }));

    return Object.freeze({
      schema: "circuit-outcome-calibration-summary",
      version: 1,
      outcomeProfile: profile,
      instrument: bundles.length ? Object.freeze({ ...bundles[0].instrument }) : null,
      phase,
      bundles: bundles.length,
      completed: completed.length,
      evidenceStatus: evidenceStatus(completed.length),
      meanAccuracy: mean(participantRows.map(row => row.accuracy).filter(finite).map(Number)),
      items: Object.freeze(itemAnalysis),
      byCompetency: Object.freeze(byCompetency),
      reviewPriorityCompetencies: Object.freeze(reviewPriorityCompetencies),
      thresholds: CALIBRATION_THRESHOLDS,
      causalClaimAllowed: false,
      interpretation: "observational item-calibration diagnostics on one phase and one exact instrument configuration; review heuristics, not psychometric validation or a causal course-effect claim"
    });
  }

  return Object.freeze({ PHASES, OUTCOME_PROFILES, PROFILE_COMPETENCIES, CALIBRATION_THRESHOLDS, exportParticipant, validateParticipant, aggregate });
});
