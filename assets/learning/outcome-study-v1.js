(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeStudyV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const PHASES = Object.freeze(["pre","post","r1","r2","r3","r4"]);
  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const mean = values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;

  function safeId(value) {
    const id = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("participantId must be 1-64 chars: letters, numbers, _ or -");
    return id;
  }

  const OUTCOME_PROFILES = Object.freeze(["legacy4", "core8"]);
  const PROFILE_COMPETENCIES = Object.freeze({
    legacy4: Object.freeze(["physics", "timing", "next-measurement", "transfer"]),
    core8: Object.freeze(["physics", "sensing", "feedback", "timing", "dynamics", "safety", "production", "evidence"])
  });

  function safeProfile(value) {
    const profile = String(value || "legacy4").trim();
    if (!OUTCOME_PROFILES.includes(profile)) throw new Error("invalid outcome profile");
    return profile;
  }

  function safeInstrumentVersion(profile, value) {
    const version = value == null ? 1 : Number(value);
    const valid = profile === "legacy4" ? version === 1 : profile === "core8" ? (version === 1 || version === 2) : false;
    if (!Number.isInteger(version) || !valid) throw new Error("invalid outcome instrument version");
    return version;
  }

  function competencyMetrics(score) {
    const rows = score && score.byCompetency && typeof score.byCompetency === "object" ? score.byCompetency : {};
    const result = {};
    for (const [competency, metric] of Object.entries(rows)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(competency)) continue;
      const attempted = Number(metric && metric.attempted || 0);
      const correct = Number(metric && metric.correct || 0);
      const accuracy = finite(metric && metric.accuracy) ? Number(metric.accuracy) : null;
      result[competency] = Object.freeze({ attempted, correct, accuracy });
    }
    return Object.freeze(result);
  }

  function phaseMetric(status) {
    const value = status && typeof status === "object" ? status : {};
    const score = value.score && typeof value.score === "object" ? value.score : {};
    return Object.freeze({
      attempted:Number(value.attempted || 0),
      total:Number(value.total || 0),
      completed:value.completed === true,
      accuracy:finite(score.accuracy) ? Number(score.accuracy) : null,
      nextMeasurementAccuracy:finite(score.nextMeasurementAccuracy) ? Number(score.nextMeasurementAccuracy) : null,
      transferAccuracy:finite(score.transferAccuracy) ? Number(score.transferAccuracy) : null,
      byCompetency:competencyMetrics(score)
    });
  }

  function exportParticipant(summary, { participantId, exportedAt = new Date().toISOString() } = {}) {
    if (!summary || typeof summary !== "object") throw new Error("outcome summary is required");
    const id = safeId(participantId);
    const profile = safeProfile(summary.profile || "legacy4");
    const instrumentVersion = safeInstrumentVersion(profile, summary.instrumentVersion);
    const phases = {};
    phases.pre = phaseMetric(summary.pre);
    phases.post = phaseMetric(summary.post);
    for (const phase of ["r1","r2","r3","r4"]) {
      const row = Array.isArray(summary.retention) ? summary.retention.find(item => item.phase === phase) : null;
      phases[phase] = phaseMetric(row);
    }
    const delta = summary.comparison && finite(summary.comparison.delta) ? Number(summary.comparison.delta) : null;
    return Object.freeze({
      schema:"circuit-outcome-study",
      version:1,
      outcomeProfile:profile,
      outcomeInstrumentVersion:instrumentVersion,
      participantId:id,
      exportedAt,
      phases:Object.freeze(phases),
      pairedPrePost:phases.pre.completed && phases.post.completed,
      delta,
      causalClaimAllowed:false,
      containsRawAnswers:false,
      containsPrompts:false
    });
  }

  function validateParticipant(bundle) {
    const value = bundle && typeof bundle === "object" ? bundle : {};
    let idValid = true;
    let profileValid = true;
    let instrumentVersionValid = true;
    try { safeId(value.participantId); } catch (_) { idValid = false; }
    try { safeProfile(value.outcomeProfile || "legacy4"); } catch (_) { profileValid = false; }
    const profile = profileValid ? safeProfile(value.outcomeProfile || "legacy4") : "legacy4";
    try { safeInstrumentVersion(profile, value.outcomeInstrumentVersion); } catch (_) { instrumentVersionValid = false; }
    const allowedCompetencies = new Set(PROFILE_COMPETENCIES[profile]);
    const phases = value.phases && typeof value.phases === "object" ? value.phases : {};
    const phaseRows = PHASES.map(phase => {
      const item = phases[phase] && typeof phases[phase] === "object" ? phases[phase] : {};
      const rows = item.byCompetency && typeof item.byCompetency === "object" ? item.byCompetency : {};
      const competenciesValid = Object.entries(rows).every(([key, metric]) => {
        const attempted = Number(metric && metric.attempted);
        const correct = Number(metric && metric.correct);
        const accuracy = metric && metric.accuracy;
        return allowedCompetencies.has(key) &&
          Number.isInteger(attempted) && attempted >= 0 &&
          Number.isInteger(correct) && correct >= 0 && correct <= attempted &&
          (accuracy == null || (finite(accuracy) && Number(accuracy) >= 0 && Number(accuracy) <= 1));
      });
      const valid = Number.isInteger(Number(item.attempted)) &&
        Number.isInteger(Number(item.total)) &&
        Number(item.attempted) >= 0 &&
        Number(item.total) >= Number(item.attempted) &&
        (item.accuracy == null || (finite(item.accuracy) && Number(item.accuracy) >= 0 && Number(item.accuracy) <= 1)) &&
        competenciesValid;
      return Object.freeze({ phase, valid, competenciesValid });
    });
    const privacyValid = value.containsRawAnswers === false && value.containsPrompts === false;
    const valid = value.schema === "circuit-outcome-study" &&
      Number(value.version) === 1 &&
      idValid &&
      profileValid &&
      instrumentVersionValid &&
      privacyValid &&
      phaseRows.every(row => row.valid);
    return Object.freeze({ valid, idValid, profileValid, instrumentVersionValid, privacyValid, phaseRows:Object.freeze(phaseRows) });
  }

  function aggregateCompetencies(bundles, phase) {
    const keys = new Set();
    for (const bundle of bundles) {
      const rows = bundle.phases?.[phase]?.byCompetency || {};
      Object.keys(rows).forEach(key => keys.add(key));
    }
    const result = {};
    for (const key of [...keys].sort()) {
      const values = bundles
        .map(bundle => bundle.phases?.[phase]?.byCompetency?.[key]?.accuracy)
        .filter(finite)
        .map(Number);
      result[key] = Object.freeze({ n: values.length, meanAccuracy: mean(values) });
    }
    return Object.freeze(result);
  }

  function aggregate(bundles = []) {
    const valid = bundles.filter(bundle => validateParticipant(bundle).valid);
    const ids = valid.map(bundle => bundle.participantId);
    if (new Set(ids).size !== ids.length) throw new Error("duplicate participantId in cohort");
    const profiles = new Set(valid.map(bundle => safeProfile(bundle.outcomeProfile || "legacy4")));
    if (profiles.size > 1) throw new Error("mixed outcome profiles cannot be aggregated");
    const outcomeProfile = profiles.size ? [...profiles][0] : null;
    const instrumentVersions = new Set(valid.map(bundle => safeInstrumentVersion(bundle.outcomeProfile || "legacy4", bundle.outcomeInstrumentVersion)));
    if (instrumentVersions.size > 1) throw new Error("mixed outcome instrument versions cannot be aggregated");
    const outcomeInstrumentVersion = instrumentVersions.size ? [...instrumentVersions][0] : null;
    const paired = valid.filter(bundle => bundle.pairedPrePost === true && finite(bundle.delta));
    const metric = (phase, key, rows = valid) => mean(rows.map(bundle => bundle.phases[phase] && bundle.phases[phase][key]).filter(finite).map(Number));
    const retention = {};
    for (const phase of ["r1","r2","r3","r4"]) {
      const completed = valid.filter(bundle => bundle.phases[phase] && bundle.phases[phase].completed === true);
      retention[phase] = Object.freeze({ completed:completed.length, completionRate:valid.length ? completed.length/valid.length : null, meanAccuracy:metric(phase,"accuracy",completed) });
    }
    const pairedN = paired.length;
    const evidenceStatus = pairedN < 4 ? "insufficient" : pairedN < 8 ? "provisional" : "usable";
    return Object.freeze({
      schema:"circuit-outcome-study-summary",
      version:1,
      outcomeProfile,
      outcomeInstrumentVersion,
      participants:valid.length,
      pairedPrePost:pairedN,
      evidenceStatus,
      meanPreAccuracy:metric("pre","accuracy",paired),
      meanPostAccuracy:metric("post","accuracy",paired),
      meanDelta:mean(paired.map(bundle => Number(bundle.delta))),
      meanPostNextMeasurementAccuracy:metric("post","nextMeasurementAccuracy",paired),
      meanPostTransferAccuracy:metric("post","transferAccuracy",paired),
      meanPostByCompetency:aggregateCompetencies(paired, "post"),
      retention:Object.freeze(retention),
      causalClaimAllowed:false,
      interpretation:"observational learner evidence from de-identified metric bundles using one outcome profile and instrument version; not a causal course-effect estimate"
    });
  }

  return Object.freeze({ PHASES, exportParticipant, validateParticipant, aggregate });
});
