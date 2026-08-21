(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitTopologyTransferV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const pi = Math.PI;
  const finite = value => Number.isFinite(Number(value));
  const positive = (value, name) => { const n=Number(value); if (!Number.isFinite(n) || n<=0) throw new RangeError(`${name} must be > 0`); return n; };
  const duty = value => { const d=Number(value); if (!Number.isFinite(d) || d<=0 || d>=0.95) throw new RangeError("duty must be between 0 and 0.95"); return d; };

  function boostCCM({ vin, duty: d, inductanceH, loadOhm }) {
    const V=positive(vin,"vin"), D=duty(d), L=positive(inductanceH,"inductanceH"), R=positive(loadOhm,"loadOhm");
    const vout=V/(1-D);
    const rhpzHz=R*Math.pow(1-D,2)/(2*pi*L);
    return Object.freeze({ topology:"BOOST_CCM", vout, rhpzHz, conservativeFcHz:rhpzHz/10, aggressiveCeilingHz:rhpzHz/5, nonMinimumPhase:true, controlVariable:"duty" });
  }

  function pfcBoost({ vrms, powerW, vbus, busCapF, lineHz, efficiency=0.97 }) {
    const Vrms=positive(vrms,"vrms"), P=positive(powerW,"powerW"), Vbus=positive(vbus,"vbus"), C=positive(busCapF,"busCapF"), f=positive(lineHz,"lineHz"), eta=Number(efficiency);
    if (!Number.isFinite(eta) || eta<=0 || eta>1) throw new RangeError("efficiency must be 0..1");
    const inputCurrentRms=P/(Vrms*eta);
    const inputCurrentPeak=Math.SQRT2*inputCurrentRms;
    const doubleLineHz=2*f;
    const busRippleVpk=P/(4*pi*f*C*Vbus);
    return Object.freeze({ topology:"BOOST_PFC", inputCurrentRms, inputCurrentPeak, doubleLineHz, busRippleVpk, suggestedOuterLoopMaxHz:doubleLineHz/10, controlVariable:"current-reference amplitude + duty", architecture:"fast current loop / slow voltage loop" });
  }

  function psfb({ vin, phaseDeg, turnsRatio, leakageH, primaryCurrentA, commutationCapF }) {
    const V=positive(vin,"vin"), phi=Number(phaseDeg), n=positive(turnsRatio,"turnsRatio"), Llk=positive(leakageH,"leakageH"), I=Math.abs(Number(primaryCurrentA)), C=positive(commutationCapF,"commutationCapF");
    if (!Number.isFinite(phi) || phi<0 || phi>180 || !Number.isFinite(I)) throw new RangeError("invalid PSFB operating point");
    const modulation=phi/180;
    const idealSecondaryV=V*n*modulation;
    const leakageEnergyJ=0.5*Llk*I*I;
    const commutationEnergyJ=0.5*C*V*V;
    const zvsEnergyMargin=leakageEnergyJ/commutationEnergyJ;
    return Object.freeze({ topology:"PSFB", modulation, idealSecondaryV, leakageEnergyJ, commutationEnergyJ, zvsEnergyMargin, zvsEnergySufficient:zvsEnergyMargin>=1, controlVariable:"bridge phase shift" });
  }

  function llcFhaGain(normalizedFrequency, ln, q) {
    const fn=positive(normalizedFrequency,"normalizedFrequency"), Ln=positive(ln,"ln"), Q=positive(q,"q");
    const real=1+(1/Ln)*(1-1/(fn*fn));
    const imag=Q*(fn-1/fn);
    return 1/Math.sqrt(real*real+imag*imag);
  }

  function llc({ resonantInductanceH, resonantCapF, magnetizingInductanceH, q, switchingHz }) {
    const Lr=positive(resonantInductanceH,"resonantInductanceH"), Cr=positive(resonantCapF,"resonantCapF"), Lm=positive(magnetizingInductanceH,"magnetizingInductanceH"), Q=positive(q,"q"), fs=positive(switchingHz,"switchingHz");
    const resonanceHz=1/(2*pi*Math.sqrt(Lr*Cr));
    const ln=Lm/Lr;
    const normalizedFrequency=fs/resonanceHz;
    const gain=llcFhaGain(normalizedFrequency,ln,Q);
    const region=normalizedFrequency<0.9?"BELOW_RESONANCE":normalizedFrequency>1.1?"ABOVE_RESONANCE":"NEAR_RESONANCE";
    return Object.freeze({ topology:"LLC", resonanceHz, ln, normalizedFrequency, gain, region, controlVariable:"switching frequency", operatingPointDependent:true });
  }

  function inverter({ mode="lcl", dcBusV, modulationIndex, l1H, capF, l2H=0 }) {
    const Vdc=positive(dcBusV,"dcBusV"), m=Number(modulationIndex), L1=positive(l1H,"l1H"), C=positive(capF,"capF"), L2=Number(l2H);
    if (!Number.isFinite(m) || m<0 || m>1.15) throw new RangeError("modulationIndex out of teaching range");
    const fundamentalVrms=m*Vdc/Math.SQRT2;
    let resonanceHz;
    if (mode==="lcl") {
      if (!Number.isFinite(L2) || L2<=0) throw new RangeError("l2H must be >0 for LCL");
      resonanceHz=(1/(2*pi))*Math.sqrt((L1+L2)/(L1*L2*C));
    } else if (mode==="lc") resonanceHz=1/(2*pi*Math.sqrt(L1*C));
    else throw new RangeError("mode must be lc or lcl");
    return Object.freeze({ topology:"INVERTER", mode, fundamentalVrms, resonanceHz, controlVariable:"modulation/current-or-voltage command", resonanceNeedsDamping:mode==="lcl" });
  }

  function transferConstraint(topology, params) {
    switch (String(topology).toLowerCase()) {
      case "boost": { const x=boostCCM(params); return Object.freeze({ topology:"boost", constraint:"RHP_ZERO", valueHz:x.rhpzHz, designHint:`keep crossover well below ${x.rhpzHz.toFixed(1)} Hz` }); }
      case "pfc": { const x=pfcBoost(params); return Object.freeze({ topology:"pfc", constraint:"DOUBLE_LINE_RIPPLE", valueHz:x.doubleLineHz, designHint:`outer voltage loop must reject ${x.doubleLineHz.toFixed(1)} Hz energy ripple rather than chase it` }); }
      case "psfb": { const x=psfb(params); return Object.freeze({ topology:"psfb", constraint:"ZVS_ENERGY_MARGIN", value:x.zvsEnergyMargin, designHint:x.zvsEnergySufficient?"commutation energy condition met in this teaching estimate":"light-load ZVS margin is insufficient in this teaching estimate" }); }
      case "llc": { const x=llc(params); return Object.freeze({ topology:"llc", constraint:"OPERATING_POINT_GAIN", value:x.gain, designHint:`fn=${x.normalizedFrequency.toFixed(3)} (${x.region}); do not reuse one plant globally` }); }
      case "inverter": { const x=inverter(params); return Object.freeze({ topology:"inverter", constraint:x.mode==="lcl"?"LCL_RESONANCE":"LC_RESONANCE", valueHz:x.resonanceHz, designHint:"place control bandwidth and damping with explicit resonance margin" }); }
      default: throw new RangeError("unknown topology");
    }
  }

  function challengeSet(seed=20260821) {
    const s=(Number(seed)>>>0)%11;
    const cases=[
      { id:`boost-${s}`, topology:"boost", prompt:"Boost duty increases at the same L/R. Which plant limit moves lower?", choices:["RHP zero","ESR zero","ADC Nyquist"], expected:"RHP zero" },
      { id:`pfc-${s}`, topology:"pfc", prompt:"PFC outer voltage loop starts correcting the 2ω bus ripple aggressively. What degrades first?", choices:["input-current shape / THD","CPU flash endurance","PWM deadtime"], expected:"input-current shape / THD" },
      { id:`psfb-${s}`, topology:"psfb", prompt:"PSFB enters light load and primary current falls. Which margin is most likely lost?", choices:["ZVS commutation energy","ADC resolution","line-frequency phase"], expected:"ZVS commutation energy" },
      { id:`llc-${s}`, topology:"llc", prompt:"LLC load/Q changes substantially. Can one small-signal plant be assumed globally?", choices:["yes","no"], expected:"no" },
      { id:`inverter-${s}`, topology:"inverter", prompt:"Grid-tied LCL inverter shows a sharp phase/magnitude feature. What should be identified before retuning PI/PR?", choices:["LCL resonance and damping","UART baud","boot ROM"], expected:"LCL resonance and damping" }
    ];
    return Object.freeze(cases.map(item=>Object.freeze(item)));
  }

  return Object.freeze({ boostCCM, pfcBoost, psfb, llcFhaGain, llc, inverter, transferConstraint, challengeSet });
});
