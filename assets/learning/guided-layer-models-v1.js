(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitGuidedLayerModelsV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function sensingSample({ physicalV = 12, rippleVpp = 0.2, phaseDeg = 0, divider = 0.2, adcVref = 3.3, adcBits = 12 } = {}) {
    if (!(divider > 0 && adcVref > 0 && adcBits >= 2)) throw new RangeError("invalid sensing parameters");
    const phaseRad = phaseDeg * Math.PI / 180;
    const sampledPhysicalV = physicalV + 0.5 * rippleVpp * Math.sin(phaseRad);
    const adcInputV = sampledPhysicalV * divider;
    const maxCode = Math.pow(2, adcBits) - 1;
    const clippedV = clamp(adcInputV, 0, adcVref);
    const code = Math.round(clippedV / adcVref * maxCode);
    const reconstructedV = code / maxCode * adcVref / divider;
    return Object.freeze({ sampledPhysicalV, adcInputV, code, maxCode, reconstructedV, quantizationErrorV: reconstructedV - sampledPhysicalV, clipped: adcInputV !== clippedV });
  }

  function feedbackResponse({
    vin = 48,
    initialV = 8,
    referenceV = 12,
    loadOhm = 6,
    L = 200e-6,
    C = 470e-6,
    dt = 10e-6,
    durationS = 0.012,
    kp = 0.3,
    ki = 100,
    currentKp = 0.02,
    currentKi = 500,
    currentLimit = 8,
    dutyMax = 0.9
  } = {}) {
    if (!(vin > 0 && loadOhm > 0 && L > 0 && C > 0 && dt > 0 && durationS > dt && currentLimit > 0 && dutyMax > 0)) {
      throw new RangeError("invalid feedback parameters");
    }

    let v = initialV;
    let iL = Math.max(0, initialV / loadOhm);
    let voltageIntegrator = 0;
    let currentIntegrator = 0;
    let duty = clamp(referenceV / vin, 0, dutyMax);
    let currentReference = 0;
    const points = [];
    const steps = Math.floor(durationS / dt);

    for (let n = 0; n <= steps; n += 1) {
      const t = n * dt;
      const voltageError = referenceV - v;
      const voltageU = kp * voltageError + voltageIntegrator;
      currentReference = clamp(voltageU, 0, currentLimit);

      if ((currentReference > 0 && currentReference < currentLimit) ||
          (currentReference >= currentLimit && voltageError < 0) ||
          (currentReference <= 0 && voltageError > 0)) {
        voltageIntegrator = clamp(voltageIntegrator + ki * voltageError * dt, 0, currentLimit);
      }

      const currentError = currentReference - iL;
      const currentU = currentKp * currentError + currentIntegrator;
      const dutyUnsat = referenceV / vin + currentU;
      duty = clamp(dutyUnsat, 0, dutyMax);

      if ((duty > 0 && duty < dutyMax) ||
          (duty >= dutyMax && currentError < 0) ||
          (duty <= 0 && currentError > 0)) {
        currentIntegrator = clamp(currentIntegrator + currentKi * currentError * dt, -0.25, 0.25);
      }

      iL = Math.max(0, iL + (duty * vin - v) / L * dt);
      v = Math.max(0, v + (iL - v / loadOhm) / C * dt);

      if (n % Math.max(1, Math.floor(steps / 120)) === 0 || n === steps) {
        points.push(Object.freeze({ tS: t, voutV: v, iLA: iL, currentReferenceA: currentReference, duty }));
      }
    }

    return Object.freeze({
      architecture: "CASCADED_VOLTAGE_CURRENT_PI",
      points: Object.freeze(points),
      finalV: v,
      finalIL: iL,
      finalCurrentReference: currentReference,
      finalDuty: duty,
      errorV: referenceV - v,
      assumptions: Object.freeze([
        "averaged CCM Buck plant",
        "fixed reference; soft-start omitted in this layer",
        "same voltage/current PI topology and anti-windup direction as buck_control.c",
        "no switching ripple, ADC quantization, dead-time or sample-to-actuate delay"
      ])
    });
  }

  function dynamicsAt({ vin = 48, L = 200e-6, C = 470e-6, loadOhm = 6, frequencyHz = 10000, delayS = 10e-6 } = {}) {
    if (!(vin > 0 && L > 0 && C > 0 && loadOhm > 0 && frequencyHz > 0 && delayS >= 0)) throw new RangeError("invalid dynamics parameters");
    const w = TAU * frequencyHz;
    const real = 1 - L * C * w * w;
    const imag = (L / loadOhm) * w;
    const denomMag = Math.hypot(real, imag);
    const plantMag = vin / denomMag;
    const plantPhaseDeg = -Math.atan2(imag, real) * 180 / Math.PI;
    const delayPhaseDeg = -360 * frequencyHz * delayS;
    return Object.freeze({
      magnitude: plantMag,
      magnitudeDb: 20 * Math.log10(plantMag),
      plantPhaseDeg,
      delayPhaseDeg,
      totalPhaseDeg: plantPhaseDeg + delayPhaseDeg,
      resonantHz: 1 / (TAU * Math.sqrt(L * C)),
      dampingRatio: Math.sqrt(L / C) / (2 * loadOhm)
    });
  }

  function safetyLatency({ comparatorNs = 80, xbarNs = 20, tripZoneNs = 30, gateNs = 100, adcUs = 1.2, isrUs = 0.3, computeUs = 4 } = {}) {
    const hardwareNs = comparatorNs + xbarNs + tripZoneNs + gateNs;
    const softwareNs = (adcUs + isrUs + computeUs) * 1000;
    return Object.freeze({ hardwareNs, softwareNs, speedup: softwareNs / hardwareNs, hardwareUs: hardwareNs / 1000, softwareUs: softwareNs / 1000 });
  }

  function productionFreshness({ controlPeriodS = 10e-6, timeoutTicks = 500, missedTicks = 0, enable = true } = {}) {
    if (!(controlPeriodS > 0 && Number.isInteger(timeoutTicks) && timeoutTicks >= 0 && Number.isInteger(missedTicks) && missedTicks >= 0)) throw new RangeError("invalid freshness parameters");
    const faultTick = timeoutTicks + 1;
    const faulted = Boolean(enable && missedTicks >= faultTick);
    return Object.freeze({
      faultTick,
      faultAfterMs: faultTick * controlPeriodS * 1000,
      commandAgeTicks: missedTicks,
      commandAgeMs: missedTicks * controlPeriodS * 1000,
      faulted,
      state: enable ? (faulted ? "FAULT_LATCHED" : "RUN") : "OFF"
    });
  }

  function boostTransfer({ vin = 24, vout = 48, L = 200e-6, loadOhm = 12 } = {}) {
    if (!(vin > 0 && vout > vin && L > 0 && loadOhm > 0)) throw new RangeError("Boost CCM requires 0 < Vin < Vout");
    const duty = 1 - vin / vout;
    const rhpZeroHz = loadOhm * Math.pow(1 - duty, 2) / (TAU * L);
    return Object.freeze({ duty, rhpZeroHz, recommendedCrossoverMaxHz: rhpZeroHz / 5 });
  }

  return Object.freeze({ sensingSample, feedbackResponse, dynamicsAt, safetyLatency, productionFreshness, boostTransfer });
});