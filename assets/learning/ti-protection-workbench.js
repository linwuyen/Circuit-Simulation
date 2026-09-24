(function(root,factory){
  root.CircuitTIProtectionWorkbench=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const SUPPORTED=new Set(["trip-zone-authority"]);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const fmt=(v,d=1)=>Number(v).toFixed(d);
  function supports(id){return SUPPORTED.has(id);}
  function mount({host,conceptId,revealed=true,onSnapshot=null}={}){
    if(!host)throw new Error("protection workbench host required");
    host.replaceChildren();host.hidden=!supports(conceptId);
    if(!supports(conceptId))return{destroy(){}};
    if(!revealed){
      host.append(el("div","ti-protection-lock","PWM AUTHORITY WORKBENCH LOCKED · commit prediction before fault evidence"));
      return{destroy(){}};
    }
    const Core=root.CircuitTIProtectionWorkbenchCore,Models=root.CircuitPowerModelsV1,State=root.CircuitPowerSystemStateV1;
    if(!Core||!Models||!State){host.append(el("p","ti-protection-error","Protection workbench dependencies missing."));return{destroy(){}};}

    const shell=el("div","ti-protection-workbench");
    const head=el("div","ti-protection-head");
    head.append(el("strong",null,"PWM AUTHORITY / SAFETY VETO"),el("span",null,"software grant ≠ hardware authority"));

    const gates=el("div","ti-authority-gates"),checks={};
    for(const[id,label]of [["run","RUN"],["commandFresh","command fresh"],["sensingValid","sensing valid"],["peripheralsReady","peripherals ready"],["calibrationValid","calibration valid"]]){
      const l=el("label","ti-authority-check"),input=el("input");input.type="checkbox";input.checked=true;input.dataset.authority=id;
      l.append(input,document.createTextNode(" "+label));gates.append(l);checks[id]=input;
    }

    const controls=el("div","ti-protection-controls");
    const currentRow=el("label"),currentHead=el("span"),currentOut=el("output"),current=el("input");
    currentHead.append(el("b",null,"Fault current"),currentOut);current.type="range";current.min=8;current.max=30;current.step=1;current.value=8;current.dataset.protection="currentA";currentRow.append(currentHead,current);
    const thresholdRow=el("label"),thresholdHead=el("span"),thresholdOut=el("output"),threshold=el("input");
    thresholdHead.append(el("b",null,"CMPSS threshold"),thresholdOut);threshold.type="range";threshold.min=9;threshold.max=20;threshold.step=1;threshold.value=State.initial.safety.thresholdA;threshold.dataset.protection="thresholdA";thresholdRow.append(thresholdHead,threshold);
    controls.append(currentRow,thresholdRow);

    const authority=el("div","ti-authority-cards"),card={};
    for(const[id,label]of [["software","Software grant"],["veto","Hardware veto"],["physical","Physical PWM"],["hwlat","HW fault latency"],["swlat","SW best-aligned"]]){
      const box=el("div");box.append(el("span",null,label));card[id]=el("strong",null,"—");card[id].dataset.authorityMetric=id;box.append(card[id]);authority.append(box);
    }

    const paths=el("div","ti-protection-paths");
    const hw=el("div","ti-protection-path hardware");
    hw.append(el("span",null,"HARDWARE"),el("b",null,"CMPSS → filter/XBAR → Trip Zone → PWM OFF"),el("strong",null,"MEASURE_REQUIRED"));
    const sw=el("div","ti-protection-path software");
    sw.append(el("span",null,"SOFTWARE"),el("b",null,"ADC → ISR/CLA → decision → CMPA → shadow LOAD"),el("strong",null,"timing model only"));
    paths.append(hw,sw);

    const actions=el("div","ti-protection-actions");
    const inject=el("button",null,"Inject OCP"),safe=el("button",null,"Drop current below threshold"),clear=el("button",null,"Qualified clear");
    inject.type=safe.type=clear.type="button";actions.append(inject,safe,clear);
    const status=el("p","ti-protection-status");
    const boundary=el("p","ti-protection-boundary","Evidence boundary: the model proves authority logic only. It does not assign absolute comparator/filter/XBAR/TZ/gate latency. Fault-to-gate-low requires real target configuration plus scope capture.");

    shell.append(head,gates,controls,authority,paths,actions,status,boundary);host.append(shell);
    let tripLatched=false;

    function inputState(){
      const value={tripLatched,currentA:Number(current.value),thresholdA:Number(threshold.value),requestedDuty:State.initial.plant.duty};
      for(const[id,input]of Object.entries(checks))value[id]=input.checked;
      return value;
    }
    function render(){
      const a=Core.analyze(inputState(),{Models,initial:State.initial});
      currentOut.textContent=fmt(a.currentA)+" A";thresholdOut.textContent=fmt(a.thresholdA)+" A";
      card.software.textContent=a.softwareGrant?"ALLOW":"BLOCK · "+a.softwareBlockers.join(", ");
      card.veto.textContent=a.hardwareVeto?(a.tripLatched?"TRIP_LATCHED":"CMPSS FAULT"):"CLEAR";
      card.physical.textContent=fmt(a.physicalDuty*100,0)+"%";
      card.hwlat.textContent=a.hardwareLatencyClaim;
      card.swlat.textContent="≥ "+fmt(a.softwareBestAlignedUs,2)+" µs best-aligned";
      clear.disabled=!a.clearEligible;
      shell.classList.toggle("is-tripped",a.hardwareVeto);
      status.textContent=a.hardwareVeto
        ?"Controller may still request "+fmt(a.requestedDuty*100,0)+"%, but hardware veto forces physical PWM to 0%."
        :a.softwareGrant?"All software gates true and no hardware veto: PWM authority granted.":"Hardware is clear, but software readiness contract blocks PWM.";
      if(typeof onSnapshot==="function")onSnapshot({
        conceptId,
        factors:a.factors,
        softwareGrant:a.softwareGrant,
        hardwareVeto:a.hardwareVeto,
        tripLatched:a.tripLatched,
        comparatorFault:a.comparatorFault,
        requestedDuty:a.requestedDuty,
        physicalDuty:a.physicalDuty,
        hardwareLatencyClaim:a.hardwareLatencyClaim,
        softwareBestAlignedUs:a.softwareBestAlignedUs
      });
      return a;
    }
    Object.values(checks).forEach(input=>input.addEventListener("change",render));
    current.addEventListener("input",render);threshold.addEventListener("input",render);
    inject.onclick=()=>{current.value=Math.max(Number(current.value),Number(threshold.value)+2);tripLatched=true;render();};
    safe.onclick=()=>{current.value=Math.max(0,Number(threshold.value)-2);render();};
    clear.onclick=()=>{
      const a=render();
      try{tripLatched=Core.nextLatch(a,{requestClear:true});render();}
      catch(error){status.textContent=error.message;}
    };
    render();
    return{render,destroy(){host.replaceChildren();},getAnalysis:()=>Core.analyze(inputState(),{Models,initial:State.initial})};
  }
  return Object.freeze({supports,mount});
});
