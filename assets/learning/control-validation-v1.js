(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitControlValidationV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const number = value => Number(value);
  const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
  const rms = values => values.length ? Math.sqrt(mean(values.map(value => value * value))) : NaN;

  function captureValid(capture) {
    const value = capture && typeof capture === "object" ? capture : {};
    return nonEmpty(value.artifact) && nonEmpty(value.sha256) && /^[a-f0-9]{64}$/i.test(value.sha256) && nonEmpty(value.instrument) && nonEmpty(value.capturedAt) && Number.isFinite(Date.parse(value.capturedAt));
  }

  function analyzeLoadStep(config = {}) {
    const samples = Array.isArray(config.samples) ? config.samples.filter(row => finite(row.tMs) && finite(row.vout)).map(row => ({ tMs:number(row.tMs), vout:number(row.vout), iL:finite(row.iL) ? number(row.iL) : null })).sort((a,b)=>a.tMs-b.tMs) : [];
    const stepAtMs = finite(config.stepAtMs) ? number(config.stepAtMs) : NaN;
    const vref = finite(config.vref) ? number(config.vref) : NaN;
    const tolerancePct = finite(config.tolerancePct) ? number(config.tolerancePct) : 2;
    const maxDroopPct = finite(config.maxDroopPct) ? number(config.maxDroopPct) : 10;
    const maxOvershootPct = finite(config.maxOvershootPct) ? number(config.maxOvershootPct) : 10;
    const maxSettlingMs = finite(config.maxSettlingMs) ? number(config.maxSettlingMs) : 20;
    if (samples.length < 5 || !finite(stepAtMs) || !finite(vref) || vref <= 0) return Object.freeze({ ready:false, pass:false, reason:"load-step requires >=5 samples, stepAtMs and positive vref" });
    const after = samples.filter(row => row.tMs >= stepAtMs);
    if (after.length < 3) return Object.freeze({ ready:false, pass:false, reason:"load-step capture has insufficient post-step samples" });
    const minV = Math.min(...after.map(row => row.vout));
    const maxV = Math.max(...after.map(row => row.vout));
    const droopPct = Math.max(0, (vref - minV) / vref * 100);
    const overshootPct = Math.max(0, (maxV - vref) / vref * 100);
    const band = vref * tolerancePct / 100;
    let settledAtMs = null;
    for (let i = 0; i < after.length; i += 1) {
      if (after.slice(i).every(row => Math.abs(row.vout - vref) <= band)) { settledAtMs = after[i].tMs; break; }
    }
    const settlingMs = settledAtMs == null ? null : settledAtMs - stepAtMs;
    const pass = droopPct <= maxDroopPct && overshootPct <= maxOvershootPct && settlingMs != null && settlingMs <= maxSettlingMs;
    return Object.freeze({ ready:true, pass, minV, maxV, droopPct, overshootPct, settlingMs, limits:Object.freeze({ tolerancePct, maxDroopPct, maxOvershootPct, maxSettlingMs }) });
  }

  function strictCommit(periodUs, computeDoneUs) {
    const epsilon = Math.max(1e-12, periodUs * 1e-12);
    const cycle = Math.floor((computeDoneUs + epsilon) / periodUs) + 1;
    return { cycle, commitUs: cycle * periodUs, firstLoadMet: cycle === 1 };
  }

  function analyzeTiming(config = {}) {
    if (![config.periodUs, config.computeDoneUs, config.observedCommitUs].every(finite)) return Object.freeze({ ready:false, pass:false, reason:"timing requires periodUs, computeDoneUs and observedCommitUs" });
    const periodUs = number(config.periodUs), computeDoneUs = number(config.computeDoneUs), observedCommitUs = number(config.observedCommitUs);
    if (periodUs <= 0 || computeDoneUs < 0) return Object.freeze({ ready:false, pass:false, reason:"timing values out of range" });
    const minSlackUs = finite(config.minSlackUs) ? number(config.minSlackUs) : 0;
    const commitToleranceUs = finite(config.commitToleranceUs) ? number(config.commitToleranceUs) : 0.05;
    const expected = strictCommit(periodUs, computeDoneUs);
    const deadlineSlackUs = periodUs - computeDoneUs;
    const commitErrorUs = Math.abs(observedCommitUs - expected.commitUs);
    const pass = deadlineSlackUs >= minSlackUs && commitErrorUs <= commitToleranceUs;
    return Object.freeze({ ready:true, pass, periodUs, computeDoneUs, observedCommitUs, expectedCommitUs:expected.commitUs, firstLoadMet:expected.firstLoadMet, deadlineSlackUs, commitErrorUs, limits:Object.freeze({ minSlackUs, commitToleranceUs }) });
  }

  function analyzeTripLatency(config = {}) {
    if (![config.faultAtNs, config.pwmLowAtNs].every(finite)) return Object.freeze({ ready:false, pass:false, reason:"trip latency requires faultAtNs and pwmLowAtNs" });
    const faultAtNs = number(config.faultAtNs), pwmLowAtNs = number(config.pwmLowAtNs);
    const maxLatencyNs = finite(config.maxLatencyNs) ? number(config.maxLatencyNs) : 1000;
    const latencyNs = pwmLowAtNs - faultAtNs;
    const pass = latencyNs >= 0 && latencyNs <= maxLatencyNs;
    return Object.freeze({ ready:true, pass, latencyNs, maxLatencyNs });
  }

  function phaseDistance(a, b) {
    let delta = (a - b) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return Math.abs(delta);
  }

  function interpolate(points, frequencyHz, key) {
    const rows = points.filter(row => finite(row.frequencyHz) && finite(row[key])).map(row => ({ frequencyHz:number(row.frequencyHz), value:number(row[key]) })).sort((a,b)=>a.frequencyHz-b.frequencyHz);
    if (!rows.length || frequencyHz < rows[0].frequencyHz || frequencyHz > rows[rows.length-1].frequencyHz) return null;
    const exact = rows.find(row => row.frequencyHz === frequencyHz);
    if (exact) return exact.value;
    for (let i = 1; i < rows.length; i += 1) {
      if (frequencyHz <= rows[i].frequencyHz) {
        const left = rows[i-1], right = rows[i];
        const x = Math.log10(frequencyHz), x0 = Math.log10(left.frequencyHz), x1 = Math.log10(right.frequencyHz);
        const ratio = (x - x0) / (x1 - x0);
        return left.value + ratio * (right.value - left.value);
      }
    }
    return null;
  }

  function compareBode(config = {}) {
    const model = Array.isArray(config.model) ? config.model : [];
    const measured = Array.isArray(config.measured) ? config.measured.filter(row => finite(row.frequencyHz) && finite(row.magnitudeDb) && finite(row.phaseDeg)) : [];
    if (model.length < 2 || measured.length < 2) return Object.freeze({ ready:false, pass:false, reason:"Bode compare requires >=2 model and measured points" });
    const magToleranceDb = finite(config.magToleranceDb) ? number(config.magToleranceDb) : 3;
    const phaseToleranceDeg = finite(config.phaseToleranceDeg) ? number(config.phaseToleranceDeg) : 20;
    const rows = measured.map(row => {
      const frequencyHz = number(row.frequencyHz);
      const modelMag = interpolate(model, frequencyHz, "magnitudeDb");
      const modelPhase = interpolate(model, frequencyHz, "phaseDeg");
      if (modelMag == null || modelPhase == null) return null;
      const magnitudeErrorDb = number(row.magnitudeDb) - modelMag;
      const phaseErrorDeg = phaseDistance(number(row.phaseDeg), modelPhase);
      return { frequencyHz, magnitudeErrorDb, phaseErrorDeg };
    }).filter(Boolean);
    if (rows.length < 2) return Object.freeze({ ready:false, pass:false, reason:"measured SFRA points do not overlap model frequency range" });
    const maxMagnitudeErrorDb = Math.max(...rows.map(row => Math.abs(row.magnitudeErrorDb)));
    const maxPhaseErrorDeg = Math.max(...rows.map(row => row.phaseErrorDeg));
    const rmsMagnitudeErrorDb = rms(rows.map(row => row.magnitudeErrorDb));
    const rmsPhaseErrorDeg = rms(rows.map(row => row.phaseErrorDeg));
    const pass = maxMagnitudeErrorDb <= magToleranceDb && maxPhaseErrorDeg <= phaseToleranceDeg;
    return Object.freeze({ ready:true, pass, matchedPoints:rows.length, maxMagnitudeErrorDb, maxPhaseErrorDeg, rmsMagnitudeErrorDb, rmsPhaseErrorDeg, limits:Object.freeze({ magToleranceDb, phaseToleranceDeg }) });
  }

  function validateBundle(bundle = {}) {
    const captures = bundle.captures && typeof bundle.captures === "object" ? bundle.captures : {};
    const loadStep = analyzeLoadStep(bundle.loadStep || {});
    const timing = analyzeTiming(bundle.timing || {});
    const trip = analyzeTripLatency(bundle.trip || {});
    const sfra = compareBode(bundle.sfra || {});
    const captureRows = ["loadStep","timing","trip","sfra"].map(id => Object.freeze({ id, valid:captureValid(captures[id]), capture:captures[id] || null }));
    const capturesValid = captureRows.every(row => row.valid);
    const analysesReady = [loadStep,timing,trip,sfra].every(result => result.ready);
    const analysesPass = [loadStep,timing,trip,sfra].every(result => result.pass);
    const overallPass = capturesValid && analysesReady && analysesPass;
    return Object.freeze({ status:overallPass ? "CONTROL_VALIDATION_PASS" : "INCOMPLETE_OR_FAIL", overallPass, capturesValid, analysesReady, analysesPass, captureRows:Object.freeze(captureRows), loadStep, timing, trip, sfra, boardPassImplied:false });
  }

  return Object.freeze({ captureValid, analyzeLoadStep, strictCommit, analyzeTiming, analyzeTripLatency, compareBode, validateBundle });
});
