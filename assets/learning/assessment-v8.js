(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitAssessmentV8 = api;
  if (root.CircuitAssessment && root.CircuitQuizBank) api.install(root.CircuitAssessment, root.CircuitQuizBank);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "8.0.0";
  const clone = value => JSON.parse(JSON.stringify(value));
  const round = (v, d) => Number(Number(v).toFixed(d == null ? 3 : d));
  const hash = value => { let h=2166136261>>>0; for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; };
  const rngFrom = seed => { let a=Number(seed)>>>0; return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}; };
  const pick=(list,rng)=>list[Math.min(list.length-1,Math.floor(rng()*list.length))];
  const shuffled=(list,rng)=>{const out=clone(list);for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const opt=(id,text,correct,misconception,feedback)=>({id,text,correct:!!correct,...(misconception?{misconception}:{}),feedback:feedback||"重新建立因果鏈。"});

  const baseQuestions = [
    {id:"inv-shoot-through-safety",moduleId:"inverter",competency:"inverter.shoot-through.safety",kind:"安全不變量",prompt:"同一半橋上下管同時導通時，最重要的第一個工程判斷是什麼？",options:[opt("shoot","形成直通電流路徑，必須靠 dead-time/interlock 避免",true,null,"同一 leg 上下管同時 ON 會直接跨接 DC bus。"),opt("more-power","輸出功率一定提高",false,"把短路當成有效功率"),opt("no-effect","只要 PWM 頻率不變就沒影響",false,"忽略 switching state"),opt("adc-only","只會影響 ADC 解析度",false,"混入無關量測問題")],href:"2_inverter/"},
    {id:"foc-park-frame",moduleId:"foc",competency:"foc.park.frame",kind:"座標遷移",prompt:"若電流向量與同步旋轉座標 q 軸對齊，理想 Park transform 最合理的結果為何？",options:[opt("q","q 軸保留主要分量，d 軸接近 0",true,null,"同步座標系把向量投影到 d/q 軸。"),opt("d","d 軸一定等於 q 軸",false,"忽略投影角度"),opt("zero","d、q 都必定為 0",false,"把座標轉換當成消除向量"),opt("bits","結果只由 ADC bit 數決定",false,"混淆量化與座標轉換")],href:"3_FOC/"},
    {id:"pi-integrator-crossover",moduleId:"pi",competency:"pi.integrator.crossover",kind:"控制計算",prompt:"純積分項 Ki/s 的幅值等於 1（0 dB）時，頻率與 Ki 的關係為何？",options:[opt("ki2pi","f0 = Ki/(2π)",true,null,"|Ki/(jω)|=1 → ω=Ki → f=Ki/(2π)。"),opt("2piki","f0 = 2πKi",false,"角頻率與 Hz 轉換方向顛倒"),opt("inv","f0 = 1/Ki",false,"忽略 rad/s 與增益方程"),opt("kp","只由 Kp 決定",false,"題目是純積分項")],href:"4_PI/02_integrator.html"},
    {id:"loop10us-deadline-budget",moduleId:"loop10us",competency:"loop10us.deadline.budget",kind:"即時時序",prompt:"100 kHz 控制迴圈的單周期 deadline 是多少？",options:[opt("10us","10 µs",true,null,"週期 T=1/f。"),opt("100us","100 µs",false,"頻率換算錯一個 decade"),opt("1us","1 µs",false,"頻率換算錯一個 decade"),opt("cpu","只看 CPU MHz，沒有固定 deadline",false,"忽略外部控制週期")],href:"5_10us_loop/"},
    {id:"bms-failsafe-convergence",moduleId:"bms",competency:"bms.failsafe.convergence",kind:"安全狀態機",prompt:"偵測到不可接受的 battery fault 後，最安全的狀態機收斂應包含什麼？",options:[opt("lock-open","FAULT_LOCK 並命令 contactor OPEN",true,null,"故障鎖定與能量隔離是 fail-safe 核心。"),opt("keep","維持 contactor CLOSED 等待使用者",false,"故障時仍保持能量路徑"),opt("reset","立刻清除 fault flag",false,"把復歸當保護"),opt("ui","只更新 UI，不改 actuation",false,"診斷沒有落到安全致動")],href:"6_BMS/"},
    {id:"ad5543-code-mapping",moduleId:"ad5543",competency:"ad5543.code.mapping",kind:"DAC 計算",prompt:"16-bit unipolar DAC 的理想 code mapping 最接近哪個關係？",options:[opt("ratio","code ≈ Vtarget/Vref × 65536，再限制在 0…65535",true,null,"16-bit full-scale 有 2^16 個量化位置。"),opt("4096","永遠乘 4096",false,"把 12-bit 套到 16-bit"),opt("inverse","code ≈ Vref/Vtarget",false,"比例方向相反"),opt("no-vref","code 與 Vref 無關",false,"忽略 reference 定義 full scale")],href:"7_AD5543/"},
    {id:"afe-phase-power",moduleId:"afe",competency:"afe.phase.power",kind:"交流功率",prompt:"正弦電壓與電流相位差 φ 時，位移功率因數的理想關係為何？",options:[opt("cos","PF = cosφ",true,null,"正弦穩態下實功率 P=Vrms·Irms·cosφ。"),opt("sin","PF = sinφ",false,"把正交分量當實功"),opt("linear","PF = φ",false,"角度不是線性功率因數"),opt("always1","只要 RMS 不變 PF 就永遠 1",false,"忽略相位")],href:"8_AFE/"},
    {id:"acmc-protection-boundary",moduleId:"acmc-pro",competency:"acmc.protection.boundary",kind:"保護邊界",prompt:"ACMC teaching model 中，保護門檻應如何使用才不會過度外推？",options:[opt("scope","把 OCP/DC-SAT 規則視為指定假設下的 teaching estimate，硬體仍需量測與容差驗證",true,null,"模型有 scope，不等於 hardware certification。"),opt("cert","模擬 PASS 等同硬體安全認證",false,"把教材模型當認證"),opt("ignore","保護門檻不需要考慮 sensor/延遲/容差",false,"忽略實體鏈路"),opt("one","任何負載都使用同一個固定峰值近似且不檢查 PF",false,"過度外推")],href:"9_ACMC_PRO/"},
    {id:"dds-real-power",moduleId:"c2000-dds",competency:"dds.phase.power",kind:"DDS/量測",prompt:"兩個同頻正弦的 Vrms、Irms 固定，只改相位差 φ，平均實功率如何變化？",options:[opt("cos","依 cosφ 成比例變化",true,null,"平均實功率是 P=Vrms·Irms·cosφ。"),opt("sin","依 sinφ 成比例",false,"那對應正交分量"),opt("same","相位不影響平均實功率",false,"忽略相位關係"),opt("freq","只由 DDS update rate 決定",false,"混淆數位生成與功率定義")],href:"10_C2000_DDS/"}
  ];

  function variant(base,variantId,role,depth,seed,prompt,options,representation){return{...clone(base),id:`${base.id}-${String(variantId).toLowerCase()}`,baseId:base.id,familyId:base.id,variantId,assessmentRole:role,transferDepth:depth,seed,representation,prompt,options};}
  function seedFor(base,variantId,role,depth){return hash(`${base.id}:${variantId}:${role}:${depth}`);}

  const generators = {
    "inv-shoot-through-safety":(base,v,r,d,s)=>{const rng=rngFrom(s),dead=pick([100,250,500,800],rng);return variant(base,v,r,d,s,`某半橋 gate driver 的 turn-off propagation 約 ${dead} ns。若上下管 command 在換相瞬間重疊，最優先新增哪一個保護？`,shuffled([opt("dead","dead-time / hardware interlock，確保同 leg 不重疊",true,null,"先消除直通狀態。"),opt("gain","提高 PWM duty",false,"增加導通不是保護"),opt("adc","增加 ADC bits",false,"與 gate overlap 無關"),opt("filter","只加輸出 LC",false,"輸出濾波不能阻止橋臂直通")],rng),d%2?"context":"state");},
    "foc-park-frame":(base,v,r,d,s)=>{const rng=rngFrom(s),deg=pick([0,30,45,60,90],rng),mag=pick([0.5,0.8,1.0],rng),rad=deg*Math.PI/180,vd=round(mag*Math.sin(rad),3),vq=round(mag*Math.cos(rad),3);return variant(base,v,r,d,s,`向量 magnitude=${mag}，相對 q 軸的 load angle=${deg}°。採目前教材定義 vd=M·sinδ、vq=M·cosδ，哪組最接近？`,shuffled([opt("correct",`vd≈${vd}, vq≈${vq}`,true,null,"直接做正交投影。"),opt("swap",`vd≈${vq}, vq≈${vd}`,false,"把 d/q 投影交換"),opt("neg",`vd≈${-vd}, vq≈${vq}`,false,"符號 convention 未依題意"),opt("zero","vd=vq=0",false,"座標轉換不會消除向量")],rng),d%3===2?"calculation":"parameter");},
    "pi-integrator-crossover":(base,v,r,d,s)=>{const rng=rngFrom(s),ki=pick([100,500,1000,2000,5000,10000],rng),f=round(ki/(2*Math.PI),1);return variant(base,v,r,d,s,`純積分 Ki/s，Ki=${ki} rad/s 等效增益常數。0 dB crossover 約多少 Hz？`,shuffled([opt("correct",`${f} Hz`,true,null,"f0=Ki/(2π)。"),opt("ki",`${ki} Hz`,false,"忘記 rad/s→Hz"),opt("2pi",`${round(ki*2*Math.PI,1)} Hz`,false,"2π 方向錯"),opt("inv",`${round(1/ki,6)} Hz`,false,"錯用倒數")],rng),d%2?"calculation":"representation");},
    "loop10us-deadline-budget":(base,v,r,d,s)=>{const rng=rngFrom(s),acq=pick([0.6,1.0,1.5,2.0],rng),cpu=pick([2,3,4,5],rng),comm=pick([1,2,3,4],rng),sum=round(acq+cpu+comm,1),margin=round(10-sum,1),pass=margin>=0;return variant(base,v,r,d,s,`100 kHz loop：ADC acquire=${acq} µs、CPU=${cpu} µs、communication critical path=${comm} µs。忽略重疊時總 critical path=${sum} µs。`,shuffled([opt("correct",pass?`可達成，margin≈${margin} µs`:`超過 deadline 約 ${Math.abs(margin)} µs`,true,null,"與 10 µs deadline 比較。"),opt("always","只要 CPU 小於 10 µs 就一定達成",false,"忽略 acquisition/communication"),opt("sumfreq","把各段頻率相加即可",false,"deadline 看時間 critical path"),opt("avg","只看平均時間，不需要 worst-case",false,"real-time 必須關注 worst-case")],rng),"timing-budget");},
    "bms-failsafe-convergence":(base,v,r,d,s)=>{const rng=rngFrom(s),fault=pick(["cell over-voltage","watchdog timeout","AFE communication loss","over-temperature"],rng);return variant(base,v,r,d,s,`BMS 發生 ${fault}，而 fault 已被判定不可立即自動恢復。下一個最安全的狀態轉移是？`,shuffled([opt("lock","進入 FAULT_LOCK、打開 contactor，保留 diagnostic evidence",true,null,"fail-safe 要隔離能量並保留原因。"),opt("run","回 RUN 繼續供電",false,"故障未解除"),opt("clear","清 fault 並關閉紀錄",false,"破壞可追溯性"),opt("ui","只顯示警告但 contactor 不變",false,"缺少安全致動")],rng),d%2?"state-machine":"fault-context");},
    "ad5543-code-mapping":(base,v,r,d,s)=>{const rng=rngFrom(s),vref=pick([2.5,5,10],rng),ratio=pick([0.1,0.25,0.5,0.75,0.9],rng),target=round(vref*ratio,3),code=Math.min(65535,Math.max(0,Math.round(ratio*65536)));return variant(base,v,r,d,s,`16-bit unipolar mapping：Vref=${vref} V、Vtarget=${target} V。忽略 gain/offset error，code 約多少？`,shuffled([opt("correct",String(code),true,null,"code≈Vtarget/Vref·65536。"),opt("12bit",String(Math.round(ratio*4096)),false,"誤用 12-bit"),opt("inverse",String(Math.round((1/ratio)*65536)),false,"比例倒置"),opt("max","65535",false,"不是任何目標都 full-scale")],rng),"numeric");},
    "afe-phase-power":(base,v,r,d,s)=>{const rng=rngFrom(s),deg=pick([0,15,30,45,60,90],rng),pf=round(Math.cos(deg*Math.PI/180),3);return variant(base,v,r,d,s,`正弦 AFE：電壓與電流 RMS 固定，相位差=${deg}°。位移 PF 約多少？`,shuffled([opt("correct",String(pf),true,null,"PF=cosφ。"),opt("sin",String(round(Math.sin(deg*Math.PI/180),3)),false,"誤用 sinφ"),opt("degree",String(deg),false,"角度不是 PF"),opt("one","1.000",false,"只有 φ≈0 才接近 1")],rng),d%2?"numeric":"waveform-context");},
    "acmc-protection-boundary":(base,v,r,d,s)=>{const rng=rngFrom(s),load=pick([500,1000,1500,2200],rng),ocp=pick([6,8,10,12],rng),peak=round(load/220*Math.SQRT2,2),trip=peak>ocp;return variant(base,v,r,d,s,`教材 resistive/PF=1 估算：220 Vrms、load=${load} W，peak current≈${peak} A，OCP=${ocp} A。應如何解讀？`,shuffled([opt("correct",trip?"teaching model 預測 OCP 可能動作，但仍需硬體量測確認":"teaching model 預測未達 OCP，但仍需硬體量測/容差確認",true,null,"既做模型判斷，也保留外部效度邊界。"),opt("cert","模擬結果就是硬體認證",false,"過度外推"),opt("ignorepf","PF/波形/延遲都永遠不重要",false,"忽略假設"),opt("rms","直接拿 RMS 當 peak 且不說明",false,"峰值/RMS 混淆")],rng),"model-boundary");},
    "dds-real-power":(base,v,r,d,s)=>{const rng=rngFrom(s),deg=pick([0,30,45,60,90,120],rng),vr=pick([10,20,50],rng),ir=pick([1,2,5],rng),p=round(vr*ir*Math.cos(deg*Math.PI/180),2);return variant(base,v,r,d,s,`DDS 產生同頻正弦，Vrms=${vr} V、Irms=${ir} A、phase=${deg}°。理想平均實功率 P 約多少？`,shuffled([opt("correct",`${p} W`,true,null,"P=Vrms·Irms·cosφ。"),opt("va",`${vr*ir} W`,false,"把 VA 當 W"),opt("sin",`${round(vr*ir*Math.sin(deg*Math.PI/180),2)} W`,false,"誤用 sinφ"),opt("zero","永遠 0 W",false,"只有特定相位才為 0")],rng),d%2?"numeric":"phase-context");}
  };

  function generateVariant(base,variantId,role,depth){const generator=generators[base.id||base.baseId];if(!generator)return null;const seed=seedFor(base,variantId,role,depth);return generator(base,variantId,role,depth,seed);}
  function makeBaseline(base){return{...clone(base),baseId:base.id,familyId:base.id,variantId:"A",assessmentRole:"baseline",transferDepth:0,seed:hash(`${base.id}:baseline`),representation:"baseline"};}
  function expandOne(base){return[makeBaseline(base),generateVariant(base,"B","transfer",1),generateVariant(base,"C","transfer",2),generateVariant(base,"D","retention",3)].filter(Boolean);}

  const prerequisitePatch = {
    "inverter.shoot-through.safety":["buck.model.validity"],
    "foc.park.frame":["adc.current.offset"],
    "pi.integrator.crossover":["adc.quantization.levels"],
    "loop10us.deadline.budget":["spi.throughput.clock"],
    "bms.failsafe.convergence":["adc.current.offset"],
    "ad5543.code.mapping":["spi.mode.cpol-cpha"],
    "afe.phase.power":["adc.divider.power"],
    "acmc.protection.boundary":["afe.phase.power","buck.model.validity"],
    "dds.phase.power":["adc.quantization.levels"]
  };
  const moduleRequirementsPatch = {
    foc:["inverter.shoot-through.safety"],
    loop10us:["spi.rx.overrun"],
    bms:["adc.current.offset"],
    ad5543:["spi.mode.cpol-cpha"],
    afe:["adc.divider.power"],
    "acmc-pro":["afe.phase.power","buck.model.validity"],
    "c2000-dds":["adc.quantization.levels"]
  };

  const importance = {buck:1.0,adc:1.0,spi:1.0,inverter:.95,foc:1.0,pi:1.0,loop10us:1.0,bms:.9,ad5543:.9,afe:1.0,"acmc-pro":1.0,"c2000-dds":.9};
  function rankNextTasks(state,questions,nowMs,budgetMinutes){
    const now=nowMs==null?Date.now():nowMs,limit=Number(budgetMinutes||30);
    return [...(questions||[]).reduce((map,q)=>{if(!map.has(q.familyId))map.set(q.familyId,q);return map;},new Map()).values()]
      .map(q=>{const m=(globalThis.CircuitAssessment&&globalThis.CircuitAssessment.mastery)?globalThis.CircuitAssessment.mastery(q.familyId,state,questions,now):{transfer:false,due:false,retained:false};const answer=state&&state.questions&&state.questions[q.familyId],history=answer&&answer.history||[];const meanConfidence=history.length?history.reduce((s,x)=>s+Number(x.confidence==null?.7:x.confidence),0)/history.length:.7;const uncertainty=1-Math.abs(meanConfidence-.5)*2;const urgency=m.due?1:!m.transfer?.85:!m.retained?.55:.2;const score=100*urgency*(importance[q.moduleId]||.8)+15*uncertainty;const minutes=q.representation==="numeric"?8:6;return{familyId:q.familyId,competency:q.competency,moduleId:q.moduleId,score:round(score,1),estimatedMinutes:minutes,transfer:!!m.transfer,due:!!m.due,retained:!!m.retained,reason:m.due?"retention due":!m.transfer?"unseen transfer not passed":!m.retained?"retention not established":"maintenance"};})
      .filter(x=>x.estimatedMinutes<=limit).sort((a,b)=>b.score-a.score);
  }

  function psychometricSummary(state,questions){
    const byFamily=new Map();(questions||[]).forEach(q=>{if(!byFamily.has(q.familyId))byFamily.set(q.familyId,q);});
    const rows=[...byFamily.values()].map(q=>{const history=state&&state.questions&&state.questions[q.familyId]&&state.questions[q.familyId].history||[];const first=history.filter(x=>x.firstAttemptForVariant);const n=first.length,correct=first.filter(x=>x.correct).length,facility=n?correct/n:null;const confident=first.filter(x=>x.confidence!=null);let calibrationSignal=null;if(confident.length>=3){const c=confident.filter(x=>x.correct).reduce((s,x)=>s+Number(x.confidence),0)/Math.max(1,confident.filter(x=>x.correct).length),w=confident.filter(x=>!x.correct).reduce((s,x)=>s+Number(x.confidence),0)/Math.max(1,confident.filter(x=>!x.correct).length);calibrationSignal=round(c-w,3);}return{familyId:q.familyId,moduleId:q.moduleId,competency:q.competency,n,facility:facility==null?null:round(facility,3),difficulty:facility==null?null:round(1-facility,3),calibrationSignal,evidence:n>=8?"usable":n>=4?"provisional":"insufficient"};});
    return{rows,usable:rows.filter(x=>x.evidence==="usable").length,provisional:rows.filter(x=>x.evidence==="provisional").length,insufficient:rows.filter(x=>x.evidence==="insufficient").length};
  }

  function install(Assessment,Quiz){
    if(!Assessment||!Quiz)return null;if(Assessment.__v8Installed)return Assessment;
    baseQuestions.forEach(q=>{if(!Quiz.questions.some(x=>x.id===q.id))Quiz.questions.push(clone(q));});
    const baseExpand=Assessment.expandQuestions.bind(Assessment),baseNext=Assessment.nextQuestion.bind(Assessment);
    Assessment.expandQuestions=function(items){return(items||[]).flatMap(q=>generators[q.id]?expandOne(q):baseExpand([q]));};
    Assessment.nextQuestion=function(items,answer,nowMs){const list=items||[],base=list.find(q=>q.assessmentRole==="baseline")||list[0];if(!base||!generators[base.baseId||base.id])return baseNext(items,answer,nowMs);const history=answer&&Array.isArray(answer.history)?answer.history:[],m=Assessment.metrics(answer,nowMs);if(!history.length)return base;if(!m.transfer){const unseen=list.find(q=>q.assessmentRole==="transfer"&&!history.some(h=>h.variantId===q.variantId));if(unseen)return unseen;const ordinal=history.filter(h=>h.assessmentRole==="transfer"&&h.firstAttemptForVariant).length+1;return generateVariant(base,"T"+ordinal,"transfer",ordinal+2);}if(!m.due)return null;const unseenR=list.find(q=>q.assessmentRole==="retention"&&!history.some(h=>h.variantId===q.variantId));if(unseenR)return unseenR;const ordinal=history.filter(h=>h.assessmentRole==="retention"&&h.firstAttemptForVariant).length+1;return generateVariant(base,"R"+(m.retentionStage+1)+"-"+ordinal,"retention",ordinal+3);};
    Object.assign(Assessment.competencyPrerequisites,prerequisitePatch);Object.assign(Assessment.moduleRequirements,moduleRequirementsPatch);
    Assessment.rankNextTasks=rankNextTasks;Assessment.psychometricSummary=psychometricSummary;Assessment.generateV8Variant=generateVariant;
    Object.defineProperty(Assessment,"__v8Installed",{value:true,enumerable:false});return Assessment;
  }

  return{VERSION,baseQuestions,generators,generateVariant,expandOne,prerequisitePatch,moduleRequirementsPatch,rankNextTasks,psychometricSummary,install};
});
