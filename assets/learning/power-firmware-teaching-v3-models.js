(function (global) {
  "use strict";
  const Base = global.CircuitPowerModelsV1 || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));

  function switchingCycle(state) {
    const p = state.plant, sw = state.switching || {};
    const duty = clamp(p.duty, 0.001, 0.999);
    const periodS = 1 / p.fsw, tonS = duty * periodS, toffS = (1 - duty) * periodS;
    const vout = p.vin * duty;
    const m1 = (p.vin - vout) / p.inductance;
    const m2 = vout / p.inductance;
    const deltaOnA = m1 * tonS, deltaOffA = m2 * toffS;
    const iavgA = vout / Math.max(p.load, 1e-9);
    const iminA = iavgA - deltaOnA / 2, imaxA = iavgA + deltaOnA / 2;
    const irmsA = Math.sqrt(Math.max(0, iavgA * iavgA + deltaOnA * deltaOnA / 12));
    const deadTimeS = Math.max(0, Number(sw.deadTimeNs || 0)) * 1e-9;
    const deadTimeWindowFraction = Math.min(0.50, 2 * deadTimeS / periodS);
    const deadTimeDutyLoss = Math.min(0.25, deadTimeS / periodS);
    const rds = Math.max(0, Number(sw.mosfetRdsOnOhm || 0.018));
    const diodeDrop = Math.max(0, Number(sw.diodeDropV || 0.8));
    const trfS = Math.max(0, Number(sw.riseNs || 35) + Number(sw.fallNs || 35)) * 1e-9;
    const conductionLossW = irmsA * irmsA * rds;
    const diodeLossW = Math.max(0, iavgA) * diodeDrop * deadTimeWindowFraction;
    const switchingLossW = 0.5 * p.vin * Math.max(0, iavgA) * trfS * p.fsw;
    const inductorSatA = Math.max(0, Number(sw.inductorSatA || 18));
    return {
      periodUs: periodS * 1e6, tonUs: tonS * 1e6, toffUs: toffS * 1e6,
      vout, m1, m2, deltaOnA, deltaOffA, voltSecondMismatchA: deltaOnA - deltaOffA,
      iavgA, iminA, imaxA, irmsA, deadTimeWindowFraction, deadTimeDutyLoss,
      deadTimeEquivalentV: p.vin * deadTimeDutyLoss,
      conductionLossW, diodeLossW, switchingLossW, totalSemiconductorLossW: conductionLossW + diodeLossW + switchingLossW,
      inductorSatA, saturationMarginA: inductorSatA - imaxA,
      abstraction: "SWITCHING_CYCLE"
    };
  }

  function peakCurrentMode(state) {
    const p = state.plant, pc = state.peakCurrent || {};
    const duty = clamp(p.duty, 0.01, 0.99), vout = p.vin * duty;
    const m1 = Math.max(1e-9, (p.vin - vout) / p.inductance);
    const m2 = Math.max(1e-9, vout / p.inductance);
    const slopeCompRatio = Math.max(0, Number(pc.slopeCompRatio || 0));
    const mc = slopeCompRatio * m2;
    const perturbationPole = -(m2 - mc) / (m1 + mc);
    const requiredMc = Math.max(0, (m2 - m1) / 2);
    const requiredRatio = requiredMc / m2;
    const stable = Math.abs(perturbationPole) < 1;
    const currentCommandA = Math.max(0, Number(pc.currentCommandA || 8));
    const blankingNs = Math.max(0, Number(pc.blankingNs || 120));
    return { duty, vout, m1, m2, mc, slopeCompRatio, perturbationPole, requiredMc, requiredRatio, stable, currentCommandA, blankingNs,
      verdict: stable ? "STABLE" : "SUBHARMONIC RISK",
      rule: stable ? "QUALIFIED" : "SLOPE COMP REQUIRED" };
  }

  function c2000Pipeline(state) {
    const p = state.plant, t = state.timing, c2 = state.c2000 || {};
    const sysclkHz = Number(c2.sysclkHz || 200e6), mhz = sysclkHz / 1e6;
    const periodUs = 1e6 / p.fsw, periodCycles = sysclkHz / p.fsw;
    const stages = [
      { id:"soc", block:"ePWM SOCA", us:Number(t.sampleUs || 0), role:"sample phase trigger" },
      { id:"sh", block:"ADC S/H", us:Number(t.acquisitionUs || 0), role:"source settles into sample capacitor" },
      { id:"eoc", block:"ADC conversion + PPB", us:Number(t.conversionUs || 0), role:"convert + offset/limit post-processing" },
      { id:"irq", block:c2.claEnabled === false ? "ADCINT → CPU ISR" : "ADCINT → CLA task", us:Number(t.irqUs || 0), role:"deterministic control entry" },
      { id:"control", block:"C(z) + limiter", us:Number(t.computeUs || 0), role:"compute command under constraints" },
      { id:"commit", block:c2.hrpwmEnabled ? "CMPA shadow + HRPWM" : "CMPA shadow", us:0, role:"write command; effective only at configured load event" },
      { id:"safety", block:"CMPSS → DC → TZ", us:0, role:"asynchronous fail-closed veto" },
      { id:"evidence", block:"GPIO probe / DMA trace", us:0, role:"make timing and ownership observable" }
    ];
    const activeUs = Number(t.acquisitionUs||0)+Number(t.conversionUs||0)+Number(t.irqUs||0)+Number(t.computeUs||0);
    const activeCycles = activeUs * mhz;
    const computeCycles = Number(t.computeUs||0) * mhz;
    const writeUs = Number(t.sampleUs||0) + activeUs;
    const timing = Base.timingState ? Base.timingState(state) : null;
    const epsilonUs = Math.max(1e-9, periodUs * 1e-9);
    const fallbackMissedLoads = Math.floor((writeUs + epsilonUs) / periodUs);
    const missedLoads = timing && Number.isFinite(timing.missedLoads) ? timing.missedLoads : fallbackMissedLoads;
    const applyUs = timing && Number.isFinite(timing.apply) ? timing.apply : periodUs * (missedLoads + 1);
    const sampleToActuateUs = timing && Number.isFinite(timing.actuation) ? timing.actuation : applyUs - Number(t.sampleUs||0);
    const slackUs = periodUs - writeUs;
    const deadlineMet = timing ? !timing.missed : missedLoads === 0;
    return { sysclkHz, periodUs, periodCycles, activeUs, activeCycles, computeCycles, writeUs, applyUs, missedLoads,
      sampleToActuateUs, slackUs, deadlineMet,
      cpuBudgetPct: periodCycles ? computeCycles / periodCycles * 100 : 0, stages };
  }

  function calibrationBudget(state) {
    const s = state.sensing || {}, cal = state.calibration || {}, plant = state.plant || {};
    const adcMax = Math.max(1, Number(s.adcMax || 1));
    const adcVref = Number(s.adcVref), divider = Number(s.divider);
    const candidateCodes = [cal.operatingAdcCode, s.operatingCode, s.adcCode].map(Number);
    const explicitCode = candidateCodes.find(v => Number.isFinite(v) && v > 0);
    const explicitOutputV = explicitCode != null && Number.isFinite(adcVref) && adcVref > 0 && Number.isFinite(divider) && divider > 0 ? explicitCode / adcMax * adcVref * divider : NaN;
    const plantOutputV = Number.isFinite(Number(plant.vout)) ? Number(plant.vout) : Number(plant.vin) * Number(plant.duty);
    const derivedCode = Number.isFinite(plantOutputV) && plantOutputV > 0 && Number.isFinite(adcVref) && adcVref > 0 && Number.isFinite(divider) && divider > 0 ? plantOutputV / divider / adcVref * adcMax : NaN;
    let rawCode, normalization, operatingOutputV;
    if (explicitCode != null) { rawCode = explicitCode; normalization = "OPERATING_POINT_CODE"; operatingOutputV = explicitOutputV; }
    else if (Number.isFinite(derivedCode) && derivedCode > 0) { rawCode = derivedCode; normalization = "PLANT_DERIVED_CODE"; operatingOutputV = plantOutputV; }
    else { rawCode = adcMax; normalization = "FULL_SCALE_FALLBACK"; operatingOutputV = Number.isFinite(adcVref) && Number.isFinite(divider) ? adcVref * divider : NaN; }
    const operatingAdcCode = clamp(rawCode, 1, adcMax);
    const gainPct = Math.abs(Number(cal.dividerGainErrorPct || 0.5));
    const vrefPct = Math.abs(Number(cal.vrefErrorPpm || 500)) / 10000;
    const adcInlPct = Math.abs(Number(cal.adcInlLsb || 1.5)) / operatingAdcCode * 100;
    const offsetPct = Math.abs(Number(cal.offsetCounts || 2)) / operatingAdcCode * 100;
    const driftPct = Math.abs(Number(cal.tempDriftPpmC || 60) * Number(cal.deltaTempC || 50)) / 10000;
    const residualPct = Math.abs(Number(cal.residualPct || 0.15));
    const contributors = { gainPct, vrefPct, adcInlPct, offsetPct, driftPct, residualPct };
    const rssPct = Math.sqrt(Object.values(contributors).reduce((sum, v) => sum + v*v, 0));
    const worstCasePct = Object.values(contributors).reduce((sum, v) => sum + v, 0);
    const regulationPct = Number((state.contract||{}).regulationPct || 1);
    return { contributors, rssPct, worstCasePct, regulationPct, marginPct: regulationPct - worstCasePct,
      qualified: worstCasePct <= regulationPct, deltaTempC:Number(cal.deltaTempC || 50), operatingAdcCode, operatingOutputV, adcMax, normalization };
  }

  const TOPOLOGY_CONTROL = Object.freeze({
    buck: { actuator:"duty", inner:"optional peak/average current", outer:"voltage", special:"CCM/DCM boundary · synchronous dead time", c2000:"ePWM + ADC + CMPSS" },
    boost: { actuator:"duty", inner:"inductor current", outer:"output voltage", special:"RHP zero limits voltage-loop bandwidth", c2000:"ePWM + ADC + CMPSS" },
    pfc: { actuator:"duty", inner:"line current", outer:"DC bus voltage", special:"Vac feed-forward · zero-cross · 2ω ripple", c2000:"ePWM SOC + CLA current loop + SOGI/PLL optional" },
    psfb: { actuator:"phase shift", inner:"transformer/output current", outer:"voltage", special:"ZVS boundary · duty loss · flux balance", c2000:"ePWM phase registers + CMPSS/TZ" },
    llc: { actuator:"switching frequency", inner:"optional current protection", outer:"voltage", special:"below/near/above resonance · burst", c2000:"variable TBPRD + dead-band + CMPSS" },
    inverter: { actuator:"modulation index / dq voltage", inner:"grid/output current", outer:"DC bus / AC voltage", special:"SPLL · LCL resonance · weak-grid interaction", c2000:"ePWM + ADC + CLA + SPLL + TZ" }
  });
  function topologyControl(id) { return Object.assign({ id }, TOPOLOGY_CONTROL[id] || TOPOLOGY_CONTROL.buck); }

  const PROTECTION_POLICIES = Object.freeze([
    { fault:"OCP", detect:"CMPSS cycle-by-cycle", reaction:"TZ PWM OFF", recovery:"auto next cycle or escalate", latency:"hardware-direct · config/device/gate dependent · measure" },
    { fault:"SCP", detect:"CMPSS high threshold", reaction:"one-shot TZ", recovery:"hiccup / latch", latency:"hardware-direct · config/device/gate dependent · measure" },
    { fault:"OVP", detect:"ADC PPB + comparator", reaction:"PWM OFF + discharge policy", recovery:"latched until qualified", latency:"path/rate dependent · measure" },
    { fault:"UVP/Brownout", detect:"filtered ADC", reaction:"derate / controlled stop", recovery:"brown-in hysteresis", latency:"filter/task dependent" },
    { fault:"OTP", detect:"temperature sensor", reaction:"derate then stop", recovery:"cooldown hysteresis", latency:"sensor/filter/task dependent" },
    { fault:"Fan fail", detect:"tach timeout", reaction:"derate / stop", recovery:"retry + log", latency:"timeout policy dependent" },
    { fault:"Sensor implausible", detect:"range/rate/redundancy", reaction:"fail-safe authority", recovery:"service / restart policy", latency:"task dependent" }
  ]);
  function protectionPolicies() { return PROTECTION_POLICIES.map(x => Object.assign({}, x)); }

  function bidirectionalFlow(state) {
    const b = state.bidirectional || {};
    const powerCommandW = Number(b.powerCommandW || 0), portAV = Math.max(1, Number(b.portAV || 48)), portBV = Math.max(1, Number(b.portBV || 24));
    const limitA = Math.max(0.1, Number(b.currentLimitA || 20));
    const direction = powerCommandW > 0 ? "A → B" : powerCommandW < 0 ? "B → A" : "IDLE";
    const mode = powerCommandW > 0 ? "SOURCE" : powerCommandW < 0 ? "SINK / REGEN" : "IDLE";
    const currentA = Math.abs(powerCommandW) / portAV, currentB = Math.abs(powerCommandW) / portBV;
    const limited = Math.max(currentA, currentB) > limitA;
    const permittedPowerW = limited ? Math.sign(powerCommandW) * limitA * Math.min(portAV, portBV) : powerCommandW;
    return { powerCommandW, portAV, portBV, direction, mode, currentA, currentB, limitA, limited, permittedPowerW,
      handoff:["ramp current command to zero","confirm energy-flow sign / bus qualification","swap source-sink authority","ramp new-direction command"] };
  }

  function productionFirmware(state) {
    const p = state.production || {};
    const timeoutMs = Math.max(1, Number(p.commandTimeoutMs || 100)), ageMs = Math.max(0, Number(p.commandAgeMs || 0));
    const commandFresh = ageMs <= timeoutMs;
    const configValid = p.configCrcValid !== false && p.configVersionMatch !== false;
    const rollbackReady = p.rollbackReady !== false;
    const safeToRun = commandFresh && configValid;
    return { timeoutMs, ageMs, commandFresh, configValid, rollbackReady, safeToRun,
      activeBank:p.activeBank || "A", faultLogDepth:Number(p.faultLogDepth || 64),
      policy: safeToRun ? "RUN AUTHORITY MAY BE GRANTED" : "FAIL SAFE / HOLD PWM OFF" };
  }

  function modelBridge(state) {
    const cycle = switchingCycle(state), pipe = c2000Pipeline(state);
    return {
      levels:[
        { name:"SWITCHING", keeps:"edge timing · ripple · loss · saturation", discards:"long-time loop response" },
        { name:"AVERAGED", keeps:"energy balance · duty→state dynamics", discards:"individual switching edges" },
        { name:"SMALL-SIGNAL", keeps:"local poles/zeros · loop gain", discards:"large-signal mode changes" },
        { name:"FIRMWARE", keeps:"sample/compute/commit/veto timing", discards:"analog detail not observable by MCU" }
      ],
      switchingRippleA:cycle.deltaOnA, timingSlackUs:pipe.slackUs
    };
  }

  global.CircuitPowerTeachingModelsV3 = { switchingCycle, peakCurrentMode, c2000Pipeline, calibrationBudget, topologyControl, protectionPolicies, bidirectionalFlow, productionFirmware, modelBridge, TOPOLOGY_CONTROL, PROTECTION_POLICIES };
})(window);
