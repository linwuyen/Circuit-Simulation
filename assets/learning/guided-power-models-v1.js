(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitGuidedPowerModelsV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const finitePositive = (value, name) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name} must be > 0`);
    return number;
  };

  function idealBuckCycle(input = {}) {
    const vin = finitePositive(input.vin ?? 48, "vin");
    const vout = finitePositive(input.vout ?? 12, "vout");
    const inductanceH = finitePositive(input.inductanceH ?? 200e-6, "inductanceH");
    const switchingHz = finitePositive(input.switchingHz ?? 100e3, "switchingHz");
    const averageCurrentA = finitePositive(input.averageCurrentA ?? 4, "averageCurrentA");
    if (vout >= vin) throw new RangeError("ideal CCM buck requires 0 < vout < vin");

    const duty = vout / vin;
    const periodS = 1 / switchingHz;
    const onTimeS = duty * periodS;
    const offTimeS = periodS - onTimeS;
    const slopeOnAps = (vin - vout) / inductanceH;
    const slopeOffAps = -vout / inductanceH;
    const rippleA = slopeOnAps * onTimeS;
    const currentMinA = averageCurrentA - rippleA / 2;
    const currentMaxA = averageCurrentA + rippleA / 2;
    const voltSecondResidualVs = (vin - vout) * onTimeS - vout * offTimeS;
    const ccm = currentMinA > 0;

    const sampleCount = Math.max(32, Math.min(512, Math.round(Number(input.sampleCount ?? 161))));
    const points = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const t = periodS * index / (sampleCount - 1);
      const iL = t <= onTimeS
        ? currentMinA + slopeOnAps * t
        : currentMaxA + slopeOffAps * (t - onTimeS);
      points.push({
        tS: t,
        iLA: iL,
        switchNodeV: t < onTimeS ? vin : 0
      });
    }

    return Object.freeze({
      vin,
      vout,
      inductanceH,
      switchingHz,
      averageCurrentA,
      duty,
      periodS,
      onTimeS,
      offTimeS,
      slopeOnAps,
      slopeOffAps,
      rippleA,
      currentMinA,
      currentMaxA,
      voltSecondResidualVs,
      ccm,
      points
    });
  }

  function sampleToActuate(input = {}) {
    const switchingHz = finitePositive(input.switchingHz ?? 100e3, "switchingHz");
    const adcS = finitePositive(input.adcS ?? 1.2e-6, "adcS");
    const isrEntryS = finitePositive(input.isrEntryS ?? 0.3e-6, "isrEntryS");
    const computeS = finitePositive(input.computeS ?? 4e-6, "computeS");
    const crossoverHz = finitePositive(input.crossoverHz ?? 10e3, "crossoverHz");
    const periodS = 1 / switchingHz;
    const computeDoneS = adcS + isrEntryS + computeS;
    const epsilon = Math.max(1e-15, periodS * 1e-12);
    const commitCycle = Math.floor((computeDoneS + epsilon) / periodS) + 1;
    const commitS = commitCycle * periodS;
    const missedLoadEvents = commitCycle - 1;
    const firstDeadlineSlackS = periodS - computeDoneS;
    const timingPhaseDeg = -360 * crossoverHz * commitS;

    return Object.freeze({
      switchingHz,
      periodS,
      adcS,
      isrEntryS,
      computeS,
      crossoverHz,
      computeDoneS,
      commitCycle,
      commitS,
      missedLoadEvents,
      firstDeadlineSlackS,
      timingPhaseDeg,
      firstLoadMet: missedLoadEvents === 0,
      events: Object.freeze([
        { id: "sample", label: "SOCA / sample", tS: 0 },
        { id: "adc", label: "ADC ready", tS: adcS },
        { id: "isr", label: "ISR entered", tS: adcS + isrEntryS },
        { id: "compute", label: "CMPA shadow written", tS: computeDoneS },
        { id: "first-load", label: "first ZERO load", tS: periodS },
        { id: "actuate", label: "new duty active", tS: commitS }
      ])
    });
  }

  function timingTransfer(input = {}) {
    const base = sampleToActuate(input);
    const faster = sampleToActuate({ ...input, switchingHz: Number(input.transferSwitchingHz ?? base.switchingHz * 2) });
    return Object.freeze({ base, transfer: faster });
  }

  return Object.freeze({ idealBuckCycle, sampleToActuate, timingTransfer });
});
