(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIBuckPhysicsCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const defaults=Object.freeze({
    vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0
  });

  const scenarios=Object.freeze([
    {id:"duty",label:"Duty",key:"duty",unit:"%",before:.25,after:.5,display:v=>Math.round(v*100),metric:"vout",expected:"up",prediction:"Duty 增加，穩態 Vout 與平均電流往哪裡走？",equation:"CCM: Vout ≈ D·Vin; vL = L·di/dt",transfer:"換成 Vin=36 V、R=4 Ω，Duty 仍從 25%→50%，主要方向是否一樣？",transferBase:{vin:36,loadOhm:4}},
    {id:"vin",label:"Vin",key:"vin",unit:"V",before:36,after:48,metric:"vout",expected:"up",prediction:"Duty 不變，Vin 增加時 Vout 與 ON-state vL 怎麼變？",equation:"CCM: Vout ≈ D·Vin; vL,on = Vin−Vout",transfer:"換成 Duty=40%，Vin 36→48 V，Vout 主要方向？",transferBase:{duty:.4}},
    {id:"inductance",label:"L",key:"inductanceUh",unit:"µH",before:100,after:200,metric:"ripple",expected:"down",prediction:"L 加倍時，同樣 switching 條件下 ΔIL 怎麼變？",equation:"ΔIL = (Vin−Vout)·D / (L·fsw)",transfer:"換成 Duty=40%、R=4 Ω，L 加倍時 ΔIL 方向？",transferBase:{duty:.4,loadOhm:4}},
    {id:"frequency",label:"fsw",key:"fswKhz",unit:"kHz",before:100,after:200,metric:"ripple",expected:"down",prediction:"fsw 加倍時，每輪斜率作用時間怎麼改？",equation:"ΔIL ∝ 1/fsw when Vin,Vout,D,L are fixed",transfer:"換成 Vin=36 V，fsw 仍加倍，ΔIL 方向？",transferBase:{vin:36}},
    {id:"load",label:"Rload",key:"loadOhm",unit:"Ω",before:5,after:50,metric:"regime",expected:"boundary",prediction:"負載變輕時，iL valley 會不會碰到 0？",equation:"K = 2·L·fsw/R; boundary K = 1−D",transfer:"換成 Duty=40%，R 5→50 Ω，是否仍可能跨 CCM/DCM boundary？",transferBase:{duty:.4}},
    {id:"capacitance",label:"C",key:"capacitanceUf",unit:"µF",before:100,after:470,metric:"vRipple",expected:"down",prediction:"C 增加後，在同一穩態工作點下輸出 ripple 怎麼變？",equation:"ΔV_C = (1/C)·∫iC dt",transfer:"換成 Duty=40%，C 增加時 capacitor ripple 方向？",transferBase:{duty:.4}},
    {id:"esr",label:"ESR",key:"esrOhm",unit:"Ω",before:0,after:.1,metric:"vRipple",expected:"up",prediction:"ESR 增加會如何改變輸出 ripple？",equation:"ΔV_ESR ≈ ESR·ΔIL",transfer:"換成 L=200 µH，ESR 增加時輸出 ripple 的 ESR 分量方向？",transferBase:{inductanceUh:200}}
  ]);

  function scenario(id){
    const s=scenarios.find(x=>x.id===id);
    if(!s)throw new Error("unknown Buck physics scenario: "+id);
    return s;
  }

  function configFor(id,which="before",base={}){
    const s=scenario(id);
    const value=which==="after"?s.after:s.before;
    return {...defaults,...base,[s.key]:value};
  }

  function derive(model){
    const c=model.config;
    const L=c.inductanceUh*1e-6;
    const vLOn=c.vin-model.vout;
    const vLOff=-model.vout;
    const onSlopeAUs=vLOn/L/1e6;
    const offSlopeAUs=vLOff/L/1e6;
    const rows=model.rows.map(row=>({
      ...row,
      iC:row.iL-row.vout/c.loadOhm
    }));
    const energyAvg=.5*L*model.avgI*model.avgI;
    return {
      vLOn,vLOff,onSlopeAUs,offSlopeAUs,energyAvgJ:energyAvg,
      rows,
      boundary:model.boundary,
      claim:"STEADY_MODEL",
      valid:model.validSmallRipple!==false
    };
  }

  function evaluate(buck,input={}){
    if(typeof buck!=="function")throw new Error("Buck steady model required");
    const model=buck({...defaults,...input});
    return {model,derived:derive(model)};
  }

  function compare(buck,id,base={}){
    const s=scenario(id);
    const before=evaluate(buck,configFor(id,"before",base));
    const after=evaluate(buck,configFor(id,"after",base));
    const scalar=k=>({
      before:before.model[k],
      after:after.model[k],
      delta:after.model[k]-before.model[k]
    });
    return {
      scenario:s,
      before,after,
      metrics:{
        vout:scalar("vout"),
        avgI:scalar("avgI"),
        ripple:scalar("ripple"),
        vRipple:scalar("vRipple")
      },
      regime:{before:before.model.regime,after:after.model.regime,changed:before.model.regime!==after.model.regime},
      valid:before.derived.valid&&after.derived.valid,
      boundary:"固定 duty 的理想二極體 Buck 穩態近似；不是啟動/閉環暫態，也不包含磁飽和、熱與 switching loss。"
    };
  }

  function transferCompare(buck,id){
    const s=scenario(id);
    return compare(buck,id,s.transferBase||{});
  }

  function regimeSweep(buck,input={},loads=[2,5,10,20,50,100]){
    return loads.map(loadOhm=>{
      const x=evaluate(buck,{...input,loadOhm});
      return {
        loadOhm,
        regime:x.model.regime,
        avgI:x.model.avgI,
        minI:x.model.minI,
        peakI:x.model.peakI,
        boundaryOhm:x.model.boundaryOhm,
        vout:x.model.vout
      };
    });
  }

  function transientConfig(input={},cycles=500){
    const c={...defaults,...input};
    const periodUs=1000/c.fswKhz;
    return {
      vin:c.vin,
      inductanceUh:c.inductanceUh,
      capacitanceUf:c.capacitanceUf,
      controlPeriodUs:periodUs,
      plantDtUs:Math.max(.05,Math.min(.25,periodUs/40)),
      cycles,
      controlMode:"manual",
      manualDuty:c.duty,
      loadProfile:[{cycle:0,ohm:c.loadOhm}],
      commandProfile:[{cycle:0,vref:c.duty*c.vin}],
      initialState:"RUN",
      precheckPassed:true,
      sensorGain:1,
      currentSensorGain:1,
      noisePct:0,
      edgeNoisePct:0,
      tripCurrent:1000,
      currentLimit:1000,
      currentFullScale:1000,
      voltageFullScale:Math.max(100,c.vin*2),
      detailCycle:Math.max(0,cycles-1)
    };
  }

  function runTransient(simulate,input={},cycles=500){
    if(typeof simulate!=="function")throw new Error("generic power transient kernel required");
    const config=transientConfig(input,cycles);
    const result=simulate(config);
    return {
      config,
      trace:result.trace,
      events:result.events,
      waveform:result.waveform||[],
      summary:result.summary||null,
      claim:"TEACHING_SURROGATE",
      boundary:"Finite-step generic L/C teaching kernel. It demonstrates startup/transient direction only; it is not the buck-steady-v1 operating-point model, target firmware, or board evidence."
    };
  }

  return {defaults,scenarios,scenario,configFor,derive,evaluate,compare,transferCompare,regimeSweep,transientConfig,runTransient};
});
