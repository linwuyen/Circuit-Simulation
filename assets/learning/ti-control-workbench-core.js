(function(root,factory){
  const api=factory(
    root,
    typeof require==="function"?require("./topology-transfer-v1.js"):root.CircuitTopologyTransferV1,
    typeof require==="function"?require("../engineering-sandbox-core.js"):root.CircuitEngineeringSandboxCore
  );
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIControlWorkbench=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,T,S){
  "use strict";
  const pi=Math.PI;
  const defaults=Object.freeze({
    vin:48,duty:.25,inductanceH:100e-6,capacitanceF:220e-6,loadOhm:5,esrOhm:.02,switchingHz:100e3,
    kp:.04,ki:80,delayUs:8,injectionDuty:.01,noiseDuty:.0005,
    fMin:10,fMax:30000,points:140
  });
  const logspace=(a,b,n)=>Array.from({length:n},(_,i)=>Math.pow(10,Math.log10(a)+(Math.log10(b)-Math.log10(a))*i/(n-1)));
  const db=x=>20*Math.log10(Math.max(x,1e-300));

  function normalize(input={}){
    const c={...defaults,...input};
    for(const k of ["vin","duty","inductanceH","capacitanceF","loadOhm","switchingHz","kp","ki","delayUs","injectionDuty","noiseDuty","fMin","fMax","points"]){
      if(!Number.isFinite(Number(c[k])))throw new TypeError(k+" must be finite");
      c[k]=Number(c[k]);
    }
    if(c.duty<=0||c.duty>=.95||c.kp<=0||c.ki<0||c.fMin<=0||c.fMax<=c.fMin)throw new RangeError("invalid control workbench input");
    c.points=Math.max(30,Math.min(500,Math.trunc(c.points)));
    return c;
  }
  function controllerAt(c,f){
    const w=2*pi*f,re=c.kp,im=-c.ki/w;
    return {magnitude:Math.hypot(re,im),magnitudeDb:db(Math.hypot(re,im)),phaseDeg:Math.atan2(im,re)*180/pi};
  }
  function loopResponse(input={}){
    const c=normalize(input),freq=logspace(c.fMin,c.fMax,c.points),rows=freq.map(f=>{
      const plant=T.buckControlToOutputAt(c,f),ctrl=controllerAt(c,f),delayPhaseDeg=-360*f*c.delayUs*1e-6;
      return {
        f,
        plantMagDb:plant.magnitudeDb,
        plantPhaseDeg:plant.phaseDeg,
        controllerMagDb:ctrl.magnitudeDb,
        controllerPhaseDeg:ctrl.phaseDeg,
        delayPhaseDeg,
        loopMagDb:plant.magnitudeDb+ctrl.magnitudeDb,
        loopPhaseDeg:plant.phaseDeg+ctrl.phaseDeg+delayPhaseDeg
      };
    });
    const cross=rows.reduce((best,row)=>Math.abs(row.loopMagDb)<Math.abs(best.loopMagDb)?row:best,rows[0]);
    const phaseMarginDeg=180+cross.loopPhaseDeg;
    return {
      config:c,
      rows,
      crossoverHz:cross.f,
      phaseAtCrossoverDeg:cross.loopPhaseDeg,
      phaseMarginDeg,
      piZeroHz:c.ki/(2*pi*c.kp),
      boundary:"Averaged CCM Buck plant + continuous PI frequency response + pure transport delay. Not a switched or target-timing model."
    };
  }
  function sfraMeasurement(input={}){
    const model=loopResponse(input),c=model.config,headroom=Math.min(c.duty,1-c.duty),saturated=c.injectionDuty>=headroom;
    const snr=Math.max(c.injectionDuty/Math.max(c.noiseDuty,1e-12),1e-12),snrDb=db(snr);
    const noiseWeight=Math.min(1,1/Math.max(snr,1e-6));
    const rows=model.rows.map((r,i)=>{
      const ripple=Math.sin(i*1.731+0.41);
      const hf=(i/(model.rows.length-1));
      const satMag=saturated?-3*Math.pow(hf,1.2):0,satPhase=saturated?-18*Math.pow(hf,1.3):0;
      return {
        f:r.f,
        modelMagDb:r.loopMagDb,
        measuredMagDb:r.loopMagDb+satMag+ripple*6*noiseWeight,
        modelPhaseDeg:r.loopPhaseDeg,
        measuredPhaseDeg:r.loopPhaseDeg+satPhase+ripple*25*noiseWeight
      };
    });
    return {
      config:c,rows,saturated,snrDb,headroom,
      quality:saturated?"NONLINEAR_SATURATION":snrDb<20?"LOW_SNR":"LINEAR_TEACHING_RANGE",
      boundary:"Synthetic deterministic SFRA-like evidence for injection discipline only. It is not measured hardware data."
    };
  }
  function timeResponse(input={}){
    if(!S||typeof S.simulateSystem!=="function")throw new Error("engineering sandbox owner required");
    const c=normalize(input);
    const run=S.simulateSystem({
      controlMode:"feedback",vin:c.vin,inductanceUh:c.inductanceH*1e6,capacitanceUf:c.capacitanceF*1e6,
      controlPeriodUs:10,cycles:1200,plantDtUs:.25,
      commandProfile:[{cycle:0,vref:c.vin*c.duty*.7},{cycle:300,vref:c.vin*c.duty}],
      loadProfile:[{cycle:0,ohm:c.loadOhm}],
      kpV:c.kp,kiV:c.ki,kpI:.04,kiI:400,currentLimit:20,dutyMax:.92,
      samplePct:20,adcLatencyUs:.5,isrLatencyUs:.3,computeUs:Math.min(9,Math.max(.2,c.delayUs*.4)),pwmCommitUs:.3,
      sensorGain:1,currentSensorGain:1,noisePct:0
    });
    return {
      config:c,
      rows:run.trace.map(r=>({tMs:r.tUs/1000,vout:r.vOut,iL:r.iL,duty:r.appliedDuty,error:r.consumedCommand-r.sampledV,timingMarginUs:r.timingMarginUs,saturated:r.controlSaturated})),
      summary:run.summary,
      boundary:"Existing generic switched causal teaching kernel. Not the averaged Bode model and not board evidence."
    };
  }
  return {defaults,normalize,controllerAt,loopResponse,sfraMeasurement,timeResponse};
});
