(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitModels = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finite(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function positive(value, name) {
    const n = finite(value, NaN);
    if (!(n > 0)) throw new RangeError(name + " must be greater than 0");
    return n;
  }

  function calculateBuckRipple(input) {
    const vin = positive(input.vin, "vin");
    const vout = positive(input.vout, "vout");
    const inductanceH = positive(input.inductanceH, "inductanceH");
    const switchingHz = positive(input.switchingHz, "switchingHz");
    const outputCurrentA = Math.max(0, finite(input.outputCurrentA, 0));
    if (vout >= vin) throw new RangeError("vout must be lower than vin for an ideal buck converter");

    const duty = vout / vin;
    const periodS = 1 / switchingHz;
    const deltaIA = ((vin - vout) * duty) / (switchingHz * inductanceH);
    const boundaryCurrentA = deltaIA / 2;
    const ccmValleyA = outputCurrentA - deltaIA / 2;
    const ccmPeakA = outputCurrentA + deltaIA / 2;
    const mode = ccmValleyA > 1e-12 ? "CCM" : Math.abs(ccmValleyA) <= 1e-12 ? "BOUNDARY" : "DCM";

    return {
      vin,
      vout,
      duty,
      periodS,
      deltaIA,
      boundaryCurrentA,
      outputCurrentA,
      mode,
      peakA: mode === "DCM" ? deltaIA : ccmPeakA,
      valleyA: mode === "DCM" ? 0 : Math.max(0, ccmValleyA),
      ccmPeakA,
      ccmValleyA,
      formulaValid: mode !== "DCM",
      warning: mode === "DCM"
        ? "已進入 DCM；Vout = Vin × Duty 與對稱三角波假設不再成立，圖形只顯示電流不得低於 0 的邊界。"
        : ""
    };
  }

  function quantizeAdc(input) {
    const voltageV = finite(input.voltageV, 0);
    const vrefV = positive(input.vrefV, "vrefV");
    const bits = Math.trunc(positive(input.bits, "bits"));
    const levels = Math.pow(2, bits);
    const maxCount = levels - 1;
    const lsbV = vrefV / levels;
    const saturatedLow = voltageV < 0;
    const saturatedHigh = voltageV >= vrefV;
    const clampedV = clamp(voltageV, 0, vrefV);
    const count = saturatedHigh ? maxCount : clamp(Math.floor(clampedV / lsbV), 0, maxCount);

    return {
      voltageV,
      vrefV,
      bits,
      levels,
      maxCount,
      lsbV,
      count,
      saturatedLow,
      saturatedHigh,
      saturated: saturatedLow || saturatedHigh,
      reconstructedV: count * lsbV,
      endpointMappedV: maxCount ? count * vrefV / maxCount : 0
    };
  }

  function calculateCurrentChain(input) {
    const currentA = finite(input.currentA, 0);
    const shuntOhm = positive(input.shuntOhm, "shuntOhm");
    const gain = positive(input.gain, "gain");
    const offsetV = finite(input.offsetV, 0);
    const adc = quantizeAdc({
      voltageV: currentA * shuntOhm * gain + offsetV,
      vrefV: input.vrefV,
      bits: input.bits
    });
    const voltsPerAmp = shuntOhm * gain;

    return {
      currentA,
      shuntOhm,
      gain,
      offsetV,
      shuntV: currentA * shuntOhm,
      amplifiedV: currentA * voltsPerAmp,
      adcInputV: currentA * voltsPerAmp + offsetV,
      voltsPerAmp,
      ampsPerCount: adc.lsbV / voltsPerAmp,
      zeroCount: Math.floor(clamp(offsetV, 0, adc.vrefV) / adc.lsbV),
      minCurrentA: -offsetV / voltsPerAmp,
      maxCurrentA: (adc.vrefV - offsetV) / voltsPerAmp,
      adc
    };
  }

  function calculateDivider(input) {
    const busV = Math.max(0, finite(input.busV, 0));
    const topOhm = positive(input.topOhm, "topOhm");
    const bottomOhm = positive(input.bottomOhm, "bottomOhm");
    const totalOhm = topOhm + bottomOhm;
    const currentA = busV / totalOhm;
    const ratio = bottomOhm / totalOhm;
    const adcInputV = busV * ratio;
    const adc = quantizeAdc({ voltageV: adcInputV, vrefV: input.vrefV, bits: input.bits });

    return {
      busV,
      topOhm,
      bottomOhm,
      totalOhm,
      ratio,
      currentA,
      adcInputV,
      topVoltageV: currentA * topOhm,
      bottomVoltageV: currentA * bottomOhm,
      topPowerW: currentA * currentA * topOhm,
      bottomPowerW: currentA * currentA * bottomOhm,
      totalPowerW: busV * currentA,
      maxBusV: adc.vrefV / ratio,
      voltsPerCount: adc.lsbV / ratio,
      adc
    };
  }

  function rcCutoffHz(resistanceOhm, capacitanceF) {
    const r = positive(resistanceOhm, "resistanceOhm");
    const c = positive(capacitanceF, "capacitanceF");
    return 1 / (2 * Math.PI * r * c);
  }

  function rms(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return 0;
    return Math.sqrt(samples.reduce((sum, value) => sum + finite(value, 0) ** 2, 0) / samples.length);
  }

  function realPower(voltageSamples, currentSamples) {
    if (!Array.isArray(voltageSamples) || !Array.isArray(currentSamples)) return 0;
    const count = Math.min(voltageSamples.length, currentSamples.length);
    if (!count) return 0;
    let sum = 0;
    for (let i = 0; i < count; i++) sum += finite(voltageSamples[i], 0) * finite(currentSamples[i], 0);
    return sum / count;
  }

  function powerMetrics(voltageSamples, currentSamples) {
    const vrms = rms(voltageSamples);
    const irms = rms(currentSamples);
    const watts = realPower(voltageSamples, currentSamples);
    const apparentVA = vrms * irms;
    return {
      vrms,
      irms,
      watts,
      apparentVA,
      totalPowerFactor: apparentVA > 0 ? clamp(watts / apparentVA, -1, 1) : 0
    };
  }

  function displacementPowerFactor(phaseDegrees) {
    return Math.cos(finite(phaseDegrees, 0) * Math.PI / 180);
  }

  return {
    clamp,
    calculateBuckRipple,
    quantizeAdc,
    calculateCurrentChain,
    calculateDivider,
    rcCutoffHz,
    rms,
    realPower,
    powerMetrics,
    displacementPowerFactor
  };
});