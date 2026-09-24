(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTITutorCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const GRADES=Object.freeze(["fail","partial","pass","transfer"]);
  const CHAINS=Object.freeze({
    "buck-energy-flow":[
      ["duty-time","Duty command","ON/OFF dwell time",["duty","on time","導通時間","作用時間","dwell"]],
      ["state-vl","switch state","inductor voltage vL",["vl","電感電壓","vin-vout","switch state"]],
      ["vl-slope","vL","di/dt",["di/dt","斜率","slope","l·di/dt","l di/dt"]],
      ["slope-current","di/dt over time","ΔiL / iL",["Δi","delta i","il","電感電流"]]
    ],
    "boost-rhpz":[
      ["duty-energy","Duty increase","inductor energy/input current",["inductor","電感","energy","能量","input current"]],
      ["energy-output","inductor charging interval","temporary output delivery",["diode","output","輸出","delivery","capacitor"]],
      ["inverse-response","temporary output delivery","initial inverse Vout response",["inverse","opposite","反向","先下降","rhp"]],
      ["rhp-bandwidth","RHP zero","voltage-loop bandwidth limit",["bandwidth","頻寬","crossover","rhpz","rhp zero"]]
    ],
    "current-mode-slope-comp":[
      ["duty-perturbation","duty above 0.5","sampled peak-current perturbation",["0.5","50%","peak","峰值","perturb"]],
      ["perturb-subharmonic","sampled perturbation","subharmonic growth",["subharmonic","次諧波","alternating","倍週期"]],
      ["ramp-stability","artificial slope ramp","sampled-data damping",["slope compensation","斜坡補償","ramp","damping"]]
    ],
    "average-current-mode":[
      ["iref-error","current reference","current error amplifier",["current reference","電流命令","error","誤差"]],
      ["error-duty","current-loop output","PWM duty",["pwm","duty","占空比"]],
      ["hierarchy","fast current loop","slow voltage/energy loop",["fast","slow","快","慢","outer","inner","外環","內環"]]
    ],
    "loop-stability":[
      ["gain-cross","loop gain","crossover frequency",["crossover","交越","0 db","loop gain"]],
      ["phase-margin","phase at crossover","phase margin",["phase margin","相位裕度","180"]],
      ["margin-transient","stability margin","transient robustness",["overshoot","settling","超越","穩定","robust"]]
    ],
    "pi-zero-placement":[
      ["integrator","integrator","low-frequency gain / zero steady-state error",["integrator","積分","steady","穩態"]],
      ["zero-phase","PI zero","phase/gain shaping",["zero","零點","phase","相位"]],
      ["zero-plant","PI zero placement","plant dynamics / crossover",["plant","pole","極點","crossover","bandwidth"]]
    ],
    "psfb-zvs-energy":[
      ["current-energy","primary/leakage current","commutation energy",["current","電流","energy","能量","leakage"]],
      ["energy-coss","commutation energy","device capacitance transition",["coss","capacitance","電容","commutation"]],
      ["margin-zvs","energy margin","ZVS success/loss",["zvs","margin","裕量","hard switching","硬切"]]
    ],
    "llc-operating-point":[
      ["normalized","fs/fr, Ln, Q","normalized operating point",["fn","fs/fr","ln","q","normalized"]],
      ["point-gain","operating point","tank gain",["gain","增益","tank"]],
      ["point-current","operating point","circulating current / switching region",["current","電流","region","區域","zvs"]]
    ],
    "llc-loop-measurement":[
      ["corner-plant","input/load operating point","local LLC plant",["load","input","operating point","工作點","plant"]],
      ["injection-linear","injection amplitude","local linearization validity",["injection","注入","amplitude","saturation","linear"]],
      ["multi-corner","plant variation","multi-corner Bode qualification",["bode","corner","多工作點","repeat","重複"]]
    ],
    "epwm-signal-path":[
      ["write-shadow","CMPA write","shadow register state",["cmpa","shadow","影子"]],
      ["shadow-load","shadow register","configured LOAD event",["load","zero","period","載入"]],
      ["load-active","LOAD event","active compare / pin timing",["active","pin","輸出","edge","邊緣"]]
    ],
    "trip-zone-authority":[
      ["fault-path","comparator fault","hardware trip path",["cmpss","comparator","trip","xbar"]],
      ["trip-pwm","Trip Zone","immediate PWM safe state",["pwm","safe","off","關閉","veto"]],
      ["latch-rearm","latched fault","qualified re-arm policy",["latch","rearm","重啟","清除"]]
    ],
    "dcl-controller-runtime":[
      ["rate-coeff","execution/sample rate","discrete coefficients semantics",["sample","rate","ts","coefficient","係數"]],
      ["numeric-limit","controller implementation","numeric/saturation behavior",["saturation","limit","precision","飽和","數值"]],
      ["runtime-plant","controller runtime","closed-loop dynamic response",["dynamic","response","closed loop","動態"]]
    ],
    "sfra-measurement":[
      ["inject-local","injection amplitude/location","local small-signal perturbation",["injection","注入","small signal","小信號"]],
      ["snr-linear","perturbation size","SNR vs saturation tradeoff",["snr","saturation","飽和","noise","雜訊"]],
      ["measure-model","measured magnitude/phase","model correlation / repeatability",["magnitude","phase","model","repeat","bode"]]
    ],
    "cla-ownership":[
      ["trigger-owner","task trigger","producer/consumer ownership",["trigger","owner","ownership","擁有","producer","consumer"]],
      ["handoff-data","handoff contract","coherent shared data",["handoff","shared","共享","race","競態"]],
      ["data-timing","coherent data","deterministic control timing",["timing","latency","stale","時間","延遲"]]
    ],
    "c28x-wcet-evidence":[
      ["exact-build","exact build/path","measured worst-case cycles",["build","compiler","path","wcet","cycle"]],
      ["wcet-deadline","worst-case cycles","deadline slack",["deadline","slack","期限","裕量"]],
      ["deadline-commit","deadline slack","correct PWM commit cycle",["commit","pwm","shadow","cycle","週期"]]
    ]
  });

  const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ");
  function committedPrediction(state,conceptId){
    const ids=["ti:"+conceptId,conceptId];
    for(const id of ids){
      const r=state?.predictions?.[id];
      if(r?.revisions?.length)return r.revisions[0];
    }
    const prefix="ti:"+conceptId+":";
    for(const [id,r] of Object.entries(state?.predictions||{})){
      if(id.startsWith(prefix)&&r?.revisions?.length)return r.revisions[0];
    }
    return null;
  }
  function latestMachine(state,conceptId){
    const candidates=Object.entries(state?.evidence||{})
      .filter(([id])=>id==="ti:"+conceptId||id.startsWith("ti:"+conceptId+":"))
      .flatMap(([,item])=>Array.isArray(item.machine)?item.machine:[]);
    return candidates.sort((a,b)=>Date.parse(a.at||0)-Date.parse(b.at||0)).at(-1)||null;
  }
  function buildPacket({concept,record={},state={},sourceDocs=[],uiContext={}}={}){
    if(!concept?.id)throw new Error("concept required");
    const prediction=committedPrediction(state,concept.id);
    const answer=String(record.firstAnswer||prediction?.prediction||"").trim();
    const correction=String(record.correction||"").trim();
    const machine=latestMachine(state,concept.id);
    const sources=sourceDocs
      .filter(doc=>(concept.sourceIds||[]).includes(doc.id))
      .map(doc=>({id:doc.id,title:doc.title,url:doc.url}));
    return Object.freeze({
      version:1,
      conceptId:concept.id,
      title:concept.title,
      problem:concept.problem,
      mode:record.activeMode||record.lastMode||((record.mastery||0)>=.8?"transfer":(record.mastery||0)>=.5?"diagnose":"predict"),
      predictionCommitted:!!prediction,
      predictionPreRegistered:prediction?.preRegistered===true,
      learnerAnswer:answer,
      correction,
      model:concept.model,
      sourceIds:Object.freeze([...(concept.sourceIds||[])]),
      sources:Object.freeze(sources),
      projectLinks:Object.freeze([...(concept.projectLinks||[])]),
      machineSnapshot:machine?.snapshot||null,
      machineVerification:machine?.verification||null,
      evidenceStrength:state?.evidence?.["ti:"+concept.id]?.strength||"none",
      nextReview:record.nextReview||null,
      uiContext:Object.freeze({
        selectedComponent:uiContext.selectedComponent||null,
        scopePhase:Number.isFinite(Number(uiContext.scopePhase))?Number(uiContext.scopePhase):null
      })
    });
  }
  function firstGap(packet){
    if(!packet.predictionCommitted){
      return Object.freeze({
        id:"prediction-lock",dimension:"prediction",
        question:"先不要看來源或答案。請先寫下你的方向預測、關鍵假設，以及哪一個波形或 timing marker 會最先改變。",
        evidenceRequest:"Commit one falsifiable prediction before model/source reveal."
      });
    }
    const links=CHAINS[packet.conceptId]||[];
    const text=norm(packet.learnerAnswer+" "+packet.correction);
    const missing=links.find(([,from,to,tokens])=>!tokens.some(token=>text.includes(norm(token))));
    if(missing){
      const[id,from,to]=missing;
      return Object.freeze({
        id,dimension:"causal-link",
        question:"你的因果鏈還沒有把「"+from+"」和「"+to+"」連起來。只回答這一段：前者改變時，後者的方向或時序怎麼變？",
        evidenceRequest:"指出一條 waveform、timing marker 或 measurement，說明什麼觀察會推翻這段連結。"
      });
    }
    if(!packet.machineSnapshot){
      return Object.freeze({
        id:"missing-evidence",dimension:"evidence",
        question:"因果鏈已經成形，但目前沒有 machine evidence。哪一個最小實驗能區分你的模型和最接近的替代解釋？",
        evidenceRequest:"Choose one observable and state the expected before/after change."
      });
    }
    if(packet.mode==="transfer"){
      return Object.freeze({
        id:"transfer-boundary",dimension:"transfer",
        question:"把同一個模型搬到新 topology／工作點時，哪一個假設最可能先失效？不要先調參數，先說失效條件。",
        evidenceRequest:"Name the new constraint and one measurement that would detect the boundary."
      });
    }
    return Object.freeze({
      id:"falsification",dimension:"evidence",
      question:"現在不要再補術語。請指出目前 machine evidence 中哪一個數值最支持你的模型，以及哪個相反結果會讓你撤回結論。",
      evidenceRequest:"Cite one observed field/timing/waveform and one falsifying alternative."
    });
  }
  function providerRequest(packet){
    const gap=firstGap(packet);
    return Object.freeze({
      schema:"ti-evidence-aware-coach-v1",
      policy:Object.freeze({
        revealSolutionBeforePrediction:false,
        grades:GRADES,
        askOneCorrectiveQuestion:true,
        requireEvidencePrediction:true,
        sourceIdsOnly:true,
        fabricatePageOrSection:false,
        evidenceEscalationAllowed:false
      }),
      learner:Object.freeze({
        conceptId:packet.conceptId,mode:packet.mode,
        answer:packet.learnerAnswer,correction:packet.correction,
        predictionPreRegistered:packet.predictionPreRegistered,
        machineSnapshot:packet.machineSnapshot,
        uiContext:packet.uiContext
      }),
      groundTruth:Object.freeze({
        problem:packet.problem,
        model:packet.model,
        causalChain:CHAINS[packet.conceptId]||[],
        sources:packet.sources
      }),
      next:Object.freeze(gap)
    });
  }
  function validateCoachResponse(response,packet){
    const r=response&&typeof response==="object"?response:{};
    const errors=[];
    if(!GRADES.includes(String(r.grade||"").toLowerCase()))errors.push("grade must be FAIL/PARTIAL/PASS/TRANSFER");
    if(!String(r.correctiveQuestion||"").trim())errors.push("one correctiveQuestion is required");
    if(!String(r.evidenceRequest||"").trim())errors.push("evidenceRequest is required");
    const cited=Array.isArray(r.sourceIds)?r.sourceIds:[];
    const allowed=new Set(packet.sourceIds);
    if(cited.some(id=>!allowed.has(id)))errors.push("sourceIds must come from the concept source closure");
    const serialized=JSON.stringify(r);
    if(/\bpage\s*\d+|\bp\.?\s*\d+|section\s*\d+/i.test(serialized))errors.push("page/section claims are not allowed without retrieved source location evidence");
    if(r.evidenceStrength&&r.evidenceStrength!=="none")errors.push("coach cannot upgrade evidence strength");
    return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors)});
  }
  return Object.freeze({GRADES,CHAINS,buildPacket,firstGap,providerRequest,validateCoachResponse});
});
