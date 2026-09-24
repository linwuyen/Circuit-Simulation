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
  const TRACE_COMPONENT={pwm:"switch",vl:"inductor",il:"inductor",ic:"capacitor",vout:"capacitor"};
  const COMPONENTS={
    vin:{label:"Vin",unit:"V",key:"vin",min:24,max:72,step:6,box:[24,92,76,142],help:"輸入電壓。改 Vin 會改 ON 狀態的 vL 與 di/dt。"},
    switch:{label:"Switch / PWM",box:[118,20,105,88],help:"開關由 Duty command 控制；這一課真正直接改變的是 ON/OFF 的作用時間。"},
    diode:{label:"Freewheel diode",box:[226,112,70,84],help:"OFF 時提供續流路徑，讓電感電流不會因開關關閉而瞬間消失。"},
    inductor:{label:"L",unit:"µH",key:"inductanceUh",min:50,max:300,step:50,box:[270,18,145,105],help:"vL=L·di/dt。L 越大，同樣 vL 下電流斜率越小。"},
    capacitor:{label:"C",unit:"µF",key:"capacitanceUf",min:47,max:1000,step:47,box:[470,100,85,105],help:"C 主要影響輸出電壓的短期保持與漣波；本題第一週期近似把舊 Vout 凍結。"},
    fsw:{label:"fsw",unit:"kHz",key:"fswKhz",min:20,max:500,step:20,help:"開關頻率改變每拍作用時間；固定電壓與 L 時，fsw 越高，單拍 ΔiL 越小。"},
    load:{label:"R",unit:"Ω",key:"loadOhm",min:1,max:100,step:1,box:[570,96,80,115],help:"負載變輕（R 變大）會降低平均電感電流，可能跨過 BCM 進入 DCM。"}
  };

  let card=null,source=null,cardsBundle=null,manifestBundle=null,record=null,scenario=null,stage=0,phase=.1,running=false,raf=0,selectedConceptId=C.lesson.id;
  let dutyPct=25,simConfig={...DEFAULT_CONFIG},selectedComponent="inductor",focusTrace=null,viewMode="first";

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
    cardsBundle=cards;manifestBundle=manifest;
    card=cards.cards.find(x=>x.id===C.lesson.id);
    source=manifest.documents.find(x=>x.id===C.lesson.sourceId);
    if(!card||!source)throw Error("TI Buck lesson source closure missing");
  }
  function conceptRecords(){
    const state=E.load();
    return state.benchmark?.[STORE_KEY]?.concepts||{};
  }
  function conceptRecord(id){
    return conceptRecords()[id]||{version:1,level:0,mastery:0,attempts:0,lastResult:null,lastReviewed:null,nextReview:null,history:[]};
  }
  function saveConceptRecord(id,value){
    const state=E.load();
    state.benchmark[STORE_KEY]||={version:1,concepts:{}};
    state.benchmark[STORE_KEY].concepts||={};
    state.benchmark[STORE_KEY].concepts[id]={...value,version:1,updatedAt:new Date().toISOString()};
    E.save(state);
    return state.benchmark[STORE_KEY].concepts[id];
  }
  function todayPlan(options={}){
    return C.buildPlan(cardsBundle?.cards||[],conceptRecords(),today(),options);
  }
  function conceptDocs(concept){
    const ids=new Set(concept.sourceIds||[]);
    return (manifestBundle?.documents||[]).filter(doc=>ids.has(doc.id));
  }
  function specializedBuckAvailable(id){
    const r=conceptRecord(id);
    return id===C.lesson.id&&Number(r.attempts||0)===0;
  }
  function selectConcept(id){
    const concept=cardsBundle?.cards?.find(x=>x.id===id);
    if(!concept)return;
    selectedConceptId=id;
    if(specializedBuckAvailable(id)){
      card=concept;
      source=manifestBundle.documents.find(x=>x.id===C.lesson.sourceId);
      document.body.dataset.tiConceptMode="buck";
      render();
    }else{
      renderGenericConcept(id);
    }
  }
  function route(){
    const list=$("workspace-route");if(!list||!cardsBundle)return;
    list.replaceChildren();
    const records=conceptRecords(),plan=todayPlan();
    const planned=new Map(plan.items.map(item=>[item.conceptId,item]));
    let completed=0;
    cardsBundle.cards.forEach((concept,index)=>{
      const r=records[concept.id]||{attempts:0,mastery:0};
      if((r.attempts||0)>0)completed++;
      const locked=(r.attempts||0)===0&&!C.prereqsReady(concept,records);
      const li=document.createElement("li"),b=document.createElement("button");
      const p=planned.get(concept.id);
      const status=locked?"LOCKED":p?p.type.toUpperCase():(r.attempts||0)>0?String(r.lastResult||"DONE").toUpperCase():"READY";
      b.type="button";b.disabled=locked;b.textContent=`${index+1}. ${concept.title} · ${status}`;
      if(concept.id===selectedConceptId)b.setAttribute("aria-current","step");
      b.onclick=()=>selectConcept(concept.id);
      li.append(b);list.append(li);
    });
    const parent=list.closest("details");
    if(parent){
      parent.open=document.body.dataset.tiConceptMode==="generic";
      parent.querySelector("summary").textContent=`TI path · ${completed}/${cardsBundle.cards.length} · today ${plan.items.length}`;
    }
  }
  function setHeader(){
    const header=document.querySelector(".workspace-header strong");
    if(header)header.textContent="TI 工程學習・從預測到波形證據";
    const entry=$("open-ti-learning");
    if(entry){entry.textContent="返回主線";entry.onclick=()=>{location.hash="";location.reload();};}
    let debug=$("open-ti-debug");
    if(!debug){
      debug=document.createElement("button");debug.id="open-ti-debug";debug.type="button";debug.textContent="TI Debug Lab";
      entry?.after(debug);
    }
    debug.onclick=()=>renderDiagnosticLab();
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
      ["fsw",simConfig.fswKhz+" kHz","fsw"],
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
    const mode=document.createElement("span");mode.className="ti-mode";mode.textContent=B.buck({...simConfig,duty:dutyPct/100}).regime;hud.append(mode);
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
      if(!c.box)return;
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
  function renderInspector(){
    let panel=$("ti-component-inspector");
    if(!panel){
      panel=document.createElement("div");panel.id="ti-component-inspector";panel.className="ti-component-inspector";
      ensureCircuitStage().append(panel);
    }
    const c=COMPONENTS[selectedComponent];panel.replaceChildren();
    const head=document.createElement("div");head.className="ti-inspector-head";
    const title=document.createElement("strong");title.textContent=c.label;
    const editable=stage===0||stage===4;
    const state=document.createElement("span");state.textContent=editable?"editable":"locked during learner loop";
    head.append(title,state);panel.append(head);
    const help=document.createElement("p");help.textContent=c.help;help.title=c.help;panel.append(help);
    if(c.key){
      const row=document.createElement("label");row.className="ti-param-row";
      const value=document.createElement("output");value.textContent=simConfig[c.key]+" "+c.unit;
      const input=document.createElement("input");input.type="range";input.min=c.min;input.max=c.max;input.step=c.step;input.value=simConfig[c.key];input.disabled=!editable;
      input.oninput=()=>{value.textContent=input.value+" "+c.unit;};
      input.onchange=()=>{
        if(!editable)return;
        const candidate={...simConfig,[c.key]:Number(input.value)};
        if(stage===0&&B.buck({...candidate,duty:.25}).regime!=="CCM"){
          input.value=simConfig[c.key];
          value.textContent=simConfig[c.key]+" "+c.unit;
          feedback("第一個 PWM 週期教材先固定在 CCM；完成這次 loop 後，STEADY view 才解鎖 BCM/DCM 探索。");
          return;
        }
        simConfig=candidate;
        saveRecord({simConfig:{...simConfig}});
        render();
      };
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
  function previewComponent(id,active=true){
    document.querySelectorAll(".ti-component-hit").forEach(n=>{
      n.classList.toggle("is-preview",!!active&&n.dataset.component===id);
    });
  }
  function highlightTrace(trace){
    focusTrace=trace;
    document.querySelectorAll("#ws-plot [data-trace]").forEach(n=>{
      n.classList.toggle("ti-trace-dim",!!trace&&n.dataset.trace!==trace);
      n.classList.toggle("ti-trace-focus",!!trace&&n.dataset.trace===trace);
    });
  }
  function bindScopeInteraction(svg,phaseHandler=setCircuitPhase){
    svg.querySelectorAll("[data-trace]").forEach(n=>{
      const trace=n.dataset.trace,component=TRACE_COMPONENT[trace];
      n.setAttribute("tabindex","0");
      n.setAttribute("role","button");
      n.setAttribute("aria-label",trace+" trace");
      n.addEventListener("mouseenter",()=>previewComponent(component,true));
      n.addEventListener("mouseleave",()=>previewComponent(component,false));
      n.addEventListener("focus",()=>previewComponent(component,true));
      n.addEventListener("blur",()=>previewComponent(component,false));
      n.addEventListener("click",event=>{
        event.stopPropagation();
        if(component)selectComponent(component);
      });
      n.addEventListener("keydown",event=>{
        if((event.key==="Enter"||event.key===" ")&&component){
          event.preventDefault();selectComponent(component);
        }
      });
    });
    let scrubbing=false;
    const scrub=event=>{
      const rect=svg.getBoundingClientRect();
      if(!rect.width)return;
      const viewX=(event.clientX-rect.left)/rect.width*720;
      const next=(viewX-95)/555;
      if(next<0||next>1)return;
      stopAnimation();
      phaseHandler(next);
    };
    svg.addEventListener("pointerdown",event=>{
      if(stage<2)return;
      scrubbing=true;
      svg.setPointerCapture?.(event.pointerId);
      scrub(event);
    });
    svg.addEventListener("pointermove",event=>{if(scrubbing)scrub(event);});
    svg.addEventListener("pointerup",event=>{
      if(!scrubbing)return;
      scrubbing=false;
      svg.releasePointerCapture?.(event.pointerId);
      scrub(event);
    });
    svg.addEventListener("pointercancel",()=>{scrubbing=false;});
  }
  function renderViewTabs(){
    let tabs=$("ti-view-tabs");
    const toolbar=$("ti-sim-toolbar");
    const status=$("ti-scope-status");
    if(!toolbar||!status)return;
    if(!tabs){
      tabs=document.createElement("div");tabs.id="ti-view-tabs";tabs.className="ti-view-tabs";
      toolbar.insertBefore(tabs,status);
    }
    tabs.replaceChildren();
    [["first","FIRST"],["steady","STEADY"],["transient","TRANSIENT"]].forEach(([id,label])=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;b.disabled=stage<2;
      if(viewMode===id)b.setAttribute("aria-current","true");
      b.onclick=()=>{viewMode=id;stopAnimation();drawPlot();renderHud();};
      tabs.append(b);
    });
  }
  function setupSurface(){
    document.body.dataset.tiConceptMode="buck";
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    $("surface-title").textContent="Buck Physics Workbench";
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
    const special=ensureSpecializedHost();special.hidden=true;special.replaceChildren();
    const circuitStage=ensureCircuitStage();circuitStage.hidden=false;
    $("lesson-control").hidden=false;
    $("ws-plot").hidden=false;
    $("surface-help").hidden=false;
    installCircuitInteractivity();

    let bar=$("ti-sim-toolbar");
    if(!bar){
      bar=document.createElement("div");bar.id="ti-sim-toolbar";bar.className="ti-sim-toolbar";
      bar.innerHTML='<strong class="ti-scope-title">SCOPE</strong><button id="ti-run" type="button">▶</button><button id="ti-pause" type="button">Ⅱ</button><button id="ti-reset" type="button">↺</button><span id="ti-scope-status"></span>';
      $("ws-plot").before(bar);
      $("ti-run").onclick=()=>{if(stage>=2)startAnimation();};
      $("ti-pause").onclick=()=>stopAnimation();
      $("ti-reset").onclick=()=>{stopAnimation();setCircuitPhase(.1);};
    }
    bar.hidden=false;
    $("ti-run").disabled=stage<2;$("ti-pause").disabled=stage<2;$("ti-reset").disabled=stage<2;
    $("ti-scope-status").textContent=stage<2?"locked":viewMode;
    renderViewTabs();
    renderCausalChain();
    renderSource();
  }
  function scopeGrid(svg){
    const g=svgEl("g",{class:"ti-scope-grid"});
    for(let i=0;i<=10;i++)g.append(svgEl("path",{d:`M${95+i*55} 18V312`}));
    for(let i=0;i<=7;i++)g.append(svgEl("path",{d:`M95 ${20+i*40}H650`}));
    svg.append(g);
  }
  function drawFirstPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;svg.setAttribute("viewBox","0 0 720 330");scopeGrid(svg);
    if(stage<2){
      svg.append(svgEl("text",{x:250,y:155,class:"ti-scope-lock"},"WAVEFORM LOCKED"));
      svg.append(svgEl("text",{x:218,y:184,class:"ti-scope-lock-sub"},"Commit prediction before revealing evidence"));
      svg.setAttribute("aria-label","Waveforms locked until prediction is committed.");
      $("ws-comparison").textContent="Prediction integrity: no waveform evidence before commitment.";
      return;
    }
    const T=scenario.periodUs,onUs=scenario.after.onUs,oldOn=scenario.before.onUs;
    const x=t=>95+t/T*555;
    const lanes={pwm:[55,84],vl:[118,158],il:[196,244],vout:[292,315]};
    const label=(name,y)=>svg.append(svgEl("text",{x:18,y,class:"ti-trace-label"},name));
    label("PWM",70);label("vL",140);label("iL",222);label("Vout",307);

    const pwm=svgEl("path",{d:`M95 ${lanes.pwm[1]}V${lanes.pwm[0]}H${x(onUs)}V${lanes.pwm[1]}H650`,class:"ti-trace ti-trace-pwm","data-trace":"pwm"});
    svg.append(pwm);

    const posV=scenario.config.vin-scenario.vout0,negV=-scenario.vout0;
    const vlScale=v=>{
      const max=Math.max(Math.abs(posV),Math.abs(negV),1);
      const mid=(lanes.vl[0]+lanes.vl[1])/2;
      return mid-v/max*18;
    };
    const vl=svgEl("path",{d:`M95 ${vlScale(posV)}H${x(onUs)}V${vlScale(negV)}H650`,class:"ti-trace ti-trace-vl","data-trace":"vl"});
    svg.append(vl);
    svg.append(svgEl("text",{x:102,y:vlScale(posV)-6,class:"ti-value-label"},`+${posV.toFixed(1)}V`));
    svg.append(svgEl("text",{x:x(onUs)+8,y:vlScale(negV)+14,class:"ti-value-label"},`${negV.toFixed(1)}V`));

    const rows=scenario.after.rows,old=scenario.before.rows;
    const all=[...rows,...old],lo=Math.min(...all.map(r=>r.iL))-.08,hi=Math.max(...all.map(r=>r.iL))+.08;
    const yi=i=>lanes.il[1]-(i-lo)/(hi-lo)*(lanes.il[1]-lanes.il[0]);
    const points=r=>r.map(v=>`${x(v.tUs)},${yi(v.iL)}`).join(" ");
    svg.append(svgEl("polyline",{points:points(old),class:"ti-trace ti-trace-old","data-trace":"il"}));
    svg.append(svgEl("polyline",{points:points(rows),class:"ti-trace ti-trace-il","data-trace":"il"}));

    const yv=(lanes.vout[0]+lanes.vout[1])/2;
    svg.append(svgEl("path",{d:`M95 ${yv}H650`,class:"ti-trace ti-trace-vout","data-trace":"vout"}));
    svg.append(svgEl("text",{x:560,y:yv-7,class:"ti-value-label"},`${scenario.vout0.toFixed(1)} V frozen`));

    svg.append(svgEl("path",{d:`M${x(oldOn)} 20V312`,class:"ti-timing ti-timing-old"}));
    svg.append(svgEl("path",{d:`M${x(onUs)} 20V312`,class:"ti-timing ti-timing-new"}));
    svg.append(svgEl("text",{x:x(oldOn)-16,y:324,class:"ti-time-label"},"25%"));
    svg.append(svgEl("text",{x:x(onUs)-16,y:324,class:"ti-time-label"},"50%"));
    svg.append(svgEl("path",{id:"ti-scope-cursor",d:"M95 20V312",class:"ti-scope-cursor"}));

    svg.setAttribute("aria-label","Four-trace scope showing PWM, inductor voltage, inductor current and frozen output voltage for the first PWM cycle.");
    $("ws-comparison").textContent=`ON ${scenario.after.onUs.toFixed(2)} µs · vL(on) +${posV.toFixed(1)} V · di/dt(on) +${scenario.after.onSlopeAUs.toFixed(3)} A/µs · first-cycle ΔiL +${scenario.after.deltaI.toFixed(3)} A`;
    highlightTrace(focusTrace);
    bindScopeInteraction(svg);
  }

  function tracePolyline(svg,rows,key,x,y,className,trace){
    svg.append(svgEl("polyline",{
      points:rows.map(r=>`${x(r)},${y(r[key])}`).join(" "),
      class:className,
      "data-trace":trace
    }));
  }
  function laneScale(values,top,bottom){
    const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1e-9);
    return value=>bottom-(value-lo)/span*(bottom-top);
  }
  function drawSteadyPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;svg.setAttribute("viewBox","0 0 720 330");scopeGrid(svg);
    const m=B.buck({...simConfig,duty:dutyPct/100}),rows=m.rows;
    const x=r=>95+r.phase*555;
    const label=(name,y)=>svg.append(svgEl("text",{x:18,y,class:"ti-trace-label"},name));
    label("PWM",42);label("vL",96);label("iL",156);label("iC",216);label("Vout",282);
    const pwmY=rows.map(r=>r.state==="ON"?31:52);
    svg.append(svgEl("polyline",{points:rows.map((r,i)=>`${x(r)},${pwmY[i]}`).join(" "),class:"ti-trace ti-trace-pwm","data-trace":"pwm"}));
    const yVL=laneScale(rows.map(r=>r.vL),75,108),yIL=laneScale(rows.map(r=>r.iL),133,172);
    const yIC=laneScale(rows.map(r=>r.iC),193,232),yVO=laneScale(rows.map(r=>r.vout),258,296);
    tracePolyline(svg,rows,"vL",x,yVL,"ti-trace ti-trace-vl","vl");
    tracePolyline(svg,rows,"iL",x,yIL,"ti-trace ti-trace-il","il");
    tracePolyline(svg,rows,"iC",x,yIC,"ti-trace ti-trace-ic","ic");
    tracePolyline(svg,rows,"vout",x,yVO,"ti-trace ti-trace-vout","vout");
    svg.append(svgEl("path",{id:"ti-scope-cursor",d:"M95 20V312",class:"ti-scope-cursor"}));
    svg.setAttribute("aria-label","Steady-state Buck scope showing PWM, vL, iL, capacitor current and Vout ripple.");
    $("ws-comparison").textContent=`${m.regime} · ΔiL ${m.ripple.toFixed(3)} A · Vout ripple ${m.vRipple.toFixed(4)} V · Rcrit ${m.boundaryOhm.toFixed(2)} Ω`;
    highlightTrace(focusTrace);
    bindScopeInteraction(svg,p=>setCircuitPhaseSteady(p,m));
  }
  function drawTransientPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;svg.setAttribute("viewBox","0 0 720 330");scopeGrid(svg);
    const t=B.buckTransient({
      before:{...simConfig,duty:.25},
      after:{...simConfig,duty:dutyPct/100},
      cycles:30,stepsPerCycle:128
    });
    const rows=t.rows,summ=t.cycleSummaries;
    const xCycle=c=>95+c/(t.cycles-1)*555;
    const yV=laneScale(summ.map(r=>r.avgVout),70,165);
    const allI=summ.flatMap(r=>[r.minI,r.maxI]),yI=laneScale(allI,205,295);
    svg.append(svgEl("text",{x:18,y:115,class:"ti-trace-label"},"Vout"));
    svg.append(svgEl("text",{x:18,y:252,class:"ti-trace-label"},"iL env"));
    svg.append(svgEl("polyline",{points:summ.map(r=>`${xCycle(r.cycle)},${yV(r.avgVout)}`).join(" "),class:"ti-trace ti-trace-vout","data-trace":"vout"}));
    svg.append(svgEl("polyline",{points:summ.map(r=>`${xCycle(r.cycle)},${yI(r.maxI)}`).join(" "),class:"ti-trace ti-trace-il","data-trace":"il"}));
    svg.append(svgEl("polyline",{points:summ.map(r=>`${xCycle(r.cycle)},${yI(r.minI)}`).join(" "),class:"ti-trace ti-trace-old","data-trace":"il"}));
    svg.append(svgEl("path",{id:"ti-scope-cursor",d:"M95 20V312",class:"ti-scope-cursor"}));
    svg.setAttribute("aria-label","Multi-cycle Buck transient showing Vout and inductor-current envelope after the duty change.");
    $("ws-comparison").textContent=`Full transient · Vout ${t.initialVout.toFixed(2)} V → cycle1 ${t.firstCycle.avgVout.toFixed(2)} V → cycle30 ${t.lastCycle.avgVout.toFixed(2)} V. FIRST view intentionally freezes old Vout; this view does not.`;
    highlightTrace(focusTrace);
    bindScopeInteraction(svg,p=>setCircuitPhaseTransient(p,t));
  }
  function drawPlot(){
    if(stage<2||viewMode==="first")return drawFirstPlot();
    if(viewMode==="steady")return drawSteadyPlot();
    return drawTransientPlot();
  }
  function applyCircuitRow(row){
    const on=row.state==="ON",off=row.state==="OFF";
    $("switch").setAttribute("d",on?"M140 70H200":"M140 70L200 45");
    $("on-path").style.display=on?"":"none";
    $("off-path").style.display=off?"":"none";
    $("circuit-state").textContent=`${row.state}  vL ${row.vL>=0?"+":""}${row.vL.toFixed(1)}V  iL ${row.iL.toFixed(3)}A`;
  }
  function setCircuitPhaseSteady(p,m){
    phase=Math.max(0,Math.min(.999,p));
    const index=Math.min(m.rows.length-1,Math.round(phase*(m.rows.length-1)));
    applyCircuitRow(m.rows[index]);
    const cursor=$("ti-scope-cursor");if(cursor){const x=95+phase*555;cursor.setAttribute("d",`M${x} 20V312`);}
  }
  function setCircuitPhaseTransient(p,t){
    phase=Math.max(0,Math.min(.999,p));
    const index=Math.min(t.rows.length-1,Math.round(phase*(t.rows.length-1)));
    applyCircuitRow(t.rows[index]);
    const cursor=$("ti-scope-cursor");if(cursor){const x=95+phase*555;cursor.setAttribute("d",`M${x} 20V312`);}
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
  function ensureSpecializedHost(){
    let host=$("ti-specialized-workbench");
    if(!host){
      host=document.createElement("div");
      host.id="ti-specialized-workbench";
      host.className="ti-specialized-workbench";
      $("surface-help").before(host);
    }
    return host;
  }
  function renderSpecializedConcept(concept,revealed){
    const host=ensureSpecializedHost();
    host.hidden=true;host.replaceChildren();
    const workbenches=[
      root.CircuitTIControlWorkbench,
      root.CircuitTITimingWorkbench,
      root.CircuitTIProtectionWorkbench,
      root.CircuitTITopologyWorkbench
    ].filter(Boolean);
    const workbench=workbenches.find(item=>item.supports(concept.id));
    if(!workbench)return;
    const meta=workbench===root.CircuitTITimingWorkbench
      ?{id:"ti-c2000-timing-workbench-v1",boundary:"Deterministic C2000 timing teaching model only. Exact target timing requires TRM plus GPIO/scope evidence."}
      :workbench===root.CircuitTIProtectionWorkbench
        ?{id:"ti-pwm-authority-workbench-v1",boundary:"Deterministic PWM authority model only. Hardware trip latency requires target configuration and scope evidence."}
        :workbench===root.CircuitTITopologyWorkbench
          ?{id:"ti-topology-constraint-atlas-v1",boundary:"Deterministic topology-transfer model evidence only. Each topology keeps its own declared validity boundary."}
          :{id:"ti-control-workbench-v1",boundary:"Deterministic teaching/model evidence only. Imported SFRA without provenance is not independent measured evidence."};
    host.hidden=false;
    workbench.mount({
      host,
      conceptId:concept.id,
      revealed,
      onSnapshot:snapshot=>{
        E.recordMachine("ti:"+concept.id,meta.id,snapshot,{
          passed:false,
          model:{id:meta.id,version:"1",boundary:meta.boundary}
        });
      }
    });
  }
  function renderGenericEvidence(concept,revealed){
    const box=$("surface-help");box.hidden=false;box.replaceChildren();
    const panel=document.createElement("div");panel.className="ti-generic-evidence";
    if(!revealed){
      const lock=document.createElement("p");lock.className="ti-generic-lock";
      lock.textContent="Primary-source model is hidden until you commit your answer.";
      panel.append(lock);box.append(panel);return;
    }
    const sections=[
      ["Physics",concept.model.physics],
      ["Math",(concept.model.math||[]).join(" · ")||"No single equation is sufficient for this concept."],
      ["Implementation",concept.model.implementation],
      ["Evidence",concept.model.evidence]
    ];
    sections.forEach(([title,text])=>{
      const s=document.createElement("section"),h=document.createElement("strong"),p=document.createElement("p");
      h.textContent=title;p.textContent=text;s.append(h,p);panel.append(s);
    });
    const sources=document.createElement("div");sources.className="ti-generic-sources";
    const h=document.createElement("strong");h.textContent="TI primary sources";sources.append(h);
    conceptDocs(concept).forEach(doc=>{
      const a=document.createElement("a");a.href=doc.url;a.target="_blank";a.rel="noopener";a.textContent=`${doc.id} — ${doc.title}`;sources.append(a);
    });
    panel.append(sources);box.append(panel);
  }
  function genericQuestion(concept,rec){
    const type=(rec.attempts||0)>0?"review":"new";
    const mode=rec.activeMode||C.preferredMode(type,rec);
    return {type,mode,question:rec.activeQuestion||concept.questions.find(q=>q.mode===mode)?.prompt||concept.questions[0].prompt};
  }
  function genericStepNav(step){
    const nav=$("ws-steps");nav.replaceChildren();
    ["Answer","Source","Correct","Grade"].forEach((label,i)=>{
      const b=document.createElement("button");b.type="button";b.disabled=true;b.textContent=`${i+1}. ${label}`;
      if(Math.min(step,3)===i)b.setAttribute("aria-current","step");
      nav.append(b);
    });
  }
  function renderDiagnosticLab(){
    stopAnimation();
    document.body.dataset.tiConceptMode="generic";
    selectedConceptId="__diagnostic__";
    route();
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    const circuitStage=$("ti-circuit-stage");if(circuitStage)circuitStage.hidden=true;
    $("lesson-control").hidden=true;
    const toolbar=$("ti-sim-toolbar");if(toolbar)toolbar.hidden=true;
    $("ws-plot").hidden=true;$("ws-plot").replaceChildren();$("ws-comparison").textContent="";
    $("surface-help").hidden=true;$("surface-help").replaceChildren();
    const host=ensureSpecializedHost();host.hidden=false;host.replaceChildren();
    $("surface-title").textContent="Unknown System Diagnostic Lab";
    $("ws-count").textContent="Practice · hidden two-fault machine";
    $("ws-title").textContent="量什麼，才能最快排掉錯的假設？";
    $("ws-intro").textContent="Measure → immutable first diagnosis → repair → verify nominal + changed condition.";
    $("ws-save").textContent="Practice evidence uses the existing V5 machine log; it does not grant independent or board evidence.";
    const nav=$("ws-steps");nav.replaceChildren();
    ["Measure","Diagnose","Repair","Verify"].forEach((label,i)=>{const b=document.createElement("button");b.type="button";b.disabled=true;b.textContent=(i+1)+". "+label;nav.append(b);});
    $("ws-question").replaceChildren();
    const h=document.createElement("h2");h.textContent="Debug contract";
    const p=document.createElement("p");p.textContent="最多五次量測；首次 root-cause 判斷不可覆寫；修復後必須在原工況與陌生工況都通過。";
    $("ws-question").append(h,p);$("ws-feedback").textContent="";$("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    const debug=root.CircuitTIDiagnosticWorkbench;
    if(!debug){host.textContent="Diagnostic workbench dependency missing.";return;}
    debug.mount({
      host,
      seed:23,
      onSnapshot:snapshot=>E.recordMachine("ti:diagnostic-practice","ti-hidden-repair-v1",snapshot,{
        passed:false,
        model:{id:"ti-hidden-repair-v1",version:"1",boundary:"Synthetic hidden two-fault system practice; evidence ceiling practice-only; independentOracle=false."}
      })
    });
    $("workspace-progress").textContent="Diagnostic practice · evidence ceiling PRACTICE_ONLY";
  }
  function renderGenericConcept(id){
    stopAnimation();
    document.body.dataset.tiConceptMode="generic";
    selectedConceptId=id;
    const concept=cardsBundle.cards.find(x=>x.id===id);if(!concept)return;
    const rec=conceptRecord(id),flow=genericQuestion(concept,rec),step=Number(rec.genericStep||0);
    route();
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    const circuitStage=$("ti-circuit-stage");if(circuitStage)circuitStage.hidden=true;
    $("lesson-control").hidden=true;
    const toolbar=$("ti-sim-toolbar");if(toolbar)toolbar.hidden=true;
    $("ws-plot").hidden=true;$("ws-plot").replaceChildren();$("ws-comparison").textContent="";
    $("surface-title").textContent=concept.title;
    $("ws-count").textContent=`TI Concept ${cardsBundle.cards.findIndex(x=>x.id===id)+1} / ${cardsBundle.cards.length} · ${flow.type.toUpperCase()} / ${flow.mode.toUpperCase()}`;
    $("ws-title").textContent=concept.problem;
    $("ws-intro").textContent="Commit your reasoning before revealing the TI model and evidence contract.";
    $("ws-save").textContent=E.storageStatus().saved?"Saved in circuit-learning-state-v5":"Storage unavailable — do not count this attempt as saved.";
    genericStepNav(step);
    renderGenericEvidence(concept,step>=1);
    renderSpecializedConcept(concept,step>=1);
    $("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    $("ws-question").replaceChildren();feedback("");

    const q=document.createElement("h2");q.textContent=step===0?flow.mode.toUpperCase():step===1?"Compare with source":step===2?"Grade the reasoning":"Review scheduled";$("ws-question").append(q);

    if(step===0){
      const p=document.createElement("p");p.textContent=flow.question;
      const ta=document.createElement("textarea");ta.id="ti-generic-answer";ta.rows=7;ta.placeholder="Write the causal chain, timing assumptions, and what evidence would falsify it.";
      const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Commit answer → reveal source";
      b.onclick=()=>{
        const answer=ta.value.trim();if(!answer){feedback("先寫下你的判斷。");return;}
        const taskId=`ti:${id}:${flow.mode}:${(rec.attempts||0)+1}`;
        try{E.commitPrediction(taskId,{prediction:answer,parameters:`concept=${id}; mode=${flow.mode}`,confidence:70});}
        catch(error){feedback(error.message);return;}
        saveConceptRecord(id,{...rec,genericStep:1,activeMode:flow.mode,activeQuestion:flow.question,activeTaskId:taskId,firstAnswer:answer});
        renderGenericConcept(id);
      };
      $("ws-question").append(p,ta,b);
    }else if(step===1){
      const p=document.createElement("p");p.textContent="Against the model at left, write the missing/broken causal link or the evidence check you would add.";
      const ta=document.createElement("textarea");ta.id="ti-generic-correction";ta.rows=6;ta.placeholder="Correction / evidence check";
      const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Save correction";
      b.onclick=()=>{
        const answer=ta.value.trim();if(!answer){feedback("先寫 correction 或 evidence check。");return;}
        E.recordOpenResponse((rec.activeTaskId||`ti:${id}`)+":correction",{answer,mode:flow.mode,selfReviewed:true});
        saveConceptRecord(id,{...rec,genericStep:2,correction:answer});
        renderGenericConcept(id);
      };
      $("ws-question").append(p,ta,b);
    }else if(step===2){
      const p=document.createElement("p");
      p.textContent="This stage is self-review, not independent verification. Grade causal completeness; evidence strength remains NONE.";
      $("ws-question").append(p);
      const wrap=document.createElement("div");wrap.className="ti-grade-buttons";
      const allowed=flow.mode==="transfer"?["fail","partial","pass","transfer"]:["fail","partial","pass"];
      allowed.forEach(result=>{
        const b=document.createElement("button");b.type="button";b.textContent=result.toUpperCase();
        b.onclick=()=>{
          const concepts=C.applyConceptResult(conceptRecords(),id,result,today(),{mode:flow.mode,gradeSource:"self-review"});
          const final={...concepts[id],genericStep:3,activeMode:null,activeQuestion:null,activeTaskId:null};
          saveConceptRecord(id,final);
          E.recordEvidence(`ti:${id}`,2,"ti-concept-self-review",{result,mode:flow.mode,sourceIds:concept.sourceIds},{strength:"none",stage:"practiced"});
          renderGenericConcept(id);
        };
        wrap.append(b);
      });
      $("ws-question").append(wrap);
    }else{
      const grade=document.createElement("div");grade.className="ti-grade";
      const strong=document.createElement("strong");strong.textContent=`Grade: ${String(rec.lastResult||"").toUpperCase()}`;
      const next=document.createElement("p");next.textContent=`Next review: ${rec.nextReview||"—"} · mastery ${Math.round((rec.mastery||0)*100)}%`;
      const note=document.createElement("p");note.textContent="This is practiced/self-reviewed evidence, not hardware or independent verification.";
      grade.append(strong,next,note);$("ws-question").append(grade);
      const b=document.createElement("button");b.type="button";b.className="primary";b.textContent="Open next planned concept";
      b.onclick=()=>{
        const plan=todayPlan({maxReviews:3,maxNew:1});
        const nextItem=plan.items.find(item=>item.conceptId!==id);
        if(nextItem)selectConcept(nextItem.conceptId);else feedback("今天沒有其他到期項目。");
      };
      $("ws-question").append(b);
    }
    $("workspace-progress").textContent=`TI plan · ${todayPlan().dueCount} review due · ${todayPlan().newCount} new · current ${concept.title}`;
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
    if(stage>=2){if(viewMode==="steady")setCircuitPhaseSteady(.1,B.buck({...simConfig,duty:dutyPct/100}));else if(viewMode==="transient")setCircuitPhaseTransient(.1,B.buckTransient({before:{...simConfig,duty:.25},after:{...simConfig,duty:dutyPct/100},cycles:30,stepsPerCycle:128}));else setCircuitPhase(.1);renderCausalChain();}else{$("on-path").style.display="none";$("off-path").style.display="none";$("circuit-state").textContent="Prediction lock active.";}
    if(stage!==1)$("ws-control").oninput=null;
  }
  async function mount(){
    if(!E||!B||!C)throw Error("TI learning dependencies missing");
    document.body.dataset.tiLearning="true";document.body.dataset.tiWorkbench="compact";setHeader();renderProgress();
    try{
      await loadSource();
      record=loadRecord();
      const plan=todayPlan();
      selectedConceptId=plan.items[0]?.conceptId||C.lesson.id;
      selectConcept(selectedConceptId);
      if(selectedConceptId===C.lesson.id&&stage>=2)startAnimation();
    }
    catch(error){$("ws-title").textContent="TI Engineering Learning 載入失敗";$("ws-intro").textContent=error.message;console.error(error);}
  }
  root.addEventListener?.("beforeunload",stopAnimation);
  return {mount};
});
