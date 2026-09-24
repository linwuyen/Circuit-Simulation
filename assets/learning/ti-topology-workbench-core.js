(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTITopologyWorkbenchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const PRESETS=Object.freeze({
    boost:Object.freeze({vin:48,duty:.5,inductanceH:300e-6,capacitanceF:220e-6,loadOhm:48,switchingHz:100e3,crossoverHz:1000}),
    pfc:Object.freeze({vrms:230,powerW:1500,vbus:400,busCapF:680e-6,lineHz:50,efficiency:.97,inductanceH:500e-6,outerCrossoverHz:10}),
    psfb:Object.freeze({vin:400,phaseDeg:90,turnsRatio:.1,leakageH:5e-6,primaryCurrentA:10,commutationCapF:2e-9}),
    llc:Object.freeze({resonantInductanceH:30e-6,resonantCapF:100e-9,magnetizingInductanceH:150e-6,q:.5,switchingHz:100e3}),
    inverter:Object.freeze({mode:"lcl",dcBusV:400,modulationIndex:.8,l1H:2e-3,capF:10e-6,l2H:1e-3,controlBandwidthHz:1000})
  });
  function merge(topology,input){return{...PRESETS[topology],...(input||{})};}
  function analyze(topology,input={},deps={}){
    const Transfer=deps.Transfer||globalThis.CircuitTopologyTransferV1;
    if(!Transfer)throw new Error("topology transfer model missing");
    topology=String(topology).toLowerCase();
    if(!PRESETS[topology])throw new RangeError("unknown topology");
    const p=merge(topology,input);
    let model,constraint,status,ratio=null,boundary;
    if(topology==="boost"){
      model=Transfer.boostCCM(p);constraint=Transfer.transferConstraint("boost",p);
      ratio=p.crossoverHz/model.rhpzHz;
      status=ratio<=.1?"CONSERVATIVE":ratio<=.2?"AGGRESSIVE":"RHPZ_LIMIT";
      boundary="Ideal averaged CCM Boost; RHP zero is non-minimum-phase and is not a cancellation target.";
    }else if(topology==="pfc"){
      model=Transfer.pfcBoost(p);constraint=Transfer.transferConstraint("pfc",p);
      ratio=p.outerCrossoverHz/model.doubleLineHz;
      status=p.outerCrossoverHz<=model.suggestedOuterLoopMaxHz?"SLOW_OUTER_LOOP":"CHASES_2W_RIPPLE";
      boundary="Averaged ideal PFC split into fast current loop and slow bus-energy loop; 2ω ripple is a forced disturbance, not an outer-loop pole.";
    }else if(topology==="psfb"){
      model=Transfer.psfb(p);constraint=Transfer.transferConstraint("psfb",p);
      ratio=model.zvsEnergyMargin;
      status=model.zvsEnergySufficient?"ZVS_MARGIN_PRESENT":"ZVS_MARGIN_LOST";
      boundary="ZVS result is an energy sufficiency estimate only; device capacitance, dead-time and parasitics still require hardware validation.";
    }else if(topology==="llc"){
      model=Transfer.llc(p);constraint=Transfer.transferConstraint("llc",p);
      ratio=model.normalizedFrequency;
      status=model.region;
      boundary="FHA steady-state gain/sensitivity only; it does not claim dynamic loop phase, settling or switching-waveform detail.";
    }else{
      model=Transfer.inverter(p);constraint=Transfer.transferConstraint("inverter",p);
      ratio=p.controlBandwidthHz/model.resonanceHz;
      status=ratio<.25?"RESONANCE_MARGIN":ratio<.5?"CLOSE_TO_RESONANCE":"RESONANCE_RISK";
      boundary="Ideal averaged LC/LCL filter model; real damping, grid impedance and sampling/control delay must be identified before controller claims.";
    }
    return Object.freeze({topology,params:Object.freeze(p),model,constraint,status,ratio,boundary});
  }
  function transferVector(deps={}){
    return Object.freeze(Object.keys(PRESETS).map(topology=>analyze(topology,{},deps)));
  }
  return Object.freeze({PRESETS,analyze,transferVector});
});
