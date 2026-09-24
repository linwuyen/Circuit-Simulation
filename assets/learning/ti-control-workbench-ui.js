(function(root,factory){
  root.CircuitTIControlWorkbench=factory(root);
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const C=root.CircuitTIControlWorkbenchCore;
  const E=root.CircuitControlEngineeringV1;
  const T=root.CircuitTopologyTransferV1;
  const Evidence=root.CircuitEvidence;
  const STORE="tiControlWorkbench";
  let config={...C.defaults,plant:{...C.defaults.plant}},mode="bode",mismatchDelayUs=0;

  function load(){
    const row=Evidence.load().benchmark?.[STORE]||{};
    config={...C.defaults,...(row.config||{}),plant:{...C.defaults.plant,...(row.config?.plant||{})}};
    mismatchDelayUs=Number(row.mismatchDelayUs||0);
  }
  function save(){
    const s=Evidence.load();s.benchmark[STORE]={config:{...config,plant:{...config.plant}},mismatchDelayUs,updatedAt:new Date().toISOString()};Evidence.save(s);
  }
  function svgEl(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text)n.textContent=text;return n;
  }
  function model(){return C.sweep(E,T,config);}
  function setup(){
    document.body.dataset.tiControl="true";document.querySelector(".route")?.setAttribute("hidden","");
    ["setup-panel","free-controls","concept-note","transfer-preview","workbench-context-slot","lesson-control"].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    $("circuit").hidden=true;$("circuit-state").hidden=true;$("answer-observation").hidden=true;
    const h=document.querySelector(".workspace-header strong");if(h)h.textContent="Digital Control + Bode/SFRA Workbench";
    const entry=$("open-ti-learning");if(entry){entry.textContent="返回 TI Concepts";entry.onclick=()=>{location.hash="ti-concepts/loop-stability";location.reload();};}
    $("workspace-progress").textContent="Plant → PI → ZOH/delay → open loop → SFRA correlation";
    $("surface-title").textContent="Buck CCM control loop";
    $("ws-count").textContent="Equation-grade control workbench";
    $("ws-title").textContent="不要靠試誤調 PI：先看 plant、zero、crossover、delay";
    $("ws-intro").textContent="同一個 local small-signal model，同時看 controller、digital delay、margin 與量測 mismatch。";
    $("deeper").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    document.querySelector(".metrics").hidden=false;$("ws-display-wrap").hidden=false;
  }
  function controls(){
    const q=$("ws-question");q.replaceChildren();
    const m=model();
    const h=document.createElement("h2");h.textContent="Control parameters";q.append(h);
    const defs=[
      ["Kp","kp",0,0.02,.00025],
      ["Ki","ki",0,80,1],
      ["Ts (µs)","sampleUs",5,100,5],
      ["extra delay (µs)","delayUs",0,100,1]
    ];
    defs.forEach(([label,key,min,max,step])=>{
      const l=document.createElement("label");l.className="ti-control-param";
      const span=document.createElement("span"),out=document.createElement("output"),input=document.createElement("input");
      span.textContent=label;out.textContent=Number(config[key]).toPrecision(4);input.type="range";input.min=min;input.max=max;input.step=step;input.value=config[key];
      input.oninput=()=>{out.textContent=Number(input.value).toPrecision(4);};
      input.onchange=()=>{config={...config,[key]:Number(input.value)};save();render();};
      l.append(span,input,out);q.append(l);
    });

    const sep=document.createElement("hr");q.append(sep);
    const mismatch=document.createElement("label");mismatch.className="ti-control-param";
    const span=document.createElement("span");span.textContent="SFRA extra delay (µs)";
    const input=document.createElement("input");input.type="range";input.min=0;input.max=100;input.step=5;input.value=mismatchDelayUs;
    const out=document.createElement("output");out.textContent=mismatchDelayUs;
    input.oninput=()=>out.textContent=input.value;
    input.onchange=()=>{mismatchDelayUs=Number(input.value);save();render();};
    mismatch.append(span,input,out);q.append(mismatch);

    const reset=document.createElement("button");reset.type="button";reset.textContent="Reset stable baseline";
    reset.onclick=()=>{config={...C.defaults,plant:{...C.defaults.plant}};mismatchDelayUs=0;save();render();};q.append(reset);

    const evidence=document.createElement("div");evidence.className="ti-control-status";
    evidence.innerHTML=`<strong>${m.margins.phaseMarginDeg!=null&&m.margins.phaseMarginDeg>45?"MARGIN OK":"MARGIN RISK"}</strong>
      <span>fc ${m.margins.crossoverHz?m.margins.crossoverHz.toFixed(1):"—"} Hz</span>
      <span>PM ${m.margins.phaseMarginDeg?m.margins.phaseMarginDeg.toFixed(1):"—"}°</span>
      <span>PI zero ${m.piZeroHz?m.piZeroHz.toFixed(1):"—"} Hz</span>`;
    q.append(evidence);
  }
  function tabs(){
    const nav=$("ws-steps");nav.replaceChildren();
    [["bode","Bode"],["timing","Timing"],["sfra","Model ↔ SFRA"]].forEach(([id,label])=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;if(mode===id)b.setAttribute("aria-current","step");
      b.onclick=()=>{mode=id;renderSurface();};nav.append(b);
    });
  }
  function logX(f,min,max,x0=70,x1=680){return x0+(Math.log10(f)-Math.log10(min))/(Math.log10(max)-Math.log10(min))*(x1-x0);}
  function yMap(v,min,max,y0,y1){return y0-(v-min)/(max-min)*(y0-y1);}
  function path(rows,xKey,yKey,minY,maxY,y0,y1,minF,maxF){
    return rows.map((r,i)=>`${i?"L":"M"}${logX(r[xKey],minF,maxF).toFixed(2)} ${yMap(r[yKey],minY,maxY,y0,y1).toFixed(2)}`).join(" ");
  }
  function grid(svg){
    const g=svgEl("g",{class:"ti-scope-grid"});
    for(let i=0;i<6;i++)g.append(svgEl("path",{d:`M70 ${35+i*48}H680`}));
    for(let i=0;i<7;i++)g.append(svgEl("path",{d:`M${70+i*101.6} 35V275`}));
    svg.append(g);
  }
  function drawBode(svg,m){
    grid(svg);
    const rows=m.rows,minF=config.minHz,maxF=config.maxHz;
    svg.append(svgEl("text",{x:16,y:30,class:"ti-trace-label"},"MAG"));
    svg.append(svgEl("text",{x:16,y:177,class:"ti-trace-label"},"PHASE"));
    svg.append(svgEl("path",{d:path(rows,"frequencyHz","magnitudeDb",-60,60,140,40,minF,maxF),class:"ti-control-mag"}));
    svg.append(svgEl("path",{d:path(rows,"frequencyHz","phaseDeg",-270,30,275,170,minF,maxF),class:"ti-control-phase"}));
    if(m.margins.crossoverHz){
      const x=logX(m.margins.crossoverHz,minF,maxF);
      svg.append(svgEl("path",{d:`M${x} 35V275`,class:"ti-control-marker"}));
      svg.append(svgEl("text",{x:x+4,y:52,class:"ti-value-label"},`fc ${m.margins.crossoverHz.toFixed(0)}Hz`));
    }
  }
  function drawTiming(svg,m){
    grid(svg);
    const budget=C.timing(E,config,m.margins.crossoverHz||100);
    const period=budget.periodUs,scale=t=>70+t/period*610;
    const events=[
      ["PWM ZERO",0],
      ["ADC done",budget.adcDoneS*1e6],
      ["command ready",budget.commandReadyS*1e6],
      ["actuate",budget.actuationS*1e6]
    ];
    svg.append(svgEl("path",{d:"M70 150H680",class:"ti-control-time-axis"}));
    events.forEach(([label,t],i)=>{
      const x=scale(Math.min(period,t));
      svg.append(svgEl("path",{d:`M${x} 70V230`,class:i===3?"ti-control-marker":"ti-control-event"}));
      svg.append(svgEl("text",{x:x+5,y:90+i*28,class:"ti-value-label"},`${label} ${t.toFixed(2)}µs`));
    });
    svg.append(svgEl("text",{x:75,y:260,class:"ti-value-label"},`sample→actuate ${(budget.sampleToActuateS*1e6).toFixed(2)}µs · missed events ${budget.missedLoadEvents} · phase @ fc ${budget.phaseLossDeg?.toFixed(2)??"—"}°`));
  }
  function drawSfra(svg,m){
    grid(svg);
    const corr=C.correlate(E,T,config,{extraDelayUs:mismatchDelayUs});
    const modelRows=m.rows,minF=config.minHz,maxF=config.maxHz;
    svg.append(svgEl("path",{d:path(modelRows,"frequencyHz","phaseDeg",-270,30,260,45,minF,maxF),class:"ti-control-model"}));
    const measRows=corr.measurements.map(x=>({frequencyHz:x.frequencyHz,phaseDeg:x.phaseDeg}));
    svg.append(svgEl("path",{d:path(measRows,"frequencyHz","phaseDeg",-270,30,260,45,minF,maxF),class:"ti-control-measured"}));
    svg.append(svgEl("text",{x:80,y:28,class:"ti-value-label"},`Model vs synthetic measurement · extra delay ${mismatchDelayUs}µs · RMS phase error ${corr.correlation.rmsPhaseDeg.toFixed(2)}°`));
    svg.append(svgEl("text",{x:80,y:285,class:"ti-value-label"},`Claim state: ${corr.claim.state} / evidence: ${corr.claim.evidence}`));
  }
  function renderSurface(){
    const m=model();
    const labels=[["ws-voltage","Crossover"],["ws-current","Phase margin"],["ws-display","PI zero"]];
    labels.forEach(([id,label])=>{const n=$(id);if(n?.parentElement)n.parentElement.firstChild.nodeValue=label;});
    $("ws-voltage").textContent=m.margins.crossoverHz?m.margins.crossoverHz.toFixed(1)+" Hz":"—";
    $("ws-current").textContent=m.margins.phaseMarginDeg?m.margins.phaseMarginDeg.toFixed(1)+"°":"—";
    $("ws-display").textContent=m.piZeroHz?m.piZeroHz.toFixed(1)+" Hz":"—";
    const svg=$("ws-plot");svg.hidden=false;svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 300");
    if(mode==="timing")drawTiming(svg,m);else if(mode==="sfra")drawSfra(svg,m);else drawBode(svg,m);
    $("ws-comparison").textContent=`Buck CCM equation-grade plant · Vout ${m.op.vout.toFixed(1)}V · resonance ${m.op.resonanceHz.toFixed(1)}Hz · ESR zero ${m.op.esrZeroHz.toFixed(0)}Hz · claim ${m.claim}`;
    $("scope-note").textContent=m.boundary;
    const help=$("surface-help");help.replaceChildren();
    const p=document.createElement("p");p.className="ti-source";p.textContent="TI anchors: SLUP173 · SSZTCG3/4 · SPRUIK4A. SFRA correlation shown here is model/synthetic until real provenance is attached.";help.append(p);
  }
  function render(){tabs();controls();renderSurface();Evidence.recordEvidence("ti:control-bode",2,"ti-control-workbench",{config:{...config},mode},{stage:"practiced",strength:"none"});}
  function mount(){
    if(!C||!E||!T||!Evidence)throw Error("control workbench dependencies missing");
    load();setup();render();
  }
  return {mount};
});
