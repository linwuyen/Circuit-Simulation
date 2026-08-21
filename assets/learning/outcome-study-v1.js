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

  function phaseMetric(status) {
    const value = status && typeof status === "object" ? status : {};
    const score = value.score && typeof value.score === "object" ? value.score : {};
    return Object.freeze({
      attempted:Number(value.attempted || 0),
      total:Number(value.total || 0),
      completed:value.completed === true,
      accuracy:finite(score.accuracy) ? Number(score.accuracy) : null,
      nextMeasurementAccuracy:finite(score.nextMeasurementAccuracy) ? Number(score.nextMeasurementAccuracy) : null,
      transferAccuracy:finite(score.transferAccuracy) ? Number(score.transferAccuracy) : null
    });
  }

  function exportParticipant(summary, { participantId, exportedAt = new Date().toISOString() } = {}) {
    if (!summary || typeof summary !== "object") throw new Error("outcome summary is required");
    const id = safeId(participantId);
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
    try { safeId(value.participantId); } catch (_) { idValid = false; }
    const phases = value.phases && typeof value.phases === "object" ? value.phases : {};
    const phaseRows = PHASES.map(phase => {
      const item = phases[phase] && typeof phases[phase] === "object" ? phases[phase] : {};
      const valid = Number.isInteger(Number(item.attempted)) && Number.isInteger(Number(item.total)) && Number(item.attempted) >= 0 && Number(item.total) >= Number(item.attempted) && (item.accuracy == null || (finite(item.accuracy) && Number(item.accuracy) >= 0 && Number(item.accuracy) <= 1));
      return Object.freeze({ phase, valid });
    });
    const privacyValid = value.containsRawAnswers === false && value.containsPrompts === false;
    const valid = value.schema === "circuit-outcome-study" && Number(value.version) === 1 && idValid && privacyValid && phaseRows.every(row => row.valid);
    return Object.freeze({ valid, idValid, privacyValid, phaseRows:Object.freeze(phaseRows) });
  }

  function aggregate(bundles = []) {
    const valid = bundles.filter(bundle => validateParticipant(bundle).valid);
    const ids = valid.map(bundle => bundle.participantId);
    if (new Set(ids).size !== ids.length) throw new Error("duplicate participantId in cohort");
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
      participants:valid.length,
      pairedPrePost:pairedN,
      evidenceStatus,
      meanPreAccuracy:metric("pre","accuracy",paired),
      meanPostAccuracy:metric("post","accuracy",paired),
      meanDelta:mean(paired.map(bundle => Number(bundle.delta))),
      meanPostNextMeasurementAccuracy:metric("post","nextMeasurementAccuracy",paired),
      meanPostTransferAccuracy:metric("post","transferAccuracy",paired),
      retention:Object.freeze(retention),
      causalClaimAllowed:false,
      interpretation:"observational learner evidence from de-identified metric bundles; not a causal course-effect estimate"
    });
  }

  return Object.freeze({ PHASES, exportParticipant, validateParticipant, aggregate });
});
