(function(root,factory){
  const api=factory(root,typeof require==="function"?require("../engineering-sandbox-core.js"):root.CircuitEngineeringSandboxCore);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIProtectionAuthority=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,S){
  "use strict";
  const defaults=Object.freeze({
    run:true,commandFresh:true,sensingValid:true,noFault:true,peripheralsReady:true,calibrationValid:true,
    cmpFault:false,tripEnabled:true,faultUs:4.0,tripLatencyUs:.25,isrLatencyUs:.8,computeUs:1.7,softwareShutdownUs:8.0
  });
  function normalize(input={}){
    const c={...defaults,...input};
    for(const k of ["run","commandFresh","sensingValid","noFault","peripheralsReady","calibrationValid","cmpFault","tripEnabled"])c[k]=!!c[k];
    for(const k of ["faultUs","tripLatencyUs","isrLatencyUs","computeUs","softwareShutdownUs"]){
      c[k]=Number(c[k]);if(!Number.isFinite(c[k])||c[k]<0)throw new RangeError(k+" invalid");
    }
    return c;
  }
  function evaluate(input={}){
    const c=normalize(input);
    const softwareReasons={
      run:c.run,
      commandFresh:c.commandFresh,
      sensingValid:c.sensingValid,
      noFault:c.noFault,
      peripheralsReady:c.peripheralsReady,
      calibrationValid:c.calibrationValid
    };
    const softwareGrant=Object.values(softwareReasons).every(Boolean);
    const hardwareTrip=c.tripEnabled&&c.cmpFault;
    const pwmAllowed=softwareGrant&&!hardwareTrip;
    const hardwareSafeUs=hardwareTrip?c.faultUs+c.tripLatencyUs:null;
    const softwareSafeUs=c.cmpFault?Math.max(c.softwareShutdownUs,c.faultUs+c.isrLatencyUs+c.computeUs):null;
    const owner=hardwareTrip?"HARDWARE_TRIP":softwareGrant?"SOFTWARE_GRANT":"SOFTWARE_VETO";
    const timeline=[{event:"command/state evaluated",tUs:0,owner:"software",safe:!softwareGrant}];
    if(c.cmpFault){
      timeline.push({event:"comparator fault",tUs:c.faultUs,owner:"CMPSS",safe:false});
      if(c.tripEnabled)timeline.push({event:"Trip Zone forces PWM safe",tUs:hardwareSafeUs,owner:"ePWM Trip Zone",safe:true});
      timeline.push({event:"ISR/software shutdown",tUs:softwareSafeUs,owner:"CPU/CLA",safe:true});
    }
    return {
      config:c,softwareReasons,softwareGrant,hardwareTrip,pwmAllowed,owner,
      hardwareSafeUs,softwareSafeUs,
      latencyAdvantageUs:hardwareSafeUs==null||softwareSafeUs==null?null:softwareSafeUs-hardwareSafeUs,
      timeline,
      boundary:"Authority model separates software permission from hardware veto. Numeric fault latency is a teaching parameter until measured on target hardware."
    };
  }
  function matrix(){
    const cases=[
      ["healthy",{}],
      ["stale-command",{commandFresh:false}],
      ["invalid-sensing",{sensingValid:false}],
      ["not-calibrated",{calibrationValid:false}],
      ["peripheral-not-ready",{peripheralsReady:false}],
      ["software-fault",{noFault:false}],
      ["hardware-trip",{cmpFault:true,tripEnabled:true}],
      ["trip-disabled",{cmpFault:true,tripEnabled:false}]
    ];
    return cases.map(([id,patch])=>({id,...evaluate(patch)}));
  }
  function sandboxTrip(input={}){
    if(!S||typeof S.simulateSystem!=="function")throw new Error("sandbox owner required");
    const c=normalize(input),r=S.simulateSystem({
      controlMode:"manual",manualDuty:.5,vin:48,inductanceUh:100,capacitanceUf:220,controlPeriodUs:10,cycles:80,plantDtUs:.1,
      commandProfile:[{cycle:0,vref:12}],loadProfile:[{cycle:0,ohm:1}],
      tripCurrent:1.5,tripLatencyUs:c.tripLatencyUs,initialState:"RUN",precheckPassed:true
    });
    const detect=r.events.find(e=>e.type==="TRIP_DETECT"),act=r.events.find(e=>e.type==="TRIP_ACTUATE");
    return {
      detectedAtUs:detect?.tUs??null,
      actuatedAtUs:act?.tUs??null,
      measuredTeachingLatencyUs:detect&&act?act.tUs-detect.tUs:null,
      summary:r.summary,
      boundary:"Existing generic switched teaching kernel. This cross-check is not board fault-latency evidence."
    };
  }
  return{defaults,normalize,evaluate,matrix,sandboxTrip};
});
