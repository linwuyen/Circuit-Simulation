(function(root,factory){
  const api=factory(root);
  root.CircuitTILearning=api;
})(globalThis,function(root){
  "use strict";

  const $=id=>document.getElementById(id);
  const E=root.CircuitEvidence;
  const B=root.CircuitTrainingExperiments;
  const C=root.CircuitTILearningCore;
  const ITEM_ID="ti:buck-energy-flow";
  const STORE_KEY="tiEngineeringLearning";
  let card=null,source=null,record=null,scenario=null,stage=0,phase=0,running=false,raf=0;
  let dutyPct=50;

  function textNodeLabel(strong,label){
    if(!strong||!strong.parentElement) return;
    const node=[...strong.parentElement.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
    if(node) node.nodeValue=label;
  }
  function today(){return C.isoDayLocal(new Date());}
  function loadRecord(){
    const state=E.load();
    return state.benchmark?.[STORE_KEY]?.concepts?.[C.lesson.id]||{version:1,progress:0,history:[],attempts:0};
  }
  function saveRecord(patch){
    const state=E.load();
    state.benchmark[STORE_KEY]||={version:1,concepts:{}};
    state.benchmark[STORE_KEY].concepts||={};
    const prev=state.benchmark[STORE_KEY].concepts[C.lesson.id]||{version:1,progress:0,history:[],attempts:0};
    record={...prev,...patch,version:1,updatedAt:new Date().toISOString()};
    state.benchmark[STORE_KEY].concepts[C.lesson.id]=record;
    E.save(state);
    renderProgress();
    return record;
  }
  async function loadSource(){
    const [cards,manifest]=await Promise.all([
      fetch("learning/ti/concept-cards.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Concept Cards 載入失敗");return r.json();}),
      fetch("learning/ti/manifest.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("TI manifest 載入失敗");return r.json();})
    ]);
    card=cards.cards.find(x=>x.id===C.lesson.id);
    source=manifest.documents.find(x=>x.id===C.lesson.sourceId);
    if(!card||!source) throw Error("TI Buck lesson source closure missing");
  }
  function route(){
    const list=$("workspace-route"); if(!list)return;
    list.replaceChildren();
    const li=document.createElement("li");
    const b=document.createElement("button");
    b.type="button";b.textContent="1. Buck 能量流與電流斜率";b.setAttribute("aria-current","step");
    li.append(b);list.append(li);
    const parent=list.closest("details");if(parent){parent.open=false;parent.querySelector("summary").textContent="Learning path · 1 / 15";}
  }
  function setHeader(){
    const header=document.querySelector(".workspace-header strong");
    if(header) header.textContent="TI 工程學習・從預測到波形證據";
    const entry=$("open-ti-learning");
    if(entry){
      entry.textContent="返回主線";
      entry.onclick=()=>{location.hash="";location.reload();};
    }
  }
  function renderProgress(){
    const p=$("workspace-progress");if(!p)return;
    if(record?.progress===4) p.textContent=`Buck energy flow · ${String(record.lastResult||"").toUpperCase()} · 下次複習 ${record.nextReview||"—"}`;
    else p.textContent="Buck energy flow · Predict → Simulate → Observe → Explain";
  }
  function setupSurface(){
    $("setup-panel").hidden=true;
    $("free-controls").hidden=true;
    $("concept-note").hidden=true;
    $("transfer-preview").hidden=true;
    $("workbench-context-slot").hidden=true;
    $("surface-title").textContent="Buck First-Cycle Lab";
    let hud=document.getElementById("ti-sim-hud");
    if(!hud){
      hud=document.createElement("div");hud.id="ti-sim-hud";hud.className="ti-sim-hud";
      hud.innerHTML='<span>Vin <strong>48 V</strong></span><span>fsw <strong>100 kHz</strong></span><span>L <strong>100 µH</strong></span><span>R <strong>5 Ω</strong></span><span class="ti-mode">CCM</span>';
      $("surface-title").after(hud);
    }
    $("ws-count").textContent="TI Concept 1 / 15 · SLVA057";
    $("ws-title").textContent="Buck 能量流：Duty 變大，最先發生什麼？";
    $("ws-intro").textContent="先預測，再動 Duty。觀察 switch state → vL → di/dt → iL。";
    $("ws-save").textContent=E.storageStatus().saved?"作答與複習日期會寫進既有 circuit-learning-state-v5。":"目前瀏覽器儲存不可用，請先不要把這次作答當成已保存。";
    textNodeLabel($("ws-voltage"),"初始 Vout");
    textNodeLabel($("ws-current"),"初始平均 iL");
    textNodeLabel($("ws-display"),"首週期淨 ΔiL");
    $("ws-display-wrap").hidden=false;
    $("ws-voltage").textContent=scenario.vout0.toFixed(2)+" V";
    $("ws-current").textContent=scenario.avgI0.toFixed(2)+" A";
    $("ws-display").textContent=stage>=2?scenario.after.deltaI.toFixed(2)+" A":"先預測";
    $("ws-control-label").textContent="Duty command（%）";
    Object.assign($("ws-control"),{min:25,max:50,step:5,value:dutyPct});
    $("ws-value").textContent=dutyPct+"%";
    $("ws-target").textContent=stage===0?"Prediction lock：先做判斷，波形才解鎖。":"把 Duty 拉到 50%，再執行第一個 PWM 週期。";
    $("ws-control").disabled=stage!==1;
    $("scope-note").textContent=scenario.boundary;
    const words=$("context-words");words.replaceChildren();
    const d=document.createElement("details"),s=document.createElement("summary"),p=document.createElement("p");
    s.textContent="這一課在看什麼？";p.textContent="不是比較兩個穩態，而是把 Vout 暫時固定在舊值，觀察 duty 命令剛改變後的第一個 PWM 週期。";
    d.append(s,p);words.append(d);
    let bar=document.getElementById("ti-sim-toolbar");
    if(!bar){
      bar=document.createElement("div");bar.id="ti-sim-toolbar";bar.className="ti-sim-toolbar";
      bar.innerHTML='<button id="ti-run" type="button">Run</button><button id="ti-pause" type="button">Pause</button><button id="ti-reset" type="button">Reset view</button><span id="ti-scope-status">Scope locked</span>';
      $("ws-plot").before(bar);
      bar.querySelector("#ti-run").onclick=()=>{if(stage>=2)startAnimation();};
      bar.querySelector("#ti-pause").onclick=()=>stopAnimation();
      bar.querySelector("#ti-reset").onclick=()=>{stopAnimation();setCircuitPhase(.1);};
    }
    bar.querySelector("#ti-run").disabled=stage<2;
    bar.querySelector("#ti-pause").disabled=stage<2;
    bar.querySelector("#ti-reset").disabled=stage<2;
    bar.querySelector("#ti-scope-status").textContent=stage<2?"Scope locked · predict first":"Scope active · first PWM cycle";
    renderSource();
  }
  function renderSource(){
    const box=$("surface-help");box.replaceChildren();
    const wrap=document.createElement("div");wrap.className="ti-source";
    const title=document.createElement("strong");title.textContent="TI primary source";
    const a=document.createElement("a");a.href=source.url;a.target="_blank";a.rel="noopener";a.textContent=`${source.id} — ${source.title}`;
    const note=document.createElement("span");note.textContent=" · primary source";
    wrap.append(title,a,note);box.append(wrap);
  }
  function svgEl(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;
  }
  function drawPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;
    const grid=svgEl("g",{"class":"ti-scope-grid"});
    for(let i=1;i<10;i++)grid.append(svgEl("path",{d:`M${70+i*58} 35V225`}));
    for(let i=1;i<6;i++)grid.append(svgEl("path",{d:`M70 ${35+i*31.5}H650`}));
    svg.append(grid);
    if(stage<2){
      svg.append(svgEl("text",{x:"245",y:"122","class":"ti-scope-lock"},"WAVEFORM LOCKED"));
      svg.append(svgEl("text",{x:"205",y:"150","class":"ti-scope-lock-sub"},"先提交預測，再解鎖第一個 PWM 週期"));
      svg.setAttribute("aria-label","波形目前鎖定，先提交預測後才能查看。");
      $("ws-comparison").textContent="Prediction integrity：先做判斷，再看證據。";
      return;
    }
    const before=scenario.before.rows,after=scenario.after.rows;
    const all=[...before,...after],lo=Math.min(...all.map(r=>r.iL))-.15,hi=Math.max(...all.map(r=>r.iL))+.15,T=scenario.periodUs;
    const x=t=>70+t/T*580,y=i=>220-(i-lo)/(hi-lo)*160;
    svg.append(svgEl("path",{d:"M70 45V220H650",stroke:"#9eb3c5",fill:"none","stroke-width":"2"}));
    svg.append(svgEl("text",{x:"70",y:"28"},"iL (A)"));
    svg.append(svgEl("text",{x:"300",y:"258"},"第一個 PWM 週期 (µs)"));
    const line=(rows,stroke,dash)=>svgEl("polyline",{points:rows.map(r=>`${x(r.tUs)},${y(r.iL)}`).join(" "),fill:"none",stroke,"stroke-width":"3","stroke-dasharray":dash||""});
    svg.append(line(before,"#aebcca","7 5"));svg.append(line(after,"#63dfbc",""));
    const oldOff=x(scenario.before.onUs),newOff=x(scenario.after.onUs);
    svg.append(svgEl("path",{d:`M${oldOff} 45V220`,stroke:"#aebcca","stroke-dasharray":"4 5"}));
    svg.append(svgEl("path",{d:`M${newOff} 45V220`,stroke:"#f0c967","stroke-dasharray":"4 5"}));
    svg.append(svgEl("text",{x:String(oldOff-25),y:"238"},"25%"));
    svg.append(svgEl("text",{x:String(newOff-20),y:"238"},"50%"));
    svg.setAttribute("aria-label","灰色虛線為原本 25% duty；綠色為 duty 改成 50% 後的第一個 PWM 週期。");
    $("ws-comparison").textContent=`ON slope ${scenario.after.onSlopeAUs.toFixed(2)} A/µs、OFF slope ${scenario.after.offSlopeAUs.toFixed(2)} A/µs；Duty 改變先改作用時間，第一週期淨 ΔiL = +${scenario.after.deltaI.toFixed(2)} A。`;
  }
  function setCircuitPhase(p){
    phase=p;
    const on=phase<dutyPct/100;
    $("switch").setAttribute("d",on?"M140 70H200":"M140 70L200 45");
    $("on-path").style.display=on?"":"none";
    $("off-path").style.display=on?"none":"";
    const rows=scenario.after.rows,index=Math.min(rows.length-1,Math.round(phase*(rows.length-1))),i=rows[index].iL;
    const vL=on?(scenario.config.vin-scenario.vout0):-scenario.vout0;
    const slope=on?scenario.after.onSlopeAUs:scenario.after.offSlopeAUs;
    $("circuit-state").textContent=`${on?"ON":"OFF"}：vL ≈ ${vL.toFixed(1)} V，di/dt ≈ ${slope.toFixed(2)} A/µs，此刻 iL ≈ ${i.toFixed(2)} A。`;
  }
  function animate(ts){
    if(!running)return;
    setCircuitPhase((ts/2400)%1);
    raf=requestAnimationFrame(animate);
  }
  function startAnimation(){
    if(running)return;running=true;document.body.dataset.tiRunning="true";raf=requestAnimationFrame(animate);
  }
  function stopAnimation(){running=false;if(raf)cancelAnimationFrame(raf);}
  function choiceField(parent,name,choices,selected){
    const f=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="你的判斷";f.append(legend);
    choices.forEach(([v,label])=>{
      const l=document.createElement("label"),input=document.createElement("input");input.type="radio";input.name=name;input.value=v;input.checked=selected===v;
      l.append(input,document.createTextNode(" "+label));f.append(l);
    });parent.append(f);return f;
  }
  function setSteps(){
    const nav=$("ws-steps");nav.replaceChildren();
    ["先猜","操作","觀察","說原因"].forEach((label,i)=>{
      const b=document.createElement("button");b.type="button";b.textContent=`${i+1}. ${label}`;b.disabled=true;
      if(stage===i||stage===4&&i===3)b.setAttribute("aria-current","step");
      nav.append(b);
    });
  }
  function questionTitle(text){
    const h=document.createElement("h2");h.textContent=text;h.tabIndex=-1;$("ws-question").append(h);return h;
  }
  function feedback(msg){$("ws-feedback").textContent=msg||"";}
  function predictionStage(){
    questionTitle("先猜一次");
    const p=document.createElement("p");p.textContent=card.questions.find(q=>q.mode==="predict")?.prompt||"Duty 增加後，第一個 PWM 週期的 iL 最先怎麼變？";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-predict",C.lesson.predictionChoices,record.predictionFirst);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="提交預測，再解鎖模擬";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-predict"]:checked')?.value;if(!answer){feedback("先選一個預測。");return;}
      const correct=answer===C.lesson.predictionExpected;
      try{E.commitPrediction(ITEM_ID,{prediction:answer,parameters:"Vin=48 V; Duty 25%→50%; L=100 µH; fsw=100 kHz; R=5 Ω; first-cycle Vout frozen",confidence:70});}catch(error){feedback(error.message);return;}
      saveRecord({progress:1,predictionFirst:answer,predictionCorrect:correct,startedAt:record.startedAt||new Date().toISOString()});
      stage=1;feedback("預測已鎖定。現在才可以動 Duty。");render();
    };
    $("ws-question").append(b);
  }
  function operateStage(){
    questionTitle("操作：只改 Duty");
    const p=document.createElement("p");p.textContent="把 Duty 從 25% 拉到 50%。在你按下開始前，新的波形仍保持隱藏。";$("ws-question").append(p);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="開始模擬第一個 PWM 週期";b.disabled=dutyPct!==50;
    b.onclick=()=>{
      scenario=C.buildFirstCycle(B.buck,{duty:.25},.5);
      E.recordMachine(ITEM_ID,"ti-learning-workspace",{
        vin:scenario.config.vin,dutyBefore:.25,dutyAfter:.5,voutFrozen:scenario.vout0,
        onSlopeAUs:scenario.after.onSlopeAUs,offSlopeAUs:scenario.after.offSlopeAUs,deltaI:scenario.after.deltaI
      },{passed:false,model:{id:"buck-first-cycle-v1",version:"1",boundary:scenario.boundary}});
      E.recordStep(ITEM_ID,"operate",true);
      saveRecord({progress:2,operated:true,machineAt:new Date().toISOString()});
      stage=2;render();startAnimation();
    };
    $("ws-question").append(b);
    $("ws-control").oninput=()=>{
      dutyPct=Number($("ws-control").value);$("ws-value").textContent=dutyPct+"%";b.disabled=dutyPct!==50;
    };
  }
  function observationStage(){
    questionTitle("觀察：波形真正先改了什麼？");
    const p=document.createElement("p");p.textContent="灰色是原本 25%，綠色是改成 50% 後、Vout 還來不及改變的第一個週期。";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-observe",C.lesson.observationChoices);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="檢查觀察";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-observe"]:checked')?.value;if(!answer){feedback("先選你從波形看到的現象。");return;}
      const correct=answer===C.lesson.observationExpected;
      const first=record.observationFirst??answer,firstCorrect=record.observationFirstCorrect??correct;
      E.recordOpenResponse(ITEM_ID+":observation",{answer,correct,firstAttempt:record.observationFirst==null});
      saveRecord({observationFirst:first,observationFirstCorrect:firstCorrect,observationPassed:correct,progress:correct?3:2});
      if(!correct){feedback("再看兩件事：電感電流能不能瞬間跳？25% 與 50% 的關斷點在哪裡？");return;}
      E.recordStep(ITEM_ID,"interpret",true);stage=3;feedback("觀察成立。最後把原因講對。");render();
    };
    $("ws-question").append(b);
  }
  function reasonStage(){
    questionTitle("說原因：把因果鏈接起來");
    const p=document.createElement("p");p.textContent="為什麼 Duty 增加後，第一個週期是『時間先改、電流逐步改』，而不是 iL 瞬間跳高？";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-reason",C.lesson.reasonChoices);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="完成這次 Learning Loop";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-reason"]:checked')?.value;if(!answer){feedback("先選一個原因。");return;}
      const correct=answer===C.lesson.reasonExpected;
      const first=record.reasonFirst??answer,firstCorrect=record.reasonFirstCorrect??correct;
      E.recordOpenResponse(ITEM_ID+":reason",{answer,correct,firstAttempt:record.reasonFirst==null});
      saveRecord({reasonFirst:first,reasonFirstCorrect:firstCorrect,reasonPassed:correct});
      if(!correct){feedback("關鍵不是『Duty 把電壓變大』；先回到 vL=L·di/dt，再問 Duty 到底直接改的是電壓值，還是作用時間。");return;}
      const current=loadRecord();
      const result=C.gradeResult({
        predictionCorrect:!!current.predictionCorrect,
        observationFirstCorrect:!!current.observationFirstCorrect,
        reasonFirstCorrect:!!current.reasonFirstCorrect,
        reasonPassed:true
      });
      const final=C.applyResult(current,result,today(),{
        predictionFirst:current.predictionFirst,
        observationFirst:current.observationFirst,
        reasonFirst:current.reasonFirst
      });
      const state=E.load();state.benchmark[STORE_KEY]||={version:1,concepts:{}};state.benchmark[STORE_KEY].concepts[C.lesson.id]=final;E.save(state);record=final;
      const pre=E.predictionStatus(ITEM_ID);
      E.recordEvidence(ITEM_ID,2,"ti-learning-workspace",{result,nextReview:final.nextReview,sourceIds:card.sourceIds},{
        strength:result==="pass"&&pre.preRegistered?"B":"none",stage:"practiced"
      });
      stage=4;feedback("");render();
    };
    $("ws-question").append(b);
  }
  function resultStage(){
    questionTitle("這次 Learning Loop 完成");
    const result=document.createElement("div");result.className="ti-grade";
    const grade=document.createElement("strong");grade.textContent="Grade: "+String(record.lastResult||"").toUpperCase();
    const causal=document.createElement("p");causal.textContent="因果鏈：Duty ↑ → ON 時間 ↑ → Vout 尚未改變時 ON/OFF 的 vL 與斜率近似不變 → 正斜率作用更久 → 單週期伏秒暫時不平衡 → iL 淨上升 → 之後 Vout 才逐步改變。";
    const review=document.createElement("p");review.textContent="下一次複習："+record.nextReview+"。紀錄已寫入既有 circuit-learning-state-v5。";
    result.append(grade,causal,review);$("ws-question").append(result);
    $("ws-result").hidden=false;$("ws-ability").textContent="已練習：從 switch state / vL / di/dt / 時間長度推導 Buck 暫態方向。";
    $("ws-transition").textContent="下一次到期後應換成 diagnose / transfer 條件，而不是重背同一題。";
    $("ws-next").textContent="重新看這次波形";$("ws-next").onclick=()=>{stage=2;render();startAnimation();};
  }
  function renderQuestion(){
    $("ws-question").replaceChildren();feedback("");setSteps();
    $("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    if(stage===0)predictionStage();
    else if(stage===1)operateStage();
    else if(stage===2)observationStage();
    else if(stage===3)reasonStage();
    else resultStage();
  }
  function render(){
    record=loadRecord();stage=Number(record.progress||0);dutyPct=stage<=1?25:50;
    scenario=C.buildFirstCycle(B.buck,{duty:.25},dutyPct/100);
    setupSurface();route();renderProgress();renderQuestion();drawPlot();
    if(stage>=2){$("ws-display").textContent=scenario.after.deltaI.toFixed(2)+" A";setCircuitPhase(.1);}
    else{$("on-path").style.display="none";$("off-path").style.display="none";$("circuit-state").textContent="結果先鎖住：先提交預測，再操作 Duty。";}
    if(stage!==1)$("ws-control").oninput=null;
  }
  async function mount(){
    if(!E||!B||!C) throw Error("TI learning dependencies missing");
    document.body.dataset.tiLearning="true";
    setHeader();renderProgress();
    try{await loadSource();record=loadRecord();stage=Number(record.progress||0);render();if(stage>=2)startAnimation();}
    catch(error){$("ws-title").textContent="TI Engineering Learning 載入失敗";$("ws-intro").textContent=error.message;console.error(error);}
  }
  root.addEventListener?.("beforeunload",stopAnimation);
  return {mount};
});
