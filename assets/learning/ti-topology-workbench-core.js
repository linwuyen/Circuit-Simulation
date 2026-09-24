(function(root,factory){
  const api=factory(typeof require==="function"?require("./topology-transfer-v1.js"):root.CircuitTopologyTransferV1);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTITopologyWorkbench=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(T){
  "use strict";
  const scenarios={
    boost:{
      label:"Boost CCM",constraint:"RHP zero",control:"Duty",
      defaults:{vin:48,duty:.5,inductanceH:200e-6,capacitanceF:470e-6,loadOhm:20,switchingHz:100e3},
      sweep:{key:"duty",min:.2,max:.8},
      evaluate:p=>{const x=T.boostCCM(p);return{metrics:{Vout:x.vout,RHPZ_Hz:x.rhpzHz,fc_conservative_Hz:x.conservativeFcHz,CCM:x.ccmValid},primary:x.rhpzHz,boundary:"CCM Boost averaged model; RHPZ constraint invalid when CCM assumption fails."};}
    },
    pfc:{
      label:"Boost PFC",constraint:"Double-line energy + loop hierarchy",control:"Current-reference amplitude + Duty",
      defaults:{vrms:230,powerW:1500,vbus:400,busCapF:900e-6,lineHz:50,efficiency:.97,inductanceH:500e-6},
      sweep:{key:"powerW",min:300,max:3000},
      evaluate:p=>{const x=T.pfcBoost(p);return{metrics:{Iin_rms_A:x.inputCurrentRms,twiceLine_Hz:x.doubleLineHz,busRipple_Vpk:x.busRippleVpk,outerMax_Hz:x.suggestedOuterLoopMaxHz},primary:x.busRippleVpk,boundary:"Averaged PFC energy model; inner/outer-loop hierarchy, not switching THD prediction."};}
    },
    psfb:{
      label:"PSFB",constraint:"ZVS commutation energy",control:"Phase shift",
      defaults:{vin:400,phaseDeg:90,turnsRatio:.08,leakageH:8e-6,primaryCurrentA:10,commutationCapF:1e-9,outputInductanceH:100e-6,outputCapacitanceF:480e-6,loadOhm:4},
      sweep:{key:"primaryCurrentA",min:.5,max:15},
      evaluate:p=>{const x=T.psfb(p);return{metrics:{idealSecondary_V:x.idealSecondaryV,leakage_uJ:x.leakageEnergyJ*1e6,commutation_uJ:x.commutationEnergyJ*1e6,ZVS_margin:x.zvsEnergyMargin,ZVS_sufficient:x.zvsEnergySufficient},primary:x.zvsEnergyMargin,boundary:"ZVS energy sufficiency estimate; actual switching transition must be measured."};}
    },
    llc:{
      label:"LLC",constraint:"fn / Ln / Q operating point",control:"Switching frequency",
      defaults:{resonantInductanceH:20e-6,resonantCapF:100e-9,magnetizingInductanceH:120e-6,q:.5,switchingHz:120e3},
      sweep:{key:"switchingHz",min:60e3,max:300e3},
      evaluate:p=>{const x=T.llc(p);return{metrics:{resonance_Hz:x.resonanceHz,fn:x.normalizedFrequency,Ln:x.ln,gain:x.gain,region:x.region,normalizedSlope:x.normalizedGainSlope},primary:x.gain,boundary:"FHA steady-state model; not startup, nonlinear switching or closed-loop qualification."};}
    },
    inverter:{
      label:"Inverter LCL",constraint:"LCL resonance + damping",control:"Modulation / current command",
      defaults:{mode:"lcl",dcBusV:400,modulationIndex:.8,l1H:2e-3,capF:10e-6,l2H:1e-3,loadOhm:20},
      sweep:{key:"capF",min:2e-6,max:50e-6},
      evaluate:p=>{const x=T.inverter(p);return{metrics:{fundamental_Vrms:x.fundamentalVrms,resonance_Hz:x.resonanceHz,needsDamping:x.resonanceNeedsDamping},primary:x.resonanceHz,boundary:"Ideal undamped filter resonance model; grid impedance and damping are not included."};}
    }
  };
  function get(id){return scenarios[id]||null;}
  function evaluate(id,input={}){const s=get(id);if(!s)throw new Error("unknown topology: "+id);return s.evaluate({...s.defaults,...input});}
  function sweep(id,points=80){
    const s=get(id);if(!s)throw new Error("unknown topology: "+id);
    const n=Math.max(10,Math.min(300,Math.trunc(points))),rows=[];
    for(let i=0;i<n;i++){
      const v=s.sweep.min+(s.sweep.max-s.sweep.min)*i/(n-1),input={...s.defaults,[s.sweep.key]:v},r=s.evaluate(input);
      rows.push({x:v,y:r.primary,metrics:r.metrics});
    }
    return {id,key:s.sweep.key,rows,boundary:s.evaluate(s.defaults).boundary};
  }
  function compare(){
    return Object.entries(scenarios).map(([id,s])=>{const r=s.evaluate(s.defaults);return{id,label:s.label,constraint:s.constraint,control:s.control,metrics:r.metrics,boundary:r.boundary};});
  }
  return{scenarios,get,evaluate,sweep,compare};
});
