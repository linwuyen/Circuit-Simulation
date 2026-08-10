(function(root,factory){
  const api=factory(root||globalThis);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.CircuitOpampDcTrainer=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const VERSION="1.0.0";
  const STORAGE_KEY="opamp-dc-reasoning-trainer-v1";
  const ERROR_TYPES=["ARITHMETIC","UNIT_CONVERSION","VOLTAGE_DIFFERENCE","OHMS_LAW","CURRENT_DIRECTION","VIRTUAL_SHORT","KCL","FEEDBACK_DROP","VOUT_POLARITY"];
  const SKILL_ORDER=["UNIT_CONVERSION","VOLTAGE_DIFFERENCE","OHMS_LAW","CURRENT_DIRECTION","VIRTUAL_SHORT","KCL","FEEDBACK_DROP","VOUT_CALCULATION"];
  const SKILL_GRAPH={
    UNIT_CONVERSION:{level:0,label:"Unit conversion",prerequisites:[]},
    VOLTAGE_DIFFERENCE:{level:1,label:"Voltage difference",prerequisites:["UNIT_CONVERSION"]},
    OHMS_LAW:{level:2,label:"Ohm's Law",prerequisites:["VOLTAGE_DIFFERENCE"]},
    CURRENT_DIRECTION:{level:3,label:"Current direction",prerequisites:["OHMS_LAW"]},
    VIRTUAL_SHORT:{level:4,label:"Virtual short",prerequisites:["CURRENT_DIRECTION"]},
    KCL:{level:5,label:"KCL",prerequisites:["VIRTUAL_SHORT"]},
    FEEDBACK_DROP:{level:5,label:"Feedback voltage drop",prerequisites:["KCL"]},
    VOUT_CALCULATION:{level:5,label:"Vout calculation",prerequisites:["FEEDBACK_DROP"]}
  };

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const round=(x,n=6)=>Number(Number(x).toFixed(n));
  const fmt=(x,n=3)=>Number(x.toFixed(n)).toString();
  const nowIso=()=>new Date().toISOString();
  function hashSeed(value){let h=2166136261>>>0;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let x=(hashSeed(seed)||1)>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
  function pick(random,list){return list[Math.min(list.length-1,Math.floor(random()*list.length))];}
  function shuffled(random,list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

  class CircuitModel{
    constructor({vplus,vleft,rleftK,rfK}){
      this.vplus=Number(vplus);this.vleft=Number(vleft);this.rleftK=Number(rleftK);this.rfK=Number(rfK);
      if(![this.vplus,this.vleft,this.rleftK,this.rfK].every(Number.isFinite))throw new Error("Invalid circuit parameters");
      if(this.rleftK<=0||this.rfK<=0)throw new Error("Resistance must be positive");
    }
    signature(){return [this.vplus,this.vleft,this.rleftK,this.rfK].map(x=>fmt(x,4)).join("|");}
  }

  class Solver{
    static solve(model){
      const vminus=model.vplus;
      const leftDv=vminus-model.vleft;
      const iLeftUa=(leftDv/model.rleftK)*1000;
      const iFeedbackOutUa=-iLeftUa;
      const feedbackDropV=Math.abs(iFeedbackOutUa)*model.rfK/1000;
      const vout=vminus-(iFeedbackOutUa*model.rfK/1000);
      const leftDirection=iLeftUa>0?"NODE_TO_LEFT":iLeftUa<0?"LEFT_TO_NODE":"NONE";
      const feedbackDirection=iFeedbackOutUa>0?"NODE_TO_VOUT":iFeedbackOutUa<0?"VOUT_TO_NODE":"NONE";
      return {vminus:round(vminus),leftDv:round(leftDv),leftDropMagnitude:round(Math.abs(leftDv)),iLeftUa:round(iLeftUa),leftCurrentMagnitudeUa:round(Math.abs(iLeftUa)),leftDirection,iFeedbackOutUa:round(iFeedbackOutUa),feedbackCurrentMagnitudeUa:round(Math.abs(iFeedbackOutUa)),feedbackDirection,feedbackDropV:round(feedbackDropV),vout:round(vout),voutRelativeToNode:vout>vminus?"HIGHER":vout<vminus?"LOWER":"EQUAL"};
    }
    static unitMultiplyUaKohm(currentUa,resistanceK){return round(Number(currentUa)*Number(resistanceK)/1000);}
    static unitDivideVKohm(voltageV,resistanceK){return round(Number(voltageV)/Number(resistanceK)*1000);}
    static mvToV(mv){return round(Number(mv)/1000);}
  }

  class SkillGraph{
    prerequisites(skill){return (SKILL_GRAPH[skill]&&SKILL_GRAPH[skill].prerequisites)||[];}
    dependents(skill){return SKILL_ORDER.filter(s=>this.prerequisites(s).includes(skill));}
    level(skill){return SKILL_GRAPH[skill]?SKILL_GRAPH[skill].level:0;}
    label(skill){return SKILL_GRAPH[skill]?SKILL_GRAPH[skill].label:skill;}
    isUnlocked(skill,mastery){return this.prerequisites(skill).every(p=>mastery.mastered(p)||mastery.score(p)>=0.55||mastery.cleanStreak(p)>=2);}
    frontier(mastery){return SKILL_ORDER.find(s=>this.isUnlocked(s,mastery)&&!mastery.mastered(s))||SKILL_ORDER[SKILL_ORDER.length-1];}
  }

  function defaultSkillState(skill){return {skill_id:skill,attempts:0,correct_count:0,incorrect_count:0,current_streak:0,best_streak:0,mastery_score:0,hint_count:0,last_error_type:null,last_seen_at:null,recent:[],clean_streak:0,parameter_signatures:[]};}

  class MasteryTracker{
    constructor(saved){this.skills={};for(const s of SKILL_ORDER)this.skills[s]=defaultSkillState(s);if(saved&&saved.skills)this.load(saved);this.initialScores=Object.fromEntries(SKILL_ORDER.map(s=>[s,this.skills[s].mastery_score]));}
    load(saved){for(const s of SKILL_ORDER){const src=saved.skills&&saved.skills[s];if(src)this.skills[s]=Object.assign(defaultSkillState(s),src,{recent:Array.isArray(src.recent)?src.recent.slice(-5):[],parameter_signatures:Array.isArray(src.parameter_signatures)?src.parameter_signatures.slice(-12):[]});}}
    score(skill){return this.skills[skill]?this.skills[skill].mastery_score:0;}
    cleanStreak(skill){return this.skills[skill]?this.skills[skill].clean_streak:0;}
    mastered(skill){const s=this.skills[skill];if(!s)return false;const recent=s.recent.slice(-5);return recent.length>=5&&recent.filter(Boolean).length>=4&&s.clean_streak>=3&&new Set(s.parameter_signatures).size>=3;}
    record(skill,correct,{hinted=false,signature="",errorType=null,at=nowIso()}={}){
      if(!this.skills[skill])return;
      const s=this.skills[skill];s.attempts++;s.last_seen_at=at;s.recent.push(Boolean(correct));s.recent=s.recent.slice(-5);
      if(signature&&!s.parameter_signatures.includes(signature))s.parameter_signatures.push(signature);s.parameter_signatures=s.parameter_signatures.slice(-12);
      if(correct){s.correct_count++;s.current_streak++;s.best_streak=Math.max(s.best_streak,s.current_streak);s.clean_streak=hinted?0:s.clean_streak+1;}else{s.incorrect_count++;s.current_streak=0;s.clean_streak=0;s.last_error_type=errorType||s.last_error_type;}
      if(hinted)s.hint_count++;
      const accuracy=s.attempts?s.correct_count/s.attempts:0;
      const recent=s.recent.length?s.recent.filter(Boolean).length/s.recent.length:0;
      const streak=Math.min(s.clean_streak/3,1);
      const diversity=Math.min(new Set(s.parameter_signatures).size/3,1);
      const hintPenalty=Math.min(s.hint_count/Math.max(1,s.attempts),1);
      const base=clamp(.35*accuracy+.35*recent+.20*streak+.10*diversity-.10*hintPenalty,0,1);
      const evidence=.4+.6*Math.min(s.attempts/5,1);
      s.mastery_score=round(clamp(base*evidence,0,1),4);
    }
    decayDependents(skill,graph){
      const visited=new Set();const walk=s=>{for(const d of graph.dependents(s)){if(visited.has(d))continue;visited.add(d);this.skills[d].mastery_score=round(Math.max(0,this.skills[d].mastery_score-.05),4);walk(d);}};walk(skill);
    }
    snapshot(){return {version:VERSION,skills:JSON.parse(JSON.stringify(this.skills))};}
    strong(){return SKILL_ORDER.filter(s=>this.skills[s].attempts>0&&this.score(s)>=.75);}
    weak(){return SKILL_ORDER.filter(s=>this.skills[s].attempts>0&&this.score(s)<.6);}
    recommended(graph){return SKILL_ORDER.filter(s=>graph.isUnlocked(s,this)).sort((a,b)=>this.score(a)-this.score(b))[0]||graph.frontier(this);}
  }

  class QuestionGenerator{
    constructor(seed="session"){this.seedBase=seed;this.counter=0;}
    random(tag){return rng(`${this.seedBase}:${tag}:${this.counter++}`);}
    scenario(difficulty=0){
      const random=this.random("scenario");
      const lowR=[5,10,20,30,40,100],hardR=[4.7,22,33,47,100];
      const currents=difficulty>=2?[10,15,20,25,30,40,50,60,75,100]:[10,20,25,30,40,50,60,100];
      const voltages=difficulty>=2?[1,1.2,1.5,1.65,1.8,2,2.048,2.5,3,3.3]:[1,1.2,1.5,1.8,2,2.5,3,3.3];
      const rs=difficulty>=2?lowR.concat(hardR):lowR;
      for(let tries=0;tries<40;tries++){
        const vplus=pick(random,voltages),rleftK=pick(random,rs),rfK=pick(random,rs),iUa=pick(random,currents),sign=random()<.72?1:-1;
        const diff=iUa*rleftK/1000;
        const vleft=round(vplus-sign*diff,4);
        if(vleft>=.1&&vleft<=5){const model=new CircuitModel({vplus,vleft,rleftK,rfK});const sol=Solver.solve(model);if(Math.abs(sol.vout)<=10)return model;}
      }
      return new CircuitModel({vplus:1.8,vleft:1.2,rleftK:20,rfK:40});
    }
    q(base){return Object.assign({id:`q-${this.counter}-${Math.random().toString(36).slice(2,7)}`,kind:"main",hints:[],highlight:"none",choices:null,tolerance:.01},base);}
    unitConversion(difficulty=0){
      const random=this.random("unit");
      if(random()<.5){const mv=pick(random,difficulty>=2?[1650,2048,3300,470,750,1250]:[200,500,600,800,1200,1800,2500]);return this.q({skill:"UNIT_CONVERSION",level:0,prompt:`${mv} mV = ? V`,answerType:"number",expected:Solver.mvToV(mv),unit:"V",errorType:"UNIT_CONVERSION",signature:`mv:${mv}`,highlight:"rleft",hints:["milli = 10⁻³。","mV → V 要除以 1000。",`${mv} ÷ 1000 = ?`]});}
      const i=pick(random,[10,20,25,30,40,50]),r=pick(random,difficulty>=2?[4.7,22,33,47]:[10,20,30,40]);
      return this.q({skill:"UNIT_CONVERSION",level:0,prompt:`${i} µA × ${r} kΩ = ? V`,answerType:"number",expected:Solver.unitMultiplyUaKohm(i,r),unit:"V",errorType:"UNIT_CONVERSION",signature:`uk:${i}:${r}`,highlight:"rf",meta:{currentUa:i,resistanceK:r},hints:["先不要想 OPA，只處理數字與單位。","µA × kΩ = mV；最後 mV → V。",`${i} × ${r} = ${round(i*r)} mV = ? V`]});
    }
    voltageDifference(difficulty=0){const m=this.scenario(difficulty),s=Solver.solve(m);return this.q({skill:"VOLTAGE_DIFFERENCE",level:1,prompt:`VA = ${fmt(s.vminus)} V，VB = ${fmt(m.vleft)} V。求 VA − VB。`,answerType:"number",expected:s.leftDv,unit:"V",errorType:"VOLTAGE_DIFFERENCE",signature:m.signature(),highlight:"rleft",model:m,hints:["先固定順序：題目要 VA − VB。","ΔV = VA − VB。",`${fmt(s.vminus)} − ${fmt(m.vleft)} = ?`]});}
    ohmsLaw(difficulty=0){const m=this.scenario(difficulty),s=Solver.solve(m),dv=Math.abs(s.leftDv);return this.q({skill:"OHMS_LAW",level:2,prompt:`電阻兩端 |ΔV| = ${fmt(dv)} V，R = ${fmt(m.rleftK)} kΩ。電流大小 = ? µA`,answerType:"number",expected:s.leftCurrentMagnitudeUa,unit:"µA",errorType:"OHMS_LAW",signature:m.signature(),highlight:"rleft",model:m,hints:["先只求 magnitude，不判方向。","I = |ΔV| / R。V / kΩ = mA。",`${fmt(dv)} ÷ ${fmt(m.rleftK)} kΩ = ? µA`]});}
    currentDirection(difficulty=0){const m=this.scenario(difficulty),s=Solver.solve(m);const node=`Vnode (${fmt(s.vminus)} V)`,left=`Vleft (${fmt(m.vleft)} V)`;const expected=s.leftDirection;return this.q({skill:"CURRENT_DIRECTION",level:3,prompt:`Conventional current 經左側電阻往哪裡流？`,answerType:"choice",expected,choices:shuffled(this.random("dir"),[{value:"NODE_TO_LEFT",label:`${node} → ${left}`},{value:"LEFT_TO_NODE",label:`${left} → ${node}`}]),errorType:"CURRENT_DIRECTION",signature:m.signature(),highlight:"left-current",model:m,hints:["先不要算電流，只比較兩端電位。","Conventional current：較高電位 → 較低電位。",`${fmt(s.vminus)} V 與 ${fmt(m.vleft)} V，哪個比較高？`]});}
    virtualShort(difficulty=0){const m=this.scenario(difficulty);return this.q({skill:"VIRTUAL_SHORT",level:4,prompt:`假設 OPA 處於負回授線性區，V+ = ${fmt(m.vplus)} V。V− ≈ ? V`,answerType:"number",expected:m.vplus,unit:"V",errorType:"VIRTUAL_SHORT",signature:m.signature(),highlight:"vminus",model:m,hints:["這題不是套 gain formula。","負回授且未飽和：V− ≈ V+。",`V+ = ${fmt(m.vplus)} V，所以 V− ≈ ?`]});}
    fullFeedback(difficulty=0){
      const m=this.scenario(difficulty),s=Solver.solve(m),sig=m.signature();
      const leftChoices=[{value:"NODE_TO_LEFT",label:`V− → Vleft`},{value:"LEFT_TO_NODE",label:`Vleft → V−`}];
      const fbChoices=[{value:"VOUT_TO_NODE",label:`Vout → V−`},{value:"NODE_TO_VOUT",label:`V− → Vout`}];
      const polarityChoices=[{value:"HIGHER",label:"Vout 高於 V−"},{value:"LOWER",label:"Vout 低於 V−"},{value:"EQUAL",label:"Vout = V−"}];
      return [
        this.q({skill:"VIRTUAL_SHORT",level:5,prompt:`Step 1 · 負回授線性區：V+ = ${fmt(m.vplus)} V，V− ≈ ? V`,answerType:"number",expected:s.vminus,unit:"V",errorType:"VIRTUAL_SHORT",signature:sig,highlight:"vminus",model:m,hints:["先確認 virtual short。","V− ≈ V+。",`V− ≈ ${fmt(m.vplus)} V。`]}),
        this.q({skill:"VOLTAGE_DIFFERENCE",level:5,prompt:`Step 2 · 求左側電阻的 signed ΔV = V− − Vleft。`,answerType:"number",expected:s.leftDv,unit:"V",errorType:"VOLTAGE_DIFFERENCE",signature:sig,highlight:"rleft",model:m,hints:["順序固定為 V− − Vleft。","ΔV = V− − Vleft。",`${fmt(s.vminus)} − ${fmt(m.vleft)} = ?`]}),
        this.q({skill:"OHMS_LAW",level:5,prompt:`Step 3 · 左側 ${fmt(m.rleftK)} kΩ 電阻的電流大小 = ? µA`,answerType:"number",expected:s.leftCurrentMagnitudeUa,unit:"µA",errorType:"OHMS_LAW",signature:sig,highlight:"rleft",model:m,hints:["先求大小，方向下一題。","I = |ΔV| / R。",`${fmt(Math.abs(s.leftDv))} V / ${fmt(m.rleftK)} kΩ = ? µA`]}),
        this.q({skill:"CURRENT_DIRECTION",level:5,prompt:`Step 4 · 左側電阻 conventional current 的方向？`,answerType:"choice",expected:s.leftDirection,choices:shuffled(this.random("left-dir"),leftChoices),errorType:"CURRENT_DIRECTION",signature:sig,highlight:"left-current",model:m,hints:["比較 V− 與 Vleft。","高電位 → 低電位。",`${fmt(s.vminus)} V vs ${fmt(m.vleft)} V。`]}),
        this.q({skill:"KCL",level:5,prompt:`Step 5 · 理想 OPA 輸入電流 ≈ 0。為滿足 KCL，feedback branch 的電流方向？`,answerType:"choice",expected:s.feedbackDirection,choices:shuffled(this.random("fb-dir"),fbChoices),errorType:"KCL",signature:sig,highlight:"feedback-current",model:m,hints:["OPA input 幾乎不吃電流，所以節點流入 = 流出。","先看左支路電流是離開還是進入 V−。feedback 必須補回相同大小。",s.feedbackDirection==="VOUT_TO_NODE"?"左支路電流離開 V−，所以 feedback 要從 Vout 流入 V−。":"左支路電流流入 V−，所以 feedback 要由 V− 流向 Vout。"]}),
        this.q({skill:"FEEDBACK_DROP",level:5,prompt:`Step 6 · Feedback current 大小與左支路相同。Rf = ${fmt(m.rfK)} kΩ，feedback resistor |ΔV| = ? V`,answerType:"number",expected:s.feedbackDropV,unit:"V",errorType:"FEEDBACK_DROP",signature:sig,highlight:"rf",model:m,meta:{currentUa:s.leftCurrentMagnitudeUa,resistanceK:m.rfK},hints:["只算 feedback resistor 的 voltage drop。","|ΔVfb| = |Ifb| × Rf。µA × kΩ = mV。",`${fmt(s.leftCurrentMagnitudeUa)} µA × ${fmt(m.rfK)} kΩ = ? V`]}),
        this.q({skill:"VOUT_CALCULATION",level:5,prompt:`Step 7 · 根據 feedback current 方向，Vout 相對 V− 應該？`,answerType:"choice",expected:s.voutRelativeToNode,choices:shuffled(this.random("vout-pol"),polarityChoices),errorType:"VOUT_POLARITY",signature:sig,highlight:"vout",model:m,hints:["不要背反相/非反相公式，只看電流方向。","電流從高電位流向低電位。",s.feedbackDirection==="VOUT_TO_NODE"?"Ifb 是 Vout → V−，所以 Vout 必須比較高。":"Ifb 是 V− → Vout，所以 Vout 必須比較低。"]}),
        this.q({skill:"VOUT_CALCULATION",level:5,prompt:`Step 8 · 最後求 ideal Vout。`,answerType:"number",expected:s.vout,unit:"V",errorType:"VOUT_POLARITY",signature:sig,highlight:"vout",model:m,hints:["用 V−、feedback drop 與剛才的方向組合。",s.voutRelativeToNode==="HIGHER"?"Vout = V− + |ΔVfb|。":"Vout = V− − |ΔVfb|。",`${fmt(s.vminus)} ${s.voutRelativeToNode==="HIGHER"?"+":"−"} ${fmt(s.feedbackDropV)} = ? V`]})
      ];
    }
    forSkill(skill,difficulty=0){switch(skill){case"UNIT_CONVERSION":return[this.unitConversion(difficulty)];case"VOLTAGE_DIFFERENCE":return[this.voltageDifference(difficulty)];case"OHMS_LAW":return[this.ohmsLaw(difficulty)];case"CURRENT_DIRECTION":return[this.currentDirection(difficulty)];case"VIRTUAL_SHORT":return[this.virtualShort(difficulty)];default:return this.fullFeedback(difficulty);}}
  }

  class AnswerEvaluator{
    evaluate(question,answer){
      if(question.answerType==="choice"){const value=String(answer||"").trim();return {correct:value===question.expected,normalized:value,expected:question.expected,errorType:question.errorType};}
      const normalized=Number(String(answer).trim().replace(",","."));
      if(!Number.isFinite(normalized))return {correct:false,normalized:null,expected:question.expected,errorType:question.errorType||"ARITHMETIC",reason:"NOT_NUMERIC"};
      const tol=Math.max(Number(question.tolerance)||.01,Math.abs(Number(question.expected))*.01);
      return {correct:Math.abs(normalized-Number(question.expected))<=tol,normalized,expected:Number(question.expected),errorType:question.errorType};
    }
  }

  class ErrorDiagnoser{
    diagnose(question,result){
      let type=result.errorType||question.errorType||"ARITHMETIC";
      if(result.reason==="NOT_NUMERIC")type="ARITHMETIC";
      return {errorType:type,skill:question.skill,message:this.message(type)};
    }
    message(type){return ({ARITHMETIC:"先把純數字運算拆開。",UNIT_CONVERSION:"先拆數字與工程單位。",VOLTAGE_DIFFERENCE:"先固定電壓差的相減順序。",OHMS_LAW:"先確認 I = ΔV / R，再處理單位。",CURRENT_DIRECTION:"先只比較兩端電位高低。",VIRTUAL_SHORT:"先確認 virtual short 成立的條件。",KCL:"先把 OPA input current ≈ 0 放進節點 KCL。",FEEDBACK_DROP:"先把 Ifb × Rf 拆成數字與單位。",VOUT_POLARITY:"先用 feedback current 方向決定 Vout 在 V− 的哪一側。"})[type]||"回到前置步驟。";}
    remediation(question,diagnosis){
      const q=(base)=>Object.assign({id:`rem-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,kind:"remediation",level:Math.max(0,(question.level||0)-1),hints:[],highlight:question.highlight,signature:`rem:${question.signature||question.id}`,tolerance:.01},base);
      const meta=question.meta||{};
      switch(diagnosis.errorType){
        case"UNIT_CONVERSION":
        case"FEEDBACK_DROP":{
          if(meta.currentUa&&meta.resistanceK){const product=round(meta.currentUa*meta.resistanceK);return [q({skill:"UNIT_CONVERSION",prompt:`先只算數字：${fmt(meta.currentUa)} × ${fmt(meta.resistanceK)} = ?`,answerType:"number",expected:product,unit:"",errorType:"ARITHMETIC",hints:["先忽略單位。","只做乘法。",`${fmt(meta.currentUa)} × ${fmt(meta.resistanceK)}`]}),q({skill:"UNIT_CONVERSION",prompt:"µA × kΩ 的結果單位先是？",answerType:"choice",expected:"mV",choices:[{value:"mV",label:"mV"},{value:"V",label:"V"},{value:"µV",label:"µV"}],errorType:"UNIT_CONVERSION",hints:["把 µ=10⁻⁶、k=10³ 相乘。","10⁻⁶ × 10³ = 10⁻³。","10⁻³ V = mV。"]}),q({skill:"UNIT_CONVERSION",prompt:`${fmt(product)} mV = ? V`,answerType:"number",expected:round(product/1000),unit:"V",errorType:"UNIT_CONVERSION",hints:["mV → V。","除以 1000。",`${fmt(product)} ÷ 1000 = ?`]})];}
          return [q({skill:"UNIT_CONVERSION",prompt:"1000 mV = ? V",answerType:"number",expected:1,unit:"V",errorType:"UNIT_CONVERSION",hints:["milli 是 10⁻³。","mV → V 除以 1000。","1000 ÷ 1000 = 1。"]})];
        }
        case"VOLTAGE_DIFFERENCE":return [q({skill:"VOLTAGE_DIFFERENCE",prompt:"若 VA = 1.8 V、VB = 1.2 V，VA − VB = ? V",answerType:"number",expected:.6,unit:"V",errorType:"VOLTAGE_DIFFERENCE",hints:["照題目順序相減。","1.8 − 1.2。","答案是正值。"]})];
        case"OHMS_LAW":return [q({skill:"OHMS_LAW",prompt:"求電流時，正確關係是哪一個？",answerType:"choice",expected:"DIVIDE",choices:[{value:"DIVIDE",label:"I = ΔV / R"},{value:"MULTIPLY",label:"I = ΔV × R"},{value:"INVERT",label:"I = R / ΔV"}],errorType:"OHMS_LAW",hints:["回到 Ohm's Law。","V = IR。","所以 I = V/R。"]}),q({skill:"UNIT_CONVERSION",prompt:"1 V / 1 kΩ = ? mA",answerType:"number",expected:1,unit:"mA",errorType:"UNIT_CONVERSION",hints:["V/Ω=A。","kΩ 會讓 A 變成 mA。","1 V / 1 kΩ = 1 mA。"]})];
        case"CURRENT_DIRECTION":return [q({skill:"CURRENT_DIRECTION",prompt:"Conventional current 在電阻中由哪邊流向哪邊？",answerType:"choice",expected:"HIGH_TO_LOW",choices:[{value:"HIGH_TO_LOW",label:"較高電位 → 較低電位"},{value:"LOW_TO_HIGH",label:"較低電位 → 較高電位"}],errorType:"CURRENT_DIRECTION",hints:["先不看 OPA。","對被動電阻，conventional current 從高電位往低電位。","選 high → low。"]})];
        case"VIRTUAL_SHORT":return [q({skill:"VIRTUAL_SHORT",prompt:"負回授且 OPA 在線性區時，V− 與 V+ 最合理的關係？",answerType:"choice",expected:"APPROX_EQUAL",choices:[{value:"APPROX_EQUAL",label:"V− ≈ V+"},{value:"ZERO",label:"V− = 0 V"},{value:"OPPOSITE",label:"V− = −V+"}],errorType:"VIRTUAL_SHORT",hints:["條件已明確：negative feedback + linear。","使用 virtual short。","V− ≈ V+。"]})];
        case"KCL":return [q({skill:"KCL",prompt:"理想 OPA 的輸入端電流 I− 約為？",answerType:"number",expected:0,unit:"A",errorType:"KCL",hints:["理想輸入阻抗非常大。","I+ ≈ I− ≈ 0。","所以 I− ≈ 0 A。"]}),q({skill:"KCL",prompt:"若左支路有 30 µA 離開 V−，OPA input 不吃電流，feedback 必須？",answerType:"choice",expected:"ENTER",choices:[{value:"ENTER",label:"30 µA 流入 V−"},{value:"LEAVE",label:"30 µA 也離開 V−"}],errorType:"KCL",hints:["節點不能憑空累積電荷。","ΣI = 0。","離開 30 µA，就要補進 30 µA。"]})];
        case"VOUT_POLARITY":return [q({skill:"CURRENT_DIRECTION",prompt:"若 feedback current 是 Vout → V−，哪個電位較高？",answerType:"choice",expected:"VOUT_HIGH",choices:[{value:"VOUT_HIGH",label:"Vout 較高"},{value:"VMINUS_HIGH",label:"V− 較高"}],errorType:"VOUT_POLARITY",hints:["電阻 conventional current 從高到低。","既然方向是 Vout → V−。","所以 Vout > V−。"]})];
        default:return [q({skill:"UNIT_CONVERSION",prompt:"先算純數字：30 × 40 = ?",answerType:"number",expected:1200,unit:"",errorType:"ARITHMETIC",hints:["拆成 3×4 再補兩個 0。","30×40 = (3×4)×100。","12×100。"]})];
      }
    }
  }

  class AdaptiveEngine{
    constructor(graph){this.graph=graph;this.errorStreak={type:null,count:0};this.difficulty=0;}
    note(correct,errorType){if(correct){this.errorStreak={type:null,count:0};return;}if(this.errorStreak.type===errorType)this.errorStreak.count++;else this.errorStreak={type:errorType,count:1};if(this.errorStreak.count>=2)this.difficulty=Math.max(0,this.difficulty-1);}
    noteCleanStreak(streak){if(streak>=3)this.difficulty=Math.min(3,this.difficulty+1);}
    pickSkill(mastery,random=Math.random){
      const unlocked=SKILL_ORDER.filter(s=>this.graph.isUnlocked(s,mastery));
      const pool=unlocked.length?unlocked:["UNIT_CONVERSION"];
      const roll=random();
      if(roll<.60)return pool.slice().sort((a,b)=>mastery.score(a)-mastery.score(b))[0];
      if(roll<.85){const review=pool.filter(s=>mastery.mastered(s)||mastery.score(s)>=.65);return review.length?pick(random,review):pool[0];}
      const frontier=this.graph.frontier(mastery);return this.graph.isUnlocked(frontier,mastery)?frontier:pool[pool.length-1];
    }
  }

  class SessionManager{
    constructor({seed=`${Date.now()}`,targetQuestions=15,storage=null,storageKey=STORAGE_KEY}={}){
      this.storage=storage||(typeof localStorage!=="undefined"?localStorage:null);this.storageKey=storageKey;this.graph=new SkillGraph();this.generator=new QuestionGenerator(seed);this.evaluator=new AnswerEvaluator();this.diagnoser=new ErrorDiagnoser();this.mastery=new MasteryTracker(this.readSaved());this.adaptive=new AdaptiveEngine(this.graph);this.targetQuestions=clamp(Number(targetQuestions)||15,10,20);this.questionCount=0;this.correctCount=0;this.current=null;this.chain=[];this.chainIndex=0;this.remediation=[];this.retryOriginal=null;this.usedHint=false;this.hintIndex=0;this.errorCounts={};this.ended=false;
    }
    readSaved(){try{return this.storage?JSON.parse(this.storage.getItem(this.storageKey)||"null"):null;}catch(_){return null;}}
    save(){if(!this.storage)return;try{this.storage.setItem(this.storageKey,JSON.stringify(this.mastery.snapshot()));}catch(_){}}
    reset(){if(this.storage)try{this.storage.removeItem(this.storageKey);}catch(_){}this.mastery=new MasteryTracker();this.questionCount=0;this.correctCount=0;this.current=null;this.chain=[];this.chainIndex=0;this.remediation=[];this.retryOriginal=null;this.ended=false;this.errorCounts={};this.save();}
    next(){
      if(this.ended)return null;
      if(this.remediation.length){this.current=this.remediation.shift();return this.prepare(this.current);}
      if(this.retryOriginal){this.current=Object.assign({},this.retryOriginal,{id:`${this.retryOriginal.id}-retry-${Date.now()}`,kind:"retry"});this.retryOriginal=null;return this.prepare(this.current);}
      if(this.chainIndex<this.chain.length){this.current=this.chain[this.chainIndex++];return this.prepare(this.current);}
      const random=this.generator.random("adaptive"),skill=this.adaptive.pickSkill(this.mastery,random);this.chain=this.generator.forSkill(skill,this.adaptive.difficulty);this.chainIndex=0;this.current=this.chain[this.chainIndex++];return this.prepare(this.current);
    }
    prepare(q){this.usedHint=false;this.hintIndex=0;return q;}
    hint(){if(!this.current)return null;const hints=this.current.hints||[];if(!hints.length)return null;const idx=Math.min(this.hintIndex,hints.length-1);this.hintIndex=Math.min(hints.length,this.hintIndex+1);this.usedHint=true;return {index:idx+1,total:hints.length,text:hints[idx]};}
    submit(answer){
      if(!this.current||this.ended)return {correct:false,error:"NO_QUESTION"};
      const q=this.current,result=this.evaluator.evaluate(q,answer),diag=result.correct?null:this.diagnoser.diagnose(q,result);
      this.questionCount++;if(result.correct)this.correctCount++;
      this.mastery.record(q.skill,result.correct,{hinted:this.usedHint,signature:q.signature||"",errorType:diag&&diag.errorType});
      if(result.correct)this.adaptive.noteCleanStreak(this.mastery.cleanStreak(q.skill));else{this.adaptive.note(false,diag.errorType);this.errorCounts[diag.errorType]=(this.errorCounts[diag.errorType]||0)+1;this.mastery.decayDependents(q.skill,this.graph);}
      this.save();
      if(!result.correct){
        if(q.kind!=="remediation"){this.retryOriginal=q;this.remediation=this.diagnoser.remediation(q,diag);}else{this.remediation.unshift(Object.assign({},q,{id:`${q.id}-again-${Date.now()}`}));}
      }else this.adaptive.note(true,null);
      if(this.questionCount>=this.targetQuestions&&this.remediation.length===0&&!this.retryOriginal){this.ended=true;}
      return {correct:result.correct,diagnosis:diag,expected:result.expected,normalized:result.normalized,ended:this.ended,question:q};
    }
    report(){
      const repeated=Object.entries(this.errorCounts).sort((a,b)=>b[1]-a[1]);
      const change=SKILL_ORDER.map(s=>({skill:s,before:this.mastery.initialScores[s]||0,after:this.mastery.score(s),delta:round(this.mastery.score(s)-(this.mastery.initialScores[s]||0),4)}));
      return {questions:this.questionCount,correct:this.correctCount,strong:this.mastery.strong(),weak:this.mastery.weak(),repeatedError:repeated.length?repeated[0][0]:null,errorCounts:Object.fromEntries(repeated),masteryChange:change,recommendedNext:this.mastery.recommended(this.graph)};
    }
  }

  class UI{
    constructor(container,options={}){this.root=typeof container==="string"?document.querySelector(container):container;if(!this.root)throw new Error("Trainer root missing");this.session=new SessionManager(options);this.bind();this.renderQuestion(this.session.next());}
    bind(){
      this.root.querySelector("[data-trainer-submit]").addEventListener("click",()=>this.submit());
      this.root.querySelector("[data-trainer-answer]").addEventListener("keydown",e=>{if(e.key==="Enter")this.submit();});
      this.root.querySelector("[data-trainer-hint]").addEventListener("click",()=>this.showHint());
      this.root.querySelector("[data-trainer-reset]").addEventListener("click",()=>{this.session.reset();this.root.querySelector("[data-trainer-report]").hidden=true;this.root.querySelector("[data-trainer-question-card]").hidden=false;this.renderQuestion(this.session.next());});
    }
    renderQuestion(q){if(!q){this.renderReport();return;}this.current=q;const s=this.session.mastery.skills[q.skill];this.root.querySelector("[data-current-skill]").textContent=q.skill;this.root.querySelector("[data-current-level]").textContent=`Level ${q.level}`;this.root.querySelector("[data-current-mastery]").textContent=`${Math.round(s.mastery_score*100)}%`;this.root.querySelector("[data-current-streak]").textContent=String(s.current_streak);this.root.querySelector("[data-session-progress]").textContent=`${this.session.questionCount}/${this.session.targetQuestions}`;this.root.querySelector("[data-trainer-prompt]").textContent=q.prompt;this.root.querySelector("[data-trainer-feedback]").textContent="";this.root.querySelector("[data-trainer-hint-text]").textContent="";const answer=this.root.querySelector("[data-trainer-answer]");const choices=this.root.querySelector("[data-trainer-choices]");answer.value="";choices.innerHTML="";
      if(q.answerType==="choice"){answer.hidden=true;this.root.querySelector("[data-trainer-submit]").hidden=true;choices.hidden=false;for(const c of q.choices||[]){const b=document.createElement("button");b.type="button";b.className="trainer-choice";b.textContent=c.label;b.dataset.value=c.value;b.addEventListener("click",()=>this.submit(c.value));choices.appendChild(b);}}else{answer.hidden=false;this.root.querySelector("[data-trainer-submit]").hidden=false;choices.hidden=true;answer.placeholder=q.unit?`輸入數值（${q.unit}）`:"輸入答案";setTimeout(()=>answer.focus(),0);}
      this.renderCircuit(q.model||null,q.highlight);this.renderMastery();
    }
    submit(forced){const answer=forced!==undefined?forced:this.root.querySelector("[data-trainer-answer]").value;const result=this.session.submit(answer),feedback=this.root.querySelector("[data-trainer-feedback]");if(result.correct){feedback.textContent="✓ 這一步正確。";feedback.className="trainer-feedback good";}else{feedback.textContent=`這一步先不要看完整答案。${result.diagnosis.message}`;feedback.className="trainer-feedback bad";}setTimeout(()=>{if(this.session.ended)this.renderReport();else this.renderQuestion(this.session.next());},result.correct?420:700);}
    showHint(){const h=this.session.hint(),el=this.root.querySelector("[data-trainer-hint-text]");if(h)el.textContent=`Hint ${h.index}/${h.total} · ${h.text}`;}
    renderMastery(){const wrap=this.root.querySelector("[data-mastery-list]");wrap.innerHTML="";for(const skill of SKILL_ORDER){const s=this.session.mastery.skills[skill],row=document.createElement("div");row.className="mastery-row";row.innerHTML=`<span>${skill}</span><div class="mastery-bar"><i style="width:${Math.round(s.mastery_score*100)}%"></i></div><b>${Math.round(s.mastery_score*100)}%</b>`;wrap.appendChild(row);}}
    renderCircuit(model,highlight){const m=model||new CircuitModel({vplus:1.8,vleft:1.2,rleftK:20,rfK:40}),s=Solver.solve(m);for(const el of this.root.querySelectorAll("[data-circuit-part]"))el.classList.toggle("active",el.dataset.circuitPart===highlight);const set=(sel,text)=>{const e=this.root.querySelector(sel);if(e)e.textContent=text;};set("[data-label-vleft]",`${fmt(m.vleft)} V`);set("[data-label-vplus]",`V+ = ${fmt(m.vplus)} V`);set("[data-label-vminus]",`V− ≈ ${fmt(s.vminus)} V`);set("[data-label-rleft]",`${fmt(m.rleftK)} kΩ`);set("[data-label-rf]",`${fmt(m.rfK)} kΩ`);set("[data-label-vout]","Vout = ?");}
    renderReport(){const r=this.session.report();this.root.querySelector("[data-trainer-question-card]").hidden=true;const box=this.root.querySelector("[data-trainer-report]");box.hidden=false;const names=a=>a.length?a.join("、"):"—";box.querySelector("[data-report-summary]").textContent=`${r.correct}/${r.questions} 個 reasoning steps 正確`;box.querySelector("[data-report-strong]").textContent=names(r.strong);box.querySelector("[data-report-weak]").textContent=names(r.weak);box.querySelector("[data-report-error]").textContent=r.repeatedError||"—";box.querySelector("[data-report-next]").textContent=r.recommendedNext||"—";const changes=r.masteryChange.filter(x=>Math.abs(x.delta)>.001).map(x=>`${x.skill}: ${Math.round(x.before*100)}% → ${Math.round(x.after*100)}%`).join("\n");box.querySelector("[data-report-change]").textContent=changes||"本次尚無可量測變化";}
  }

  function autoMount(){if(typeof document==="undefined")return;const el=document.querySelector("[data-opamp-dc-trainer]");if(el&&!el.__trainer){el.__trainer=new UI(el,{targetQuestions:Number(el.dataset.questions)||15});}}
  if(typeof document!=="undefined"){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",autoMount);else setTimeout(autoMount,0);}

  return {VERSION,STORAGE_KEY,ERROR_TYPES,SKILL_ORDER,SKILL_GRAPH,CircuitModel,Solver,SkillGraph,QuestionGenerator,AnswerEvaluator,ErrorDiagnoser,AdaptiveEngine,MasteryTracker,SessionManager,UI,autoMount};
});