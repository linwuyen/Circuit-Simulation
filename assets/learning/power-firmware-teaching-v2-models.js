(function (global) {
  "use strict";

  const Base = global.CircuitPowerModelsV1 || {};
  const clamp = Base.clamp || ((v, lo, hi) => Math.max(lo, Math.min(hi, Number(v))));
  const clone = value => JSON.parse(JSON.stringify(value));

  const SYSTEM_CONTRACT = Object.freeze({
    vinMin: 36,
    vinMax: 60,
    voutMin: 12,
    voutMax: 40,
    regulationPct: 1,
    currentLimitA: 10,
    rippleMvpp: 100,
    ocpA: 12,
    controlDeadlineUs: 10
  });

  function contractRows(state) {
    const c = Object.assign({}, SYSTEM_CONTRACT, state.contract || {});
    return [
      { id: "input", label: "Input range", value: `${c.vinMin}–${c.vinMax} V`, stages: [0, 5, 6] },
      { id: "output", label: "Programmable Vout", value: `${c.voutMin}–${c.voutMax} V · ±${c.regulationPct}%`, stages: [0, 1, 3, 4] },
      { id: "current", label: "Current authority", value: `CC ${c.currentLimitA} A`, stages: [0, 3, 6] },
      { id: "ripple", label: "Ripple", value: `< ${c.rippleMvpp} mVpp`, stages: [1, 2, 4] },
      { id: "deadline", label: "Control deadline", value: `< ${c.controlDeadlineUs} µs`, stages: [2, 4] },
      { id: "safety", label: "Hardware OCP", value: `${c.ocpA} A · fail-closed`, stages: [6, 7] }
    ];
  }

  function buckRegion(state) {
    const p = state.plant;
    const limits = state.limits || {};
    const duty = clamp(p.duty, limits.dutyMin == null ? 0.02 : limits.dutyMin, limits.dutyMax == null ? 0.90 : limits.dutyMax);
    const period = 1 / p.fsw;
    const vout = p.vin * duty;
    const iavg = vout / Math.max(p.load, 1e-9);
    const deltaI = Math.max(0, ((p.vin - vout) / p.inductance) * duty * period);
    const boundaryA = deltaI / 2;
    const dutyMax = limits.dutyMax == null ? 0.90 : limits.dutyMax;
    const currentLimit = limits.currentLimitA == null ? SYSTEM_CONTRACT.currentLimitA : limits.currentLimitA;
    let region = "CCM";
    let reason = "Inductor current stays above zero; averaged CCM equations are valid for this teaching point.";
    if (duty >= dutyMax - 1e-6) {
      region = "SATURATION";
      reason = "Actuator is at the duty ceiling; controller demand can no longer increase plant input.";
    } else if (iavg >= currentLimit) {
      region = "CURRENT_LIMIT";
      reason = "Load demand reaches the current authority boundary; CC/limiter logic owns the operating point.";
    } else if (iavg <= boundaryA) {
      region = "DCM";
      reason = "Inductor current reaches zero each cycle; Vout ≈ D·Vin is no longer the complete plant model.";
    }
    return {
      region,
      reason,
      duty,
      vout,
      iavg,
      deltaI,
      boundaryA,
      load: p.load,
      idealRuleValid: region === "CCM"
    };
  }

  function resolutionBudget(state) {
    const s = state.sensing;
    const a = state.actuator || { tbclkHz: 200e6, tbprd: 2000 };
    const adcLsbPinV = s.adcVref / s.adcMax;
    const adcLsbOutputV = adcLsbPinV * s.divider;
    const dutyLsb = 1 / Math.max(1, a.tbprd);
    const pwmEquivalentOutputV = state.plant.vin * dutyLsb;
    const effectiveFloorV = Math.max(adcLsbOutputV, pwmEquivalentOutputV);
    return {
      adcLsbPinV,
      adcLsbOutputV,
      dutyLsb,
      dutyLsbPct: dutyLsb * 100,
      pwmEquivalentOutputV,
      effectiveFloorV,
      tbclkNs: 1e9 / a.tbclkHz,
      tbprd: a.tbprd
    };
  }

  function sampleInductorCurrent(state) {
    const p = state.plant;
    const t = state.timing;
    const sampling = state.sampling || { jitterNs: 20, sourceTauUs: 0.08 };
    const region = buckRegion(state);
    const truth = Base.buckTruth ? Base.buckTruth(state) : region;
    const periodUs = 1e6 / p.fsw;
    const phase = clamp(t.sampleUs / periodUs, 0, 0.999999);
    const d = clamp(truth.duty, 1e-6, 0.999999);
    function at(ph) {
      const x = ((ph % 1) + 1) % 1;
      if (x <= d) return truth.imin + truth.deltaI * (x / d);
      return truth.imax - truth.deltaI * ((x - d) / Math.max(1e-9, 1 - d));
    }
    const sampledA = at(phase);
    const jitterPhase = Math.max(0, Number(sampling.jitterNs || 0)) / 1000 / periodUs;
    const low = at(phase - jitterPhase);
    const high = at(phase + jitterPhase);
    const jitterBandA = Math.abs(high - low) / 2;
    const sourceTau = Math.max(1e-6, Number(sampling.sourceTauUs || 0.08));
    const settlingResidual = Math.exp(-Math.max(0, t.acquisitionUs) / sourceTau);
    return {
      phase,
      phasePct: phase * 100,
      sampledA,
      averageA: truth.iavg,
      rippleErrorA: sampledA - truth.iavg,
      jitterBandA,
      settlingResidual,
      periodUs,
      region: region.region,
      modelValid: region.region === "CCM"
    };
  }

  function ccCvPoint(state, loadOverride) {
    const p = state.plant;
    const limits = state.limits || {};
    const loadR = Math.max(0.05, Number(loadOverride == null ? p.load : loadOverride));
    const vref = Number(state.control.vref);
    const currentLimit = Number(limits.currentLimitA == null ? SYSTEM_CONTRACT.currentLimitA : limits.currentLimitA);
    const dutyMax = Number(limits.dutyMax == null ? 0.90 : limits.dutyMax);
    const maxPlantV = p.vin * dutyMax;
    const cvCurrent = vref / loadR;
    let mode = "CV";
    let targetV = vref;
    let limiter = "none";
    if (cvCurrent > currentLimit) {
      mode = "CC";
      targetV = currentLimit * loadR;
      limiter = "current";
    }
    if (targetV > maxPlantV) {
      mode = "SATURATION";
      targetV = maxPlantV;
      limiter = "duty";
    }
    const currentA = targetV / loadR;
    return {
      mode,
      targetV,
      currentA,
      currentLimit,
      loadR,
      duty: clamp(targetV / p.vin, 0, dutyMax),
      cvCurrent,
      maxPlantV,
      limiter
    };
  }

  function simulateWindup(state, antiWindup) {
    const p = state.plant;
    const c = state.control;
    const limits = state.limits || {};
    const dt = 1 / p.fsw;
    const tau = 1.2e-3;
    const steps = 3200;
    const sagStart = 500;
    const sagEnd = 1700;
    const dutyMin = limits.dutyMin == null ? 0.02 : limits.dutyMin;
    const dutyMax = limits.dutyMax == null ? 0.90 : limits.dutyMax;
    const vinNom = p.vin;
    const vinSag = Math.min(vinNom * 0.50, c.vref / dutyMax * 0.78);
    let y = c.vref;
    let integrator = clamp(c.vref / vinNom, dutyMin, dutyMax);
    let duty = integrator;
    let peakAfterRecovery = y;
    let saturatedSamples = 0;
    let integralPeak = Math.abs(integrator);
    for (let k = 0; k < steps; k += 1) {
      const vin = (k >= sagStart && k < sagEnd) ? vinSag : vinNom;
      const eNorm = (c.vref - y) / vinNom;
      const nextI = integrator + c.ki * eNorm * dt;
      const raw = c.kp * eNorm + nextI;
      duty = clamp(raw, dutyMin, dutyMax);
      const saturated = raw !== duty;
      if (saturated) saturatedSamples += 1;
      if (!antiWindup || !saturated || (raw > dutyMax && eNorm < 0) || (raw < dutyMin && eNorm > 0)) integrator = nextI;
      integralPeak = Math.max(integralPeak, Math.abs(integrator));
      y += dt / tau * (vin * duty - y);
      if (k >= sagEnd) peakAfterRecovery = Math.max(peakAfterRecovery, y);
    }
    return {
      antiWindup: !!antiWindup,
      finalV: y,
      overshootV: Math.max(0, peakAfterRecovery - c.vref),
      overshootPct: c.vref ? Math.max(0, peakAfterRecovery - c.vref) / c.vref * 100 : 0,
      saturatedSamples,
      integralPeak,
      vinSag
    };
  }

  function simulateFeedForward(state, enabled) {
    const p = state.plant;
    const c = state.control;
    const limits = state.limits || {};
    const dt = 1 / p.fsw;
    const tau = 1.2e-3;
    const steps = 1800;
    const stepAt = 400;
    const vinBefore = p.vin;
    const vinAfter = Math.max(1, p.vin * 0.78);
    const dutyMin = limits.dutyMin == null ? 0.02 : limits.dutyMin;
    const dutyMax = limits.dutyMax == null ? 0.90 : limits.dutyMax;
    let y = c.vref;
    let integral = enabled ? 0 : c.vref / vinBefore;
    let minimum = y;
    for (let k = 0; k < steps; k += 1) {
      const vin = k < stepAt ? vinBefore : vinAfter;
      const ff = enabled ? c.vref / vin : 0;
      const eNorm = (c.vref - y) / vinBefore;
      const nextI = integral + c.ki * eNorm * dt;
      const raw = ff + c.kp * eNorm + nextI;
      const duty = clamp(raw, dutyMin, dutyMax);
      const saturated = raw !== duty;
      if (!saturated || (raw > dutyMax && eNorm < 0) || (raw < dutyMin && eNorm > 0)) integral = nextI;
      y += dt / tau * (vin * duty - y);
      if (k >= stepAt) minimum = Math.min(minimum, y);
    }
    return {
      enabled: !!enabled,
      vinBefore,
      vinAfter,
      minV: minimum,
      droopV: Math.max(0, c.vref - minimum),
      finalV: y
    };
  }

  function loopBandwidthBudget(state) {
    const fsw = state.plant.fsw;
    const timing = Base.timingState ? Base.timingState(state) : { actuation: 1e6 / fsw };
    const innerHz = Math.min(fsw / 20, 5000);
    const outerHz = innerHz / 5;
    const phaseLagInnerDeg = 360 * innerHz * timing.actuation * 1e-6;
    const phaseLagOuterDeg = 360 * outerHz * timing.actuation * 1e-6;
    return { fsw, innerHz, outerHz, separation: innerHz / outerHz, phaseLagInnerDeg, phaseLagOuterDeg, actuationUs: timing.actuation };
  }

  const STARTUP_STATES = Object.freeze(["POWER_OFF", "INIT", "SELF_TEST", "PRECHARGE", "SOFT_START", "RUN", "FAULT_LATCHED"]);

  function startupView(startup) {
    const s = Object.assign({ state: "POWER_OFF", adcValid: false, selfTestPass: false, busReady: false, prechargeDone: false, softStartComplete: false, faultInput: false }, startup || {});
    return {
      state: s.state,
      pwmAllowed: !s.faultInput && (s.state === "SOFT_START" || s.state === "RUN"),
      qualifiers: s
    };
  }

  function startupTransition(startup, event) {
    const next = clone(Object.assign({ state: "POWER_OFF", adcValid: false, selfTestPass: false, busReady: false, prechargeDone: false, softStartComplete: false, faultInput: false }, startup || {}));
    let blocked = null;
    if (event === "fault") {
      next.faultInput = true;
      next.state = "FAULT_LATCHED";
      return { next, blocked: null, view: startupView(next) };
    }
    if (event === "clear_fault") {
      if (next.faultInput) blocked = "FAULT_INPUT_ACTIVE";
      else next.state = "INIT";
      return { next, blocked, view: startupView(next) };
    }
    if (event === "power_on" && next.state === "POWER_OFF") next.state = "INIT";
    else if (event === "advance") {
      if (next.state === "INIT") {
        if (!next.adcValid) blocked = "ADC_NOT_VALID";
        else next.state = "SELF_TEST";
      } else if (next.state === "SELF_TEST") {
        if (!next.selfTestPass) blocked = "SELF_TEST_NOT_PASS";
        else next.state = "PRECHARGE";
      } else if (next.state === "PRECHARGE") {
        if (!next.busReady || !next.prechargeDone) blocked = "BUS_NOT_QUALIFIED";
        else next.state = "SOFT_START";
      } else if (next.state === "SOFT_START") {
        if (!next.softStartComplete) blocked = "SOFT_START_NOT_DONE";
        else next.state = "RUN";
      }
    }
    return { next, blocked, view: startupView(next) };
  }

  const PLANT_REGIONS = Object.freeze({
    buck: { axis: "load / duty", regions: ["DCM", "CCM", "current limit", "duty saturation"], boundary: "iL,min = 0 / current limiter / duty ceiling" },
    boost: { axis: "duty / load", regions: ["DCM", "CCM", "RHP-zero limited", "current limit"], boundary: "RHP zero moves with operating point" },
    pfc: { axis: "line angle / load", regions: ["zero-cross", "normal CCM", "brownout", "current limit"], boundary: "line voltage and 2ω power ripple change plant authority" },
    psfb: { axis: "phase / load", regions: ["light-load hard switching", "ZVS", "duty loss", "current limit"], boundary: "commutation current decides ZVS margin" },
    llc: { axis: "fsw / load", regions: ["below resonance", "near resonance", "above resonance", "burst/light-load"], boundary: "gain slope and resonant mode vary strongly with operating point" },
    inverter: { axis: "grid / current", regions: ["grid-following", "current limit", "weak-grid", "island/fault"], boundary: "PLL and grid impedance can become part of the plant" }
  });

  function plantRegion(id) {
    return PLANT_REGIONS[id] || PLANT_REGIONS.buck;
  }

  function dataFreshness(record, maxAgeMs) {
    const age = Number(record && record.ageMs || 0);
    const maxAge = Number(maxAgeMs == null ? 100 : maxAgeMs);
    return { ageMs: age, maxAgeMs: maxAge, fresh: age <= maxAge, label: age <= maxAge ? "FRESH" : "STALE" };
  }

  const INSTRUMENTS = Object.freeze({
    physical_vout: { label: "Physical Vout", covers: ["physical"] },
    adc_raw: { label: "ADC raw", covers: ["measurement"] },
    pwm_cmd: { label: "PWM command", covers: ["actuation"] },
    pwm_pin: { label: "PWM pin", covers: ["physical", "actuation"] },
    timing_gpio: { label: "SOC/ISR GPIO", covers: ["timing"] },
    trip_flags: { label: "Trip flags", covers: ["safety"] },
    state_log: { label: "State transition log", covers: ["state", "history"] },
    command_age: { label: "Command age/version", covers: ["ownership"] },
    minmax: { label: "Min/max capture", covers: ["measurement", "history"] },
    ring_buffer: { label: "Fault ring buffer", covers: ["timing", "history"] },
    iout: { label: "Physical Iout", covers: ["physical"] },
    owner_tag: { label: "Writer/owner tag", covers: ["ownership"] }
  });
  const DIAGNOSTIC_DIMENSIONS = Object.freeze(["physical", "measurement", "timing", "actuation", "safety", "state", "ownership", "history"]);

  function instrumentationScore(selected) {
    const chosen = (selected || []).filter(id => INSTRUMENTS[id]);
    const covered = new Set();
    chosen.forEach(id => INSTRUMENTS[id].covers.forEach(x => covered.add(x)));
    const score = Math.round(covered.size / DIAGNOSTIC_DIMENSIONS.length * 100);
    return { selected: chosen, covered: Array.from(covered), missing: DIAGNOSTIC_DIMENSIONS.filter(x => !covered.has(x)), score, slots: chosen.length };
  }

  global.CircuitPowerTeachingModelsV2 = {
    SYSTEM_CONTRACT,
    contractRows,
    buckRegion,
    resolutionBudget,
    sampleInductorCurrent,
    ccCvPoint,
    simulateWindup,
    simulateFeedForward,
    loopBandwidthBudget,
    STARTUP_STATES,
    startupView,
    startupTransition,
    PLANT_REGIONS,
    plantRegion,
    dataFreshness,
    INSTRUMENTS,
    DIAGNOSTIC_DIMENSIONS,
    instrumentationScore
  };
})(window);
