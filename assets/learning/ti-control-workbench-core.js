(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIControlWorkbenchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clone=value=>JSON.parse(JSON.stringify(value));
  const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new RangeError(name+" must be finite");return n;};
  function analyze(input={},deps={}){
    const Models=deps.Models||globalThis.CircuitPowerModelsV1;
    const Control=deps.Control||globalThis.CircuitControlEngineeringV1;
    const initial=deps.initial||globalThis.CircuitPowerSystemStateV1?.initial;
    if(!Models||!Control||!initial)throw new Error("control workbench dependencies missing");
    const state=clone(initial);
    const p={
      vref:finite(input.vref??state.control.vref,"vref"),
      kp:finite(input.kp??state.control.kp,"kp"),
      ki:finite(input.ki??state.control.ki,"ki"),
      computeUs:finite(input.computeUs??state.timing.computeUs,"computeUs"),
      dutyMax:finite(input.dutyMax??state.limits.dutyMax,"dutyMax"),
      antiWindup:input.antiWindup!==false
    };
    if(!(p.kp>=0&&p.ki>=0&&p.computeUs>=0&&p.dutyMax>state.limits.dutyMin&&p.dutyMax<=.98))throw new RangeError("control parameters out of range");
    state.control.vref=p.vref;
    state.control.kp=p.kp;
    state.control.ki=p.ki;
    state.control.antiWindup=p.antiWindup;
    state.timing.computeUs=p.computeUs;
    state.limits.dutyMax=p.dutyMax;

    const timing=Models.timingState(state);
    const transient=Models.simulatePi(state);
    const loop=Models.analyzeLoop(state,timing.actuation);
    const samplePeriodS=1/state.plant.fsw;
    const pi=Control.piDiscreteCoefficients({kp:p.kp,ki:p.ki,samplePeriodS,method:"tustin"});
    const zeroHz=p.kp>0?p.ki/(2*Math.PI*p.kp):null;
    const modelAt=frequencyHz=>{
      const row=Models.buckLoopPoint(frequencyHz,timing.actuation,state);
      return {magnitudeDb:row.magDb,phaseDeg:row.phase};
    };
    const measurements=Array.isArray(input.measurements)?input.measurements:[];
    const correlation=measurements.length?Control.correlateBode({modelAt,measurements}):null;
    const sfra=Control.measurementClaim({measurements,correlation});
    const single=loop.status==="SINGLE"?loop.crossings[0]:null;
    return Object.freeze({
      params:Object.freeze(p),
      state:Object.freeze(state),
      timing:Object.freeze(timing),
      transient:Object.freeze(transient),
      loop:Object.freeze(loop),
      pi,
      piZeroHz:zeroHz,
      crossoverHz:single?single.freq:null,
      phaseMarginDeg:single?single.phaseMargin:null,
      sfra,
      correlation
    });
  }
  return Object.freeze({analyze});
});
