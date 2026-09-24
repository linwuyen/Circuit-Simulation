(function(root,factory){
  root.CircuitTITimingWorkbench=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const SUPPORTED=new Set(["epwm-signal-path","dcl-controller-runtime","cla-ownership","c28x-wcet-evidence"]);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
  function supports(id){return SUPPORTED.has(id);}
  function mount({host,conceptId,revealed=true,onSnapshot=null}={}){
    if(!host)throw new Error("timing workbench host required");
    host.replaceChildren();host.hidden=!supports(conceptId);
    if(!supports(conceptId))return{destroy(){}};
    if(!revealed){
      host.append(el("div","ti-timing-lock","C2000 TIMING WORKBENCH LOCKED · commit prediction before timeline evidence"));
      return{destroy(){}};
    }
    const Models=root.CircuitPowerModelsV1,State=root.CircuitPowerSystemStateV1,Core=root.CircuitTITimingWorkbenchCore;
    if(!Models||!State||!Core){host.append(el("p","ti-timing-error","Timing workbench dependencies missing."));return{destroy(){}};}

    const shell=el("div","ti-timing-workbench");
    const head=el("div","ti-timing-head");
    head.append(el("strong",null,"C2000 SAMPLE → COMPUTE → ACTUATE"),el("span",null,"ePWM / ADC / ISR / CMPA / SHADOW LOAD"));

    const controls=el("div","ti-timing-controls"),inputs={};
    const defs=[
      ["sampleUs","SOC / sample","µs",0,8,.1,State.initial.timing.sampleUs],
      ["computeUs","Controller compute","µs",.2,18,.1,State.initial.timing.computeUs],
      ["fswKhz","PWM","kHz",50,200,10,State.initial.plant.fsw/1000]
    ];
    for(const[id,label,unit,min,max,step,value]of defs){
      const row=el("label","ti-timing-input"),top=el("span"),name=el("b",null,label),out=el("output");
      const input=el("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.timing=id;
      top.append(name,out);row.append(top,input);controls.append(row);inputs[id]={input,out,unit};
    }

    const metrics=el("div","ti-timing-metrics"),metric={};
    for(const[id,label]of [["period","PWM period"],["ready","command ready"],["active","PWM active"],["cycle","actuation cycle"],["deadline","deadline"],["missed","missed loads"]]){
      const box=el("div");box.append(el("span",null,label));metric[id]=el("strong",null,"—");metric[id].dataset.timingMetric=id;box.append(metric[id]);metrics.append(box);
    }

    const timeline=el("section","ti-timing-timeline");
    const timelineHead=el("div","ti-timing-timeline-head");
    timelineHead.append(el("strong",null,"Hardware timeline"),el("span",null,"CMPA write is not a pin transition"));
    const track=el("div","ti-timing-track");
    const scale=el("div","ti-timing-scale");
    timeline.append(timelineHead,track,scale);

    const chain=el("div","ti-timing-chain");
    ["ePWM ZERO","SOCA / S&H","ADC EOC","ADCINT / ISR","C(z)","CMPA write","shadow LOAD","PWM active"].forEach((label,i)=>{
      if(i)chain.append(el("span",null,"→"));
      chain.append(el("b",null,label));
    });

    const table=el("table","ti-timing-table");
    const thead=el("thead"),hr=el("tr");["Event","Time","Cycle"].forEach(x=>hr.append(el("th",null,x)));thead.append(hr);
    const tbody=el("tbody");table.append(thead,tbody);

    const statement=el("p","ti-timing-statement");
    const boundary=el("p","ti-timing-boundary","Model boundary: deterministic single-rate teaching model with one strict CMPA shadow LOAD at PWM zero. Exact device load mode, SOC source, ADC timing, interrupt nesting and pin latency still require the target C2000 TRM plus GPIO/scope evidence.");
    shell.append(head,controls,metrics,timeline,chain,table,statement,boundary);host.append(shell);

    function params(){return{sampleUs:Number(inputs.sampleUs.input.value),computeUs:Number(inputs.computeUs.input.value),fswKhz:Number(inputs.fswKhz.input.value)};}
    function render(){
      const a=Core.analyze(params(),{Models,initial:State.initial});
      inputs.sampleUs.out.textContent=fmt(a.sampleUs,1)+" µs";
      inputs.computeUs.out.textContent=fmt(a.computeUs,1)+" µs";
      inputs.fswKhz.out.textContent=fmt(a.fswKhz,0)+" kHz";
      metric.period.textContent=fmt(a.timing.periodUs,2)+" µs";
      metric.ready.textContent=fmt(a.commandReadyUs,2)+" µs";
      metric.active.textContent=fmt(a.activePwmUs,2)+" µs";
      metric.cycle.textContent="cycle +"+a.cycleIndex;
      metric.deadline.textContent=a.deadlineMet?"PASS":"MISS";
      metric.deadline.classList.toggle("is-fault",!a.deadlineMet);
      metric.missed.textContent=String(a.timing.missedLoads);

      const horizon=Math.max(a.activePwmUs,a.timing.periodUs*2);
      track.replaceChildren();scale.replaceChildren();
      const loads=Math.ceil(horizon/a.timing.periodUs);
      for(let i=0;i<=loads;i++){
        const t=i*a.timing.periodUs;
        const line=el("i","ti-timing-load");line.style.left=(t/horizon*100)+"%";line.title="PWM ZERO / shadow LOAD @ "+fmt(t,2)+" µs";track.append(line);
        const tick=el("span",null,fmt(t,1));tick.style.left=(t/horizon*100)+"%";scale.append(tick);
      }
      a.events.forEach(event=>{
        const marker=el("button","ti-timing-event",event.label);
        marker.type="button";marker.style.left=(Math.max(0,Math.min(100,event.timeUs/horizon*100)))+"%";
        marker.title=event.label+" @ "+fmt(event.timeUs,2)+" µs";
        marker.dataset.event=event.id;
        const small=el("small",null,fmt(event.timeUs,2)+" µs");marker.append(small);track.append(marker);
      });

      tbody.replaceChildren();
      a.events.forEach(event=>{
        const tr=el("tr");tr.append(el("td",null,event.label),el("td",null,fmt(event.timeUs,2)+" µs"),el("td",null,"+"+event.cycle));tbody.append(tr);
      });
      statement.textContent=a.deadlineMet
        ?"CMPA command is ready at "+fmt(a.commandReadyUs,2)+" µs, before the "+fmt(a.activePwmUs,2)+" µs shadow LOAD. Hardware applies the new PWM at cycle +"+a.cycleIndex+"."
        :"CMPA command is only ready at "+fmt(a.commandReadyUs,2)+" µs, after the first eligible LOAD. The write exists in software, but the PWM stays old until "+fmt(a.activePwmUs,2)+" µs (cycle +"+a.cycleIndex+").";

      if(typeof onSnapshot==="function")onSnapshot({
        conceptId,
        params:{sampleUs:a.sampleUs,computeUs:a.computeUs,fswKhz:a.fswKhz},
        periodUs:a.timing.periodUs,
        commandReadyUs:a.commandReadyUs,
        activePwmUs:a.activePwmUs,
        missedLoads:a.timing.missedLoads,
        actuationCycle:a.cycleIndex,
        deadlineMet:a.deadlineMet
      });
      return a;
    }
    Object.values(inputs).forEach(x=>x.input.addEventListener("input",render));
    render();
    return{render,destroy(){host.replaceChildren();},getAnalysis:()=>Core.analyze(params(),{Models,initial:State.initial})};
  }
  return Object.freeze({supports,mount});
});
