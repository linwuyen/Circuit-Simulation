(function(root,factory){
  const api=factory(root);
  root.CircuitTIBuckPhysicsUI=api;
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const E=root.CircuitEvidence,B=root.CircuitTrainingExperiments,P=root.CircuitTIBuckPhysics;
  const STORE_KEY="tiBuckPhysicsExplorer",DEFAULT={...P.defaults};
  let config={...DEFAULT},mode="startup",steady=null,transient=null,sweep=null;

  const specs=[
    ["vin","Vin","V",12,96,6],
    ["duty","Duty","",.05,.8,.05],
    ["inductanceUh","L","µH",20,1000,20],
    ["capacitanceUf","C","µF",22,2200,22],
    ["loadOhm","R","Ω",.5,150,1],
    ["fswKhz","fsw","kHz",20,500,10]
  ];

  function svgEl(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
    if(text)n.textContent=text;
    return n;
  }
  function load(){
    const state=E.load(),row=state.benchmark?.[STORE_KEY];
    if(row?.version===1){config={...DEFAULT,...(row.config||{})};mode=row.mode||"startup";}
  }
  function save(){
    const state=E.load();
    state.benchmark[STORE_KEY]={version:1,config:{...config},mode,updatedAt:new Date().toISOString()};
    E.save(state);
  }
  function header(){
    document.body.dataset.tiPhysics="true";
    const h=document.querySelector(".workspace-header strong");if(h)h.textContent="TI Buck Physics Workbench";
    const p=$("workspace-progress");if(p)p.textContent="Steady state · CCM/BCM/DCM · switched startup transient";
    const toolbar=document.querySelector(".workspace-header .toolbar"),ti=$("open-ti-learning");\n    if(toolbar&&!$("open-ti-concepts")){const concepts=document.createElement("button");concepts.id="open-ti-concepts";concepts.type="button";concepts.textContent="TI Concepts";concepts.onclick=()=>{location.hash="ti-concepts";location.reload();};toolbar.prepend(concepts);}
    if(ti){ti.textContent="Learning Loop";ti.onclick=()=>{location.hash="ti-learning";location.reload();};}
    if(toolbar&&!$("open-buck-physics")){
      const b=document.createElement("button");b.id="open-buck-physics";b.type="button";b.textContent="Buck Physics";b.disabled=true;toolbar.prepend(b);
    }
  }
  function compute(){
    steady=P.steadySnapshot(B.buck,config);
    transient=P.simulateTransient(config,{cycles:600,stepsPerCycle:70,maxPoints:1000});
    sweep=P.loadSweep(B.buck,config,{
      minLoadOhm:Math.max(.2,Math.min(config.loadOhm/4,steady.boundaryOhm/4)),
      maxLoadOhm:Math.min(5000,Math.max(config.loadOhm*4,steady.boundaryOhm*4)),
      points:48
    });
  }
  function circuitState(){
    $("on-path").style.display="";$("off-path").style.display="none";$("switch").setAttribute("d","M140 70H200");
    $("circuit-state").textContent=
      `ON: vL +${steady.firstOrder.onVL.toFixed(2)} V · di/dt +${steady.firstOrder.onSlopeAUs.toFixed(3)} A/µs  |  OFF: vL ${steady.firstOrder.offVL.toFixed(2)} V · di/dt ${steady.firstOrder.offSlopeAUs.toFixed(3)} A/µs`;
  }
  function renderControls(){
    let panel=$("ti-physics-controls");
    if(!panel){panel=document.createElement("div");panel.id="ti-physics-controls";panel.className="ti-physics-controls";$("circuit").after(panel);}
    panel.replaceChildren();
    specs.forEach(([key,label,unit,min,max,step])=>{
      const wrap=document.createElement("label");wrap.className="ti-physics-control";
      const head=document.createElement("span");head.textContent=label;
      const out=document.createElement("output");out.textContent=key==="duty"?Math.round(config[key]*100)+"%":config[key]+" "+unit;
      const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=config[key];input.setAttribute("aria-label",label);
      input.oninput=()=>{
        config={...config,[key]:Number(input.value)};
        out.textContent=key==="duty"?Math.round(config[key]*100)+"%":config[key]+" "+unit;
        save();render();
      };
      wrap.append(head,input,out);panel.append(wrap);
    });
  }
  function renderModeBar(){
    let bar=$("ti-physics-modebar");
    if(!bar){bar=document.createElement("div");bar.id="ti-physics-modebar";bar.className="ti-physics-modebar";$("ws-plot").before(bar);}
    bar.replaceChildren();
    [["startup","Startup / full transient"],["sweep","Load sweep / regime"]].forEach(([id,label])=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;if(mode===id)b.setAttribute("aria-current","page");
      b.onclick=()=>{mode=id;save();render();};bar.append(b);
    });
    const status=document.createElement("span");status.className="ti-physics-status";status.textContent=`${steady.regime} · Rcrit ${steady.boundaryOhm.toFixed(2)} Ω`;bar.append(status);
  }
  function grid(svg,w=720,h=330){
    const g=svgEl("g",{class:"ti-scope-grid"});
    for(let i=1;i<10;i++)g.append(svgEl("path",{d:`M${70+i*60} 25V${h-25}`}));
    for(let i=1;i<7;i++)g.append(svgEl("path",{d:`M70 ${25+i*(h-50)/7}H${w-30}`}));
    svg.append(g);
  }
  function plotStartup(){
    const svg=$("ws-plot");svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 330");grid(svg);
    const rows=transient.rows,T=Math.max(...rows.map(r=>r.tMs)),vMax=Math.max(steady.vout*1.35,...rows.map(r=>r.vout),1),iMax=Math.max(steady.peakI*1.35,...rows.map(r=>r.iL),1);
    const x=t=>70+t/T*610,yV=v=>145-v/vMax*105,yI=i=>300-i/iMax*105;
    const poly=(vals,y,klass)=>svgEl("polyline",{points:vals.map(r=>`${x(r.tMs)},${y(r)}`).join(" "),class:klass});
    svg.append(svgEl("text",{x:15,y:75,class:"ti-trace-label"},"Vout"));
    svg.append(svgEl("text",{x:15,y:230,class:"ti-trace-label"},"iL"));
    svg.append(poly(rows,r=>yV(r.vout),"ti-trace ti-trace-vout"));
    svg.append(poly(rows,r=>yI(r.iL),"ti-trace ti-trace-il"));
    svg.append(svgEl("path",{d:`M70 ${yV(steady.vout)}H680`,class:"ti-target-line"}));
    svg.append(svgEl("text",{x:535,y:yV(steady.vout)-5,class:"ti-value-label"},`steady ${steady.vout.toFixed(2)} V`));
    svg.append(svgEl("text",{x:290,y:325,class:"ti-time-label"},`time 0 → ${T.toFixed(2)} ms`));
    $("ws-comparison").textContent=`Transient solver ${transient.solver.dtUs.toFixed(3)} µs/step · final Vout ${transient.final.avgVout.toFixed(2)} V · final avg iL ${transient.final.avgIL.toFixed(2)} A · peak Vout ${transient.final.peakVout.toFixed(2)} V`;
  }
  function plotSweep(){
    const svg=$("ws-plot");svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 330");grid(svg);
    const rows=sweep.rows,min=Math.min(...rows.map(r=>r.loadOhm)),max=Math.max(...rows.map(r=>r.loadOhm)),vmax=Math.max(...rows.map(r=>r.vout))*1.12;
    const logX=r=>70+(Math.log(r)-Math.log(min))/(Math.log(max)-Math.log(min))*610,y=v=>285-v/vmax*220;
    svg.append(svgEl("polyline",{points:rows.map(r=>`${logX(r.loadOhm)},${y(r.vout)}`).join(" "),class:"ti-trace ti-trace-vout"}));
    const xb=logX(sweep.boundaryOhm);
    svg.append(svgEl("path",{d:`M${xb} 25V300`,class:"ti-boundary-line"}));
    svg.append(svgEl("text",{x:Math.max(75,xb-45),y:42,class:"ti-value-label"},`Rcrit ${sweep.boundaryOhm.toFixed(1)}Ω`));
    svg.append(svgEl("text",{x:90,y:312,class:"ti-regime-label"},"CCM"));
    svg.append(svgEl("text",{x:585,y:312,class:"ti-regime-label"},"DCM"));
    svg.append(svgEl("text",{x:15,y:80,class:"ti-trace-label"},"Vout"));
    $("ws-comparison").textContent=`Load sweep ${min.toFixed(2)} → ${max.toFixed(2)} Ω · boundary ${sweep.boundaryOhm.toFixed(2)} Ω · current point ${config.loadOhm.toFixed(2)} Ω = ${steady.regime}`;
  }
  function renderCoach(){
    $("ws-count").textContent="Buck Physics · deterministic model";$("ws-title").textContent=`${steady.regime} · ${steady.vout.toFixed(2)} V`;
    $("ws-intro").textContent="改一個參數，直接看 operating point、regime boundary 與 switched transient。";$("ws-steps").replaceChildren();
    const q=$("ws-question");q.replaceChildren();
    const metrics=[["Rcrit",steady.boundaryOhm.toFixed(2)+" Ω"],["Vout",steady.vout.toFixed(2)+" V"],["avg iL",steady.avgI.toFixed(2)+" A"],["ΔiL",steady.ripple.toFixed(3)+" A"],["vL ON",steady.firstOrder.onVL.toFixed(2)+" V"],["di/dt ON",steady.firstOrder.onSlopeAUs.toFixed(3)+" A/µs"]];
    const mg=document.createElement("div");mg.className="ti-physics-metrics";metrics.forEach(([k,v])=>{const d=document.createElement("div");d.innerHTML=`<span>${k}</span><strong>${v}</strong>`;mg.append(d);});q.append(mg);
    const rule=document.createElement("div");rule.className="ti-physics-rule";rule.innerHTML=`<strong>Regime rule</strong><p>R &lt; Rcrit → CCM；R &gt; Rcrit → DCM。現在 R = ${config.loadOhm.toFixed(2)} Ω，Rcrit = ${steady.boundaryOhm.toFixed(2)} Ω。</p>`;q.append(rule);
    const cause=document.createElement("div");cause.className="ti-physics-rule";cause.innerHTML='<strong>Physics</strong><p>ON: vL = Vin − Vout；OFF(續流): vL ≈ −Vout；di/dt = vL/L。</p>';q.append(cause);
    $("ws-feedback").textContent="";$("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("deeper").hidden=true;
    $("ws-save").textContent="Config stored in existing V5 benchmark state; this explorer does not grant mastery evidence.";
  }
  function render(){
    compute();$("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;
    const route=document.querySelector(".route");if(route)route.hidden=true;
    $("surface-title").textContent="Buck Physics Workbench";$("metrics")?.setAttribute?.("hidden","");$("lesson-control").hidden=true;
    renderControls();renderModeBar();circuitState();renderCoach();if(mode==="startup")plotStartup();else plotSweep();
    $("surface-help").replaceChildren();$("scope-note").textContent=transient.boundary;
  }
  function mount(){if(!E||!B||!P)throw new Error("Buck physics dependencies missing");load();header();render();}
  return {mount};
});
