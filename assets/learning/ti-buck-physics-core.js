(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIBuckPhysics=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const defaults=Object.freeze({
    vin:48,
    duty:.25,
    inductanceUh:100,
    capacitanceUf:220,
    loadOhm:5,
    fswKhz:100,
    esrOhm:0
  });

  const clone=value=>JSON.parse(JSON.stringify(value));

  function finite(name,value,lo,hi){
    const n=Number(value);
    if(!Number.isFinite(n)||n<lo||n>hi)throw new RangeError(name+" outside "+lo+".."+hi);
    return n;
  }

  function normalize(input={}){
    return {
      vin:finite("vin",input.vin??defaults.vin,1,200),
      duty:finite("duty",input.duty??defaults.duty,.02,.95),
      inductanceUh:finite("inductanceUh",input.inductanceUh??defaults.inductanceUh,5,10000),
      capacitanceUf:finite("capacitanceUf",input.capacitanceUf??defaults.capacitanceUf,1,20000),
      loadOhm:finite("loadOhm",input.loadOhm??defaults.loadOhm,.1,5000),
      fswKhz:finite("fswKhz",input.fswKhz??defaults.fswKhz,1,2000),
      esrOhm:finite("esrOhm",input.esrOhm??defaults.esrOhm,0,5)
    };
  }

  function boundaryOhm(input={}){
    const c=normalize(input);
    const L=c.inductanceUh*1e-6;
    const f=c.fswKhz*1000;
    return 2*L*f/(1-c.duty);
  }

  function firstOrderFromOperatingPoint(input={},vout){
    const c=normalize(input);
    const L=c.inductanceUh*1e-6;
    const v=Number(vout);
    if(!Number.isFinite(v))throw new TypeError("vout must be finite");
    const onVL=c.vin-v;
    const offVL=-v;
    return {
      onVL,
      offVL,
      onSlopeAUs:onVL/L/1e6,
      offSlopeAUs:offVL/L/1e6,
      tonUs:c.duty/(c.fswKhz*1000)*1e6,
      toffUs:(1-c.duty)/(c.fswKhz*1000)*1e6,
      periodUs:1/(c.fswKhz*1000)*1e6
    };
  }

  function steadySnapshot(buck,input={}){
    if(typeof buck!=="function")throw new TypeError("buck model function required");
    const c=normalize(input);
    const result=buck(c);
    const firstOrder=firstOrderFromOperatingPoint(c,result.vout);
    return {
      config:c,
      regime:result.regime,
      vout:result.vout,
      avgI:result.avgI,
      minI:result.minI,
      peakI:result.peakI,
      ripple:result.ripple,
      zeroFraction:result.zeroFraction,
      boundaryOhm:result.boundaryOhm,
      firstOrder,
      modelBoundary:result.boundary
    };
  }

  function simulateTransient(input={},options={}){
    const c=normalize(input);
    const L=c.inductanceUh*1e-6;
    const C=c.capacitanceUf*1e-6;
    const R=c.loadOhm;
    const f=c.fswKhz*1000;
    const period=1/f;
    const stepsPerCycle=Math.max(20,Math.min(400,Math.trunc(options.stepsPerCycle??80)));
    const cycles=Math.max(1,Math.min(20000,Math.trunc(options.cycles??600)));
    const maxPoints=Math.max(100,Math.min(5000,Math.trunc(options.maxPoints??1200)));
    const dt=period/stepsPerCycle;
    const totalSteps=stepsPerCycle*cycles;
    const captureStride=Math.max(1,Math.floor(totalSteps/maxPoints));
    let iL=Math.max(0,Number(options.initialIL??0));
    let vC=Math.max(0,Number(options.initialVout??0));
    const rows=[];
    const tailI=[];
    const tailV=[];
    let peakV=vC;

    for(let step=0;step<=totalSteps;step++){
      const phase=(step%stepsPerCycle)/stepsPerCycle;
      const on=phase<c.duty;
      const diodeConducting=!on&&iL>1e-12;
      const vL=on?c.vin-vC:diodeConducting?-vC:0;

      if(step%captureStride===0||step===totalSteps){
        rows.push({
          tMs:step*dt*1000,
          iL,
          vout:vC,
          on,
          diodeConducting,
          vL
        });
      }
      if(step>=totalSteps-stepsPerCycle){
        tailI.push(iL);
        tailV.push(vC);
      }
      if(step===totalSteps)break;

      const di=vL/L;
      const dv=(iL-vC/R)/C;

      // Semi-implicit Euler: current responds to the present switch state,
      // capacitor then integrates the updated inductor current.
      let nextI=iL+di*dt;
      if(!on&&nextI<0)nextI=0;
      const nextV=Math.max(0,vC+((nextI-vC/R)/C)*dt);
      iL=nextI;
      vC=nextV;
      if(vC>peakV)peakV=vC;
    }

    const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
    const finalAvgV=mean(tailV);
    const finalAvgI=mean(tailI);
    const finalMinI=Math.min(...tailI);
    const zeroSamples=tailI.filter(x=>x<=1e-6).length;
    const observedRegime=zeroSamples===0?"CCM":zeroSamples>=tailI.length-1?"DCM":"DCM";

    return {
      version:1,
      config:c,
      solver:{
        type:"ideal-switched-buck-semi-implicit-euler",
        dtUs:dt*1e6,
        stepsPerCycle,
        cycles,
        durationMs:totalSteps*dt*1000
      },
      rows,
      final:{
        avgVout:finalAvgV,
        avgIL:finalAvgI,
        minIL:finalMinI,
        zeroFraction:tailI.length?zeroSamples/tailI.length:0,
        regime:observedRegime,
        peakVout:peakV
      },
      boundaryOhm:boundaryOhm(c),
      boundary:"Ideal switch/diode, resistive load, lumped L/C, no ESR unless separately visualized, no switching loss, no saturation, no controller. Intended for causal learning, not device stress design."
    };
  }

  function loadSweep(buck,input={},options={}){
    if(typeof buck!=="function")throw new TypeError("buck model function required");
    const c=normalize(input);
    const min=finite("minLoadOhm",options.minLoadOhm??Math.max(.2,c.loadOhm/4),.1,5000);
    const max=finite("maxLoadOhm",options.maxLoadOhm??Math.min(5000,c.loadOhm*20),min,5000);
    const points=Math.max(3,Math.min(200,Math.trunc(options.points??25)));
    const rows=[];
    for(let i=0;i<points;i++){
      const mix=i/(points-1);
      const load=min*Math.pow(max/min,mix);
      const r=buck({...c,loadOhm:load});
      rows.push({
        loadOhm:load,
        regime:r.regime,
        vout:r.vout,
        avgI:r.avgI,
        minI:r.minI,
        peakI:r.peakI,
        zeroFraction:r.zeroFraction
      });
    }
    return {config:c,boundaryOhm:boundaryOhm(c),rows};
  }

  return {
    defaults,
    normalize,
    boundaryOhm,
    firstOrderFromOperatingPoint,
    steadySnapshot,
    simulateTransient,
    loadSweep,
    clone
  };
});
