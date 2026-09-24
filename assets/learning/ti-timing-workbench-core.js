(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTITimingWorkbenchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clone=value=>JSON.parse(JSON.stringify(value));
  const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new RangeError(name+" must be finite");return n;};
  function analyze(input={},deps={}){
    const Models=deps.Models||globalThis.CircuitPowerModelsV1;
    const initial=deps.initial||globalThis.CircuitPowerSystemStateV1?.initial;
    if(!Models||!initial)throw new Error("timing workbench dependencies missing");
    const state=clone(initial);
    const sampleUs=finite(input.sampleUs??state.timing.sampleUs,"sampleUs");
    const computeUs=finite(input.computeUs??state.timing.computeUs,"computeUs");
    const fswKhz=finite(input.fswKhz??state.plant.fsw/1000,"fswKhz");
    if(!(sampleUs>=0&&computeUs>=0&&fswKhz>0))throw new RangeError("timing parameters out of range");
    state.timing.sampleUs=sampleUs;
    state.timing.computeUs=computeUs;
    state.plant.fsw=fswKhz*1000;
    const timing=Models.timingState(state);
    const cycleIndex=Math.round(timing.apply/timing.periodUs);
    const commandReadyUs=timing.write;
    const activePwmUs=timing.apply;
    const deadlineUs=Math.ceil((sampleUs+1e-12)/timing.periodUs)*timing.periodUs||timing.periodUs;
    const events=Object.freeze([
      {id:"zero",label:"ePWM ZERO",timeUs:0,cycle:0},
      {id:"soc",label:"SOCA / S&H",timeUs:timing.sampleUs,cycle:Math.floor(timing.sampleUs/timing.periodUs)},
      {id:"eoc",label:"ADC EOC",timeUs:timing.eoc,cycle:Math.floor(timing.eoc/timing.periodUs)},
      {id:"isr",label:"ISR start",timeUs:timing.isr,cycle:Math.floor(timing.isr/timing.periodUs)},
      {id:"write",label:"CMPA write / command ready",timeUs:timing.write,cycle:Math.floor(timing.write/timing.periodUs)},
      {id:"load",label:"shadow LOAD",timeUs:timing.apply,cycle:cycleIndex},
      {id:"active",label:"PWM active",timeUs:timing.apply,cycle:cycleIndex}
    ]);
    return Object.freeze({
      state:Object.freeze(state),
      timing:Object.freeze(timing),
      sampleUs,computeUs,fswKhz,
      commandReadyUs,activePwmUs,deadlineUs,cycleIndex,
      deadlineMet:!timing.missed,
      events,
      distinction:commandReadyUs===activePwmUs?"ready=active":"command ready precedes hardware activation"
    });
  }
  return Object.freeze({analyze});
});
