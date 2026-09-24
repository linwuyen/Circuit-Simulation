(function(root,factory){
  root.CircuitTIC2000Timing=factory(root);
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const C=root.CircuitTIC2000TimingCore;
  const S=root.CircuitEngineeringSandboxCore;
  const V=root.CircuitControlValidationV1;
  const E=root.CircuitEvidence;
  let config={...C.defaults};

  function load(){config={...C.defaults,...(E.load().benchmark?.tiC2000Timing?.config||{})};}
  function save(result){
    const s=E.load();s.benchmark.tiC2000Timing={config:{...config},last:{applyCycle:result.applyCycle,extraCycleDelay:result.extraCycleDelay,pass:result.acceptance.pass},updatedAt:new Date().toISOString()};E.save(s);
    E.recordEvidence("ti:epwm-signal-path",2,"ti-c2000-timing",{computeUs:config.computeUs,applyCycle:result.applyCycle,extraCycleDelay:result.extraCycleDelay},{stage:"practiced",strength:"B"});
  }
  function setup(){
    document.body.dataset.tiTiming="true";document.querySelector(".route")?.setAttribute("hidden","");
    ["setup-panel","free-controls","concept-note","transfer-preview","workbench-context-slot","lesson-control"].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    $("circuit").hidden=true;$("circuit-state").hidden=true;$("answer-observation").hidden=true;
    const h=document.querySelector(".workspace-header strong");if(h)h.textContent="C2000 Sample → Compute → Actuate";
    const entry=$("open-ti-learning");if(entry){entry.textContent="返回 TI Concepts";entry.onclick=()=>{location.hash="ti-concepts/epwm-signal-path";location.reload();};}
    $("workspace-progress").textContent="PWM ZERO → ADC SOC/EOC → ISR → controller → CMPA write → shadow load";
    $("surface-title").textContent="100 kHz timing workbench";
    $("ws-count").textContent="C2000 timing · deterministic teaching kernel";
    $("ws-title").textContent="算完 ≠ 生效：deadline 決定哪一拍 PWM 真正改變";
    $("ws-intro").textContent="改 compute time，看 command-ready、compare write 與 shadow-load 的相對時序。";
    $("deeper").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    document.querySelector(".metrics").hidden=false;$("ws-display-wrap").hidden=false;
  }
  function controls(result){
    const q=$("ws-question");q.replaceChildren();
    const h=document.createElement("h2");h.textContent="Timing knobs";q.append(h);
    const defs=[
      ["Compute","computeUs",.5,15,.1,"µs"],
      ["ADC sample","samplePct",5,90,5,"%"],
      ["ADC latency","adcLatencyUs",.2,3,.1,"µs"],
      ["ISR latency","isrLatencyUs",.1,3,.1,"µs"],
      ["PWM write","pwmCommitUs",.1,2,.1,"µs"]
    ];
    defs.forEach(([label,key,min,max,step,unit])=>{
      const l=document.createElement("label");l.className="ti-timing-param";l.dataset.timingKey=key;
      const n=document.createElement("span");n.textContent=label;
      const input=document.createElement("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=config[key];
      const out=document.createElement("output");out.textContent=Number(config[key]).toFixed(1)+unit;
      input.oninput=()=>out.textContent=Number(input.value).toFixed(1)+unit;
      input.onchange=()=>{config={...config,[key]:Number(input.value)};render();};
      l.append(n,input,out);q.append(l);
    });
    const preset=document.createElement("div");preset.className="ti-timing-presets";
    [["Fast 1.7 µs",1.7],["Miss 11 µs",11],["Two-cycle 15 µs",15]].forEach(([label,value])=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>{config={...config,computeUs:value};render();};preset.append(b);
    });q.append(preset);
    const verdict=document.createElement("div");verdict.className="ti-timing-verdict";
    verdict.innerHTML=`<strong>${result.firstNextLoad?"DEADLINE MET":"DEADLINE MISSED"}</strong>
      <span>write @ ${result.window.commit.toFixed(2)} µs</span>
      <span>active @ ${result.observedCommitUs.toFixed(2)} µs</span>
      <span>extra cycles ${result.extraCycleDelay}</span>`;
    q.append(verdict);
  }
  function eventColor(type){
    if(type==="PWM_SHADOW_LOAD")return "load";
    if(type.includes("MISSED"))return "miss";
    if(type==="CONTROL_DONE"||type==="PWM_COMMIT")return "compute";
    if(type.startsWith("ADC")||type==="ISR")return "sample";
    return "zero";
  }
  function drawTimeline(result){
    const svg=$("ws-plot");svg.hidden=false;svg.replaceChildren();svg.setAttribute("viewBox","0 0 900 300");
    const maxUs=Math.max(30,result.observedCommitUs+2),x=t=>80+t/maxUs*780;
    for(let cycle=0;cycle<=Math.ceil(maxUs/10);cycle++){
      const tx=cycle*10;svg.append(el("path",{d:`M${x(tx)} 35V260`,class:"ti-timing-cycle"}));svg.append(el("text",{x:x(tx)+3,y:280,class:"ti-value-label"},tx+"µs"));
    }
    svg.append(el("path",{d:"M80 150H860",class:"ti-control-time-axis"}));
    result.stages.forEach((ev,i)=>{
      const px=x(ev.relativeUs),klass=eventColor(ev.type);
      svg.append(el("circle",{cx:px,cy:150,r:7,class:"ti-timing-dot "+klass}));
      const above=i%2===0,y=above?70:220;
      svg.append(el("path",{d:`M${px} 143V${above?92:198}`,class:"ti-timing-stem "+klass}));
      svg.append(el("text",{x:px,y,"text-anchor":"middle",class:"ti-timing-event-label"},ev.type.replace("PWM_","")));
      svg.append(el("text",{x:px,y:above?86:236,"text-anchor":"middle",class:"ti-value-label"},ev.relativeUs.toFixed(2)+"µs"));
    });
    if(!result.firstNextLoad){
      const x1=x(10),x2=x(result.observedCommitUs);
      svg.append(el("path",{d:`M${x1} 38H${x2}`,class:"ti-timing-latency"}));
      svg.append(el("text",{x:(x1+x2)/2,y:30,"text-anchor":"middle",class:"ti-timing-latency-label"},`missed load → +${result.extraCycleDelay} cycle`));
    }
  }
  function el(tag,attrs={},text=""){const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text)n.textContent=text;return n;}
  function apiTable(result){
    let box=$("ti-timing-api");
    if(!box){box=document.createElement("div");box.id="ti-timing-api";box.className="ti-timing-api";$("ws-plot").after(box);}
    box.replaceChildren();
    result.apiMap.forEach(row=>{
      const div=document.createElement("div");div.innerHTML=`<strong>${row.stage}</strong><span>${row.owner}</span><code>${row.api}</code>`;box.append(div);
    });
  }
  function sweep(result){
    const rows=C.sweepCompute(S,V);
    let box=$("ti-timing-sweep");
    if(!box){box=document.createElement("div");box.id="ti-timing-sweep";box.className="ti-timing-sweep";$("ws-comparison").after(box);}
    box.replaceChildren();
    rows.forEach(row=>{
      const span=document.createElement("span");span.className=row.firstNextLoad?"pass":"fail";span.textContent=`${row.computeUs}µs → +${row.extraCycleDelay}cy`;box.append(span);
    });
  }
  function metrics(result){
    [["ws-voltage","Command ready"],["ws-current","Active"],["ws-display","Extra cycles"]].forEach(([id,label])=>{const n=$(id);if(n?.parentElement)n.parentElement.firstChild.nodeValue=label;});
    $("ws-voltage").textContent=result.window.commit.toFixed(2)+" µs";
    $("ws-current").textContent=result.observedCommitUs.toFixed(2)+" µs";
    $("ws-display").textContent=String(result.extraCycleDelay);
  }
  function render(){
    const result=C.run(S,V,config);save(result);metrics(result);controls(result);drawTimeline(result);apiTable(result);sweep(result);
    $("ws-comparison").textContent=`period ${result.config.controlPeriodUs}µs · SOC ${result.window.soc.toFixed(2)} · EOC ${result.window.ready.toFixed(2)} · ISR ${result.window.isr.toFixed(2)} · done ${result.window.done.toFixed(2)} · write ${result.window.commit.toFixed(2)} · active ${result.observedCommitUs.toFixed(2)}µs`;
    $("scope-note").textContent=result.boundary;
    const help=$("surface-help");help.replaceChildren();const p=document.createElement("p");p.className="ti-source";p.textContent="TI anchor: SPRAD12A ePWM Developer’s Guide. Register/load-mode details must be verified against the exact C2000 device configuration.";help.append(p);
  }
  function mount(){if(!C||!S||!V||!E)throw Error("timing dependencies missing");load();setup();render();}
  return {mount};
});
