(function(root,factory){
  const api=factory(root, typeof require==="function"?require("../engineering-sandbox-core.js"):root.CircuitEngineeringSandboxCore);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIC2000Timing=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,S){
  "use strict";
  const defaults=Object.freeze({
    periodUs:10,
    samplePct:50,
    adcLatencyUs:1.2,
    isrLatencyUs:.8,
    computeUs:1.7,
    pwmCommitUs:.3,
    shadowLoad:"ZERO"
  });
  function normalize(input={}){
    const c={...defaults,...input};
    for(const k of ["periodUs","samplePct","adcLatencyUs","isrLatencyUs","computeUs","pwmCommitUs"]){
      c[k]=Number(c[k]);if(!Number.isFinite(c[k]))throw new TypeError(k+" must be finite");
    }
    if(c.periodUs<=0||c.samplePct<0||c.samplePct>=100||c.adcLatencyUs<0||c.isrLatencyUs<0||c.computeUs<0||c.pwmCommitUs<0)throw new RangeError("invalid timing input");
    if(c.shadowLoad!=="ZERO")throw new RangeError("teaching model currently supports ZERO shadow load");
    return c;
  }
  function directTimeline(input={}){
    const c=normalize(input);
    const sampleUs=c.periodUs*c.samplePct/100;
    const adcDoneUs=sampleUs+c.adcLatencyUs;
    const isrStartUs=adcDoneUs+c.isrLatencyUs;
    const controlDoneUs=isrStartUs+c.computeUs;
    const writeDoneUs=controlDoneUs+c.pwmCommitUs;
    const eps=1e-9;
    const nextZeroUs=c.periodUs;
    const hit=writeDoneUs<nextZeroUs-eps;
    const activeUs=hit?nextZeroUs:2*c.periodUs;
    const events=[
      {name:"PWM ZERO / cycle start",tUs:0,owner:"ePWM"},
      {name:"SOCA / ADC sample",tUs:sampleUs,owner:"ePWM→ADC"},
      {name:"ADC EOC",tUs:adcDoneUs,owner:"ADC"},
      {name:"ISR start",tUs:isrStartUs,owner:"CPU/CLA"},
      {name:"controller done",tUs:controlDoneUs,owner:"controller"},
      {name:"CMPA shadow write done",tUs:writeDoneUs,owner:"software→ePWM"},
      {name:"shadow load → active CMPA",tUs:activeUs,owner:"ePWM"}
    ];
    return {
      config:c,events,hit,miss:!hit,
      writeDoneUs,activeUs,
      deadlineUs:nextZeroUs,
      marginUs:nextZeroUs-writeDoneUs,
      actuationDelayCycles:hit?1:2,
      sampleToActiveUs:activeUs-sampleUs,
      boundary:"Deterministic single-channel timing contract with ZERO shadow-load. It models commit semantics, not pin dead-band/sync propagation or measured silicon latency."
    };
  }
  function sandboxEvidence(input={}){
    if(!S||typeof S.simulateSystem!=="function")throw new Error("engineering sandbox owner required");
    const c=normalize(input);
    const r=S.simulateSystem({
      controlMode:"feedback",vin:48,inductanceUh:100,capacitanceUf:220,controlPeriodUs:c.periodUs,cycles:80,plantDtUs:.25,
      commandProfile:[{cycle:0,vref:12}],loadProfile:[{cycle:0,ohm:5}],
      kpV:.04,kiV:80,kpI:.04,kiI:400,currentLimit:20,dutyMax:.92,
      samplePct:c.samplePct,adcLatencyUs:c.adcLatencyUs,isrLatencyUs:c.isrLatencyUs,computeUs:c.computeUs,pwmCommitUs:c.pwmCommitUs,
      sensorGain:1,currentSensorGain:1,noisePct:0
    });
    const first=r.trace.find(x=>Number.isFinite(x.timingMarginUs))||r.trace[0];
    const eventNames=new Set(["PWM_ZERO","ADC_SAMPLE","CONTROL_DONE","PWM_WRITE","PWM_SHADOW_LOAD"]);
    return {
      direct:directTimeline(c),
      summary:r.summary,
      trace:r.trace.map(x=>({cycle:x.k,tUs:x.tUs,timingMarginUs:x.timingMarginUs,timingMiss:x.timingMiss,computedDuty:x.computedDuty,appliedDuty:x.appliedDuty,scheduledApplyCycle:x.scheduledApplyCycle})),
      events:r.events.filter(e=>eventNames.has(e.type)).slice(0,80),
      firstMarginUs:first?.timingMarginUs??null,
      boundary:"Cross-check from existing generic switched causal kernel; still teaching evidence, not C2000 target measurement."
    };
  }
  function sweepCompute(input={},options={}){
    const c=normalize(input),min=Number(options.minUs??.2),max=Number(options.maxUs??Math.max(c.periodUs*1.5,12)),points=Math.max(5,Math.min(200,Math.trunc(options.points??60)));
    const rows=Array.from({length:points},(_,i)=>{
      const computeUs=min+(max-min)*i/(points-1),r=directTimeline({...c,computeUs});
      return {computeUs,marginUs:r.marginUs,miss:r.miss,activeUs:r.activeUs,cycles:r.actuationDelayCycles};
    });
    return {config:c,rows,boundaryComputeUs:c.periodUs-(c.periodUs*c.samplePct/100+c.adcLatencyUs+c.isrLatencyUs+c.pwmCommitUs)};
  }
  return {defaults,normalize,directTimeline,sandboxEvidence,sweepCompute};
});
