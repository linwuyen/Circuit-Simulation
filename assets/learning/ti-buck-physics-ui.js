(function(root,factory){
  root.CircuitTIBuckPhysics=factory(root);
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const P=root.CircuitTIBuckPhysicsCore;
  const Buck=root.CircuitTrainingExperiments;
  const Sandbox=root.CircuitEngineeringSandboxCore;
  const First=root.CircuitTILearningCore;
  const E=root.CircuitEvidence;
  let scenarioId="duty",view="steady",revealed=false,lastPrediction=null;

  function svgEl(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
    if(text)n.textContent=text;
    return n;
  }
  function itemId(){return "ti:buck-physics:"+scenarioId;}
  function stateRow(){return E.load().benchmark?.tiBuckPhysics?.[scenarioId]||null;}
  function saveRow(patch){
    const s=E.load();s.benchmark.tiBuckPhysics||={};
    s.benchmark.tiBuckPhysics[scenarioId]={...(s.benchmark.tiBuckPhysics[scenarioId]||{}),...patch,updatedAt:new Date().toISOString()};
    E.save(s);
  }
  function setupChrome(){
    document.body.dataset.tiBuckPhysics="true";
    document.body.dataset.tiWorkbench="compact";
    document.querySelector(".route")?.setAttribute("hidden","");
    ["setup-panel","free-controls","concept-note","transfer-preview","workbench-context-slot"].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    const header=document.querySelector(".workspace-header strong");if(header)header.textContent="Buck Physics Workbench";
    const entry=$("open-ti-learning");if(entry){entry.textContent="返回 TI Learning";entry.onclick=()=>{location.hash="ti-learning";location.reload();};}
    $("workspace-progress").textContent="Buck · steady → first-cycle → transient → CCM/DCM boundary";
    $("surface-title").textContent="Buck Physics";
    $("ws-count").textContent="TI / Buck physics";
    $("ws-title").textContent="不要背公式：改一個量，預測哪個 waveform 先變";
    $("ws-intro").textContent="Steady model、first-cycle causal view、generic transient surrogate 分開呈現，不互相冒充。";
    $("ws-save").textContent="Predictions and attempts persist in circuit-learning-state-v5.";
    $("deeper").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-result").hidden=true;
    $("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    $("lesson-control").hidden=true;
    $("answer-observation").hidden=true;
    $("context-words").replaceChildren();
  }
  function scenarioTabs(){
    let box=$("ti-physics-scenarios");
    if(!box){box=document.createElement("div");box.id="ti-physics-scenarios";box.className="ti-physics-scenarios";$("circuit").before(box);}
    box.replaceChildren();
    P.scenarios.forEach(s=>{
      const b=document.createElement("button");b.type="button";b.textContent=s.label;b.className=s.id===scenarioId?"is-active":"";
      b.onclick=()=>{scenarioId=s.id;revealed=!!stateRow()?.revealed;lastPrediction=stateRow()?.prediction||null;render();};
      box.append(b);
    });
  }
  function viewTabs(){
    const nav=$("ws-steps");nav.replaceChildren();
    [["steady","Steady"],["first","First-cycle"],["transient","Full transient"],["regime","CCM/DCM"]].forEach(([id,label])=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;b.setAttribute("aria-current",view===id?"step":"false");
      if(id==="first"&&scenarioId!=="duty")b.disabled=true;
      b.onclick=()=>{view=id;drawPlot();renderEvidence();};
      nav.append(b);
    });
  }
  function compare(){return P.compare(Buck.buck,scenarioId);}
  function setMetrics(result){
    document.querySelector(".metrics").hidden=false;
    const labels=[["ws-voltage","Vout"],["ws-current","ΔIL"],["ws-display","Regime"]];
    labels.forEach(([id,label])=>{const n=$(id);if(n&&n.parentElement)n.parentElement.firstChild.nodeValue=label;});
    $("ws-display-wrap").hidden=false;
    const model=revealed?result.after.model:result.before.model;
    $("ws-voltage").textContent=model.vout.toFixed(2)+" V";
    $("ws-current").textContent=model.ripple.toFixed(3)+" A";
    $("ws-display").textContent=model.regime;
  }
  function renderQuestion(){
    const q=$("ws-question");q.replaceChildren();
    const result=compare(),s=result.scenario,row=stateRow();
    const h=document.createElement("h2");h.textContent=s.label+" scenario";q.append(h);
    const p=document.createElement("p");p.textContent=s.prediction;q.append(p);
    const before=s.display?s.display(s.before):s.before,after=s.display?s.display(s.after):s.after;
    const cond=document.createElement("p");cond.className="ti-physics-change";cond.textContent=`${s.label}: ${before} ${s.unit} → ${after} ${s.unit}`;q.append(cond);
    const fs=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="先預測主要結果";fs.append(legend);
    [["up","↑ 增加"],["down","↓ 減少"],["same","≈ 近似不變"],["boundary","跨模型／regime"]].forEach(([v,label])=>{
      const l=document.createElement("label"),i=document.createElement("input");i.type="radio";i.name="ti-physics-predict";i.value=v;i.checked=(lastPrediction||row?.prediction)===v;
      l.append(i,document.createTextNode(" "+label));fs.append(l);
    });q.append(fs);
    const commit=document.createElement("button");commit.type="button";commit.className="primary";commit.textContent=revealed?"重新提交預測":"Lock prediction → reveal evidence";
    commit.onclick=()=>{
      const answer=document.querySelector('input[name="ti-physics-predict"]:checked')?.value;
      if(!answer){$("ws-feedback").textContent="先選一個方向。";return;}
      lastPrediction=answer;revealed=true;
      try{E.commitPrediction(itemId(),{prediction:answer,parameters:`${s.key}: ${s.before}→${s.after}`,confidence:70});}catch(_){}
      saveRow({prediction:answer,revealed:true});
      E.recordEvidence(itemId(),2,"ti-buck-physics",{scenario:scenarioId,view:"steady",regime:result.regime},{stage:"practiced",strength:"B"});
      render();
    };q.append(commit);
    if(revealed){
      const evidence=document.createElement("div");evidence.className="ti-physics-evidence";
      const delta=result.metrics[s.metric];
      const truth=s.metric==="regime"
        ? `${result.regime.before} → ${result.regime.after}`
        : `${s.metric}: ${Number(delta.before).toPrecision(4)} → ${Number(delta.after).toPrecision(4)}`;
      evidence.innerHTML=`<strong>Model evidence</strong><p>${truth}</p><p>${result.boundary}</p>`;
      q.append(evidence);
    }
  }
  function axes(svg,title){
    svg.append(svgEl("text",{x:18,y:24,class:"ti-trace-label"},title));
    const g=svgEl("g",{class:"ti-scope-grid"});
    for(let i=0;i<=10;i++)g.append(svgEl("path",{d:`M70 ${35+i*24}H680`}));
    for(let i=0;i<=10;i++)g.append(svgEl("path",{d:`M${70+i*61} 35V275`}));
    svg.append(g);
  }
  function linePoints(rows,xKey,yKey,x0=70,x1=680,y0=260,y1=55){
    const xs=rows.map(r=>r[xKey]),ys=rows.map(r=>r[yKey]);
    const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),yr=Math.max(1e-9,ymax-ymin);
    return rows.map(r=>{
      const x=x0+(r[xKey]-xmin)/Math.max(1e-9,xmax-xmin)*(x1-x0);
      const y=y0-(r[yKey]-ymin)/yr*(y0-y1);
      return `${x},${y}`;
    }).join(" ");
  }
  function drawSteady(svg,result){
    axes(svg,"Steady iL · before / after");
    const before=result.before.model.rows,after=result.after.model.rows;
    svg.append(svgEl("polyline",{points:linePoints(before,"tUs","iL"),class:"ti-physics-before"}));
    if(revealed)svg.append(svgEl("polyline",{points:linePoints(after,"tUs","iL"),class:"ti-physics-after"}));
  }
  function drawFirst(svg){
    axes(svg,"First-cycle iL · old Vout frozen");
    const beforeConfig=P.configFor("duty","before"),after=P.configFor("duty","after");
    const scenario=First.buildFirstCycle(Buck.buck,beforeConfig,afterConfig.duty);
    svg.append(svgEl("polyline",{points:linePoints(scenario.before.rows,"tUs","iL"),class:"ti-physics-before"}));
    if(revealed)svg.append(svgEl("polyline",{points:linePoints(scenario.after.rows,"tUs","iL"),class:"ti-physics-after"}));
  }
  function drawTransient(svg,result){
    axes(svg,"Startup transient Vout · generic teaching kernel");
    const before=P.runTransient(Sandbox.simulateSystem,result.before.model.config,260);
    svg.append(svgEl("polyline",{points:linePoints(before.trace,"k","vOut"),class:"ti-physics-before"}));
    if(revealed){
      const after=P.runTransient(Sandbox.simulateSystem,result.after.model.config,260);
      svg.append(svgEl("polyline",{points:linePoints(after.trace,"k","vOut"),class:"ti-physics-after"}));
    }
  }
  function drawRegime(svg){
    axes(svg,"Load sweep · iL(min)");
    const rows=P.regimeSweep(Buck.buck,{},[2,5,10,20,30,40,50,75,100]);
    const points=linePoints(rows,"loadOhm","minI");
    svg.append(svgEl("polyline",{points,class:"ti-physics-after"}));
    rows.forEach(r=>{
      const label=document.createElementNS("http://www.w3.org/2000/svg","text");
      label.setAttribute("x",String(80+(Math.log10(r.loadOhm/2)/Math.log10(50))*560));
      label.setAttribute("y",r.regime==="DCM"?"260":"80");
      label.setAttribute("class","ti-value-label");label.textContent=r.regime;svg.append(label);
    });
  }
  function drawPlot(){
    const svg=$("ws-plot");svg.hidden=false;svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 300");
    const result=compare();
    if(view==="first"&&scenarioId==="duty")drawFirst(svg);
    else if(view==="transient")drawTransient(svg,result);
    else if(view==="regime")drawRegime(svg);
    else drawSteady(svg,result);
    $("ws-comparison").textContent=view==="steady"
      ? `Model: buck-steady-v1 · ${result.before.model.regime} → ${revealed?result.after.model.regime:"locked"}`
      : view==="transient"
        ? "Model: generic-power-causal-kernel · teaching surrogate, not operating-point truth"
        : view==="first"
          ? "Model: first-cycle causal approximation · old Vout frozen"
          : "Model: buck-steady-v1 · load sweep exposes CCM/DCM boundary";
  }
  function renderEvidence(){
    const result=compare();
    $("scope-note").textContent=view==="transient"
      ? "Full transient is a generic teaching surrogate. Do not compare it as if it were the buck steady-state contract."
      : view==="first"
        ? "First-cycle view freezes old Vout to isolate immediate cause/effect."
        : result.boundary;
    const box=$("surface-help");box.replaceChildren();
    const p=document.createElement("p");p.className="ti-source";p.textContent="TI source anchor: SLVA057 · Understanding Buck Power Stages in Switchmode Power Supplies";box.append(p);
  }
  function render(){
    scenarioTabs();viewTabs();const result=compare();setMetrics(result);renderQuestion();drawPlot();renderEvidence();
    $("circuit-state").textContent=`Scenario ${result.scenario.label} · ${result.before.model.regime} ${revealed?"→ "+result.after.model.regime:"→ locked"}`;
  }
  function mount(){
    if(!P||!Buck||!Sandbox||!First||!E)throw Error("Buck physics dependencies missing");
    setupChrome();
    const row=stateRow();revealed=!!row?.revealed;lastPrediction=row?.prediction||null;
    render();
  }
  return {mount};
});
