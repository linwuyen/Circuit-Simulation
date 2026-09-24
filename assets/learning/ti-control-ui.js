(function(root,factory){
  const api=factory(root);root.CircuitTIControlUI=api;
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id),E=root.CircuitEvidence,C=root.CircuitTIControlWorkbench;
  const STORE="tiControlWorkbench";
  let cfg={...C.defaults},mode="bode",loop=null,sfra=null,time=null;
  const specs=[
    ["kp","Kp","",.005,.25,.005],["ki","Ki","1/s",5,500,5],["delayUs","Delay","µs",0,35,1],
    ["injectionDuty","SFRA inj","duty",.0001,.2,.001],["noiseDuty","Noise","duty",.00001,.005,.00005],
    ["loadOhm","R","Ω",1,40,1]
  ];
  const svgEl=(tag,a={},t="")=>{const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,String(v)));if(t)n.textContent=t;return n;};
  function load(){const s=E.load().benchmark?.[STORE];if(s?.version===1){cfg={...C.defaults,...(s.config||{})};mode=s.mode||"bode";}}
  function save(){const s=E.load();s.benchmark[STORE]={version:1,config:{...cfg},mode,updatedAt:new Date().toISOString()};E.save(s);}
  function compute(){loop=C.loopResponse(cfg);sfra=C.sfraMeasurement(cfg);time=C.timeResponse(cfg);}
  function header(){
    document.body.dataset.tiControl="true";
    document.querySelector(".workspace-header strong").textContent="TI Digital Control + SFRA Workbench";
    $("workspace-progress").textContent="Plant → PI → delay → loop gain → SFRA → switched causal transient";
    const bar=document.querySelector(".workspace-header .toolbar"),ti=$("open-ti-learning");
    if(ti){ti.textContent="Buck Learning";ti.onclick=()=>{location.hash="ti-learning";location.reload();};}
    if(bar&&!$("open-ti-concepts")){const b=document.createElement("button");b.id="open-ti-concepts";b.textContent="TI Concepts";b.onclick=()=>{location.hash="ti-concepts";location.reload();};bar.prepend(b);}
  }
  function clear(){
    $("setup-panel").hidden=true;$("free-controls").hidden=true;$("concept-note").hidden=true;$("transfer-preview").hidden=true;$("workbench-context-slot").hidden=true;$("lesson-control").hidden=true;
    $("metrics")?.setAttribute?.("hidden","");const r=document.querySelector(".route");if(r)r.hidden=true;
    $("circuit").hidden=true;$("circuit-state").hidden=true;$("ws-result").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("deeper").hidden=true;
  }
  function controls(){
    let p=$("ti-control-controls");if(!p){p=document.createElement("div");p.id="ti-control-controls";p.className="ti-control-controls";$("workspace-surface").append(p);}p.replaceChildren();
    specs.forEach(([key,label,unit,min,max,step])=>{const l=document.createElement("label"),s=document.createElement("span"),i=document.createElement("input"),o=document.createElement("output");s.textContent=label;i.type="range";i.min=min;i.max=max;i.step=step;i.value=cfg[key];o.textContent=Number(cfg[key]).toPrecision(4)+" "+unit;i.oninput=()=>{cfg={...cfg,[key]:Number(i.value)};o.textContent=Number(cfg[key]).toPrecision(4)+" "+unit;save();render();};l.append(s,i,o);p.append(l);});
  }
  function modebar(){
    let b=$("ti-control-modebar");if(!b){b=document.createElement("div");b.id="ti-control-modebar";b.className="ti-control-modebar";$("ws-plot").before(b);}b.replaceChildren();
    [["bode","Bode / margin"],["sfra","SFRA model vs measurement"],["time","Switched transient"]].forEach(([id,label])=>{const x=document.createElement("button");x.textContent=label;if(mode===id)x.setAttribute("aria-current","page");x.onclick=()=>{mode=id;save();render();};b.append(x);});
    const st=document.createElement("span");st.textContent=mode==="sfra"?sfra.quality:`fc≈${loop.crossoverHz.toFixed(0)} Hz · PM ${loop.phaseMarginDeg.toFixed(1)}°`;b.append(st);
  }
  function grid(svg){const g=svgEl("g",{class:"ti-scope-grid"});for(let i=1;i<10;i++)g.append(svgEl("path",{d:`M${70+i*60} 25V310`}));for(let i=1;i<7;i++)g.append(svgEl("path",{d:`M70 ${25+i*40}H680`}));svg.append(g);}
  const logX=(f,min,max)=>70+(Math.log10(f)-Math.log10(min))/(Math.log10(max)-Math.log10(min))*610;
  function bodePlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 330");grid(svg);
    const rows=loop.rows,min=rows[0].f,max=rows.at(-1).f,magMin=Math.min(-60,...rows.map(r=>r.loopMagDb)),magMax=Math.max(30,...rows.map(r=>r.loopMagDb));
    const yM=v=>145-(v-magMin)/(magMax-magMin)*105,yP=v=>300-(v+270)/270*115;
    svg.append(svgEl("text",{x:15,y:70,class:"ti-trace-label"},"|L| dB"));svg.append(svgEl("text",{x:15,y:230,class:"ti-trace-label"},"phase"));
    svg.append(svgEl("polyline",{points:rows.map(r=>`${logX(r.f,min,max)},${yM(r.loopMagDb)}`).join(" "),class:"ti-trace ti-trace-il"}));
    svg.append(svgEl("polyline",{points:rows.map(r=>`${logX(r.f,min,max)},${yP(r.loopPhaseDeg)}`).join(" "),class:"ti-trace ti-trace-vout"}));
    const xc=logX(loop.crossoverHz,min,max);svg.append(svgEl("path",{d:`M${xc} 25V310`,class:"ti-boundary-line"}));
    $("ws-comparison").textContent=`PI zero ${loop.piZeroHz.toFixed(1)} Hz · crossover ≈ ${loop.crossoverHz.toFixed(0)} Hz · phase ${loop.phaseAtCrossoverDeg.toFixed(1)}° · PM ${loop.phaseMarginDeg.toFixed(1)}° · delay ${cfg.delayUs.toFixed(1)} µs`;
  }
  function sfraPlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 330");grid(svg);
    const rows=sfra.rows,min=rows[0].f,max=rows.at(-1).f,vals=rows.flatMap(r=>[r.modelMagDb,r.measuredMagDb]),lo=Math.min(...vals)-5,hi=Math.max(...vals)+5,y=v=>270-(v-lo)/(hi-lo)*220;
    svg.append(svgEl("polyline",{points:rows.map(r=>`${logX(r.f,min,max)},${y(r.modelMagDb)}`).join(" "),class:"ti-trace ti-trace-il"}));
    svg.append(svgEl("polyline",{points:rows.map(r=>`${logX(r.f,min,max)},${y(r.measuredMagDb)}`).join(" "),class:"ti-trace ti-trace-vout"}));
    svg.append(svgEl("text",{x:15,y:55,class:"ti-trace-label"},"model / synthetic SFRA"));
    $("ws-comparison").textContent=`${sfra.quality} · injection ${cfg.injectionDuty.toFixed(4)} duty · headroom ${sfra.headroom.toFixed(3)} · SNR ${sfra.snrDb.toFixed(1)} dB`;
  }
  function timePlot(){
    const svg=$("ws-plot");svg.replaceChildren();svg.setAttribute("viewBox","0 0 720 330");grid(svg);const rows=time.rows,T=rows.at(-1).tMs,vmax=Math.max(...rows.map(r=>r.vout),1),imax=Math.max(...rows.map(r=>r.iL),1),x=t=>70+t/T*610,yv=v=>145-v/vmax*105,yi=i=>300-i/imax*105;
    svg.append(svgEl("text",{x:15,y:70,class:"ti-trace-label"},"Vout"));svg.append(svgEl("text",{x:15,y:230,class:"ti-trace-label"},"iL"));
    svg.append(svgEl("polyline",{points:rows.map(r=>`${x(r.tMs)},${yv(r.vout)}`).join(" "),class:"ti-trace ti-trace-vout"}));
    svg.append(svgEl("polyline",{points:rows.map(r=>`${x(r.tMs)},${yi(r.iL)}`).join(" "),class:"ti-trace ti-trace-il"}));
    $("ws-comparison").textContent=`generic switched causal kernel · final Vout ${time.summary.finalV.toFixed(2)} V · peak I ${time.summary.peakI.toFixed(2)} A · PWM commit misses ${time.summary.missedCommits}`;
  }
  function coach(){
    $("ws-count").textContent="SLUP173 · SSZTCG3/4 · SPRUIK4A";$("ws-title").textContent="Control loop truth: model, delay, injection, timing";$("ws-intro").textContent="調 Kp/Ki/Delay，再看 Bode、SFRA injection quality 與 switched timing。";$("ws-steps").replaceChildren();
    const q=$("ws-question");q.replaceChildren();const g=document.createElement("div");g.className="ti-physics-metrics";
    const rows=[["fc",loop.crossoverHz.toFixed(0)+" Hz"],["PM",loop.phaseMarginDeg.toFixed(1)+"°"],["PI zero",loop.piZeroHz.toFixed(1)+" Hz"],["SFRA",sfra.quality],["SNR",sfra.snrDb.toFixed(1)+" dB"],["misses",String(time.summary.missedCommits)]];
    rows.forEach(([k,v])=>{const d=document.createElement("div");d.innerHTML=`<span>${k}</span><strong>${v}</strong>`;g.append(d);});q.append(g);
    const a=document.createElement("div");a.className="ti-physics-rule";a.innerHTML="<strong>Truth boundary</strong><p>Bode = averaged CCM model；SFRA = deterministic synthetic injection discipline；time view = existing generic switched teaching kernel。三者不能冒充真板量測。</p>";q.append(a);
    $("ws-save").textContent="Workbench config stored in V5 benchmark state; no hardware evidence claim.";
  }
  function render(){
    compute();clear();$("surface-title").textContent="Digital Control + SFRA Workbench";controls();modebar();coach();$("ws-plot").hidden=false;$("ws-comparison").hidden=false;
    if(mode==="bode")bodePlot();else if(mode==="sfra")sfraPlot();else timePlot();
    $("surface-help").replaceChildren();$("scope-note").textContent=mode==="bode"?loop.boundary:mode==="sfra"?sfra.boundary:time.boundary;
  }
  function mount(){load();header();render();}
  return {mount};
});
