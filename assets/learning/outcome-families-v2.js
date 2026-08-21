(function (root, factory) {
  const Benchmark = root && root.CircuitOutcomeBenchmarkV1 || (typeof require === "function" ? require("./outcome-benchmark-v1.js") : null);
  const api = factory(Benchmark);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeFamiliesV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Benchmark) {
  "use strict";
  if (!Benchmark) throw new Error("CircuitOutcomeBenchmarkV1 is required");

  const VERSION = 2;
  const PROFILE = "core8";
  const PHASE_INDEX = Object.freeze({ pre:0, post:1, r1:2, r2:3, r3:4, r4:5 });
  const COMPETENCIES = Benchmark.CORE8_COMPETENCIES;
  const round = (value, digits = 6) => Number(value.toFixed(digits));
  const normalizedSeed = seed => {
    const value = Number(seed);
    if (!Number.isFinite(value)) throw new RangeError("seed must be finite");
    return value >>> 0;
  };

  const FAMILY_CATALOG = Object.freeze({
    physics: Object.freeze([
      Object.freeze({ id:"physics.inductance-ripple", contract:"At fixed Vin/Vout/fsw in CCM, ripple magnitude is inversely proportional to L." }),
      Object.freeze({ id:"physics.switching-frequency-ripple", contract:"At fixed Vin/Vout/L in CCM, ripple magnitude is inversely proportional to switching frequency." })
    ]),
    sensing: Object.freeze([
      Object.freeze({ id:"sensing.divider-to-count", contract:"With physical voltage fixed and ADC unsaturated, raw ADC count follows divider ratio." }),
      Object.freeze({ id:"sensing.afe-gain-to-count", contract:"With physical input fixed and ADC unsaturated, raw ADC count follows analog front-end gain." })
    ]),
    feedback: Object.freeze([
      Object.freeze({ id:"feedback.reference-first-step", contract:"With reconstructed feedback frozen, positive PI duty-request tendency follows a reference step." }),
      Object.freeze({ id:"feedback.feedback-first-step", contract:"With reference frozen, positive PI duty-request tendency moves opposite a reconstructed-feedback step." })
    ]),
    timing: Object.freeze([
      Object.freeze({ id:"timing.shadow-load-deadline", contract:"A shadow write must complete strictly before the PWM load event; exact-deadline completion misses." }),
      Object.freeze({ id:"timing.rate-change-deadline", contract:"With compute latency fixed, changing switching period changes whether the first shadow-load deadline is met." })
    ]),
    dynamics: Object.freeze([
      Object.freeze({ id:"dynamics.delay-change-phase", contract:"At fixed probe frequency, pure-delay phase is linear in delay and becomes more negative as delay increases." }),
      Object.freeze({ id:"dynamics.frequency-change-phase", contract:"At fixed pure delay, delay-only phase becomes more negative as probe frequency increases." })
    ]),
    safety: Object.freeze([
      Object.freeze({ id:"safety.hardware-vs-software-veto", contract:"When a direct hardware trip path exists, it owns the fastest physical PWM veto rather than the ADC/CPU path." }),
      Object.freeze({ id:"safety.trip-latch-authority", contract:"An asserted hardware trip veto dominates RUN state and nonzero controller request at the physical PWM output." })
    ]),
    production: Object.freeze([
      Object.freeze({ id:"production.command-freshness", contract:"Software PWM authority fails closed only when external command age is strictly greater than timeout, all other invariants valid." }),
      Object.freeze({ id:"production.authority-and", contract:"Software PWM authority is the conjunction of RUN, freshness, sensing validity, no fault, peripheral readiness and calibration validity." })
    ]),
    evidence: Object.freeze([
      Object.freeze({ id:"evidence.highest-claim", contract:"The highest allowed engineering claim is capped by the highest evidence tier actually completed." }),
      Object.freeze({ id:"evidence.board-closure-gap", contract:"Target image and board binding do not become BOARD_PASS until all required physical captures satisfy acceptance criteria." })
    ])
  });

  function fnv1a(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function contractFingerprint() {
    const contract = COMPETENCIES.flatMap(competency => FAMILY_CATALOG[competency].map(row => `${competency}|${row.id}|${row.contract}`)).join("\n");
    return `core8-families-v2-${fnv1a(contract)}`;
  }

  function familySelection(seed, phase, competency, index) {
    if (!(phase in PHASE_INDEX)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (!COMPETENCIES.includes(competency)) throw new RangeError(`unknown core8 competency: ${competency}`);
    if (!Number.isInteger(index) || index < 0 || index >= Benchmark.MAX_CASES_PER_COMPETENCY) throw new RangeError("invalid family item index");
    const salt = COMPETENCIES.indexOf(competency) * 11;
    const phaseIndex = PHASE_INDEX[phase];
    const familyIndex = (normalizedSeed(seed) + phaseIndex + index + salt) % FAMILY_CATALOG[competency].length;
    const variantIndex = (normalizedSeed(seed) + phaseIndex * 3 + index * 5 + salt) % 4;
    const family = FAMILY_CATALOG[competency][familyIndex];
    return Object.freeze({ family, familyIndex, variantIndex, phaseIndex });
  }

  function caseId(seed, phase, competency, familyIndex, variantIndex, index) {
    return `${phase}-${competency}-f${familyIndex}-v${variantIndex}-i${index}-s${normalizedSeed(seed)}`;
  }

  function decorate(item, meta) {
    return Object.freeze({
      ...item,
      familyId: meta.family.id,
      familyContract: meta.family.contract,
      variantId: `${meta.family.id}:${item.phase}:v${meta.variantIndex}`,
      instrumentVersion: VERSION
    });
  }

  function choiceCase({ seed, phase, competency, index, meta, prompt, choices, expected, choiceLabels, rationale, parameters }) {
    return decorate({
      id: caseId(seed, phase, competency, meta.familyIndex, meta.variantIndex, index),
      phase,
      competency,
      answerType:"choice",
      prompt,
      choices:Object.freeze(choices),
      expected,
      choiceLabels:choiceLabels ? Object.freeze({ ...choiceLabels }) : undefined,
      rationale:rationale || undefined,
      parameters:Object.freeze({ ...parameters, familyIndex:meta.familyIndex, variantIndex:meta.variantIndex })
    }, meta);
  }

  function physics(seed, phase, index) {
    const meta = familySelection(seed, phase, "physics", index);
    const v = meta.variantIndex;
    if (meta.familyIndex === 0) {
      const base = [100,150,220,330][v];
      const factor = [2,0.5,1.5,0.75][v];
      const changed = round(base * factor, 1);
      return choiceCase({ seed,phase,competency:"physics",index,meta,
        prompt:`Buck stays at the same Vin, Vout and fsw in CCM. L changes from ${base} uH to ${changed} uH. What happens to ΔiL?`,
        choices:["increase","decrease","same"], expected:factor > 1 ? "decrease" : "increase",
        choiceLabels:{ increase:"ΔiL 變大", decrease:"ΔiL 變小", same:"大致不變" },
        rationale:"At fixed switching voltage/time, di/dt=vL/L; larger L reduces ripple.", parameters:{ inductanceUh:base, changedUh:changed, factor } });
    }
    const base = [50,80,100,160][v] * 1000;
    const factor = [2,0.5,1.5,0.75][v];
    const changed = Math.round(base * factor);
    return choiceCase({ seed,phase,competency:"physics",index,meta,
      prompt:`Buck stays at the same Vin, Vout and L in CCM. fsw changes from ${base} Hz to ${changed} Hz. What happens to ΔiL?`,
      choices:["increase","decrease","same"], expected:factor > 1 ? "decrease" : "increase",
      choiceLabels:{ increase:"ΔiL 變大", decrease:"ΔiL 變小", same:"大致不變" },
      rationale:"At fixed duty and voltages, switching period sets on/off time; higher fsw shortens the current ramp.", parameters:{ switchingHz:base, changedSwitchingHz:changed, factor } });
  }

  function sensing(seed, phase, index) {
    const meta = familySelection(seed, phase, "sensing", index);
    const v = meta.variantIndex;
    const physicalV = [5,8,10,12][v];
    const factor = [1.25,0.75,1.5,0.8][v];
    if (meta.familyIndex === 0) {
      const base = [0.12,0.18,0.20,0.10][v];
      const changed = round(base * factor, 4);
      return choiceCase({ seed,phase,competency:"sensing",index,meta,
        prompt:`Physical Vout remains ${physicalV} V and the ADC is unsaturated. Divider ratio changes from ${base} to ${changed}. What should raw ADC count do?`,
        choices:["increase","decrease","same"], expected:factor > 1 ? "increase" : "decrease",
        choiceLabels:{ increase:"ADC count 變大", decrease:"ADC count 變小", same:"ADC count 不變" },
        rationale:"Before firmware scaling, the divider changes ADC-pin voltage in the same direction.", parameters:{ physicalV, divider:base, changedDivider:changed, factor } });
    }
    const base = [0.8,1.0,1.2,1.5][v];
    const changed = round(base * factor, 3);
    return choiceCase({ seed,phase,competency:"sensing",index,meta,
      prompt:`Sensor input remains fixed and the ADC is unsaturated. Analog front-end gain changes from ${base} to ${changed}. What should raw ADC count do first?`,
      choices:["increase","decrease","same"], expected:factor > 1 ? "increase" : "decrease",
      choiceLabels:{ increase:"ADC count 變大", decrease:"ADC count 變小", same:"ADC count 不變" },
      rationale:"With the physical input fixed, analog gain changes ADC-pin voltage before any engineering-unit reconstruction.", parameters:{ physicalV, afeGain:base, changedAfeGain:changed, factor } });
  }

  function feedback(seed, phase, index) {
    const meta = familySelection(seed, phase, "feedback", index);
    const v = meta.variantIndex;
    const step = [1.5,-1.0,2.0,-1.5][v];
    if (meta.familyIndex === 0) {
      const reference = [9,10,12,15][v];
      const changed = round(reference + step, 2);
      const feedback = round(reference - 0.5, 2);
      return choiceCase({ seed,phase,competency:"feedback",index,meta,
        prompt:`Reconstructed feedback is frozen at ${feedback} V for the first control step. Reference changes from ${reference} V to ${changed} V. With positive Kp/Ki and no saturation, what is the first duty-request tendency?`,
        choices:["duty-increase","duty-decrease","same"], expected:step > 0 ? "duty-increase" : "duty-decrease",
        choiceLabels:{ "duty-increase":"Duty request 增加", "duty-decrease":"Duty request 減少", same:"Duty request 不變" },
        rationale:"With y-hat frozen, the sign of the reference step sets the sign of e=r-y-hat and the positive PI first-step command.", parameters:{ referenceV:reference, changedReferenceV:changed, feedbackV:feedback, stepV:step } });
    }
    const reference = [10,12,15,18][v];
    const feedback = round(reference - 0.8, 2);
    const changed = round(feedback + step, 2);
    return choiceCase({ seed,phase,competency:"feedback",index,meta,
      prompt:`Reference is frozen at ${reference} V for the first control step. Reconstructed feedback changes from ${feedback} V to ${changed} V. With positive Kp/Ki and no saturation, what is the first duty-request tendency?`,
      choices:["duty-increase","duty-decrease","same"], expected:step > 0 ? "duty-decrease" : "duty-increase",
      choiceLabels:{ "duty-increase":"Duty request 增加", "duty-decrease":"Duty request 減少", same:"Duty request 不變" },
      rationale:"With r frozen, increasing reconstructed feedback reduces e=r-y-hat, so a positive PI moves the request down on the first step.", parameters:{ referenceV:reference, feedbackV:feedback, changedFeedbackV:changed, stepV:step } });
  }

  function timing(seed, phase, index) {
    const meta = familySelection(seed, phase, "timing", index);
    const v = meta.variantIndex;
    if (meta.familyIndex === 0) {
      const switchingHz = [80000,100000,125000,160000][v];
      const periodS = 1 / switchingHz;
      const ratio = [0.82,1.0,1.08,0.65][v];
      const completionS = periodS * ratio;
      const truth = Benchmark.strictSampleToActuate({ switchingHz, completionS });
      return decorate({
        id:caseId(seed,phase,"timing",meta.familyIndex,v,index), phase, competency:"timing", answerType:"timing",
        prompt:`PWM=${switchingHz} Hz and ADC+ISR+compute completes at ${round(completionS*1e6,3)} us after ZERO. Does the new CMPA reach the first ZERO load event?`,
        expected:Object.freeze({ judgement:truth.firstLoadMet ? "met" : "missed", commitUs:round(truth.commitS*1e6,3) }),
        parameters:Object.freeze({ switchingHz, completionUs:round(completionS*1e6,3), periodUs:round(periodS*1e6,3), ratio, familyIndex:meta.familyIndex, variantIndex:v })
      }, meta);
    }
    const baseHz = [80000,100000,120000,150000][v];
    const completionUs = [8.5,7.0,6.5,5.0][v];
    const factor = [2,0.5,1.5,0.75][v];
    const changedHz = Math.round(baseHz * factor);
    const completionS = completionUs * 1e-6;
    const base = Benchmark.strictSampleToActuate({ switchingHz:baseHz, completionS });
    const changed = Benchmark.strictSampleToActuate({ switchingHz:changedHz, completionS });
    return choiceCase({ seed,phase,competency:"timing",index,meta,
      prompt:`The ADC+ISR+compute path remains ${completionUs} us. It ${base.firstLoadMet ? "meets" : "misses"} the first ZERO at ${baseHz} Hz. fsw changes to ${changedHz} Hz with no compute change. Does the first ZERO deadline now meet?`,
      choices:["met","missed"], expected:changed.firstLoadMet ? "met" : "missed",
      choiceLabels:{ met:"第一個 ZERO 趕得上", missed:"錯過第一個 ZERO" },
      rationale:"A fixed compute latency must be compared against the new switching period; software completion is not yet physical actuation.", parameters:{ baseHz, changedHz, completionUs, baseMet:base.firstLoadMet, factor } });
  }

  function dynamics(seed, phase, index) {
    const meta = familySelection(seed, phase, "dynamics", index);
    const v = meta.variantIndex;
    const factor = [2,0.5,1.5,0.75][v];
    if (meta.familyIndex === 0) {
      const probeHz = [3000,5000,8000,12000][v];
      const delayUs = [4,6,8,10][v];
      const changed = round(delayUs * factor, 3);
      return choiceCase({ seed,phase,competency:"dynamics",index,meta,
        prompt:`Probe frequency stays at ${probeHz} Hz. Pure sample-to-actuate delay changes from ${delayUs} us to ${changed} us. What happens to the delay-only phase contribution?`,
        choices:["more-negative","less-negative","same"], expected:factor > 1 ? "more-negative" : "less-negative",
        choiceLabels:{ "more-negative":"Phase 更負、lag 更多", "less-negative":"Phase 較不負、lag 較少", same:"Phase 不變" },
        rationale:"phi_delay=-360*f*Td; at fixed f, larger Td creates more negative phase.", parameters:{ probeHz, delayUs, changedDelayUs:changed, factor } });
    }
    const delayUs = [4,6,8,10][v];
    const probeHz = [3000,5000,8000,12000][v];
    const changed = Math.round(probeHz * factor);
    return choiceCase({ seed,phase,competency:"dynamics",index,meta,
      prompt:`Pure sample-to-actuate delay stays at ${delayUs} us. Probe frequency changes from ${probeHz} Hz to ${changed} Hz. What happens to the delay-only phase contribution?`,
      choices:["more-negative","less-negative","same"], expected:factor > 1 ? "more-negative" : "less-negative",
      choiceLabels:{ "more-negative":"Phase 更負、lag 更多", "less-negative":"Phase 較不負、lag 較少", same:"Phase 不變" },
      rationale:"phi_delay=-360*f*Td; at fixed Td, higher frequency creates more negative delay phase.", parameters:{ probeHz, changedProbeHz:changed, delayUs, factor } });
  }

  function safety(seed, phase, index) {
    const meta = familySelection(seed, phase, "safety", index);
    const v = meta.variantIndex;
    if (meta.familyIndex === 0) {
      const hardwareNs = [120,180,250,320][v];
      const softwareUs = [2.8,4.2,6.0,8.5][v];
      return choiceCase({ seed,phase,competency:"safety",index,meta,
        prompt:`An OCP can force PWM LOW through a ${hardwareNs} ns CMPSS/XBAR/Trip path or be noticed after a ${softwareUs} us ADC+ISR path. Which path should own the fastest physical veto?`,
        choices:["hardware-veto","software-isr","equivalent"], expected:"hardware-veto",
        choiceLabels:{ "hardware-veto":"CMPSS / Trip hardware veto", "software-isr":"ADC ISR / CPU software", equivalent:"兩條等價" },
        rationale:"A direct hardware veto must not wait for acquisition, interrupt entry or control compute.", parameters:{ hardwareNs, softwareUs } });
    }
    const dutyPct = [15,30,45,60][v];
    return choiceCase({ seed,phase,competency:"safety",index,meta,
      prompt:`Software state is RUN and the controller requests ${dutyPct}% duty, but a hardware Trip Zone latch is asserted. Which authority controls the physical PWM output now?`,
      choices:["trip-veto","software-run","controller-request"], expected:"trip-veto",
      choiceLabels:{ "trip-veto":"Trip hardware keeps PWM vetoed", "software-run":"RUN state wins", "controller-request":"Duty request wins" },
      rationale:"Software request and state do not override an independent hardware safety veto.", parameters:{ dutyPct, tripLatched:true, softwareState:"RUN" } });
  }

  function production(seed, phase, index) {
    const meta = familySelection(seed, phase, "production", index);
    const v = meta.variantIndex;
    if (meta.familyIndex === 0) {
      const timeout = [200,300,500,800][v];
      const offset = [-1,0,1,25][v];
      const age = timeout + offset;
      return choiceCase({ seed,phase,competency:"production",index,meta,
        prompt:`Assume RUN, sensing valid, no fault, peripherals ready and calibration valid. Command timeout=${timeout} ticks and external producer age=${age} ticks. What is software PWM authority?`,
        choices:["granted","denied"], expected:age > timeout ? "denied" : "granted",
        choiceLabels:{ granted:"GRANTED", denied:"DENIED / fail closed" },
        rationale:"Freshness belongs to the producer; this contract denies only when age is strictly greater than timeout.", parameters:{ timeoutTicks:timeout, commandAgeTicks:age, ageOffset:offset } });
    }
    const invalid = ["sensing","peripherals","calibration",null][v];
    const values = { run:true, fresh:true, sensing:true, noFault:true, peripherals:true, calibration:true };
    if (invalid) values[invalid] = false;
    return choiceCase({ seed,phase,competency:"production",index,meta,
      prompt:`PWM authority requires RUN ∧ FRESH ∧ SENSING_VALID ∧ NO_FAULT ∧ PERIPHERALS_READY ∧ CALIBRATION_VALID. In this snapshot ${invalid ? `${invalid.toUpperCase()} is false while every other invariant is true` : "all six invariants are true"}. What is software PWM authority?`,
      choices:["granted","denied"], expected:invalid ? "denied" : "granted",
      choiceLabels:{ granted:"GRANTED", denied:"DENIED / fail closed" },
      rationale:"Production authority is a conjunction; one false invariant removes software permission to energize PWM.", parameters:{ invalidInvariant:invalid, values } });
  }

  function evidence(seed, phase, index) {
    const meta = familySelection(seed, phase, "evidence", index);
    const v = meta.variantIndex;
    if (meta.familyIndex === 0) {
      const tiers = ["model","hil","target","board-pass"];
      const expected = tiers[v];
      const packageText = [
        "teaching-model invariants PASS, with no executable HIL or target evidence",
        "Host SIL and deterministic HIL PASS, but no TI target image exists",
        "TI target compile/link/HEX PASS, but board binding or physical closure is incomplete",
        "TI target PASS, board bindings VERIFIED, and all required physical captures PASS acceptance criteria"
      ][v];
      return choiceCase({ seed,phase,competency:"evidence",index,meta,
        prompt:`Evidence package: ${packageText}. What is the highest claim allowed?`,
        choices:["model","hil","target","board-pass"], expected,
        choiceLabels:{ model:"Teaching model only", hil:"HIL tier", target:"Target image tier", "board-pass":"BOARD_PASS for this evidence contract" },
        rationale:"Lower evidence tiers never certify a higher tier; physical closure is required for a board claim.", parameters:{ evidenceTier:expected } });
    }
    const captures = [0,2,5,7][v];
    return choiceCase({ seed,phase,competency:"evidence",index,meta,
      prompt:`Target image PASS and all board bindings are VERIFIED, but only ${captures}/8 required physical captures satisfy acceptance criteria. What evidence gap still blocks BOARD_PASS?`,
      choices:["physical-captures","more-hil","more-model","nothing"], expected:"physical-captures",
      choiceLabels:{ "physical-captures":"Complete the missing physical captures", "more-hil":"Add more HIL only", "more-model":"Add more model checks only", nothing:"Nothing; BOARD_PASS is already justified" },
      rationale:"Bindings identify what must be measured; they do not replace the missing physical evidence itself.", parameters:{ verifiedBindings:9, physicalCaptures:captures, requiredCaptures:8 } });
  }

  const GENERATORS = Object.freeze({ physics, sensing, feedback, timing, dynamics, safety, production, evidence });

  function generateBenchmarkSet({ seed = 20260821, phase = "pre", countPerCompetency = 1 } = {}) {
    if (!(phase in PHASE_INDEX)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (!Number.isInteger(countPerCompetency) || countPerCompetency < 1 || countPerCompetency > Benchmark.MAX_CASES_PER_COMPETENCY) throw new RangeError("invalid countPerCompetency");
    const cases = [];
    for (const competency of COMPETENCIES) {
      for (let index = 0; index < countPerCompetency; index += 1) cases.push(GENERATORS[competency](seed, phase, index));
    }
    const fingerprints = cases.map(Benchmark.contentFingerprint);
    if (new Set(fingerprints).size !== fingerprints.length) throw new Error(`${phase}/core8/v2 contains duplicate benchmark content`);
    return Object.freeze(cases);
  }

  return Object.freeze({ VERSION, PROFILE, COMPETENCIES, FAMILY_CATALOG, contractFingerprint, familySelection, generateBenchmarkSet });
});
