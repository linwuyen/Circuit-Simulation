(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.C2000BuckHil = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DT = 1e-5;
  const DEFAULTS = Object.freeze({
    vin: 48,
    vref: 12,
    L: 200e-6,
    C: 470e-6,
    loadOhm: 6,
    currentLimit: 8,
    ovp: 14,
    dutyMax: 0.9,
    voltageKp: 0.3,
    voltageKi: 100,
    currentKp: 0.02,
    currentKi: 500,
    softStartTicks: 5000,
    commandTimeoutTicks: 500
  });

  const FAULT = Object.freeze({
    OCP: 1 << 0,
    OVP: 1 << 1,
    SENSOR: 1 << 2,
    COMMAND_TIMEOUT: 1 << 3
  });

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function createState(overrides = {}) {
    const cfg = { ...DEFAULTS, ...overrides };
    return {
      cfg,
      tick: 0,
      vout: 0,
      iL: 0,
      duty: 0,
      iref: 0,
      voltageI: 0,
      currentI: 0,
      commandAge: 0,
      faultLatch: 0,
      state: "SOFT_START",
      minVout: Infinity,
      maxVout: -Infinity,
      tripTick: null
    };
  }

  function controlStep(s, input = {}) {
    const c = s.cfg;
    const heartbeat = input.heartbeat !== false;
    const sensorValid = input.sensorValid !== false;
    const measuredVout = Number.isFinite(input.measuredVout) ? input.measuredVout : s.vout;
    const measuredCurrent = Number.isFinite(input.measuredCurrent) ? input.measuredCurrent : s.iL;

    if (heartbeat) s.commandAge = 0;
    else s.commandAge += 1;

    if (!sensorValid) s.faultLatch |= FAULT.SENSOR;
    if (measuredCurrent > c.currentLimit * 1.08) s.faultLatch |= FAULT.OCP;
    if (measuredVout > c.ovp) s.faultLatch |= FAULT.OVP;
    if (s.commandAge > c.commandTimeoutTicks) s.faultLatch |= FAULT.COMMAND_TIMEOUT;

    if (s.faultLatch) {
      if (s.tripTick == null) s.tripTick = s.tick;
      s.state = "FAULT_LATCHED";
      s.duty = 0;
      s.iref = 0;
      s.currentI = 0;
      return;
    }

    const softVref = c.vref * clamp(s.tick / c.softStartTicks, 0, 1);
    s.state = softVref < c.vref ? "SOFT_START" : "RUN";

    const ev = softVref - measuredVout;
    const ivUnsat = c.voltageKp * ev + s.voltageI;
    s.iref = clamp(ivUnsat, 0, c.currentLimit);
    if ((s.iref > 0 && s.iref < c.currentLimit) ||
        (s.iref >= c.currentLimit && ev < 0) ||
        (s.iref <= 0 && ev > 0)) {
      s.voltageI = clamp(s.voltageI + c.voltageKi * ev * DT, 0, c.currentLimit);
    }

    const ei = s.iref - measuredCurrent;
    const ff = softVref / c.vin;
    const raw = ff + c.currentKp * ei + s.currentI;
    s.duty = clamp(raw, 0, c.dutyMax);
    if ((s.duty > 0 && s.duty < c.dutyMax) ||
        (s.duty >= c.dutyMax && ei < 0) ||
        (s.duty <= 0 && ei > 0)) {
      s.currentI = clamp(s.currentI + c.currentKi * ei * DT, -0.25, 0.25);
    }
  }

  function plantStep(s, loadOhm = s.cfg.loadOhm) {
    const c = s.cfg;
    const di = (s.duty * c.vin - s.vout) / c.L * DT;
    s.iL = Math.max(0, s.iL + di);
    const dv = (s.iL - s.vout / loadOhm) / c.C * DT;
    s.vout = Math.max(0, s.vout + dv);
    s.minVout = Math.min(s.minVout, s.vout);
    s.maxVout = Math.max(s.maxVout, s.vout);
  }

  function runScenario(name, overrides = {}) {
    const s = createState(overrides);
    let finalLoad = s.cfg.loadOhm;
    let eventTick = null;
    const totalTicks = 9000;
    const trace = [];

    for (let n = 0; n < totalTicks; n += 1) {
      s.tick = n;
      const input = {};
      let load = s.cfg.loadOhm;

      if (name === "load-step" && n >= 5500) {
        load = s.cfg.loadOhm / 2;
        if (eventTick == null) eventTick = n;
      }
      if (name === "ocp" && n === 5000) {
        input.measuredCurrent = s.cfg.currentLimit * 1.25;
        eventTick = n;
      }
      if (name === "adc-stuck" && n >= 5000) {
        input.sensorValid = false;
        if (eventTick == null) eventTick = n;
      }
      if (name === "command-timeout" && n >= 5000) {
        input.heartbeat = false;
        if (eventTick == null) eventTick = n;
      }
      if (name === "ovp" && n === 5000) {
        input.measuredVout = s.cfg.ovp + 1;
        eventTick = n;
      }

      finalLoad = load;
      controlStep(s, input);
      plantStep(s, load);

      if (n % 100 === 0 || n === eventTick || (s.tripTick != null && n === s.tripTick)) {
        trace.push({ tick: n, vout: s.vout, iL: s.iL, duty: s.duty, state: s.state, faultLatch: s.faultLatch });
      }
    }

    const expectedFault = {
      nominal: 0,
      "load-step": 0,
      ocp: FAULT.OCP,
      "adc-stuck": FAULT.SENSOR,
      "command-timeout": FAULT.COMMAND_TIMEOUT,
      ovp: FAULT.OVP
    }[name];

    const tripLatencyTicks = eventTick != null && s.tripTick != null ? s.tripTick - eventTick : null;
    return {
      name,
      vout: s.vout,
      iL: s.iL,
      duty: s.duty,
      state: s.state,
      faultLatch: s.faultLatch,
      expectedFault,
      tripLatencyTicks,
      eventTick,
      tripTick: s.tripTick,
      finalLoad,
      trace,
      pass:
        expectedFault === 0
          ? s.faultLatch === 0 && Math.abs(s.vout - s.cfg.vref) < 0.35
          : (s.faultLatch & expectedFault) !== 0 && s.duty === 0 && tripLatencyTicks != null &&
            (name === "command-timeout" ? tripLatencyTicks <= s.cfg.commandTimeoutTicks + 1 : tripLatencyTicks <= 1)
    };
  }

  function boardEvidenceContract() {
    return [
      { id: "pwm", signal: "PWM gate command", criterion: "100 kHz period and commanded duty match CMPA" },
      { id: "gpio", signal: "GPIO31 ISR probe", criterion: "sample-to-compare execution fits inside the control period" },
      { id: "soc", signal: "ADC SOC phase", criterion: "sample phase is deterministic relative to PWM switching edge" },
      { id: "trip", signal: "CMPSS → TZ", criterion: "fault forces PWM low without waiting for background software" },
      { id: "soft", signal: "Soft-start Vout", criterion: "monotonic ramp without duty saturation windup" },
      { id: "load", signal: "Load step", criterion: "Vout transient returns to regulation without protection chatter" },
      { id: "timeout", signal: "Command timeout", criterion: "stale command fails closed and latches evidence" },
      { id: "rearm", signal: "Fault re-arm", criterion: "clear only after source-safe qualifiers are physically true" }
    ];
  }

  return { DEFAULTS, FAULT, createState, controlStep, plantStep, runScenario, boardEvidenceContract };
});
