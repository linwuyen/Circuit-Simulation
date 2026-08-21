(function (global) {
  "use strict";

  const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value)));
  const fmt = (value, digits) => Number(value).toFixed(digits == null ? 2 : digits);

  function buckTruth(state) {
    const p = state.plant;
    const duty = clamp(p.duty, 0.02, 0.95);
    const period = 1 / p.fsw;
    const vout = p.vin * duty;
    const iavg = vout / p.load;
    const deltaI = ((p.vin - vout) / p.inductance) * duty * period;
    return { duty, period, vout, iavg, deltaI, imin: Math.max(0, iavg - deltaI / 2), imax: iavg + deltaI / 2 };
  }

  function measureVout(vout, sensing) {
    const dividerV = vout / sensing.divider;
    const afeGain = 1 + Number(sensing.gainError) / 100;
    const afeV = dividerV * afeGain;
    const raw = Math.round(afeV / sensing.adcVref * sensing.adcMax) + Number(sensing.offsetCounts);
    const count = clamp(raw, 0, sensing.adcMax);
    const firmwareVout = count / sensing.adcMax * sensing.adcVref * sensing.divider;
    return {
      dividerV, afeGain, afeV, raw, count, firmwareVout,
      errorV: firmwareVout - vout,
      clipped: count !== raw,
      lsbAtOutput: sensing.adcVref / sensing.adcMax * sensing.divider
    };
  }

  function timingState(state) {
    const t = state.timing;
    const periodUs = 1e6 / state.plant.fsw;
    const eoc = t.sampleUs + t.acquisitionUs + t.conversionUs;
    const isr = eoc + t.irqUs;
    const write = isr + t.computeUs;
    // A compare write must finish strictly before the shadow-load event.  A
    // write exactly on the boundary is treated fail-closed as a missed load.
    const epsilonUs = Math.max(1e-9, periodUs * 1e-9);
    const missedLoads = Math.floor((write + epsilonUs) / periodUs);
    const missed = missedLoads > 0;
    const apply = periodUs * (missedLoads + 1);
    const actuation = apply - t.sampleUs;
    return { periodUs, eoc, isr, write, missed, missedLoads, apply, actuation, sampleUs: t.sampleUs };
  }

  function simulatePi(state) {
    const p = state.plant;
    const c = state.control;
    const t = timingState(state);
    const initialVout = p.vin * p.duty;
    const steps = 3000;
    const stepIndex = 500;
    const tau = 1.2e-3;
    const ts = 1 / p.fsw;
    const delayCycles = t.missedLoads;
    const queue = Array.from({ length: delayCycles + 1 }, () => p.duty);
    let y = initialVout;
    let integrator = p.duty;
    let duty = p.duty;
    const phys = [], meas = [], refs = [], duties = [];
    for (let k = 0; k < steps; k += 1) {
      const currentRef = k < stepIndex ? initialVout : c.vref;
      const measured = measureVout(y, state.sensing).firmwareVout;
      const eNorm = (currentRef - measured) / p.vin;
      const nextI = integrator + c.ki * eNorm * ts;
      const raw = c.kp * eNorm + nextI;
      const cmd = clamp(raw, 0.02, 0.90);
      if ((raw >= 0.02 && raw <= 0.90) || (raw > 0.90 && eNorm < 0) || (raw < 0.02 && eNorm > 0)) integrator = nextI;
      queue.push(cmd);
      duty = queue.shift();
      y += ts / tau * (p.vin * duty - y);
      if (k % 12 === 0) {
        phys.push(y); meas.push(measured); refs.push(currentRef); duties.push(duty);
      }
    }
    const finalPhysical = phys[phys.length - 1];
    const finalMeasured = measureVout(finalPhysical, state.sensing).firmwareVout;
    const maxAfter = Math.max.apply(null, phys.slice(Math.floor(stepIndex / 12)));
    const overshoot = c.vref > 0 ? Math.max(0, (maxAfter - c.vref) / c.vref * 100) : 0;
    return { phys, meas, refs, duties, finalPhysical, finalMeasured, finalDuty: duties[duties.length - 1], overshoot, initialVout, delayCycles };
  }

  function linePath(values, width, height, minY, maxY) {
    if (!values.length) return "";
    const span = Math.max(1e-9, maxY - minY);
    return values.map((value, index) => {
      const x = index / Math.max(1, values.length - 1) * width;
      const y = height - (value - minY) / span * height;
      return `${index ? "L" : "M"} ${fmt(x, 2)} ${fmt(clamp(y, 0, height), 2)}`;
    }).join(" ");
  }

  const complex = (re, im) => ({ re, im });
  const cmul = (a, b) => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  function cdiv(a, b) {
    const d = b.re * b.re + b.im * b.im || 1e-20;
    return complex((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }
  const cabs = a => Math.hypot(a.re, a.im);
  const cphase = a => Math.atan2(a.im, a.re) * 180 / Math.PI;
  const logspace = (minExp, maxExp, count) => Array.from({ length: count }, (_, i) => Math.pow(10, minExp + (maxExp - minExp) * i / (count - 1)));

  function buckLoopPoint(freq, delayUs, state) {
    const p = state.plant, c = state.control;
    const w = 2 * Math.PI * freq;

    // Normalized CCM Buck Gvd/Vin with load R and capacitor ESR Rc:
    // (1 + s Rc C) /
    // [1 + s(L/R + Rc C) + s^2 L C (1 + Rc/R)].
    // The controller uses e/Vin, so the Vin plant gain cancels by construction.
    const rc = Number(p.esr) || 0;
    const numPlant = complex(1, w * rc * p.capacitance);
    const denPlant = complex(
      1 - w * w * p.inductance * p.capacitance * (1 + rc / p.load),
      w * (p.inductance / p.load + rc * p.capacitance)
    );
    const plant = cdiv(numPlant, denPlant);
    const controller = complex(c.kp, -c.ki / Math.max(w, 1e-9));
    const theta = -w * delayUs * 1e-6;
    const delay = complex(Math.cos(theta), Math.sin(theta));
    const loop = cmul(cmul(controller, plant), delay);

    // Do not wrap the displayed phase back into [-180, 180]. A pure digital
    // delay can contribute several full turns near Nyquist.
    const phase = cphase(controller) + cphase(plant) - 360 * freq * delayUs * 1e-6;
    return { magDb: 20 * Math.log10(Math.max(cabs(loop), 1e-12)), phase };
  }

  function unwrap(phases) {
    const out = [];
    phases.forEach((phase, index) => {
      let value = phase;
      if (index) {
        while (value - out[index - 1] > 180) value -= 360;
        while (value - out[index - 1] < -180) value += 360;
      }
      out.push(value);
    });
    return out;
  }

  function interpolateCrossing(f1, f2, m1, m2, p1, p2) {
    const ratio = m1 === m2 ? 0 : clamp((0 - m1) / (m2 - m1), 0, 1);
    const logF = Math.log10(f1) + ratio * (Math.log10(f2) - Math.log10(f1));
    return { freq: Math.pow(10, logF), phase: p1 + ratio * (p2 - p1) };
  }

  function loopFrequencyBand(state) {
    const minHz = 1;
    const nyquistGuardHz = Math.max(10, Number(state.plant.fsw) * 0.45);
    const maxHz = Math.min(50000, nyquistGuardHz);
    return { minHz, maxHz };
  }

  function analyzeLoop(state, delayUs) {
    const band = loopFrequencyBand(state);
    const freqs = logspace(Math.log10(band.minHz), Math.log10(band.maxHz), 360);
    const points = freqs.map(f => buckLoopPoint(f, delayUs, state));
    const mags = points.map(p => p.magDb);
    const phases = unwrap(points.map(p => p.phase));
    const crossings = [];
    for (let i = 0; i < mags.length - 1; i += 1) {
      if (mags[i] === 0 || mags[i] * mags[i + 1] < 0) crossings.push(interpolateCrossing(freqs[i], freqs[i + 1], mags[i], mags[i + 1], phases[i], phases[i + 1]));
    }
    crossings.forEach(c => { c.phaseMargin = 180 + c.phase; });
    return { freqs, mags, phases, crossings, minHz:band.minHz, maxHz:band.maxHz, status: crossings.length === 0 ? "NO_CROSSOVER" : crossings.length === 1 ? "SINGLE" : "MULTIPLE" };
  }

  const PLANTS = Object.freeze({
    buck: { id:"buck", name:"Buck", controlVariable:"Duty", output:"Vout", plant:"LC double pole + ESR zero", threat:"LC resonance / digital delay", actuator:"CMPA / duty", response:"mono", model:"qualitative normalized signature · not a transfer-function plot" },
    boost: { id:"boost", name:"Boost", controlVariable:"Duty", output:"Vout", plant:"LC + RHP zero", threat:"RHP zero limits bandwidth", actuator:"CMPA / duty", response:"rhp", model:"qualitative normalized signature · RHP direction only" },
    pfc: { id:"pfc", name:"PFC", controlVariable:"Current command + duty", output:"IL + Vbus", plant:"inner current + outer voltage", threat:"2ω ripple / line feed-forward", actuator:"current-loop PWM", response:"ripple", model:"qualitative normalized signature · two-loop concept" },
    psfb: { id:"psfb", name:"PSFB", controlVariable:"Phase shift", output:"Vout / Iout", plant:"LC + commutation", threat:"duty loss / ZVS boundary", actuator:"phase compare", response:"deadzone", model:"qualitative normalized signature · commutation concept" },
    llc: { id:"llc", name:"LLC", controlVariable:"Switching frequency", output:"Vout", plant:"resonant gain vs operating point", threat:"gain slope changes / mode", actuator:"TBPRD / frequency", response:"resonant", model:"qualitative normalized signature · operating-point concept" },
    inverter: { id:"inverter", name:"Inverter", controlVariable:"Modulation / current cmd", output:"Vac / Iac", plant:"LC/LCL + grid", threat:"PLL / grid impedance", actuator:"SPWM / SVPWM", response:"sine", model:"qualitative normalized signature · AC-control concept" }
  });

  function topologyResponse(type) {
    const n = 140, values = [];
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1) * 6;
      let y = 0;
      if (type === "mono") y = 1 - Math.exp(-t);
      if (type === "rhp") y = 1 - Math.exp(-t) - 1.40 * t * Math.exp(-2.8 * t);
      if (type === "ripple") y = 1 - Math.exp(-t) + 0.12 * Math.sin(2 * Math.PI * t / 1.8);
      if (type === "deadzone") y = t < 0.8 ? 0 : 1 - Math.exp(-(t - 0.8));
      if (type === "resonant") y = 0.72 + 0.32 * Math.exp(-0.28 * t) * Math.sin(2.5 * t) + 0.28 * (1 - Math.exp(-t));
      if (type === "sine") y = 0.5 + 0.38 * Math.sin(2.2 * t) * (1 - Math.exp(-1.2 * t));
      values.push(y);
    }
    return values;
  }

  const HYPOTHESES = ["sense", "timing", "control", "protect", "data"];
  const DEBUG_SCENARIOS = Object.freeze([
    { id:"sense", symptom:"Physical Vout 比設定值低約 1 V，但 telemetry 顯示剛好 24 V。", root:"Sensing offset / gain", explanation:"Controller 已把錯誤 measurement 調到 24 V；physical truth 因 measurement bias 被拉低。", evidence:{ scope:["sense","control"], adc:["sense"], pwm:["sense","timing","control"], timing:["sense","control","protect","data"], trip:["sense","timing","control","data"], host:["sense","timing","control","protect"] } },
    { id:"timing", symptom:"同一組 PI 在 code 變重後開始 oscillate；DC gain 幾乎沒變，SFRA phase 明顯變差。", root:"Missed PWM load / extra digital delay", explanation:"計算完成太晚，多一個 sample-to-actuate cycle；magnitude 可接近原模型，但 phase 被延遲吃掉。", evidence:{ scope:["timing","control"], adc:["timing","control","protect","data"], pwm:["timing","protect"], timing:["timing"], trip:["timing","control","data"], host:["timing","control","protect"] } },
    { id:"protect", symptom:"Command 與 PI 都要求輸出，但 gate PWM 完全為 0；重新寫 CMPA 也沒用。", root:"Protection latch / Trip Zone", explanation:"Control command 存在，但 safety plane 正在 veto PWM；一直改 PI 不會讓 gate 恢復。", evidence:{ scope:["protect","timing"], adc:["protect","control","data"], pwm:["protect","timing"], timing:["protect","control","data"], trip:["protect"], host:["protect","timing","control"] } },
    { id:"data", symptom:"Host 已改 Vref，但 converter 長時間仍跑舊設定；local control loop 看起來很穩。", root:"Stale command / DMA data ownership", explanation:"Plant、sensing、PI 都可能完全正常；錯的是 controller 正在追一個 stale reference。", evidence:{ scope:["data","sense","control"], adc:["data","control","protect"], pwm:["data","control"], timing:["data","control","protect"], trip:["data","control","timing"], host:["data"] } }
  ]);

  function applyMeasurement(scenario, candidates, measurement) {
    const compatible = scenario.evidence[measurement] || HYPOTHESES;
    const before = candidates.slice();
    const after = before.filter(h => compatible.includes(h));
    const safeAfter = after.length ? after : before;
    const reduction = before.length ? Math.round((1 - safeAfter.length / before.length) * 100) : 0;
    const bits = before.length && safeAfter.length ? Math.log2(before.length) - Math.log2(safeAfter.length) : 0;
    return { before, after: safeAfter, reduction, bits };
  }

  global.CircuitPowerModelsV1 = { clamp, fmt, buckTruth, measureVout, timingState, simulatePi, linePath, buckLoopPoint, analyzeLoop, loopFrequencyBand, PLANTS, topologyResponse, HYPOTHESES, DEBUG_SCENARIOS, applyMeasurement };
})(window);
