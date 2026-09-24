(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIControlWorkbenchCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const defaults=Object.freeze({
    plant:Object.freeze({
      vin:48,duty:.5,inductanceH:500e-6,capacitanceF:220e-6,loadOhm:12,esrOhm:.03,switchingHz:100000
    }),
    kp:.001,ki:10,sampleUs:10,delayUs:2.5,sensorGain:1,
    minHz:10,maxHz:20000,points:241
  });

  function normalize(input={}){
    const x={...defaults,...input,plant:{...defaults.plant,...(input.plant||{})}};
    for(const k of ["kp","ki","sampleUs","delayUs","sensorGain","minHz","maxHz","points"]){
      if(!Number.isFinite(Number(x[k])))throw new Error(k+" must be finite");
      x[k]=Number(x[k]);
    }
    if(x.kp<0||x.ki<0||x.sampleUs<=0||x.delayUs<0||x.sensorGain<=0||x.minHz<=0||x.maxHz<=x.minHz||x.points<20)throw new Error("control workbench input out of range");
    return x;
  }

  function controller(engine,cfg){
    const c=engine.piDiscreteCoefficients({
      kp:cfg.kp,ki:cfg.ki,samplePeriodS:cfg.sampleUs*1e-6,method:"tustin"
    });
    return {coefficients:c,at:f=>engine.discretePiAt(c,f)};
  }

  function buildOwners(engine,topology,input={}){
    if(!engine||!topology)throw new Error("control engine and topology owner required");
    const cfg=normalize(input);
    const op=topology.buckCCM(cfg.plant);
    if(!op.ccmValid)throw new Error("Buck CCM plant invalid at this operating point");
    const c=controller(engine,cfg);
    const plantAt=f=>topology.buckControlToOutputAt(cfg.plant,f);
    const openAt=f=>engine.openLoopAt({
      plantAt,
      frequencyHz:f,
      controller:c.at,
      samplePeriodS:cfg.sampleUs*1e-6,
      delayS:cfg.delayUs*1e-6,
      sensorGain:cfg.sensorGain
    });
    return {cfg,op,controller:c,plantAt,openAt};
  }

  function sweep(engine,topology,input={}){
    const o=buildOwners(engine,topology,input);
    const frequencies=engine.logspace(o.cfg.minHz,o.cfg.maxHz,o.cfg.points);
    const rows=frequencies.map(f=>{
      const plant=o.plantAt(f),ctrl=o.controller.at(f),open=o.openAt(f);
      return Object.freeze({
        frequencyHz:f,
        plantMagnitudeDb:plant.magnitudeDb,plantPhaseDeg:plant.phaseDeg,
        controllerMagnitudeDb:ctrl.magnitudeDb,controllerPhaseDeg:ctrl.phaseDeg,
        magnitudeDb:open.magnitudeDb,phaseDeg:open.phaseDeg
      });
    });
    const margins=engine.estimateMargins({responseAt:o.openAt,minHz:o.cfg.minHz,maxHz:o.cfg.maxHz,points:801});
    const zeroHz=o.cfg.kp>0?o.cfg.ki/o.cfg.kp/(2*Math.PI):null;
    const phaseDelayAtCrossover=margins.crossoverHz==null?null:-360*margins.crossoverHz*o.cfg.delayUs*1e-6;
    return Object.freeze({
      ...o,
      rows:Object.freeze(rows),
      margins,
      piZeroHz:zeroHz,
      phaseDelayAtCrossover,
      claim:"MODEL_ONLY",
      boundary:"Equation-grade averaged Buck CCM plant + discrete PI + ZOH + pure delay. It is a local small-signal model, not switching transient or hardware evidence."
    });
  }

  function designAt(engine,topology,input={},desiredCrossoverHz=500,desiredPhaseMarginDeg=60){
    const o=buildOwners(engine,topology,input);
    const f=Number(desiredCrossoverHz);
    const plant=o.plantAt(f);
    const other=engine.multiplyResponses(
      engine.zohAt(f,o.cfg.sampleUs*1e-6),
      engine.pureDelayAt(f,o.cfg.delayUs*1e-6),
      engine.phasor(o.cfg.sensorGain,0)
    );
    const design=engine.designPIAtCrossover({plantResponse:plant,frequencyHz:f,desiredPhaseMarginDeg,otherResponse:other});
    return Object.freeze({...design,plant,other,claim:"MODEL_ONLY"});
  }

  function vary(engine,topology,input={},change={}){
    const before=sweep(engine,topology,input);
    const after=sweep(engine,topology,{...input,...change,plant:{...(input.plant||{}),...(change.plant||{})}});
    return Object.freeze({before,after});
  }

  function modelMeasurements(modelRows,{extraDelayUs=0,magScale=1,phaseOffsetDeg=0}={}){
    return modelRows.filter((_,i)=>i%12===0).map(row=>({
      frequencyHz:row.frequencyHz,
      magnitudeDb:row.magnitudeDb+20*Math.log10(Math.max(1e-12,magScale)),
      phaseDeg:row.phaseDeg-360*row.frequencyHz*extraDelayUs*1e-6+phaseOffsetDeg
    }));
  }

  function correlate(engine,topology,input={},measurementOptions={},provenance=null){
    const model=sweep(engine,topology,input);
    const measurements=modelMeasurements(model.rows,measurementOptions);
    const correlation=engine.correlateBode({
      modelAt:f=>model.openAt(f),
      measurements
    });
    const claim=engine.measurementClaim({measurements,correlation,provenance});
    return Object.freeze({model,measurements,correlation,claim});
  }

  function timing(engine,input={},crossoverHz=500){
    const cfg=normalize(input);
    const periodUs=1000000/cfg.plant.switchingHz;
    const sampleOffsetS=0;
    const result=engine.timingBudget({
      sysclkHz:200e6,adclkHz:50e6,pwmHz:cfg.plant.switchingHz,
      acquisitionCycles:20,conversionCycles:14,
      computeCycles:Math.max(0,(cfg.delayUs-1)*200),
      writeCycles:20,sampleOffsetS,loadMode:"zero",crossoverHz
    });
    return Object.freeze({...result,periodUs,claim:"MODEL_ONLY_TIMING_BUDGET"});
  }

  return {defaults,normalize,controller,buildOwners,sweep,designAt,vary,modelMeasurements,correlate,timing};
});
