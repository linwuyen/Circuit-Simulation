(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIC2000TimingCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const defaults=Object.freeze({
    controlPeriodUs:10,samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:1.7,pwmCommitUs:.3,
    vin:48,inductanceUh:500,capacitanceUf:220,manualDuty:.4,loadOhm:12
  });
  const API_MAP=Object.freeze([
    {stage:"PWM_ZERO",owner:"ePWM time-base / load event",api:"EPWM_setCounterCompareShadowLoadMode / TBCTR event"},
    {stage:"ADC_SOC",owner:"ePWM Event Trigger",api:"EPWM_setADCTriggerSource + EPWM_enableADCTrigger"},
    {stage:"ADC_EOC",owner:"ADC",api:"ADC_setInterruptSource / ADC result ready"},
    {stage:"ISR",owner:"PIE / CPU or CLA",api:"ADC interrupt / CLA task trigger"},
    {stage:"CONTROL_DONE",owner:"controller runtime",api:"DCL/custom controller execution"},
    {stage:"PWM_COMMIT",owner:"software compare write",api:"EPWM_setCounterCompareValue"},
    {stage:"PWM_SHADOW_LOAD",owner:"ePWM hardware commit",api:"configured CMP shadow-load event"}
  ]);

  function normalize(input={}){
    const c={...defaults,...input};
    for(const k of ["controlPeriodUs","samplePct","adcLatencyUs","isrLatencyUs","computeUs","pwmCommitUs"]){
      c[k]=Number(c[k]);if(!Number.isFinite(c[k]))throw new Error(k+" must be finite");
    }
    if(c.controlPeriodUs<=0||c.samplePct<0||c.samplePct>100||c.adcLatencyUs<0||c.isrLatencyUs<0||c.computeUs<0||c.pwmCommitUs<0)throw new Error("timing input out of range");
    return c;
  }

  function relativeEvent(event,cycleStart){
    return {...event,relativeUs:event.tUs-cycleStart};
  }

  function run(sandbox,validation,input={},sourceCycle=3){
    if(!sandbox||!validation)throw new Error("sandbox and control-validation owners required");
    const c=normalize(input);
    const window=sandbox.timingWindow(c);
    const system=sandbox.simulateSystem({
      controlPeriodUs:c.controlPeriodUs,cycles:12,plantDtUs:.25,
      vin:c.vin,inductanceUh:c.inductanceUh,capacitanceUf:c.capacitanceUf,
      loadProfile:[{cycle:0,ohm:c.loadOhm}],commandProfile:[{cycle:0,vref:c.vin*c.manualDuty}],
      controlMode:"manual",manualDuty:c.manualDuty,
      samplePct:c.samplePct,adcLatencyUs:c.adcLatencyUs,isrLatencyUs:c.isrLatencyUs,
      computeUs:c.computeUs,pwmCommitUs:c.pwmCommitUs,
      initialState:"RUN",precheckPassed:true,
      tripCurrent:1000,currentLimit:1000,currentFullScale:1000,voltageFullScale:200,
      noisePct:0,edgeNoisePct:0
    });
    const start=sourceCycle*c.controlPeriodUs;
    const sourceEvents=system.events.filter(e=>e.cycle===sourceCycle&&["PWM_ZERO","ADC_SOC","ADC_EOC","ISR","CONTROL_DONE","PWM_COMMIT","PWM_COMMIT_MISSED"].includes(e.type)).map(e=>relativeEvent(e,start));
    const trace=system.trace[sourceCycle];
    const applyCycle=trace.scheduledApplyCycle;
    const shadow=system.events.find(e=>e.type==="PWM_SHADOW_LOAD"&&e.sourceCycle===sourceCycle);
    const shadowEvent=shadow?relativeEvent(shadow,start):null;
    const expected=validation.strictCommit(c.controlPeriodUs,window.commit);
    const observedCommitUs=shadowEvent?.relativeUs??null;
    const acceptance=observedCommitUs==null?{ready:false,pass:false,reason:"shadow-load event not found"}:validation.analyzeTiming({
      periodUs:c.controlPeriodUs,
      computeDoneUs:window.commit,
      observedCommitUs,
      minSlackUs:-Infinity,
      commitToleranceUs:1e-6
    });
    const stages=[
      ...sourceEvents,
      ...(shadowEvent?[{...shadowEvent,type:"PWM_SHADOW_LOAD"}]:[])
    ].sort((a,b)=>a.relativeUs-b.relativeUs);
    return Object.freeze({
      config:c,window,sourceCycle,applyCycle,
      firstNextLoad:applyCycle===sourceCycle+1,
      extraCycleDelay:Math.max(0,applyCycle-(sourceCycle+1)),
      stages:Object.freeze(stages),
      expectedCommitUs:expected.commitUs,
      observedCommitUs,
      acceptance,
      apiMap:API_MAP,
      claim:"TEACHING_TIMING_MODEL",
      boundary:"Event sequence comes from the existing deterministic generic power kernel. API names are mapping guidance; target ePWM/ADC register configuration and board GPIO timing remain higher evidence."
    });
  }

  function sweepCompute(sandbox,validation,values=[.5,1.7,4,8,11,15]){
    return values.map(computeUs=>{
      const r=run(sandbox,validation,{computeUs});
      return {computeUs,commitUs:r.window.commit,applyCycle:r.applyCycle,extraCycleDelay:r.extraCycleDelay,firstNextLoad:r.firstNextLoad,pass:r.acceptance.pass};
    });
  }

  return {defaults,API_MAP,normalize,run,sweepCompute};
});
