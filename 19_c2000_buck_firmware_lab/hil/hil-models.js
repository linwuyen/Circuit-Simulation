(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.C2000BuckHil = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

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
    controlPeriodS: 1e-5,
    softStartVoltsPerSecond: 240,
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
      softVref: 0,
      voltageI: 0,
      currentI: 0,
      commandAge: 0,
      faultLatch: 0,
      state: "OFF",
      minVout: Infinity,
      maxVout: -Infinity,
      tripTick: null
    };
  }

  function createCommandTracker() {
    return { lastSequence: 0, lastClearFaultToken: 0 };
  }

  function consumeCommand(tracker, snapshot = {}) {
    const sequence = Number(snapshot.sequence) >>> 0;
    const clearFaultToken = Number(snapshot.clearFaultToken) >>> 0;
    const heartbeat = sequence !== tracker.lastSequence;
    const clearFault = clearFaultToken !== tracker.lastClearFaultToken;
    if (heartbeat) tracker.lastSequence = sequence;
    if (clearFault) tracker.lastClearFaultToken = clearFaultToken;
    return { enable: snapshot.enable !== false, heartbeat, clearFault };
  }

  function controlStep(s, input = {}) {
    const c = s.cfg;
    const dt = c.controlPeriodS;
    const heartbeat = input.heartbeat === true;
    const enable = input.enable !== false;
    const sensorValid = input.sensorValid !== false;
    const peripheralsReady = input.peripheralsReady !== false;
    const calibrationValid = input.calibrationValid !== false;
    const hardwareTripActive = input.hardwareTripActive === true;
    const clearFault = input.clearFault === true;
    const measuredVin = Number.isFinite(input.measuredVin) ? input.measuredVin : c.vin;
    const measuredVout = Number.isFinite(input.measuredVout) ? input.measuredVout : s.vout;
    const measuredCurrent = Number.isFinite(input.measuredCurrent) ? input.measuredCurrent : s.iL;

    if (heartbeat) s.commandAge = 0;
    else s.commandAge += 1;

    if (!sensorValid || !peripheralsReady || !calibrationValid || measuredVin <= 0.1 || dt <= 0) s.faultLatch |= FAULT.SENSOR;
    if (hardwareTripActive) s.faultLatch |= FAULT.OCP;
    if (measuredCurrent > c.currentLimit * 1.08) s.faultLatch |= FAULT.OCP;
    if (measuredVout > c.ovp) s.faultLatch |= FAULT.OVP;
    if (enable && s.commandAge > c.commandTimeoutTicks) s.faultLatch |= FAULT.COMMAND_TIMEOUT;

    if (s.faultLatch) {
      if (s.tripTick == null) s.tripTick = s.tick;
      s.state = "FAULT_LATCHED";
      s.duty = 0;
      s.iref = 0;
      s.currentI = 0;
      if (clearFault && sensorValid && peripheralsReady && calibrationValid && measuredVin > 0.1 &&
          measuredCurrent < c.currentLimit * 0.20 && measuredVout < c.vref * 0.50 &&
          s.commandAge <= c.commandTimeoutTicks) {
        s.faultLatch = 0;
        s.state = "OFF";
        s.softVref = 0;
        s.voltageI = 0;
      }
      return;
    }

    if (!enable) {
      s.state = "OFF";
      s.softVref = 0;
      s.duty = 0;
      s.iref = 0;
      s.voltageI = 0;
      s.currentI = 0;
      return;
    }

    if (s.state === "OFF") s.state = "SOFT_START";
    if (s.state === "SOFT_START") {
      s.softVref = Math.min(c.vref, s.softVref + c.softStartVoltsPerSecond * dt);
      if (s.softVref >= c.vref) s.state = "RUN";
    } else {
      s.softVref = c.vref;
    }

    const ev = s.softVref - measuredVout;
    const ivUnsat = c.voltageKp * ev + s.voltageI;
    s.iref = clamp(ivUnsat, 0, c.currentLimit);
    if ((s.iref > 0 && s.iref < c.currentLimit) ||
        (s.iref >= c.currentLimit && ev < 0) ||
        (s.iref <= 0 && ev > 0)) {
      s.voltageI = clamp(s.voltageI + c.voltageKi * ev * dt, 0, c.currentLimit);
    }

    const ei = s.iref - measuredCurrent;
    const raw = s.softVref / measuredVin + c.currentKp * ei + s.currentI;
    s.duty = clamp(raw, 0, c.dutyMax);
    if ((s.duty > 0 && s.duty < c.dutyMax) ||
        (s.duty >= c.dutyMax && ei < 0) ||
        (s.duty <= 0 && ei > 0)) {
      s.currentI = clamp(s.currentI + c.currentKi * ei * dt, -0.25, 0.25);
    }
  }

  function plantStep(s, loadOhm = s.cfg.loadOhm) {
    const c = s.cfg;
    const dt = c.controlPeriodS;
    const di = (s.duty * c.vin - s.vout) / c.L * dt;
    s.iL = Math.max(0, s.iL + di);
    const dv = (s.iL - s.vout / loadOhm) / c.C * dt;
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
      const input = { heartbeat: true };
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
      if (name === "adc-overflow" && n === 5000) {
        input.sensorValid = false;
        eventTick = n;
      }
      if (name === "hardware-trip" && n === 5000) {
        input.hardwareTripActive = true;
        eventTick = n;
      }
      if (name === "command-timeout" && n >= 5000) {
        input.heartbeat = false;
        if (eventTick == null) eventTick = n;
      }
      if (name === "ovp" && n === 5000) {
        input.measuredVout = s.cfg.ovp + 1;
        eventTick = n;
      }
      if (name === "idle-off") {
        input.enable = false;
        input.heartbeat = false;
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
      "idle-off": 0,
      ocp: FAULT.OCP,
      "adc-stuck": FAULT.SENSOR,
      "adc-overflow": FAULT.SENSOR,
      "hardware-trip": FAULT.OCP,
      "command-timeout": FAULT.COMMAND_TIMEOUT,
      ovp: FAULT.OVP
    }[name];

    const tripLatencyTicks = eventTick != null && s.tripTick != null ? s.tripTick - eventTick : null;
    const nonFaultPass = name === "idle-off"
      ? s.faultLatch === 0 && s.state === "OFF" && s.duty === 0
      : s.faultLatch === 0 && Math.abs(s.vout - s.cfg.vref) < 0.35;

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
          ? nonFaultPass
          : (s.faultLatch & expectedFault) !== 0 && s.duty === 0 && tripLatencyTicks != null &&
            (name === "command-timeout" ? tripLatencyTicks <= s.cfg.commandTimeoutTicks + 1 : tripLatencyTicks <= 1)
    };
  }

  function runFaultClearScenario() {
    const s = createState();
    const tracker = createCommandTracker();

    s.tick = 1;
    controlStep(s, { ...consumeCommand(tracker, { sequence: 1, clearFaultToken: 0 }), sensorValid: false });

    s.tick = 2;
    controlStep(s, {
      ...consumeCommand(tracker, { sequence: 2, clearFaultToken: 1 }),
      measuredCurrent: s.cfg.currentLimit * 0.30,
      measuredVout: 0
    });
    const unsafeClearRejected = s.faultLatch !== 0 && s.state === "FAULT_LATCHED";

    s.tick = 3;
    controlStep(s, {
      ...consumeCommand(tracker, { sequence: 3, clearFaultToken: 1 }),
      measuredCurrent: 0,
      measuredVout: 0
    });
    const heldLevelRejected = s.faultLatch !== 0 && s.state === "FAULT_LATCHED";

    s.tick = 4;
    controlStep(s, {
      ...consumeCommand(tracker, { sequence: 4, clearFaultToken: 2 }),
      measuredCurrent: 0,
      measuredVout: 0
    });
    const freshClearAccepted = s.faultLatch === 0 && s.state === "OFF";

    return { unsafeClearRejected, heldLevelRejected, freshClearAccepted, state: s.state, faultLatch: s.faultLatch };
  }

  function boardEvidenceContract() {
    return [
      { id: "pwm", signal: "PWM gate command", criterion: "measured period matches configured fsw and active duty matches CMPA after the defined shadow-load event" },
      { id: "gpio", signal: "GPIO31 ISR probe", criterion: "sample-to-shadow-write execution meets the measured control deadline with margin" },
      { id: "soc", signal: "ADC SOC phase", criterion: "sample phase is deterministic relative to the physical switching edge" },
      { id: "trip", signal: "CMPSS → XBAR → DCAEVT1 → TZ", criterion: "fault forces PWM low without waiting for ADC ISR or background software" },
      { id: "soft", signal: "Soft-start Vout", criterion: "monotonic ramp without duty saturation windup" },
      { id: "load", signal: "Load step", criterion: "Vout transient returns to regulation without protection chatter" },
      { id: "timeout", signal: "Command timeout", criterion: "stale enabled external command fails closed; disabled authority remains safely OFF without fabricated freshness" },
      { id: "rearm", signal: "Fault re-arm", criterion: "clear only after explicit command plus physically safe V/I qualifiers" }
    ];
  }

  return { DEFAULTS, FAULT, createState, createCommandTracker, consumeCommand, controlStep, plantStep, runScenario, runFaultClearScenario, boardEvidenceContract };
});
