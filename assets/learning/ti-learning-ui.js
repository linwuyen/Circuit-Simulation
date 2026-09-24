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
  const DEFAULT_CONFIG={vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0};
  const COMPACT={
    prediction:[
      ["time-first","ON 時間先變長"],
      ["slope-first","di/dt 立刻變陡"],
      ["jump","iL 瞬間跳高"]
    ],
    observation:[
      ["net-rise","斜率近似不變，ON 區段拉長"],
      ["jump","iL 出現垂直跳變"],
      ["same-cycle","第一週期完全不變"]
    ],
    reason:[
      ["volt-second","Duty 先改作用時間，造成伏秒不平衡"],
      ["vin-change","Duty 直接提高 Vin"],
      ["controller-jump","PWM command 直接讓 iL 跳變"]
    ]
  };
  const COMPONENTS={
    vin:{label:"Vin",unit:"V",key:"vin",min:24,max:72,step:6,box:[24,92,76,142],help:"輸入電壓。改 Vin 會改 ON 狀態的 vL 與 di/dt。"},
    switch:{label:"Switch / PWM",box:[118,20,105,88],help:"開關由 Duty command 控制；這一課真正直接改變的是 ON/OFF 的作用時間。"},
    diode:{label:"Freewheel diode",box:[226,112,70,84],help:"OFF 時提供續流路徑，讓電感電流不會因開關關閉而瞬間消失。"},
    inductor:{label:"L",unit:"µH",key:"inductanceUh",min:50,max:300,step:50,box:[270,18,145,105],help:"vL=L·di/dt。L 越大，同樣 vL 下電流斜率越小。"},
    capacitor:{label:"C",unit:"µF",key:"capacitanceUf",min:47,max:1000,step:47,box:[470,100,85,105],help:"C 主要影響輸出電壓的短期保持與漣波；本題第一週期近似把舊 Vout 凍結。"},
    load:{label:"R",unit:"Ω",key:"loadOhm",min:1,max:10,step:1,box:[570,96,80,115],help:"負載決定原工作點電流。這裡限制在 CCM 範圍內，避免換掉題目的物理模型。"}
  };

  let card=null,source=null,record=null,scenario=null,stage=0,phase=.1,running=false,raf=0;
  let dutyPct=25,simConfig={...DEFAULT_CONFIG},selectedComponent="inductor",focusTrace=null;
  let cursorA=.25,cursorB=.5,activeCursor="a";

  function svgEl(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
    if(text)n.textContent=text;
    return n;
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
  function parameterSummary(){
    return `Vin=${simConfig.vin} V; Duty 25%→50%; L=${simConfig.inductanceUh} µH; fsw=${simConfig.fswKhz} kHz; R=${simConfig.loadOhm} Ω; C=${simConfig.capacitanceUf} µF; first-cycle Vout frozen`;
  }
  async function loadSource(){
    const [cards,manifest]=await Promise.all([
      fetch("learning/ti/concept-cards.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Concept Cards 載入失敗");return r.json();}),
      fetch("learning/ti/manifest.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("TI manifest 載入失敗");return r.json();})
    ]);
    card=cards.cards.find(x=>x.id===C.lesson.id);
    source=manifest.documents.find(x=>x.id===C.lesson.sourceId);
    if(!card||!source)throw Error("TI Buck lesson source closure missing");
  }
  function route(){
    const list=$("workspace-route");if(!list)return;
    list.replaceChildren();
    const li=document.createElement("li"),b=document.createElement("button");
    b.type="button";b.textContent="1. Buck 能量流與電流斜率";b.setAttribute("aria-current","step");
    li.append(b);list.append(li);
    const parent=list.closest("details");
    if(parent){parent.open=false;parent.querySelector("summary").textContent="Learning path · 1 / 15";}
  }
  function setHeader(){
    const header=document.querySelector(".workspace-header strong");
    if(header)header.textContent="TI 工程學習・從預測到波形證據";
    const entry=$("open-ti-learning");
    if(entry){entry.textContent="返回主線";entry.onclick=()=>{location.hash="";location.reload();};}
  }
  function renderProgress(){
    const p=$("workspace-progress");if(!p)return;
    p.textContent=record?.progress===4
      ? `Buck energy flow · ${String(record.lastResult||"").toUpperCase()} · 下次複習 ${record.nextReview||"—"}`
      : "Buck energy flow · Predict → Simulate → Observe → Explain";
  }
  function renderHud(){
    let hud=$("ti-sim-hud");
    if(!hud){
      hud=document.createElement("div");hud.id="ti-sim-hud";hud.className="ti-sim-hud";
      $("surface-title").after(hud);
    }
    hud.replaceChildren();
    const items=[
      ["Vin",simConfig.vin+" V","vin"],
      ["fsw",simConfig.fswKhz+" kHz",null],
      ["L",simConfig.inductanceUh+" µH","inductor"],
      ["C",simConfig.capacitanceUf+" µF","capacitor"],
      ["R",simConfig.loadOhm+" Ω","load"]
    ];
    items.forEach(([name,value,component])=>{
      const b=document.createElement(component?"button":"span");
      b.className="ti-hud-chip";b.innerHTML=`${name} <strong>${value}</strong>`;
      if(component){b.type="button";b.onclick=()=>selectComponent(component);}
      hud.append(b);
    });
    const mode=document.createElement("span");mode.className="ti-mode";mode.textContent=scenario?.config?"CCM":"—";hud.append(mode);
  }
  function renderSource(){
    const box=$("surface-help");box.replaceChildren();
    const wrap=document.createElement("div");wrap.className="ti-source";
    const title=document.createElement("strong");title.textContent="TI";
    const a=document.createElement("a");a.href=source.url;a.target="_blank";a.rel="noopener";a.textContent=`${source.id} — ${source.title}`;
    wrap.append(title,a);box.append(wrap);
  }
  function ensureCircuitStage(){
    const circuit=$("circuit"),state=$("circuit-state");
    let stageBox=$("ti-circuit-stage");
    if(!stageBox){
      stageBox=document.createElement("div");
      stageBox.id="ti-circuit-stage";
      stageBox.className="ti-circuit-stage";
      circuit.before(stageBox);
      stageBox.append(circuit);
      if(state)stageBox.append(state);
    }
    return stageBox;
  }
  function installCircuitInteractivity(){
    const svg=$("circuit");
    let layer=svg.querySelector("#ti-component-hit-layer");
    if(!layer){layer=svgEl("g",{id:"ti-component-hit-layer"});svg.append(layer);}
    layer.replaceChildren();
    Object.entries(COMPONENTS).forEach(([id,c])=>{
      const [x,y,w,h]=c.box;
      const hit=svgEl("rect",{x,y,width:w,height:h,rx:12,class:"ti-component-hit"+(id===selectedComponent?" is-selected":""),tabindex:"0",role:"button","data-component":id,"aria-label":"選擇 "+c.label});
      hit.addEventListener("click",()=>selectComponent(id));
      hit.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectComponent(id);}});
      layer.append(hit);
    });
    renderInspector();
  }
  function selectComponent(id){
    if(!COMPONENTS[id])return;
    selectedComponent=id;
    document.querySelectorAll(".ti-component-hit").forEach(n=>n.classList.toggle("is-selected",n.dataset.component===id));
    renderInspector();
    const trace={switch:"pwm",inductor:"il",vin:"vl",diode:"vl",capacitor:"vout",load:"il"}[id]||null;
    highlightTrace(trace);
  }
  function refreshScenarioPreview(){
    scenario=C.buildFirstCycle(B.buck,{...simConfig,duty:.25},Math.max(.251,dutyPct/100));
    renderHud();
    if(stage>=2){drawPlot();setCircuitPhase(phase);}
  }
  function cursorCurrent(ph){
    const rows=scenario?.after?.rows||[];
    if(!rows.length)return 0;
    const pos=Math.max(0,Math.min(rows.length-1,ph*(rows.length-1)));
    const i=Math.floor(pos),mix=pos-i;
    const a=rows[i]?.iL??0,b=rows[Math.min(rows.length-1,i+1)]?.iL??a;
    return a+(b-a)*mix;
  }
  function updateCursorReadout(){
    const out=$("ti-cursor-readout");if(!out||!scenario)return;
    const dt=Math.abs(cursorB-cursorA)*scenario.periodUs;
    const di=cursorCurrent(cursorB)-cursorCurrent(cursorA);
    out.textContent=`Δt ${dt.toFixed(3)} µs · Δi ${di>=0?"+":""}${di.toFixed(3)} A`;
    $("ti-cursor-a-btn")?.classList.toggle("is-active",activeCursor==="a");
    $("ti-cursor-b-btn")?.classList.toggle("is-active",activeCursor==="b");
  }
  function setScopeCursorFromEvent(event){
    if(stage<2||!scenario)return;
    const svg=$("ws-plot"),rect=svg.getBoundingClientRect();
    const xPx=event.clientX-rect.left;
    const phase=Math.max(0,Math.min(1,(xPx/rect.width*720-95)/555));
    if(activeCursor==="a"){cursorA=phase;activeCursor="b";}else{cursorB=phase;activeCursor="a";}
    const x=95+phase*555;
    const id=activeCursor==="b"?"ti-cursor-a":"ti-cursor-b";
    $(id)?.setAttribute("d",`M${x} 20V312`);
    updateCursorReadout();
  }
  function renderInspector(){
    let panel=$("ti-component-inspector");
    if(!panel){
      panel=document.createElement("div");panel.id="ti-component-inspector";panel.className="ti-component-inspector";
      ensureCircuitStage().append(panel);
    }
    const c=COMPONENTS[selectedComponent];panel.replaceChildren();
    const head=document.createElement("div");head.className="ti-inspector-head";
    const title=document.createElement("strong");title.textContent=c.label;
    const state=document.createElement("span");state.textContent=stage===0?"editable":"locked after prediction";
    head.append(title,state);panel.append(head);
    const help=document.createElement("p");help.textContent=c.help;help.title=c.help;panel.append(help);
    if(c.key){
      const row=document.createElement("label");row.className="ti-param-row";
      const value=document.createElement("output");value.textContent=simConfig[c.key]+" "+c.unit;
      const input=document.createElement("input");input.type="range";input.min=c.min;input.max=c.max;input.step=c.step;input.value=simConfig[c.key];input.disabled=stage!==0;
      input.oninput=()=>{
        value.textContent=input.value+" "+c.unit;
        if(stage!==0)return;
        simConfig={...simConfig,[c.key]:Number(input.value)};
        saveRecord({simConfig:{...simConfig}});
        refreshScenarioPreview();
      };
      input.onchange=()=>{ if(stage===0) render(); };
      row.append(input,value);panel.append(row);
    }else{
      const note=document.createElement("span");note.className="ti-inspector-note";note.textContent=selectedComponent==="switch"?"Use Duty command slider in step 2.":"No adjustable parameter in this lesson.";panel.append(note);
    }
  }
  function renderCausalChain(){
    let chain=$("ti-causal-chain");
    if(!chain){
      chain=document.createElement("div");chain.id="ti-causal-chain";chain.className="ti-causal-chain";
      const toolbar=$("ti-sim-toolbar");
      const status=$("ti-scope-status");
      if(toolbar&&status)toolbar.insertBefore(chain,status);
    }
    chain.replaceChildren();
    if(stage<2){
      const lock=document.createElement("span");lock.className="ti-causal-lock";lock.textContent="Causal chain unlocks after simulation";chain.append(lock);return;
    }
    const steps=[
      ["pwm","Duty ↑","switch"],
      ["pwm","ON time ↑","switch"],
      ["vl","vL positive dwell ↑","inductor"],
      ["il","ΔiL ↑","inductor"]
    ];
    steps.forEach(([trace,label,component],i)=>{
      if(i){const arrow=document.createElement("span");arrow.className="ti-causal-arrow";arrow.textContent="→";chain.append(arrow);}
      const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>{selectComponent(component);highlightTrace(trace);};chain.append(b);
    });
  }
  function highlightTrace(trace){
    focusTrace=trace;
    document.querySelectorAll("#ws-plot [data-trace]").forEach(n=>{
      n.classList.toggle("ti-trace-dim",!!trace&&n.dataset.trace!==trace);
      n.classList.toggle("ti-trace-focus",!!trace&&n.dataset.trace===trace);
    });
  }
  function setupSurface(){
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    $("surface-title").textContent="Buck First-Cycle Lab";
    $("ws-count").textContent="TI Concept 1 / 15 · SLVA057";
    $("ws-title").textContent="Duty 變大，最先發生什麼？";
    $("ws-intro").textContent="Predict first. Then inspect PWM → vL → iL.";
    $("ws-save").textContent=E.storageStatus().saved?"Saved in circuit-learning-state-v5":"Storage unavailable — do not count this attempt as saved.";
    $("metrics")?.setAttribute?.("hidden","");
    $("ws-control-label").textContent="Duty command (%)";
    Object.assign($("ws-control"),{min:25,max:50,step:5,value:dutyPct});
    $("ws-value").textContent=dutyPct+"%";
    $("ws-target").textContent=stage===0?"Prediction lock：先判斷，再看波形。":"Move Duty to 50%, then run one PWM cycle.";
    $("ws-control").disabled=stage!==1;
    $("scope-note").textContent=scenario.boundary;
    renderHud();
    ensureCircuitStage();
    installCircuitInteractivity();

    let bar=$("ti-sim-toolbar");
    if(!bar){
      bar=document.createElement("div");bar.id="ti-sim-toolbar";bar.className="ti-sim-toolbar";
      bar.innerHTML='<strong class="ti-scope-title">SCOPE</strong><button id="ti-run" type="button" title="Run">▶</button><button id="ti-pause" type="button" title="Pause">Ⅱ</button><button id="ti-reset" type="button" title="Reset">↺</button><button id="ti-cursor-a-btn" type="button" title="Set cursor A">A</button><button id="ti-cursor-b-btn" type="button" title="Set cursor B">B</button><span id="ti-cursor-readout"></span><span id="ti-scope-status"></span>';
      $("ws-plot").before(bar);
      $("ti-run").onclick=()=>{if(stage>=2)startAnimation();};
      $("ti-pause").onclick=()=>stopAnimation();
      $("ti-reset").onclick=()=>{stopAnimation();cursorA=.25;cursorB=.5;activeCursor="a";drawPlot();setCircuitPhase(.1);};
      $("ti-cursor-a-btn").onclick=()=>{activeCursor="a";updateCursorReadout();};
      $("ti-cursor-b-btn").onclick=()=>{activeCursor="b";updateCursorReadout();};
      $("ws-plot").addEventListener("click",setScopeCursorFromEvent);
    }
    $("ti-run").disabled=stage<2;$("ti-pause").disabled=stage<2;$("ti-reset").disabled=stage<2;
    $("ti-cursor-a-btn").disabled=stage<2;$("ti-cursor-b-btn").disabled=stage<2;
    $("ti-scope-status").textContent=stage<2?"locked":"first cycle";
    updateCursorReadout();
    renderCausalChain();
    renderSource();
  }
  function scopeGrid(svg){
    const g=svgEl("g",{class:"ti-scope-grid"});
    for(let i=0;i<=10;i++)g.append(svgEl("path",{d:`M${95+i*55} 18V312`}));
    for(let i=0;i<=7;i++)g.append(svgEl("path",{d:`M95 ${20+i*40}H650`}));
    svg.append(g);
  }
  function drawPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;svg.setAttribute("viewBox","0 0 720 330");scopeGrid(svg);
    if(stage<2){
      svg.append(svgEl("text",{x:250,y:155,class:"ti-scope-lock"},"WAVEFORM LOCKED"));
      svg.append(svgEl("text",{x:218,y:184,class:"ti-scope-lock-sub"},"Commit prediction before revealing evidence"));
      svg.setAttribute("aria-label","Waveforms locked until prediction is committed.");
      $("ws-comparison").textContent="Prediction integrity: no waveform evidence before commitment.";
      updateCursorReadout();
      return;
    }
    const T=scenario.periodUs,onUs=scenario.after.onUs,oldOn=scenario.before.onUs;
    const x=t=>95+t/T*555;
    const lanes={pwm:[55,84],vl:[118,158],il:[196,244],vout:[292,315]};
    const label=(name,y)=>svg.append(svgEl("text",{x:18,y,class:"ti-trace-label"},name));
    label("PWM",70);label("vL",140);label("iL",222);label("Vout",307);

    const pwm=svgEl("path",{d:`M95 ${lanes.pwm[1]}V${lanes.pwm[0]}H${x(onUs)}V${lanes.pwm[1]}H650`,class:"ti-trace ti-trace-pwm","data-trace":"pwm","data-component":"switch"});
    svg.append(pwm);

    const posV=scenario.config.vin-scenario.vout0,negV=-scenario.vout0;
    const vlScale=v=>{
      const max=Math.max(Math.abs(posV),Math.abs(negV),1);
      const mid=(lanes.vl[0]+lanes.vl[1])/2;
      return mid-v/max*18;
    };
    const vl=svgEl("path",{d:`M95 ${vlScale(posV)}H${x(onUs)}V${vlScale(negV)}H650`,class:"ti-trace ti-trace-vl","data-trace":"vl","data-component":"inductor"});
    svg.append(vl);
    svg.append(svgEl("text",{x:102,y:vlScale(posV)-6,class:"ti-value-label"},`+${posV.toFixed(1)}V`));
    svg.append(svgEl("text",{x:x(onUs)+8,y:vlScale(negV)+14,class:"ti-value-label"},`${negV.toFixed(1)}V`));

    const rows=scenario.after.rows,old=scenario.before.rows;
    const all=[...rows,...old],lo=Math.min(...all.map(r=>r.iL))-.08,hi=Math.max(...all.map(r=>r.iL))+.08;
    const yi=i=>lanes.il[1]-(i-lo)/(hi-lo)*(lanes.il[1]-lanes.il[0]);
    const points=r=>r.map(v=>`${x(v.tUs)},${yi(v.iL)}`).join(" ");
    svg.append(svgEl("polyline",{points:points(old),class:"ti-trace ti-trace-old","data-trace":"il","data-component":"inductor"}));
    svg.append(svgEl("polyline",{points:points(rows),class:"ti-trace ti-trace-il","data-trace":"il","data-component":"inductor"}));

    const yv=(lanes.vout[0]+lanes.vout[1])/2;
    svg.append(svgEl("path",{d:`M95 ${yv}H650`,class:"ti-trace ti-trace-vout","data-trace":"vout","data-component":"capacitor"}));
    svg.append(svgEl("text",{x:560,y:yv-7,class:"ti-value-label"},`${scenario.vout0.toFixed(1)} V frozen`));

    svg.append(svgEl("path",{d:`M${x(oldOn)} 20V312`,class:"ti-timing ti-timing-old"}));
    svg.append(svgEl("path",{d:`M${x(onUs)} 20V312`,class:"ti-timing ti-timing-new"}));
    svg.append(svgEl("text",{x:x(oldOn)-16,y:324,class:"ti-time-label"},"25%"));
    svg.append(svgEl("text",{x:x(onUs)-16,y:324,class:"ti-time-label"},"50%"));
    svg.append(svgEl("path",{id:"ti-scope-cursor",d:"M95 20V312",class:"ti-scope-cursor"}));
    svg.append(svgEl("path",{id:"ti-cursor-a",d:`M${95+cursorA*555} 20V312`,class:"ti-measure-cursor ti-measure-cursor-a"}));
    svg.append(svgEl("path",{id:"ti-cursor-b",d:`M${95+cursorB*555} 20V312`,class:"ti-measure-cursor ti-measure-cursor-b"}));
    svg.append(svgEl("text",{x:95+cursorA*555+4,y:32,class:"ti-cursor-label"},"A"));
    svg.append(svgEl("text",{x:95+cursorB*555+4,y:32,class:"ti-cursor-label"},"B"));
    svg.querySelectorAll("[data-component]").forEach(node=>node.addEventListener("click",event=>{
      event.stopPropagation();
      selectComponent(node.dataset.component);
      highlightTrace(node.dataset.trace||null);
    }));
    updateCursorReadout();

    svg.setAttribute("aria-label","Four-trace scope showing PWM, inductor voltage, inductor current and frozen output voltage for the first PWM cycle.");
    $("ws-comparison").textContent=`ON ${scenario.after.onUs.toFixed(2)} µs · vL(on) +${posV.toFixed(1)} V · di/dt(on) +${scenario.after.onSlopeAUs.toFixed(3)} A/µs · first-cycle ΔiL +${scenario.after.deltaI.toFixed(3)} A`;
    highlightTrace(focusTrace);
  }
  function setCircuitPhase(p){
    phase=Math.max(0,Math.min(.999,p));
    const on=phase<dutyPct/100;
    $("switch").setAttribute("d",on?"M140 70H200":"M140 70L200 45");
    $("on-path").style.display=on?"":"none";$("off-path").style.display=on?"none":"";
    const rows=scenario.after.rows,index=Math.min(rows.length-1,Math.round(phase*(rows.length-1))),i=rows[index].iL;
    const vL=on?(scenario.config.vin-scenario.vout0):-scenario.vout0;
    const slope=on?scenario.after.onSlopeAUs:scenario.after.offSlopeAUs;
    $("circuit-state").textContent=`${on?"ON":"OFF"}  vL ${vL>=0?"+":""}${vL.toFixed(1)}V  di/dt ${slope>=0?"+":""}${slope.toFixed(3)}A/µs  iL ${i.toFixed(3)}A`;
    const cursor=$("ti-scope-cursor");
    if(cursor){const x=95+phase*555;cursor.setAttribute("d",`M${x} 20V312`);}
  }
  function animate(ts){if(!running)return;setCircuitPhase((ts/2600)%1);raf=requestAnimationFrame(animate);}
  function startAnimation(){if(running)return;running=true;document.body.dataset.tiRunning="true";raf=requestAnimationFrame(animate);}
  function stopAnimation(){running=false;delete document.body.dataset.tiRunning;if(raf)cancelAnimationFrame(raf);}
  function choiceField(parent,name,choices,selected){
    const f=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="Choose";f.append(legend);
    choices.forEach(([v,label])=>{
      const l=document.createElement("label"),input=document.createElement("input");
      input.type="radio";input.name=name;input.value=v;input.checked=selected===v;
      l.append(input,document.createTextNode(" "+label));f.append(l);
    });
    parent.append(f);return f;
  }
  function setSteps(){
    const nav=$("ws-steps");nav.replaceChildren();
    ["Predict","Run","Observe","Explain"].forEach((label,i)=>{
      const b=document.createElement("button");b.type="button";b.textContent=`${i+1}. ${label}`;b.disabled=true;
      if(stage===i||stage===4&&i===3)b.setAttribute("aria-current","step");
      nav.append(b);
    });
  }
  function questionTitle(text){const h=document.createElement("h2");h.textContent=text;h.tabIndex=-1;$("ws-question").append(h);return h;}
  function feedback(msg){$("ws-feedback").textContent=msg||"";}
  function predictionStage(){
    questionTitle("Predict");
    const p=document.createElement("p");p.textContent="Duty 25% → 50%. Before Vout can move, what changes first?";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-predict",COMPACT.prediction,record.predictionFirst);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Lock prediction";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-predict"]:checked')?.value;if(!answer){feedback("先選一個預測。");return;}
      const correct=answer===C.lesson.predictionExpected;
      try{E.commitPrediction(ITEM_ID,{prediction:answer,parameters:parameterSummary(),confidence:70});}catch(error){feedback(error.message);return;}
      saveRecord({progress:1,predictionFirst:answer,predictionCorrect:correct,startedAt:record.startedAt||new Date().toISOString(),simConfig:{...simConfig}});
      stage=1;render();
    };
    $("ws-question").append(b);
  }
  function operateStage(){
    questionTitle("Run one PWM cycle");
    const p=document.createElement("p");p.textContent="Move Duty to 50%. Other component values are locked to your prediction.";$( "ws-question").append(p);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Run first cycle";b.disabled=dutyPct!==50;
    b.onclick=()=>{
      scenario=C.buildFirstCycle(B.buck,{...simConfig,duty:.25},.5);
      E.recordMachine(ITEM_ID,"ti-learning-workspace",{
        config:{...simConfig},dutyBefore:.25,dutyAfter:.5,voutFrozen:scenario.vout0,
        onSlopeAUs:scenario.after.onSlopeAUs,offSlopeAUs:scenario.after.offSlopeAUs,deltaI:scenario.after.deltaI
      },{passed:false,model:{id:"buck-first-cycle-v1",version:"1",boundary:scenario.boundary}});
      E.recordStep(ITEM_ID,"operate",true);
      saveRecord({progress:2,operated:true,machineAt:new Date().toISOString()});
      stage=2;render();startAnimation();
    };
    $("ws-question").append(b);
    $("ws-control").oninput=()=>{dutyPct=Number($("ws-control").value);$("ws-value").textContent=dutyPct+"%";b.disabled=dutyPct!==50;};
  }
  function observationStage(){
    questionTitle("Observe");
    const p=document.createElement("p");p.textContent="Use the four traces and the 25% / 50% timing markers. What actually changed first?";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-observe",COMPACT.observation);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Check observation";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-observe"]:checked')?.value;if(!answer){feedback("先選你從波形看到的現象。");return;}
      const correct=answer===C.lesson.observationExpected;
      const first=record.observationFirst??answer,firstCorrect=record.observationFirstCorrect??correct;
      E.recordOpenResponse(ITEM_ID+":observation",{answer,correct,firstAttempt:record.observationFirst==null});
      saveRecord({observationFirst:first,observationFirstCorrect:firstCorrect,observationPassed:correct,progress:correct?3:2});
      if(!correct){feedback("看 PWM 關斷點、vL 平台長度，以及 iL 有沒有垂直跳變。");highlightTrace("pwm");return;}
      E.recordStep(ITEM_ID,"interpret",true);stage=3;render();
    };
    $("ws-question").append(b);
  }
  function reasonStage(){
    questionTitle("Explain");
    const p=document.createElement("p");p.textContent="Which causal statement explains the first-cycle result?";$("ws-question").append(p);
    choiceField($("ws-question"),"ti-reason",COMPACT.reason);
    const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Complete loop";
    b.onclick=()=>{
      const answer=document.querySelector('input[name="ti-reason"]:checked')?.value;if(!answer){feedback("先選原因。");return;}
      const correct=answer===C.lesson.reasonExpected;
      const first=record.reasonFirst??answer,firstCorrect=record.reasonFirstCorrect??correct;
      E.recordOpenResponse(ITEM_ID+":reason",{answer,correct,firstAttempt:record.reasonFirst==null});
      saveRecord({reasonFirst:first,reasonFirstCorrect:firstCorrect,reasonPassed:correct});
      if(!correct){feedback("回到 vL=L·di/dt：Duty 直接改的是哪個量的『時間』？");selectComponent("inductor");highlightTrace("vl");return;}
      const current=loadRecord();
      const result=C.gradeResult({predictionCorrect:!!current.predictionCorrect,observationFirstCorrect:!!current.observationFirstCorrect,reasonFirstCorrect:!!current.reasonFirstCorrect,reasonPassed:true});
      const final=C.applyResult(current,result,today(),{predictionFirst:current.predictionFirst,observationFirst:current.observationFirst,reasonFirst:current.reasonFirst});
      const state=E.load();state.benchmark[STORE_KEY]||={version:1,concepts:{}};state.benchmark[STORE_KEY].concepts[C.lesson.id]=final;E.save(state);record=final;
      const pre=E.predictionStatus(ITEM_ID);
      E.recordEvidence(ITEM_ID,2,"ti-learning-workspace",{result,nextReview:final.nextReview,sourceIds:card.sourceIds},{strength:result==="pass"&&pre.preRegistered?"B":"none",stage:"practiced"});
      stage=4;render();
    };
    $("ws-question").append(b);
  }
  function resultStage(){
    questionTitle("Loop complete");
    const box=document.createElement("div");box.className="ti-grade";
    const grade=document.createElement("strong");grade.textContent="Grade: "+String(record.lastResult||"").toUpperCase();
    const chain=document.createElement("p");chain.textContent="Duty ↑ → ON time ↑ → positive vL lasts longer → iL gains net current in the first cycle.";
    const review=document.createElement("p");review.textContent="Next review: "+record.nextReview;
    box.append(grade,chain,review);$("ws-question").append(box);
    $("ws-result").hidden=false;$("ws-ability").textContent="Evidence: PWM + vL + iL + frozen Vout.";$("ws-transition").textContent="Next due review should change the condition instead of repeating the same wording.";
    $("ws-next").textContent="Replay scope";$("ws-next").onclick=()=>{stage=2;render();startAnimation();};
  }
  function renderQuestion(){
    $("ws-question").replaceChildren();feedback("");setSteps();
    $("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    if(stage===0)predictionStage();else if(stage===1)operateStage();else if(stage===2)observationStage();else if(stage===3)reasonStage();else resultStage();
  }
  function render(){
    stopAnimation();
    record=loadRecord();stage=Number(record.progress||0);
    simConfig={...DEFAULT_CONFIG,...(record.simConfig||{})};
    dutyPct=stage<=1?25:50;
    scenario=C.buildFirstCycle(B.buck,{...simConfig,duty:.25},dutyPct/100);
    setupSurface();route();renderProgress();drawPlot();renderQuestion();
    if(stage>=2){setCircuitPhase(.1);renderCausalChain();}else{$("on-path").style.display="none";$("off-path").style.display="none";$("circuit-state").textContent="Prediction lock active.";}
    if(stage!==1)$("ws-control").oninput=null;
  }
  async function mount(){
    if(!E||!B||!C)throw Error("TI learning dependencies missing");
    document.body.dataset.tiLearning="true";document.body.dataset.tiWorkbench="compact";setHeader();renderProgress();
    try{await loadSource();record=loadRecord();render();if(stage>=2)startAnimation();}
    catch(error){$("ws-title").textContent="TI Engineering Learning 載入失敗";$("ws-intro").textContent=error.message;console.error(error);}
  }
  root.addEventListener?.("beforeunload",stopAnimation);
  return {mount};
});
