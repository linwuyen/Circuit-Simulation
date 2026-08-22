(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitTopologyTransferV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const pi = Math.PI;
  const positive = (value, name) => { const n=Number(value); if (!Number.isFinite(n) || n<=0) throw new RangeError(`${name} must be > 0`); return n; };
  const duty = value => { const d=Number(value); if (!Number.isFinite(d) || d<=0 || d>=0.95) throw new RangeError("duty must be between 0 and 0.95"); return d; };
  const frequency = value => positive(value,"frequencyHz");

  function phasor(real, imag) {
    const magnitude=Math.hypot(real,imag);
    return Object.freeze({ real, imag, magnitude, magnitudeDb:20*Math.log10(Math.max(magnitude,1e-300)), phaseDeg:Math.atan2(imag,real)*180/pi });
  }

  function divideComplex(nr,ni,dr,di) {
    const den=dr*dr+di*di;
    if (den===0) return phasor(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    return phasor((nr*dr+ni*di)/den,(ni*dr-nr*di)/den);
  }

  function boostCCM({ vin, duty: d, inductanceH, capacitanceF=null, loadOhm }) {
    const V=positive(vin,"vin"), D=duty(d), L=positive(inductanceH,"inductanceH"), R=positive(loadOhm,"loadOhm");
    const vout=V/(1-D);
    const dcGain=V/Math.pow(1-D,2);
    const rhpzRadS=R*Math.pow(1-D,2)/L;
    const rhpzHz=rhpzRadS/(2*pi);
    let resonanceHz=null, qualityFactor=null;
    if (capacitanceF!==null && capacitanceF!==undefined) {
      const C=positive(capacitanceF,"capacitanceF");
      const omega0=(1-D)/Math.sqrt(L*C);
      resonanceHz=omega0/(2*pi);
      qualityFactor=R*(1-D)*Math.sqrt(C/L);
    }
    return Object.freeze({ topology:"BOOST_CCM", vout, dcGain, rhpzHz, rhpzRadS, resonanceHz, qualityFactor, conservativeFcHz:rhpzHz/10, aggressiveCeilingHz:rhpzHz/5, nonMinimumPhase:true, controlVariable:"duty", fidelity:"EQUATION_GRADE_IDEAL_CCM" });
  }

  function boostControlToOutputAt(params, frequencyHz) {
    const f=frequency(frequencyHz), C=positive(params.capacitanceF,"capacitanceF");
    const op=boostCCM(params), D=duty(params.duty), L=positive(params.inductanceH,"inductanceH"), w=2*pi*f;
    const omega0=(1-D)/Math.sqrt(L*C), Q=op.qualityFactor;
    const nr=op.dcGain, ni=-op.dcGain*w/op.rhpzRadS;
    const dr=1-(w/omega0)*(w/omega0), di=w/(Q*omega0);
    const base=divideComplex(nr,ni,dr,di);
    const numeratorPhase=-Math.atan(w/op.rhpzRadS)*180/pi;
    const denominatorPhase=Math.atan2(di,dr)*180/pi;
    const phaseDeg=numeratorPhase-denominatorPhase;
    return Object.freeze({ ...base, phaseDeg, topology:"BOOST_CCM", frequencyHz:f, units:"V/duty", fidelity:"EQUATION_GRADE_IDEAL_CCM" });
  }

  function pfcBoost({ vrms, powerW, vbus, busCapF, lineHz, efficiency=0.97, inductanceH=null }) {
    const Vrms=positive(vrms,"vrms"), P=positive(powerW,"powerW"), Vbus=positive(vbus,"vbus"), C=positive(busCapF,"busCapF"), f=positive(lineHz,"lineHz"), eta=Number(efficiency);
    if (!Number.isFinite(eta) || eta<=0 || eta>1) throw new RangeError("efficiency must be 0..1");
    const inputCurrentRms=P/(Vrms*eta);
    const inputCurrentPeak=Math.SQRT2*inputCurrentRms;
    const doubleLineHz=2*f;
    const busRippleVpk=P/(4*pi*f*C*Vbus);
    const loadOhm=Vbus*Vbus/P;
    const outerPoleRadS=2/(loadOhm*C);
    const outerPoleHz=outerPoleRadS/(2*pi);
    const L=inductanceH===null || inductanceH===undefined ? null : positive(inductanceH,"inductanceH");
    return Object.freeze({ topology:"BOOST_PFC", inputCurrentRms, inputCurrentPeak, doubleLineHz, busRippleVpk, loadOhm, outerPoleHz, inductanceH:L, suggestedOuterLoopMaxHz:doubleLineHz/10, controlVariable:"current-reference amplitude + duty", architecture:"fast current loop / slow voltage loop", fidelity:"EQUATION_GRADE_AVERAGED_IDEAL" });
  }

  function pfcCurrentPlantAt({ vbus, inductanceH }, frequencyHz) {
    const Vbus=positive(vbus,"vbus"), L=positive(inductanceH,"inductanceH"), f=frequency(frequencyHz), w=2*pi*f;
    return Object.freeze({ ...phasor(0,-Vbus/(w*L)), topology:"BOOST_PFC_CURRENT", frequencyHz:f, units:"A/duty", fidelity:"EQUATION_GRADE_STIFF_BUS_INNER_PLANT" });
  }

  function pfcVoltagePlantAt({ vrms, powerW, vbus, busCapF, efficiency=0.97 }, frequencyHz) {
    const Vrms=positive(vrms,"vrms"), P=positive(powerW,"powerW"), Vbus=positive(vbus,"vbus"), C=positive(busCapF,"busCapF"), f=frequency(frequencyHz), eta=Number(efficiency);
    if (!Number.isFinite(eta) || eta<=0 || eta>1) throw new RangeError("efficiency must be 0..1");
    const R=Vbus*Vbus/P, pole=2/(R*C), k=eta*Vrms/(Math.SQRT2*C*Vbus), w=2*pi*f;
    return Object.freeze({ ...divideComplex(k,0,pole,w), topology:"BOOST_PFC_VOLTAGE", frequencyHz:f, units:"V/Apeak-command", poleHz:pole/(2*pi), fidelity:"EQUATION_GRADE_SLOW_ENERGY_PLANT" });
  }

  function psfb({ vin, phaseDeg, turnsRatio, leakageH, primaryCurrentA, commutationCapF, outputInductanceH=null, outputCapacitanceF=null, loadOhm=null }) {
    const V=positive(vin,"vin"), phi=Number(phaseDeg), n=positive(turnsRatio,"turnsRatio"), Llk=positive(leakageH,"leakageH"), I=Math.abs(Number(primaryCurrentA)), Ccomm=positive(commutationCapF,"commutationCapF");
    if (!Number.isFinite(phi) || phi<0 || phi>180 || !Number.isFinite(I)) throw new RangeError("invalid PSFB operating point");
    const modulation=phi/180;
    const idealSecondaryV=V*n*modulation;
    const leakageEnergyJ=0.5*Llk*I*I;
    const commutationEnergyJ=0.5*Ccomm*V*V;
    const zvsEnergyMargin=leakageEnergyJ/commutationEnergyJ;
    let outputResonanceHz=null;
    if (outputInductanceH!==null && outputCapacitanceF!==null && loadOhm!==null) {
      outputResonanceHz=1/(2*pi*Math.sqrt(positive(outputInductanceH,"outputInductanceH")*positive(outputCapacitanceF,"outputCapacitanceF")));
      positive(loadOhm,"loadOhm");
    }
    return Object.freeze({ topology:"PSFB", modulation, idealSecondaryV, leakageEnergyJ, commutationEnergyJ, zvsEnergyMargin, zvsEnergySufficient:zvsEnergyMargin>=1, outputResonanceHz, controlVariable:"bridge phase shift", fidelity:"MIXED_IDEAL_TRANSFER_AND_ZVS_ENERGY_ESTIMATE" });
  }

  function psfbControlToOutputAt(params, frequencyHz) {
    const V=positive(params.vin,"vin"), n=positive(params.turnsRatio,"turnsRatio"), L=positive(params.outputInductanceH,"outputInductanceH"), C=positive(params.outputCapacitanceF,"outputCapacitanceF"), R=positive(params.loadOhm,"loadOhm"), f=frequency(frequencyHz), w=2*pi*f;
    const gainPerDeg=n*V/180;
    const dr=1-w*w*L*C, di=w*L/R;
    return Object.freeze({ ...divideComplex(gainPerDeg,0,dr,di), topology:"PSFB_IDEAL_OUTPUT", frequencyHz:f, units:"V/degree", fidelity:"EQUATION_GRADE_IDEAL_NO_DUTY_LOSS" });
  }

  function llcFhaGain(normalizedFrequency, ln, q) {
    const fn=positive(normalizedFrequency,"normalizedFrequency"), Ln=positive(ln,"ln"), Q=positive(q,"q");
    const real=1+(1/Ln)*(1-1/(fn*fn));
    const imag=Q*(fn-1/fn);
    return 1/Math.sqrt(real*real+imag*imag);
  }

  function llcFhaSensitivity(normalizedFrequency, ln, q) {
    const fn=positive(normalizedFrequency,"normalizedFrequency"), Ln=positive(ln,"ln"), Q=positive(q,"q"), h=Math.max(1e-5,fn*1e-4);
    const lo=Math.max(1e-8,fn-h), hi=fn+h;
    const gain=llcFhaGain(fn,Ln,Q), dGainDfn=(llcFhaGain(hi,Ln,Q)-llcFhaGain(lo,Ln,Q))/(hi-lo);
    const normalizedSlope=fn*dGainDfn/gain;
    return Object.freeze({ gain, dGainDfn, normalizedSlope, units:"dln(M)/dln(fn)", fidelity:"EQUATION_GRADE_FHA_STEADY_STATE" });
  }

  function llc({ resonantInductanceH, resonantCapF, magnetizingInductanceH, q, switchingHz }) {
    const Lr=positive(resonantInductanceH,"resonantInductanceH"), Cr=positive(resonantCapF,"resonantCapF"), Lm=positive(magnetizingInductanceH,"magnetizingInductanceH"), Q=positive(q,"q"), fs=positive(switchingHz,"switchingHz");
    const resonanceHz=1/(2*pi*Math.sqrt(Lr*Cr));
    const ln=Lm/Lr;
    const normalizedFrequency=fs/resonanceHz;
    const sensitivity=llcFhaSensitivity(normalizedFrequency,ln,Q);
    const gain=sensitivity.gain;
    const gainSlopePerHz=sensitivity.dGainDfn/resonanceHz;
    const region=normalizedFrequency<0.9?"BELOW_RESONANCE":normalizedFrequency>1.1?"ABOVE_RESONANCE":"NEAR_RESONANCE";
    return Object.freeze({ topology:"LLC", resonanceHz, ln, normalizedFrequency, gain, gainSlopePerHz, normalizedGainSlope:sensitivity.normalizedSlope, region, controlVariable:"switching frequency", operatingPointDependent:true, fidelity:"EQUATION_GRADE_FHA_STEADY_STATE" });
  }

  function inverter({ mode="lcl", dcBusV, modulationIndex, l1H, capF, l2H=0, loadOhm=null }) {
    const Vdc=positive(dcBusV,"dcBusV"), m=Number(modulationIndex), L1=positive(l1H,"l1H"), C=positive(capF,"capF"), L2=Number(l2H);
    if (!Number.isFinite(m) || m<0 || m>1.15) throw new RangeError("modulationIndex out of teaching range");
    const fundamentalVrms=m*Vdc/Math.SQRT2;
    let resonanceHz;
    if (mode==="lcl") {
      if (!Number.isFinite(L2) || L2<=0) throw new RangeError("l2H must be >0 for LCL");
      resonanceHz=(1/(2*pi))*Math.sqrt((L1+L2)/(L1*L2*C));
    } else if (mode==="lc") resonanceHz=1/(2*pi*Math.sqrt(L1*C));
    else throw new RangeError("mode must be lc or lcl");
    const R=loadOhm===null || loadOhm===undefined ? null : positive(loadOhm,"loadOhm");
    return Object.freeze({ topology:"INVERTER", mode, fundamentalVrms, resonanceHz, loadOhm:R, controlVariable:"modulation/current-or-voltage command", resonanceNeedsDamping:mode==="lcl", fidelity:"EQUATION_GRADE_IDEAL_AVERAGED_FILTER" });
  }

  function inverterLcVoltageAt({ dcBusV, l1H, capF, loadOhm }, frequencyHz) {
    const Vdc=positive(dcBusV,"dcBusV"), L=positive(l1H,"l1H"), C=positive(capF,"capF"), R=positive(loadOhm,"loadOhm"), f=frequency(frequencyHz), w=2*pi*f;
    return Object.freeze({ ...divideComplex(Vdc,0,1-w*w*L*C,w*L/R), topology:"INVERTER_LC", frequencyHz:f, units:"V/modulation", fidelity:"EQUATION_GRADE_IDEAL_AVERAGED_LC" });
  }

  function inverterLclGridCurrentAt({ dcBusV, l1H, l2H, capF }, frequencyHz) {
    const Vdc=positive(dcBusV,"dcBusV"), L1=positive(l1H,"l1H"), L2=positive(l2H,"l2H"), C=positive(capF,"capF"), f=frequency(frequencyHz), w=2*pi*f;
    const denomImag=w*(L1+L2)-w*w*w*L1*L2*C;
    if (Math.abs(denomImag)<1e-18) return Object.freeze({ real:0, imag:denomImag>=0?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY, magnitude:Number.POSITIVE_INFINITY, magnitudeDb:Number.POSITIVE_INFINITY, phaseDeg:denomImag>=0?-90:90, topology:"INVERTER_LCL", frequencyHz:f, units:"A/modulation", singular:true, fidelity:"EQUATION_GRADE_IDEAL_UNDAMPED_LCL" });
    const response=phasor(0,-Vdc/denomImag);
    return Object.freeze({ ...response, topology:"INVERTER_LCL", frequencyHz:f, units:"A/modulation", singular:false, fidelity:"EQUATION_GRADE_IDEAL_UNDAMPED_LCL" });
  }

  function transferConstraint(topology, params) {
    switch (String(topology).toLowerCase()) {
      case "boost": { const x=boostCCM(params); return Object.freeze({ topology:"boost", constraint:"RHP_ZERO", valueHz:x.rhpzHz, designHint:`keep crossover well below ${x.rhpzHz.toFixed(1)} Hz` }); }
      case "pfc": { const x=pfcBoost(params); return Object.freeze({ topology:"pfc", constraint:"DOUBLE_LINE_RIPPLE", valueHz:x.doubleLineHz, designHint:`outer voltage loop must reject ${x.doubleLineHz.toFixed(1)} Hz energy ripple rather than chase it` }); }
      case "psfb": { const x=psfb(params); return Object.freeze({ topology:"psfb", constraint:"ZVS_ENERGY_MARGIN", value:x.zvsEnergyMargin, designHint:x.zvsEnergySufficient?"commutation energy condition met in this teaching estimate":"light-load ZVS margin is insufficient in this teaching estimate" }); }
      case "llc": { const x=llc(params); return Object.freeze({ topology:"llc", constraint:"OPERATING_POINT_GAIN", value:x.gain, designHint:`fn=${x.normalizedFrequency.toFixed(3)} (${x.region}); local dlnM/dlnf=${x.normalizedGainSlope.toFixed(3)}` }); }
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

  return Object.freeze({
    boostCCM, boostControlToOutputAt,
    pfcBoost, pfcCurrentPlantAt, pfcVoltagePlantAt,
    psfb, psfbControlToOutputAt,
    llcFhaGain, llcFhaSensitivity, llc,
    inverter, inverterLcVoltageAt, inverterLclGridCurrentAt,
    transferConstraint, challengeSet
  });
});
