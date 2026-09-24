(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.CircuitTILearningCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DAY=86400000;
  const policy={
    fail:{mastery:.2,days:1},
    partial:{mastery:.5,days:3},
    pass:{mastery:.8,days:7},
    transfer:{mastery:1,days:30}
  };
  const lesson={
    id:"buck-energy-flow",
    sourceId:"SLVA057",
    title:"Buck energy flow and current slope",
    predictionChoices:[
      ["time-first","ON 時間先變長；Vout 尚未改變時，ON/OFF 的 vL 與 di/dt 一開始近似不變，但正斜率作用更久，所以 iL 淨上升"],
      ["slope-first","Duty 一增加，ON 與 OFF 的 di/dt 立刻一起變陡"],
      ["jump","Duty 一增加，電感電流會瞬間跳到更高值"]
    ],
    predictionExpected:"time-first",
    observationChoices:[
      ["net-rise","ON/OFF 斜率近似相同，但 ON 區段變長；第一個週期結束時 iL 比起點高"],
      ["jump","iL 在切換瞬間出現垂直跳變"],
      ["same-cycle","Duty 變了，但第一個週期的 iL 軌跡完全不變"]
    ],
    observationExpected:"net-rise",
    reasonChoices:[
      ["volt-second","電感電流不能瞬間跳變；Vout 尚未建立新值時，vL=L·di/dt 的斜率主要由既有 Vin/Vout 決定。Duty 增加先改變正、負 vL 各自作用的時間，造成暫時的伏秒不平衡"],
      ["vin-change","Duty 會直接把輸入電壓 Vin 提高，所以電流上升"],
      ["controller-jump","PWM register 改變會直接把能量寫進電感，因此 iL 可以跳變"]
    ],
    reasonExpected:"volt-second"
  };

  function isoDayLocal(date=new Date()){
    const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  function addDays(day,days){
    const d=new Date(day+"T12:00:00");
    d.setDate(d.getDate()+days);
    return isoDayLocal(d);
  }
  function cycleRows({startI,periodUs,duty,onSlopeAUs,offSlopeAUs,points=256}){
    const onUs=periodUs*duty;
    const atTurnOff=startI+onSlopeAUs*onUs;
    return Array.from({length:points+1},(_,i)=>{
      const tUs=periodUs*i/points;
      const iL=tUs<=onUs?startI+onSlopeAUs*tUs:atTurnOff+offSlopeAUs*(tUs-onUs);
      return {tUs,iL,on:tUs<=onUs};
    });
  }
  function buildFirstCycle(buck,input={},dutyAfter=.5){
    if(typeof buck!=="function") throw new Error("buck model function required");
    const config={
      vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0,
      ...input
    };
    const steady=buck(config);
    if(steady.regime!=="CCM") throw new Error("TI Buck first-cycle lesson requires CCM baseline");
    if(!(dutyAfter>0&&dutyAfter<1)) throw new Error("dutyAfter must be within 0..1");
    const L=config.inductanceUh*1e-6;
    const vout0=steady.vout;
    const onSlopeAUs=(config.vin-vout0)/L/1e6;
    const offSlopeAUs=(-vout0)/L/1e6;
    const common={startI:steady.minI,periodUs:steady.periodUs,onSlopeAUs,offSlopeAUs};
    const beforeRows=cycleRows({...common,duty:config.duty});
    const afterRows=cycleRows({...common,duty:dutyAfter});
    const summarize=(rows,duty)=>({
      duty,
      rows,
      onSlopeAUs,
      offSlopeAUs,
      endI:rows.at(-1).iL,
      deltaI:rows.at(-1).iL-rows[0].iL,
      onUs:steady.periodUs*duty,
      offUs:steady.periodUs*(1-duty)
    });
    return {
      config:{...config,dutyAfter},
      vout0,
      startI:steady.minI,
      avgI0:steady.avgI,
      periodUs:steady.periodUs,
      before:summarize(beforeRows,config.duty),
      after:summarize(afterRows,dutyAfter),
      boundary:"第一個 PWM 週期近似：Vin 固定、Vout 尚未改變、理想 CCM Buck；用於觀察 duty 改變後最先發生的因果，不代表新穩態。"
    };
  }
  function buildBuckPhysics(buck,input={}){
    if(typeof buck!=="function") throw new Error("buck model function required");
    const config={
      vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0,
      ...input
    };
    const m=buck(config);
    const L=config.inductanceUh*1e-6, f=config.fswKhz*1000, T=1/f;
    const onV=config.vin-m.vout, offV=-m.vout;
    const onSlopeAUs=onV/L/1e6, offSlopeAUs=offV/L/1e6;
    const energyMin=.5*L*m.minI*m.minI, energyPeak=.5*L*m.peakI*m.peakI;
    const capCurrentRows=m.rows.map(r=>({tUs:r.tUs,iC:r.iL-m.avgI,vout:r.vout}));
    return {
      config:m.config,
      regime:m.regime,
      vout:m.vout,
      avgI:m.avgI,
      minI:m.minI,
      peakI:m.peakI,
      ripple:m.ripple,
      vRipple:m.vRipple,
      periodUs:m.periodUs,
      boundaryOhm:m.boundaryOhm,
      zeroFraction:m.zeroFraction,
      validSmallRipple:m.validSmallRipple,
      on:{vL:onV,slopeAUs:onSlopeAUs,durationUs:T*config.duty*1e6},
      off:{vL:offV,slopeAUs:offSlopeAUs,durationUs:T*(1-config.duty)*1e6},
      energy:{minJ:energyMin,peakJ:energyPeak,deltaJ:energyPeak-energyMin},
      rows:m.rows,
      capCurrentRows,
      boundary:m.boundary
    };
  }
  function compareBuckParameter(buck,baseInput,key,nextValue){
    const before=buildBuckPhysics(buck,baseInput);
    const after=buildBuckPhysics(buck,{...baseInput,[key]:nextValue});
    const ratio=(a,b)=>Math.abs(b)<1e-15?null:a/b;
    return {
      key,
      before,
      after,
      ratios:{
        ripple:ratio(after.ripple,before.ripple),
        vRipple:ratio(after.vRipple,before.vRipple),
        avgI:ratio(after.avgI,before.avgI)
      },
      changedRegime:before.regime!==after.regime
    };
  }
  function gradeResult({predictionCorrect=false,observationFirstCorrect=false,reasonFirstCorrect=false,reasonPassed=false,transferPassed=false}={}){
    if(transferPassed) return "transfer";
    if(!reasonPassed) return "fail";
    return predictionCorrect&&observationFirstCorrect&&reasonFirstCorrect?"pass":"partial";
  }
  function nextReview(result,day=isoDayLocal()){
    const p=policy[result];
    if(!p) throw new Error("unknown result: "+result);
    return addDays(day,p.days);
  }
  function applyResult(previous={},result,day=isoDayLocal(),details={}){
    const p=policy[result];
    if(!p) throw new Error("unknown result: "+result);
    const history=[...(previous.history||[]),{date:day,result,mastery:p.mastery,...details}].slice(-20);
    return {
      ...previous,
      attempts:Number(previous.attempts||0)+1,
      mastery:p.mastery,
      lastResult:result,
      lastReviewed:day,
      nextReview:nextReview(result,day),
      history,
      completedAt:new Date().toISOString(),
      progress:4
    };
  }
  return {lesson,policy,isoDayLocal,addDays,buildFirstCycle,buildBuckPhysics,compareBuckParameter,gradeResult,nextReview,applyResult};
});
