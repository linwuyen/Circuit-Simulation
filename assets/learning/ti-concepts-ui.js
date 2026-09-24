(function(root,factory){
  const api=factory(root);
  root.CircuitTIConceptsUI=api;
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const E=root.CircuitEvidence,L=root.CircuitTIConceptLabs;
  let cards=[],manifest=null,current=null,input={},result=null,revealed=false;

  const pretty={
    vin:["Vin","V"],vout:["Vout","V"],duty:["Duty","ratio"],inductanceH:["L","H"],capacitanceF:["C","F"],loadOhm:["R","Ω"],switchingHz:["fsw","Hz"],
    slopeCompAUs:["Slope comp","A/µs"],bandwidthHz:["Bandwidth","Hz"],delayUs:["Delay","µs"],crossoverHz:["fc","Hz"],basePhaseMarginDeg:["Base PM","deg"],
    kp:["Kp",""],ki:["Ki","1/s"],tsUs:["Ts","µs"],phaseDeg:["Phase","deg"],primaryCurrentA:["Primary I","A"],commutationCapF:["Ccomm","F"],
    resonantInductanceH:["Lr","H"],resonantCapF:["Cr","F"],magnetizingInductanceH:["Lm","H"],q:["Q",""],ln:["Ln",""],qA:["Q A",""],qB:["Q B",""],
    periodUs:["Period","µs"],writeUs:["Write","µs"],faultUs:["Fault","µs"],hardwareLatencyUs:["TZ latency","µs"],isrDecisionUs:["ISR safe","µs"],
    designedRateHz:["Designed rate","Hz"],actualRateHz:["Actual rate","Hz"],operatingDuty:["Duty op","ratio"],injection:["Injection","duty"],noiseFloor:["Noise","duty"],
    producerSeq:["Producer seq",""],consumerSeq:["Consumer seq",""],handoff:["Handoff","bool"],deadlineUs:["Deadline","µs"],averageScale:["Avg scale","ratio"],
    initialA:["Initial I","A"],referenceA:["Iref","A"],limit:["Limit",""]
  };

  function addNavButton(){
    const toolbar=document.querySelector(".workspace-header .toolbar");
    if(toolbar&&!$("open-ti-concepts")){
      const b=document.createElement("button");b.id="open-ti-concepts";b.type="button";b.textContent="TI Concepts";b.onclick=()=>{location.hash="ti-concepts";location.reload();};toolbar.prepend(b);
    }
  }
  function setHeader(title,sub){
    document.body.dataset.tiConcepts="true";
    const h=document.querySelector(".workspace-header strong");if(h)h.textContent=title;
    const p=$("workspace-progress");if(p)p.textContent=sub||"15 primary-source engineering concepts";
    const ti=$("open-ti-learning");if(ti){ti.textContent="Buck Learning";ti.onclick=()=>{location.hash="ti-learning";location.reload();};}
    addNavButton();
  }
  async function loadData(){
    const [c,m]=await Promise.all([
      fetch("learning/ti/concept-cards.json",{cache:"no-store"}).then(r=>r.json()),
      fetch("learning/ti/manifest.json",{cache:"no-store"}).then(r=>r.json())
    ]);
    cards=c.cards;manifest=m;
  }
  function sourceById(id){return manifest.documents.find(d=>d.id===id);}
  function clearWorkspace(){
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    $("lesson-control").hidden=true;$("metrics")?.setAttribute?.("hidden","");
    const route=document.querySelector(".route");if(route)route.hidden=true;
    $("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("deeper").hidden=true;
    $("ws-feedback").textContent="";$("surface-help").replaceChildren();
  }
  function stateFor(id){
    const s=E.load();
    return s.benchmark?.tiConceptWeb?.[id]||{version:1};
  }
  function saveState(id,patch){
    const s=E.load();s.benchmark.tiConceptWeb||={};
    s.benchmark.tiConceptWeb[id]={...(s.benchmark.tiConceptWeb[id]||{version:1}),...patch,updatedAt:new Date().toISOString()};
    E.save(s);return s.benchmark.tiConceptWeb[id];
  }
  function renderCatalog(){
    clearWorkspace();setHeader("TI Primary-Source Concept Labs","15 concepts · web evidence surfaces");
    document.body.dataset.tiConceptCatalog="true";
    $("surface-title").textContent="TI Concept Labs";
    $("circuit").hidden=true;$("circuit-state").hidden=true;$("ws-plot").hidden=true;$("ws-comparison").hidden=true;
    let grid=$("ti-concept-grid");
    if(!grid){grid=document.createElement("div");grid.id="ti-concept-grid";grid.className="ti-concept-grid";$("workspace-surface").append(grid);}
    grid.replaceChildren();
    cards.forEach((card,index)=>{
      const st=stateFor(card.id),lab=L.get(card.id),article=document.createElement("article");article.className="ti-concept-card";
      const top=document.createElement("div");top.className="ti-concept-card-top";
      const n=document.createElement("span");n.textContent=String(index+1).padStart(2,"0");
      const kind=document.createElement("span");kind.textContent=lab.kind;top.append(n,kind);
      const h=document.createElement("h3");h.textContent=card.title;
      const p=document.createElement("p");p.textContent=card.problem;
      const meta=document.createElement("p");meta.className="ti-concept-meta";meta.textContent=`Sources: ${card.sourceIds.join(", ")} · ${st.predictionCommitted?"prediction saved":"new"}`;
      const b=document.createElement("button");b.type="button";b.className="primary";b.textContent=lab.route?"Open dedicated lab":"Open concept lab";
      b.onclick=()=>{location.hash=lab.route?lab.route.slice(1):"ti-concept/"+card.id;location.reload();};
      article.append(top,h,p,meta,b);grid.append(article);
    });
    $("ws-count").textContent="15 / 15 mapped";$("ws-title").textContent="一張卡 = 一個工程問題 + 一個 evidence surface";
    $("ws-intro").textContent="不是 PDF 目錄。每張卡先預測，再解鎖可計算證據。";
    $("ws-question").replaceChildren();
    const info=document.createElement("div");info.className="ti-physics-rule";info.innerHTML="<strong>Rule</strong><p>Prediction integrity、TI source closure、V5 durable state 都沿用現有架構。</p>";$("ws-question").append(info);
    $("ws-save").textContent="Catalog itself does not grant mastery.";
  }
  function renderInputs(){
    let box=$("ti-concept-inputs");if(!box){box=document.createElement("div");box.id="ti-concept-inputs";box.className="ti-concept-inputs";$("workspace-surface").append(box);}
    box.replaceChildren();
    Object.entries(input).forEach(([key,value])=>{
      const spec=pretty[key]||[key,""],label=document.createElement("label");label.className="ti-concept-input";
      const name=document.createElement("span");name.textContent=spec[0];
      let control;
      if(typeof value==="boolean"){control=document.createElement("input");control.type="checkbox";control.checked=value;}
      else {control=document.createElement("input");control.type="number";control.value=value;control.step=Math.abs(value)>=1000?"100":Math.abs(value)>=1?".1":"0.000001";}
      const unit=document.createElement("span");unit.textContent=spec[1];
      control.onchange=()=>{input={...input,[key]:typeof value==="boolean"?control.checked:Number(control.value)};saveState(current.id,{input});if(revealed){result=L.evaluate(current.id,input);renderEvidence();}};
      label.append(name,control,unit);box.append(label);
    });
  }
  function metricGrid(metrics){
    const g=document.createElement("div");g.className="ti-concept-metrics";
    Object.entries(metrics).forEach(([k,v])=>{
      const d=document.createElement("div"),s=document.createElement("span"),strong=document.createElement("strong");s.textContent=k;
      strong.textContent=typeof v==="number"?(Math.abs(v)>=1000?v.toFixed(0):Math.abs(v)>=10?v.toFixed(2):v.toFixed(4)):String(v);
      d.append(s,strong);g.append(d);
    });return g;
  }
  function drawSeries(series){
    const svg=$("ws-plot");svg.replaceChildren();svg.hidden=false;svg.setAttribute("viewBox","0 0 720 300");
    const grid=document.createElementNS("http://www.w3.org/2000/svg","g");grid.setAttribute("class","ti-scope-grid");
    for(let i=1;i<10;i++){const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",`M${60+i*62} 25V270`);grid.append(p);}
    for(let i=1;i<6;i++){const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",`M60 ${25+i*40}H680`);grid.append(p);}svg.append(grid);
    if(!series)return;
    const sets=Array.isArray(series)?[series]:Object.values(series).filter(Array.isArray);
    sets.slice(0,2).forEach((rows,setIndex)=>{
      if(!rows.length)return;
      if(typeof rows[0]==="number"){
        const lo=Math.min(...rows),hi=Math.max(...rows),span=hi-lo||1,pts=rows.map((v,i)=>`${70+i/(rows.length-1)*600},${260-(v-lo)/span*210}`).join(" ");
        const pl=document.createElementNS("http://www.w3.org/2000/svg","polyline");pl.setAttribute("points",pts);pl.setAttribute("class",setIndex?"ti-trace ti-trace-vout":"ti-trace ti-trace-il");svg.append(pl);return;
      }
      const numericKeys=Object.keys(rows[0]).filter(k=>typeof rows[0][k]==="number");
      if(numericKeys.length<2)return;
      const [xk,yk]=numericKeys, xs=rows.map(r=>r[xk]),ys=rows.map(r=>r[yk]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),xspan=xmax-xmin||1,yspan=ymax-ymin||1;
      const pts=rows.map(r=>`${70+(r[xk]-xmin)/xspan*600},${260-(r[yk]-ymin)/yspan*210}`).join(" ");
      const pl=document.createElementNS("http://www.w3.org/2000/svg","polyline");pl.setAttribute("points",pts);pl.setAttribute("class",setIndex?"ti-trace ti-trace-vout":"ti-trace ti-trace-il");svg.append(pl);
    });
  }
  function renderEvidence(){
    if(!revealed||!result)return;
    $("ws-plot").hidden=false;drawSeries(result.series);
    $("ws-comparison").hidden=false;$("ws-comparison").textContent=result.summary;
    const surface=$("surface-help");surface.replaceChildren();surface.append(metricGrid(result.metrics));
    const boundary=document.createElement("p");boundary.className="ti-concept-boundary";boundary.textContent="Boundary: "+result.boundary;surface.append(boundary);
  }
  function sourceLinks(){
    const wrap=document.createElement("div");wrap.className="ti-concept-sources";
    current.sourceIds.forEach(id=>{const d=sourceById(id),a=document.createElement("a");a.target="_blank";a.rel="noopener";a.href=d?.url||"#";a.textContent=id;wrap.append(a);});
    return wrap;
  }
  function responseBox(mode,prompt){
    const wrap=document.createElement("div");wrap.className="ti-response-box",h=document.createElement("strong");h.textContent=mode.toUpperCase();
    const p=document.createElement("p");p.textContent=prompt,ta=document.createElement("textarea");ta.rows=3;ta.placeholder="先用自己的因果模型回答…";
    const b=document.createElement("button");b.type="button";b.textContent="Save "+mode;
    b.onclick=()=>{const text=ta.value.trim();if(!text)return;E.recordOpenResponse("ti-concept:"+current.id+":"+mode,{answer:text,mode});saveState(current.id,{[mode+"Saved"]:true});b.textContent="Saved";};
    wrap.append(h,p,ta,b);return wrap;
  }
  function renderLab(id){
    current=cards.find(c=>c.id===id);if(!current){renderCatalog();return;}
    const lab=L.get(id);if(lab.route){location.hash=lab.route.slice(1);location.reload();return;}
    clearWorkspace();setHeader("TI Concept Lab",current.title);document.body.dataset.tiConceptCatalog="false";
    $("circuit").hidden=true;$("circuit-state").hidden=true;
    const st=stateFor(id);input={...L.defaults(id),...(st.input||{})};revealed=!!st.predictionCommitted;result=revealed?L.evaluate(id,input):null;
    $("surface-title").textContent=current.title;renderInputs();
    $("ws-plot").hidden=!revealed;$("ws-comparison").hidden=!revealed;
    $("ws-count").textContent=`${current.sourceIds.join(" · ")} · ${lab.kind}`;
    $("ws-title").textContent=current.problem;$("ws-intro").replaceChildren(sourceLinks());
    $("ws-steps").replaceChildren();
    ["Predict","Evidence","Diagnose","Transfer"].forEach((t,i)=>{const b=document.createElement("button");b.type="button";b.disabled=true;b.textContent=(i+1)+". "+t;if((revealed?1:0)===i)b.setAttribute("aria-current","step");$("ws-steps").append(b);});
    const q=$("ws-question");q.replaceChildren();
    const prompt=document.createElement("p");prompt.className="ti-concept-prompt";prompt.textContent=current.questions.find(x=>x.mode==="predict").prompt;q.append(prompt);
    if(!revealed){
      const fs=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="先預測";fs.append(legend);
      L.choices(id).forEach(([value,label])=>{const l=document.createElement("label"),r=document.createElement("input");r.type="radio";r.name="ti-concept-predict";r.value=value;l.append(r,document.createTextNode(" "+label));fs.append(l);});q.append(fs);
      const b=document.createElement("button");b.className="primary";b.type="button";b.textContent="Lock prediction → reveal evidence";
      b.onclick=()=>{
        const selected=document.querySelector('input[name="ti-concept-predict"]:checked')?.value;if(!selected)return;
        const correct=selected===L.expected(id);
        try{E.commitPrediction("ti-concept:"+id,{prediction:selected,parameters:JSON.stringify(input),confidence:70});}catch{}
        saveState(id,{input,predictionCommitted:true,prediction:selected,predictionCorrect:correct});
        E.recordEvidence("ti-concept:"+id,2,"ti-concept-web",{sourceIds:current.sourceIds,kind:lab.kind},{strength:"none",stage:"practiced"});
        revealed=true;result=L.evaluate(id,input);renderLab(id);
      };q.append(b);
    }else{
      const verdict=document.createElement("div");verdict.className="ti-concept-verdict";verdict.textContent=st.predictionCorrect?"Prediction: matched model":"Prediction: model disagrees — inspect evidence";q.append(verdict);
      q.append(responseBox("diagnose",current.questions.find(x=>x.mode==="diagnose").prompt));
      q.append(responseBox("transfer",current.questions.find(x=>x.mode==="transfer").prompt));
    }
    renderEvidence();
    $("ws-save").textContent="Prediction/evidence use existing circuit-learning-state-v5. Diagnose/transfer free responses are preserved without auto-claiming mastery.";
  }
  async function mount(hash){
    await loadData();const raw=hash||location.hash;
    if(raw.startsWith("#ti-concept/"))renderLab(decodeURIComponent(raw.slice("#ti-concept/".length)));
    else renderCatalog();
  }
  return {mount};
});
