(function (root, factory) {
  const Calibration = root && root.CircuitOutcomeCalibrationV1 || (typeof require === "function" ? require("./outcome-calibration-v1.js") : null);
  const Benchmark = root && root.CircuitOutcomeBenchmarkV1 || (typeof require === "function" ? require("./outcome-benchmark-v1.js") : null);
  const Families = root && root.CircuitOutcomeFamiliesV2 || (typeof require === "function" ? require("./outcome-families-v2.js") : null);
  const Instrument = root && root.CircuitOutcomeCore8InstrumentV2 || (typeof require === "function" ? require("./outcome-core8-instrument-v2.js") : null);
  const api = factory(Calibration, Benchmark, Families, Instrument);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeFamilyCalibrationV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Calibration, Benchmark, Families, Instrument) {
  "use strict";
  if (!Calibration || !Benchmark || !Families || !Instrument) throw new Error("Calibration, Benchmark, FamiliesV2 and Core8InstrumentV2 are required");

  const PHASES = Calibration.PHASES;
  const THRESHOLDS = Calibration.CALIBRATION_THRESHOLDS;
  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  function fnv1a32(text, offset) {
    let hash = offset >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function exactContractFingerprint(seed, countPerCompetency) {
    const contract = PHASES.map(phase => {
      const cases = Instrument.generateBenchmarkSet({ seed, phase, countPerCompetency });
      return [phase, cases.map(item => ({
        id:item.id,
        phase:item.phase,
        competency:item.competency,
        answerType:item.answerType,
        prompt:item.prompt,
        choices:item.choices || null,
        choiceLabels:item.choiceLabels || null,
        expected:item.expected,
        parameters:item.parameters || null
      }))];
    });
    const text = JSON.stringify(contract);
    const a = fnv1a32(text, 2166136261).toString(16).padStart(8, "0");
    const b = fnv1a32(text, 2246822519).toString(16).padStart(8, "0");
    return `${a}${b}`;
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
    if (n < THRESHOLDS.minimumReviewN) return "insufficient";
    if (n < THRESHOLDS.usableN) return "provisional";
    return "usable";
  }

  function reviewFlags(proportionCorrect, discrimination, n) {
    if (n < THRESHOLDS.minimumReviewN) return Object.freeze(["insufficient-sample"]);
    const flags = [];
    if (proportionCorrect < THRESHOLDS.tooHardBelow) flags.push("too-hard");
    else if (proportionCorrect > THRESHOLDS.tooEasyAbove) flags.push("too-easy");
    if (discrimination == null) flags.push("discrimination-not-estimable");
    else if (discrimination < 0) flags.push("negative-discrimination");
    else if (discrimination < THRESHOLDS.lowDiscriminationBelow) flags.push("low-discrimination");
    else if (discrimination < THRESHOLDS.watchDiscriminationBelow) flags.push("watch-discrimination");
    return Object.freeze(flags);
  }

  function restScoreBand(value) {
    if (!finite(value)) return "unknown";
    if (Number(value) < 0.5) return "low";
    if (Number(value) < 0.75) return "mid";
    return "high";
  }

  function resolveBundle(bundle, phase) {
    const validation = Calibration.validateParticipant(bundle);
    if (!validation.valid) throw new Error(`invalid calibration bundle: ${bundle && bundle.participantId || "unknown"}`);
    if (bundle.outcomeProfile !== "core8") throw new Error("family calibration requires core8 bundles");
    const seed = Number(bundle.instrument.seed);
    const count = Number(bundle.instrument.countPerCompetency);
    if (count !== 1) throw new Error("cross-form family calibration currently requires countPerCompetency=1");
    const expectedFingerprint = exactContractFingerprint(seed, count);
    if (bundle.instrument.contractFingerprint !== expectedFingerprint) {
      throw new Error(`bundle contract does not match core8 family instrument v2: ${bundle.participantId}`);
    }
    const status = bundle.phases[phase];
    if (!status || status.completed !== true || status.attempted !== status.total || status.total <= 0) return null;
    const cases = Instrument.generateBenchmarkSet({ seed, phase, countPerCompetency:count });
    const byId = new Map(cases.map(item => [item.id, item]));
    const rows = status.rows.map(row => {
      const item = byId.get(row.caseId);
      if (!item || item.competency !== row.competency) throw new Error(`case mapping mismatch for ${bundle.participantId}: ${row.caseId}`);
      return Object.freeze({
        caseId:row.caseId,
        competency:row.competency,
        familyId:item.familyId,
        variantId:item.variantId,
        correct:row.correct === true
      });
    });
    if (rows.length !== cases.length) throw new Error(`completed family form is incomplete for ${bundle.participantId}`);
    const totalCorrect = rows.reduce((sum, row) => sum + (row.correct ? 1 : 0), 0);
    return Object.freeze({ participantId:bundle.participantId, seed, rows:Object.freeze(rows), totalCorrect, accuracy:totalCorrect / rows.length });
  }

  function aggregate(bundles = [], { phase = "post" } = {}) {
    if (!PHASES.includes(phase)) throw new RangeError(`unknown family calibration phase: ${phase}`);
    const ids = bundles.map(bundle => bundle && bundle.participantId);
    if (new Set(ids).size !== ids.length) throw new Error("duplicate participantId in family calibration cohort");
    const resolved = bundles.map(bundle => resolveBundle(bundle, phase)).filter(Boolean);

    const observations = [];
    for (const participant of resolved) {
      for (const row of participant.rows) {
        const itemScore = row.correct ? 1 : 0;
        observations.push(Object.freeze({
          participantId:participant.participantId,
          seed:participant.seed,
          competency:row.competency,
          familyId:row.familyId,
          variantId:row.variantId,
          itemScore,
          restScore:(participant.totalCorrect - itemScore) / Math.max(1, participant.rows.length - 1)
        }));
      }
    }

    const familyIds = [...new Set(observations.map(row => row.familyId))].sort();
    const families = familyIds.map(familyId => {
      const rows = observations.filter(row => row.familyId === familyId);
      const itemScores = rows.map(row => row.itemScore);
      const restScores = rows.map(row => row.restScore);
      const p = mean(itemScores);
      const discrimination = pearson(itemScores, restScores);
      const learners = new Set(rows.map(row => row.participantId)).size;
      const bands = {};
      for (const band of ["low","mid","high"]) {
        const subset = rows.filter(row => restScoreBand(row.restScore) === band);
        bands[band] = Object.freeze({ n:subset.length, proportionCorrect:mean(subset.map(row => row.itemScore)) });
      }
      const variants = {};
      for (const variantId of [...new Set(rows.map(row => row.variantId))].sort()) {
        const subset = rows.filter(row => row.variantId === variantId);
        variants[variantId] = Object.freeze({
          n:subset.length,
          proportionCorrect:mean(subset.map(row => row.itemScore)),
          forms:new Set(subset.map(row => row.seed)).size
        });
      }
      return Object.freeze({
        familyId,
        competency:rows[0] && rows[0].competency,
        learners,
        observations:rows.length,
        forms:new Set(rows.map(row => row.seed)).size,
        variants:Object.freeze(variants),
        proportionCorrect:p,
        correctedDiscrimination:discrimination,
        byRestScoreBand:Object.freeze(bands),
        reviewStatus:evidenceStatus(learners),
        reviewFlags:reviewFlags(p, discrimination, learners)
      });
    });

    const byCompetency = {};
    for (const competency of Instrument.COMPETENCIES) {
      const learnerAccuracy = resolved.map(participant => {
        const rows = participant.rows.filter(row => row.competency === competency);
        return rows.length ? rows.filter(row => row.correct).length / rows.length : null;
      }).filter(finite).map(Number);
      const familyRows = families.filter(row => row.competency === competency);
      const pValues = familyRows.map(row => row.proportionCorrect).filter(finite).map(Number);
      const minFamilyN = familyRows.length ? Math.min(...familyRows.map(row => row.learners)) : 0;
      byCompetency[competency] = Object.freeze({
        n:learnerAccuracy.length,
        meanAccuracy:mean(learnerAccuracy),
        familiesObserved:familyRows.length,
        minFamilyN,
        observedFamilySpread:pValues.length >= 2 ? Math.max(...pValues) - Math.min(...pValues) : null,
        familyComparisonStatus:familyRows.length >= 2 && minFamilyN >= THRESHOLDS.minimumReviewN ? evidenceStatus(minFamilyN) : "insufficient"
      });
    }

    return Object.freeze({
      schema:"circuit-outcome-family-calibration-summary",
      version:1,
      outcomeProfile:"core8",
      instrumentVersion:Instrument.VERSION,
      familyContractFingerprint:Instrument.familyContractFingerprint(),
      phase,
      bundles:bundles.length,
      completed:resolved.length,
      evidenceStatus:evidenceStatus(resolved.length),
      meanAccuracy:mean(resolved.map(row => row.accuracy)),
      families:Object.freeze(families),
      byCompetency:Object.freeze(byCompetency),
      thresholds:THRESHOLDS,
      causalClaimAllowed:false,
      abilityAdjustment:"descriptive rest-of-phase score bands only; not a Rasch/IRT latent-ability estimate",
      interpretation:"cross-form observational family diagnostics after exact v2 contract verification; family differences can still reflect sample/form imbalance and require replication"
    });
  }

  return Object.freeze({ PHASES, exactContractFingerprint, resolveBundle, aggregate });
});
