(function(root,factory){
  root.CircuitTITopologyWorkbench=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const MAP=Object.freeze({
    "boost-rhpz":"boost",
    "average-current-mode":"pfc",
    "psfb-zvs-energy":"psfb",
    "llc-operating-point":"llc"
  });
  const LABELS={boost:"BOOST",pfc:"PFC",psfb:"PSFB",llc:"LLC",inverter:"INVERTER"};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
  function supports(id){return Object.hasOwn(MAP,id);}
  function mount({host,conceptId,revealed=true,onSnapshot=null}={}){
    if(!host)throw new Error("topology workbench host required");
    host.replaceChildren();host.hidden=!supports(conceptId);
    if(!supports(conceptId))return{destroy(){}};
    if(!revealed){host.append(el("div","ti-topology-lock","TOPOLOGY CONSTRAINT ATLAS LOCKED · commit prediction before transfer evidence"));return{destroy(){}};}
    const Core=root.CircuitTITopologyWorkbenchCore,Transfer=root.CircuitTopologyTransferV1;
    if(!Core||!Transfer){host.append(el("p","ti-topology-error","Topology transfer dependencies missing."));return{destroy(){}};}

    let topology=MAP[conceptId];
    const patches={boost:{},pfc:{},psfb:{},llc:{},inverter:{}};
    const shell=el("div","ti-topology-workbench");
    const head=el("div","ti-topology-head");
    head.append(el("strong",null,"POWER TOPOLOGY CONSTRAINT ATLAS"),el("span",null,"same grammar · different constraint"));
    const tabs=el("div","ti-topology-tabs");
    for(const id of Object.keys(LABELS)){
      const b=el("button",null,LABELS[id]);b.type="button";b.dataset.topology=id;
      b.onclick=()=>{topology=id;render();};tabs.append(b);
    }
    const controls=el("div","ti-topology-controls");
    const metrics=el("div","ti-topology-metrics");
    const constraint=el("section","ti-topology-constraint");
    const boundary=el("p","ti-topology-boundary");
    shell.append(head,tabs,controls,metrics,constraint,boundary);host.append(shell);

    function slider(id,label,min,max,step,value,read){
      const row=el("label","ti-topology-input"),top=el("span"),out=el("output");
      top.append(el("b",null,label),out);
      const input=el("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.topologyControl=id;
      const update=()=>{patches[topology][id]=Number(input.value);out.textContent=read(Number(input.value));render(false);};
      input.oninput=update;out.textContent=read(Number(value));row.append(top,input);controls.append(row);
    }
    function renderControls(){
      controls.replaceChildren();const p={...Core.PRESETS[topology],...patches[topology]};
      if(topology==="boost"){
        slider("duty","Duty",.3,.75,.01,p.duty,v=>fmt(v*100,0)+"%");
        slider("crossoverHz","Target crossover",100,5000,100,p.crossoverHz,v=>v>=1000?fmt(v/1000,1)+" kHz":fmt(v,0)+" Hz");
      }else if(topology==="pfc"){
        slider("outerCrossoverHz","Outer crossover",1,100,1,p.outerCrossoverHz,v=>fmt(v,0)+" Hz");
        slider("busCapF","Bus C",330e-6,1500e-6,10e-6,p.busCapF,v=>fmt(v*1e6,0)+" µF");
      }else if(topology==="psfb"){
        slider("primaryCurrentA","Primary current",1,15,.5,p.primaryCurrentA,v=>fmt(v,1)+" A");
        slider("leakageH","Leakage L",1e-6,12e-6,.5e-6,p.leakageH,v=>fmt(v*1e6,1)+" µH");
      }else if(topology==="llc"){
        slider("switchingHz","Switching f",60e3,180e3,2e3,p.switchingHz,v=>fmt(v/1000,0)+" kHz");
        slider("q","Q",.2,1.5,.05,p.q,v=>fmt(v,2));
      }else{
        slider("controlBandwidthHz","Control BW",100,5000,100,p.controlBandwidthHz,v=>v>=1000?fmt(v/1000,1)+" kHz":fmt(v,0)+" Hz");
        slider("l2H","Grid-side L",.5e-3,4e-3,.1e-3,p.l2H,v=>fmt(v*1e3,1)+" mH");
      }
    }
    function render(rebuild=true){
      if(rebuild)renderControls();
      for(const b of tabs.querySelectorAll("button"))b.setAttribute("aria-current",b.dataset.topology===topology?"true":"false");
      const a=Core.analyze(topology,patches[topology],{Transfer});
      metrics.replaceChildren();
      const rows=[];
      if(topology==="boost")rows.push(["RHP zero",a.model.rhpzHz,"Hz"],["fc / fRHPZ",a.ratio,"×"],["conservative fc",a.model.conservativeFcHz,"Hz"]);
      if(topology==="pfc")rows.push(["2ω ripple",a.model.doubleLineHz,"Hz"],["outer / 2ω",a.ratio,"×"],["suggested outer max",a.model.suggestedOuterLoopMaxHz,"Hz"]);
      if(topology==="psfb")rows.push(["ZVS energy margin",a.model.zvsEnergyMargin,"×"],["leakage energy",a.model.leakageEnergyJ*1e6,"µJ"],["commutation energy",a.model.commutationEnergyJ*1e6,"µJ"]);
      if(topology==="llc")rows.push(["fn",a.model.normalizedFrequency,"×fr"],["FHA gain",a.model.gain,"×"],["dlnM/dlnf",a.model.normalizedGainSlope,""]);
      if(topology==="inverter")rows.push(["LCL resonance",a.model.resonanceHz,"Hz"],["BW / fres",a.ratio,"×"],["Vrms ideal",a.model.fundamentalVrms,"V"]);
      for(const[label,value,unit]of rows){
        const box=el("div");box.append(el("span",null,label));const strong=el("strong",null,fmt(value,unit==="Hz"&&value>=1000?0:2)+(unit?" "+unit:""));box.append(strong);metrics.append(box);
      }
      constraint.replaceChildren(el("span",null,a.constraint.constraint),el("strong",null,a.status),el("p",null,a.constraint.designHint));
      boundary.textContent="Model boundary: "+a.boundary+" · fidelity: "+a.model.fidelity;
      if(typeof onSnapshot==="function")onSnapshot({
        conceptId,topology:a.topology,status:a.status,ratio:a.ratio,
        constraint:a.constraint.constraint,modelFidelity:a.model.fidelity,params:a.params
      });
      return a;
    }
    render();
    return{render,destroy(){host.replaceChildren();},getAnalysis:()=>Core.analyze(topology,patches[topology],{Transfer})};
  }
  return Object.freeze({supports,mount});
});
