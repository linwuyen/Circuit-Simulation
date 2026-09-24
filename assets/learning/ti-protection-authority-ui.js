(function(root,factory){
  root.CircuitTIProtectionAuthority=factory(root);
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const C=root.CircuitTIProtectionAuthorityCore;
  const S=root.CircuitEngineeringSandboxCore;
  const V=root.CircuitControlValidationV1;
  const E=root.CircuitEvidence;
  const STORE="tiProtectionAuthority";
  let state={...C.defaults};

  function load(){state={...C.defaults,...(E.load().benchmark?.[STORE]?.state||{})};}
  function save(){
    const s=E.load();s.benchmark[STORE]={state:{...state},updatedAt:new Date().toISOString()};E.save(s);
    const r=C.evaluate(state);
    E.recordEvidence("ti:trip-zone-authority",2,"ti-protection-authority",{softwareGrant:r.softwareGrant,hardwareVeto:r.hardwareVeto,physicalPwm:r.physicalPwm},{stage:"practiced",strength:"none"});
  }
  function setup(){
    document.body.dataset.tiProtection="true";document.querySelector(".route")?.setAttribute("hidden","");
    ["setup-panel","free-controls","concept-note","transfer-preview","workbench-context-slot","lesson-control"].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    $("circuit").hidden=true;$("circuit-state").hidden=true;$("answer-observation").hidden=true;
    const h=document.querySelector(".workspace-header strong");if(h)h.textContent="Protection / PWM Authority Workbench";
    const entry=$("open-ti-learning");if(entry){entry.textContent="返回 TI Concepts";entry.onclick=()=>{location.hash="ti-concepts/trip-zone-authority";location.reload();};}
    $("workspace-progress").textContent="software grant → hardware veto → physical PWM";
    $("surface-title").textContent="Who actually owns PWM?";
    $("ws-count").textContent="Safety authority · fail-closed";
    $("ws-title").textContent="Controller 說 ON，不代表 MOSFET 一定能 ON";
    $("ws-intro").textContent="Software grant 與 hardware Trip veto 分開。Fault source 消失，也不代表 latch 自動清除。";
    $("deeper").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
    document.querySelector(".metrics").hidden=false;$("ws-display-wrap").hidden=false;
  }
  function metrics(r){
    [["ws-voltage","SW grant"],["ws-current","HW veto"],["ws-display","Physical PWM"]].forEach(([id,label])=>{const n=$(id);if(n?.parentElement)n.parentElement.firstChild.nodeValue=label;});
    $("ws-voltage").textContent=r.softwareGrant?"ALLOW":"BLOCK";
    $("ws-current").textContent=r.hardwareVeto?"TRIP":"CLEAR";
    $("ws-display").textContent=r.physicalPwm?(r.physicalDuty*100).toFixed(0)+"%":"0% SAFE";
  }
  function authorityDiagram(r){
    const svg=$("ws-plot");svg.hidden=false;svg.replaceChildren();svg.setAttribute("viewBox","0 0 900 300");
    const nodes=[
      [80,70,200,65,"SOFTWARE GRANT",r.softwareGrant?"ALLOW":"BLOCK",r.softwareGrant?"ok":"bad"],
      [350,70,200,65,"HARDWARE VETO",r.hardwareVeto?"TRIP":"CLEAR",r.hardwareVeto?"bad":"ok"],
      [620,70,200,65,"PHYSICAL PWM",r.physicalPwm?(r.physicalDuty*100).toFixed(0)+"%":"0% SAFE",r.physicalPwm?"ok":"safe"]
    ];
    nodes.forEach(([x,y,w,h,title,value,klass])=>{
      svg.append(el("rect",{x,y,width:w,height:h,rx:12,class:"ti-authority-node "+klass}));
      svg.append(el("text",{x:x+w/2,y:y+25,"text-anchor":"middle",class:"ti-authority-title"},title));
      svg.append(el("text",{x:x+w/2,y:y+50,"text-anchor":"middle",class:"ti-authority-value"},value));
    });
    svg.append(el("path",{d:"M280 102H340",class:"ti-authority-arrow"}));
    svg.append(el("path",{d:"M550 102H610",class:"ti-authority-arrow"}));
    const gates=[
      ["RUN",r.run],["fresh",r.commandFresh],["sense",r.sensingValid],["periph",r.peripheralsReady],["cal",r.calibrationValid],["no SW fault",!r.softwareFault]
    ];
    gates.forEach(([name,ok],i)=>{
      const x=85+i*118;svg.append(el("rect",{x,y:185,width:100,height:38,rx:8,class:"ti-authority-gate "+(ok?"ok":"bad")}));
      svg.append(el("text",{x:x+50,y:209,"text-anchor":"middle",class:"ti-authority-gate-text"},name));
    });
    svg.append(el("text",{x:85,y:260,class:"ti-value-label"},r.blockers.length?"Blockers: "+r.blockers.join(" · "):"All software conditions satisfied"));
  }
  function el(tag,attrs={},text=""){const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text)n.textContent=text;return n;}
  function controls(r){
    const q=$("ws-question");q.replaceChildren();
    const h=document.createElement("h2");h.textContent="Authority inputs";q.append(h);
    const defs=[
      ["RUN","run"],["Command fresh","commandFresh"],["Sensing valid","sensingValid"],["Peripherals ready","peripheralsReady"],["Calibration valid","calibrationValid"],["Software fault","softwareFault"]
    ];
    const grid=document.createElement("div");grid.className="ti-authority-controls";
    defs.forEach(([label,key])=>{
      const l=document.createElement("label"),i=document.createElement("input");i.type="checkbox";i.checked=!!state[key];i.dataset.authorityKey=key;
      i.onchange=()=>{state={...state,[key]:i.checked};save();render();};l.append(i,document.createTextNode(" "+label));grid.append(l);
    });q.append(grid);
    const actions=document.createElement("div");actions.className="ti-authority-actions";
    const fault=document.createElement("button");fault.type="button";fault.className="danger";fault.textContent="Inject hardware fault";
    fault.onclick=()=>{state={...C.injectFault(state)};save();render();};
    const source=document.createElement("button");source.type="button";source.textContent="Clear fault source";
    source.onclick=()=>{state={...C.clearFaultSource(state)};save();render();};
    const rearm=document.createElement("button");rearm.type="button";rearm.textContent="Qualified re-arm";
    rearm.onclick=()=>{const x=C.rearm(state);state={...x.state};save();render();$("ws-feedback").textContent=x.accepted?"RE-ARM ACCEPTED":"RE-ARM REJECTED: "+x.reason;};
    actions.append(fault,source,rearm);q.append(actions);

    const sw=C.softwarePath(S);
    const compare=document.createElement("div");compare.className="ti-authority-race";
    compare.innerHTML=`<div><strong>Hardware path</strong><span>CMPSS/filter/XBAR/TZ → PWM veto</span><b>absolute latency: MEASURE</b></div>
      <div><strong>ISR-only path</strong><span>sample → EOC → ISR → decision → load</span><b>best aligned ≈ ${sw.nextHardwareLoadUs.toFixed(2)} µs</b></div>`;
    q.append(compare);

    const measure=document.createElement("fieldset");measure.className="ti-trip-measure";
    measure.innerHTML='<legend>Measured fault → PWM-low capture</legend><label>fault edge ns <input id="ti-fault-ns" type="number" value="1000"></label><label>PWM low ns <input id="ti-pwm-low-ns" type="number" value="1450"></label><label>limit ns <input id="ti-trip-limit-ns" type="number" value="1000"></label><button id="ti-trip-analyze" type="button">Analyze capture</button><output id="ti-trip-result"></output>';
    q.append(measure);
    $("ti-trip-analyze").onclick=()=>{
      const a=C.analyzeMeasuredTrip(V,{faultAtNs:Number($("ti-fault-ns").value),pwmLowAtNs:Number($("ti-pwm-low-ns").value),maxLatencyNs:Number($("ti-trip-limit-ns").value)});
      $("ti-trip-result").textContent=a.ready?`${a.pass?"PASS":"FAIL"} · latency ${a.latencyNs} ns · ${a.evidence}`:"INCOMPLETE";
    };
  }
  function render(){
    const r=C.evaluate(state);metrics(r);authorityDiagram(r);controls(r);
    $("ws-comparison").textContent=r.hardwareVeto
      ?"Hardware veto owns the final physical state even if software grant remains true."
      :"Physical PWM is permitted only when every software condition is valid and hardware veto is clear.";
    $("scope-note").textContent="No absolute CMPSS/TZ/gate latency is invented here. Real fault-edge→PWM/gate-low latency must come from a provenance-bound capture.";
    const help=$("surface-help");help.replaceChildren();const p=document.createElement("p");p.className="ti-source";p.textContent="TI anchor: SPRAD12A · Trip Zone / Digital Compare authority. BOARD_PASS is not implied.";help.append(p);
  }
  function mount(){if(!C||!S||!V||!E)throw Error("protection authority dependencies missing");load();setup();render();}
  return {mount};
});
