(function(root){
  "use strict";
  const Assessment=root.CircuitAssessment,Quiz=root.CircuitQuizBank,Bindings=root.CircuitCompetencyBindings;
  if(!Assessment||!Quiz)throw new Error("OP AMP assessment requires CircuitAssessment + CircuitQuizBank");
  if(Assessment.__opampSlewInstalled)return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const hash=value=>{let h=2166136261>>>0;for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const rngFrom=seed=>{let a=Number(seed)>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
  const shuffled=(list,rng)=>{const out=clone(list);for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const opt=(id,text,correct,misconception,feedback)=>({id,text,correct:!!correct,...(misconception?{misconception}:{}),feedback:feedback||"回到 dV/dt、振幅與頻率的因果鏈。"});
  const round=(v,d=3)=>Number(Number(v).toFixed(d));
  const BASE={id:"opamp-slew-large-signal",moduleId:"opamp",competency:"opamp.large-signal.slew-rate",kind:"Large-signal response",prompt:"同一顆 OP AMP、同一 frequency：1 Vpp 正弦正常，但 10 Vpp 變成近似三角波。第一個應優先驗證什麼？",options:[opt("sr","比較 SR 與 2πfVpk；大振幅可能進入 slew-rate limit",true,null,"slew limit 會隨振幅增加而更容易出現。"),opt("gbw","只要波形變形就一定是 GBW 不足",false,"忽略 amplitude dependence"),opt("offset","只看 DC offset",false,"offset 無法解釋同頻幅度依賴的 triangle-like 失真"),opt("bits","提高 ADC bit 數",false,"與 OP AMP 大訊號斜率限制無關")],href:"12_opamp_slew_rate/04_gbw_vs_slew.html"};
  if(!Quiz.questions.some(q=>q.id===BASE.id))Quiz.questions.push(clone(BASE));
  const seedFor=(variant,role,depth)=>hash(`${BASE.id}:${variant}:${role}:${depth}`);
  function variant(base,id,role,depth,prompt,options,representation,parameters){return{...clone(base),id:`${base.id}-${String(id).toLowerCase()}`,baseId:base.id,familyId:base.id,variantId:id,assessmentRole:role,transferDepth:depth,seed:seedFor(id,role,depth),representation,parameters:parameters||{},prompt,options};}
  function generate(base,id,role,depth){
    const seed=seedFor(id,role,depth),rng=rngFrom(seed),d=Math.max(1,depth);
    if(d%4===1){
      const fKHz=[20,50,100,200,500][d%5],vpp=[1,2,5,10][(d+1)%4],req=2*Math.PI*fKHz*1e3*(vpp/2)/1e6;
      return variant(base,id,role,d,`輸出 ${vpp} Vpp、${fKHz} kHz 正弦。只看 slew limit，最低 SR 約多少 V/µs？`,shuffled([opt("correct",`${round(req,3)} V/µs`,true,null,"SRrequired=2πfVpk。"),opt("vpp",`${round(req*2,3)} V/µs`,false,"把 Vpp 當 Vpk"),opt("no2pi",`${round(req/(2*Math.PI),3)} V/µs`,false,"漏掉 2π"),opt("mhz",`${round(req*1e6,1)} V/µs`,false,"把 V/s 與 V/µs 換算搞反")],rng),"numeric-requirement",{fKHz,vpp});
    }
    if(d%4===2){
      const sr=[0.5,1,2,5,10][d%5],vpp=[2,4,8,10][d%4],fp=sr*1e6/(2*Math.PI*(vpp/2))/1e3;
      return variant(base,id,role,d,`某 OP AMP 最差方向 SR=${sr} V/µs，要輸出 ${vpp} Vpp sine。理想 slew-only FPBW 約多少 kHz？`,shuffled([opt("correct",`${round(fp,1)} kHz`,true,null,"f=SR/(2πVpk)。"),opt("double",`${round(fp*2,1)} kHz`,false,"把 Vpp/Vpk 關係用反"),opt("2pi",`${round(fp*2*Math.PI,1)} kHz`,false,"漏除 2π"),opt("gbw","無法由 SR 與振幅估算任何頻率",false,"FPBW 正是由這兩者定義的 large-signal 尺度")],rng),"reverse-calculation",{sr,vpp});
    }
    if(d%4===3){
      return variant(base,id,role,d,"示波器看到 step 前段是近乎固定斜率直線，接近目標後才轉成彎曲尾巴並慢慢進入 ±0.1% 誤差帶。最合理的拆解？",shuffled([opt("two-stage","前段 large-signal slew limit；後段 small-signal settling/closed-loop dynamics",true,null,"兩段受不同機制限制。"),opt("all-gbw","整段都只能用 GBW 一個參數解釋",false,"忽略 fixed-slope large-signal 區"),opt("all-sr","只要知道 SR 就能精確預測最後 ±0.1% settling",false,"settling 還受 poles/phase margin/load/精度帶影響"),opt("offset","這只代表 input offset",false,"offset 不會形成固定斜率 ramp")],rng),"scope-waveform",{});
    }
    const sameFreq=100,vSmall=0.2,vLarge=8;
    return variant(base,id,role,d,`診斷題：${sameFreq} kHz、${vSmall} Vpp 正常；同樣 ${sameFreq} kHz、${vLarge} Vpp 明顯 triangle-like。把振幅再降回 ${vSmall} Vpp 後失真消失。哪個 hypothesis 機率最高？`,shuffled([opt("slew","Slew Rate / full-power bandwidth limit",true,null,"同頻只改 amplitude 即跨入/退出失真，是 large-signal 線索。"),opt("smallbw","純 small-signal −3 dB bandwidth 不足",false,"若小訊號同頻正常，單純 small-signal bandwidth 不是第一嫌疑"),opt("dc","DC offset",false,"offset 與 amplitude threshold 不匹配"),opt("quant","ADC quantization",false,"題目描述的是 OP AMP output waveform")],rng),"model-selection",{sameFreq,vSmall,vLarge});
  }
  function expandOne(base){const b={...clone(base),baseId:base.id,familyId:base.id,variantId:"A",assessmentRole:"baseline",transferDepth:0,seed:seedFor("A","baseline",0),representation:"concept"};return[b,generate(base,"B","transfer",1),generate(base,"C","transfer",2),generate(base,"D","transfer",3),generate(base,"R1","retention",4),generate(base,"R2","retention",5),generate(base,"R3","retention",6),generate(base,"R4","retention",7)];}
  const baseExpand=Assessment.expandQuestions.bind(Assessment),baseNext=Assessment.nextQuestion.bind(Assessment);
  Assessment.expandQuestions=function(items){return(items||[]).flatMap(q=>(q.baseId||q.id)===BASE.id?expandOne(q):baseExpand([q]));};
  Assessment.nextQuestion=function(items,answer,nowMs){const list=items||[],base=list.find(q=>q.assessmentRole==="baseline")||list[0];if(!base||(base.baseId||base.id)!==BASE.id)return baseNext(items,answer,nowMs);const history=answer&&Array.isArray(answer.history)?answer.history:[],m=Assessment.metrics(answer,nowMs);if(!history.length)return base;if(!m.transfer){const unseen=list.find(q=>q.assessmentRole==="transfer"&&!history.some(h=>h.variantId===q.variantId));if(unseen)return unseen;const n=history.filter(h=>h.assessmentRole==="transfer"&&h.firstAttemptForVariant).length+1;return generate(base,"T"+n,"transfer",n+3);}if(!m.due)return null;const unseen=list.find(q=>q.assessmentRole==="retention"&&!history.some(h=>h.variantId===q.variantId));if(unseen)return unseen;const n=history.filter(h=>h.assessmentRole==="retention"&&h.firstAttemptForVariant).length+1;return generate(base,"RX"+n,"retention",n+7);};
  Assessment.competencyPrerequisites["opamp.large-signal.slew-rate"]=[];
  Assessment.moduleRequirements.opamp=[];
  Assessment.generateOpampVariant=generate;
  if(Bindings&&Bindings.bindings)Bindings.bindings["opamp.large-signal.slew-rate"]={moduleId:"opamp",lessonCompetencies:["opamp.large-signal.slew-rate"],labIds:["opamp.lab.opamp-step","opamp.lab.opamp-sine","opamp.lab.opamp-diagnose"]};

  const Ch=root.CircuitEngineeringChallenges;
  if(Ch){
    const templates=[
      {id:"opamp-open-required-sr",moduleId:"opamp",competency:"opamp.large-signal.slew-rate",unit:"V/us",tolerance:.02},
      {id:"opamp-open-fpbw",moduleId:"opamp",competency:"opamp.large-signal.slew-rate",unit:"kHz",tolerance:.02},
      {id:"opamp-open-step-time",moduleId:"opamp",competency:"opamp.large-signal.slew-rate",unit:"us",tolerance:.02}
    ];
    const baseInstantiate=Ch.instantiateNumeric.bind(Ch),baseEvaluate=Ch.evaluateNumeric.bind(Ch);
    function instantiate(taskId,seed){const n=Number(seed||0),rng=rngFrom(hash(`${taskId}:${n}`)),pick=a=>a[Math.floor(rng()*a.length)],t=templates.find(x=>x.id===taskId);if(!t)return baseInstantiate(taskId,seed);
      if(taskId==="opamp-open-required-sr"){const fKHz=pick([20,50,100,200,500,1000]),vpp=pick([1,2,4,5,8,10]),expected=2*Math.PI*fKHz*1e3*(vpp/2)/1e6;return{...t,seed:n,parameters:{fKHz,vpp},prompt:`輸出 ${vpp} Vpp、${fKHz} kHz sine，最低理想 Slew Rate 約多少 V/µs？`,expected:()=>expected,explanation:"SRrequired=2πfVpk，且 Vpk=Vpp/2。"};}
      if(taskId==="opamp-open-fpbw"){const sr=pick([0.5,1,2,5,10,20]),vpp=pick([1,2,4,8,10]),expected=sr*1e6/(2*Math.PI*(vpp/2))/1e3;return{...t,seed:n,parameters:{sr,vpp},prompt:`最差方向 SR=${sr} V/µs、輸出 ${vpp} Vpp，slew-only FPBW 約多少 kHz？`,expected:()=>expected,explanation:"FPBW=SR/(2πVpk)。"};}
      const dv=pick([1,2,5,8,10]),sr=pick([0.5,1,2,4,5]),expected=dv/sr;return{...t,seed:n,parameters:{dv,sr},prompt:`輸出 step ΔV=${dv} V，若全程受 SR=${sr} V/µs 限制，主要 slew ramp 的理想下界約多少 µs？`,expected:()=>expected,explanation:"t≈ΔV/SR；這不是完整 settling time。"};
    }
    function evaluate(taskId,answer,unit,seed){if(!templates.some(t=>t.id===taskId))return baseEvaluate(taskId,answer,unit,seed);const task=instantiate(taskId,seed),value=Number(answer);if(!Number.isFinite(value))return{correct:false,reason:"not-a-number",expected:task.expected(),unit:task.unit,seed:task.seed,parameters:task.parameters};let x=value,u=String(unit||task.unit).toLowerCase().replace("µ","u");if(task.unit==="V/us"&&u==="v/s")x/=1e6;if(task.unit==="kHz"&&u==="hz")x/=1e3;if(task.unit==="kHz"&&u==="mhz")x*=1e3;if(task.unit==="us"&&u==="ns")x/=1e3;if(task.unit==="us"&&u==="ms")x*=1e3;const expected=task.expected(),relativeError=expected?Math.abs(x-expected)/Math.abs(expected):Math.abs(x-expected);return{correct:relativeError<=task.tolerance,expected,normalized:x,unit:task.unit,relativeError,explanation:task.explanation,seed:task.seed,parameters:task.parameters};}
    templates.forEach(t=>{if(!Ch.numericTemplates.some(x=>x.id===t.id))Ch.numericTemplates.push(t);if(!Ch.numericTasks.some(x=>x.id===t.id))Ch.numericTasks.push(instantiate(t.id,0));});
    Ch.instantiateNumeric=instantiate;Ch.evaluateNumeric=evaluate;
    const game={id:"opamp-slew-vs-bandwidth-game",moduleId:"opamp",title:"同頻大振幅變三角波",symptom:"100 kHz 時 0.5 Vpp 正常，但 8 Vpp 明顯 triangle-like；DC output swing 尚有餘裕。",rootCauseId:"slew-limit",causes:[{id:"slew-limit",text:"Slew Rate / full-power bandwidth 不足",prior:.5},{id:"small-signal-bw",text:"純 small-signal closed-loop bandwidth 不足",prior:.3},{id:"output-rail",text:"output swing 碰 rail",prior:.2}],tests:[{id:"reduce-amplitude",text:"保持 100 kHz，只把 Vpp 降低 10 倍",cost:1,result:"失真幾乎消失，小振幅 gain/phase 正常。",likelihood:{"slew-limit":.96,"small-signal-bw":.18,"output-rail":.45}},{id:"measure-slope",text:"在 zero crossing 量最大 dV/dt",cost:1,result:"正負斜率都卡在近固定 V/µs 上限。",likelihood:{"slew-limit":.98,"small-signal-bw":.12,"output-rail":.15}},{id:"small-signal-sweep",text:"用 50 mVpp 做 frequency sweep",cost:2,result:"100 kHz 仍遠低於 −3 dB corner。",likelihood:{"slew-limit":.9,"small-signal-bw":.08,"output-rail":.55}},{id:"dc-swing",text:"確認輸出 peak 與供電 rail headroom",cost:2,result:"峰值離 rail 仍有數伏特。",likelihood:{"slew-limit":.75,"small-signal-bw":.7,"output-rail":.05}]}];
    if(!Ch.diagnosticGames.some(x=>x.id===game.id))Ch.diagnosticGames.push(game);
  }
  Object.defineProperty(Assessment,"__opampSlewInstalled",{value:true,enumerable:false});
  root.CircuitOpampAssessment={version:"1.0.0",baseQuestion:BASE,generate,expandOne};
})(typeof globalThis!=="undefined"?globalThis:this);
