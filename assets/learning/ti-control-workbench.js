(function(root,factory){
  root.CircuitTIControlWorkbench=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const SUPPORTED=new Set(["loop-stability","pi-zero-placement","sfra-measurement"]);
  const svgNS="http://www.w3.org/2000/svg";
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const svgEl=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"—";
  const logLabel=f=>!Number.isFinite(f)?"—":f>=1000?fmt(f/1000,2)+" kHz":fmt(f,1)+" Hz";

  function supports(id){return SUPPORTED.has(id);}

  function chartPath(values,width,height,min,max){
    if(!values.length)return"";
    const span=Math.max(1e-12,max-min);
    return values.map((v,i)=>{
      const x=i/Math.max(1,values.length-1)*width;
      const y=height-(v-min)/span*height;
      return (i?"L":"M")+" "+x.toFixed(2)+" "+Math.max(0,Math.min(height,y)).toFixed(2);
    }).join(" ");
  }

  function chart(title,kind){
    const card=el("section","ti-control-chart");
    const head=el("div","ti-control-chart-head");
    head.append(el("strong",null,title),el("span",null,kind));
    const svg=svgEl("svg",{viewBox:"0 0 560 150",role:"img"});
    const grid=svgEl("path",{d:"M0 30H560 M0 60H560 M0 90H560 M0 120H560",class:"ti-control-grid"});
    const a=svgEl("path",{class:"ti-control-line ti-control-line-a"});
    const b=svgEl("path",{class:"ti-control-line ti-control-line-b"});
    svg.append(grid,a,b);card.append(head,svg);
    return{card,svg,a,b,head};
  }

  function mount({host,conceptId,revealed=true,onSnapshot=null}={}){
    if(!host)throw new Error("control workbench host required");
    host.replaceChildren();
    host.hidden=!supports(conceptId);
    if(!supports(conceptId))return{destroy(){}};
    if(!revealed){
      host.append(el("div","ti-control-lock","CONTROL WORKBENCH LOCKED · commit answer before model evidence"));
      return{destroy(){}};
    }

    const Models=root.CircuitPowerModelsV1;
    const Control=root.CircuitControlEngineeringV1;
    const Core=root.CircuitTIControlWorkbenchCore;
    const State=root.CircuitPowerSystemStateV1;
    if(!Models||!Control||!Core||!State){
      host.append(el("p","ti-control-error","Control workbench dependencies missing."));
      return{destroy(){}};
    }

    const shell=el("div","ti-control-workbench");
    const heading=el("div","ti-control-head");
    heading.append(el("strong",null,"DIGITAL CONTROL WORKBENCH"),el("span",null,"r → e → C(z) → u → P → y"));

    const controls=el("div","ti-control-controls");
    const defs=[
      ["vref","Vref","V",20,40,.5,State.initial.control.vref],
      ["kp","Kp","",.05,2,.05,State.initial.control.kp],
      ["ki","Ki","/s",0,800,10,State.initial.control.ki],
      ["computeUs","Compute","µs",.2,12,.2,State.initial.timing.computeUs],
      ["dutyMax","Duty max","%",30,95,1,State.initial.limits.dutyMax*100]
    ];
    const inputs={};
    for(const[id,label,unit,min,max,step,value]of defs){
      const row=el("label","ti-control-input"),top=el("span");
      const name=el("b",null,label);
      const out=el("output",null,id==="dutyMax"?fmt(value,0)+"%":fmt(value,id==="ki"?0:1)+(unit?" "+unit:""));
      const input=el("input");input.type="range";input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.control=id;
      top.append(name,out);row.append(top,input);controls.append(row);inputs[id]={input,out,unit};
    }

    const aw=el("label","ti-control-toggle"),awInput=el("input");
    awInput.type="checkbox";awInput.checked=true;awInput.dataset.control="antiWindup";
    aw.append(awInput,document.createTextNode(" anti-windup"));controls.append(aw);

    const blocks=el("div","ti-control-blocks");
    ["r","e","C(z) PI","u / limiter","Buck P(s)","y"].forEach((t,i)=>{
      if(i)blocks.append(el("span",null,"→"));
      blocks.append(el("b",null,t));
    });

    const metrics=el("div","ti-control-metrics"),metric={};
    for(const[id,label]of [["zero","PI zero"],["delay","sample→actuate"],["cross","crossover"],["pm","phase margin"],["sat","saturation"],["sfra","SFRA claim"]]){
      const box=el("div");box.append(el("span",null,label));metric[id]=el("strong",null,"—");metric[id].dataset.metric=id;box.append(metric[id]);metrics.append(box);
    }

    const plots=el("div","ti-control-plots");
    const stepChart=chart("Step response","Vref / physical Vout");
    const bodeMag=chart("Loop magnitude","0 dB = crossover");
    const bodePhase=chart("Loop phase","digital delay keeps full phase lag");
    plots.append(stepChart.card,bodeMag.card,bodePhase.card);

    const sfra=el("section","ti-control-sfra");
    const sfraHead=el("div","ti-control-sfra-head");
    sfraHead.append(el("strong",null,"SFRA / measured Bode"),el("span",null,"No measurement → MODEL_ONLY"));
    const ta=el("textarea");ta.rows=4;ta.placeholder="Frequency (Hz),Magnitude (dB),Phase (deg)\n100,20,-90\n1000,0,-120\n10000,-20,-180";
    const actions=el("div","ti-control-sfra-actions");
    const compare=el("button",null,"Compare imported CSV"),clear=el("button",null,"Clear measurement");
    compare.type=clear.type="button";actions.append(compare,clear);
    const sfraStatus=el("p","ti-control-sfra-status","MODEL_ONLY · no measured points loaded.");
    sfra.append(sfraHead,ta,actions,sfraStatus);

    const boundary=el("p","ti-control-boundary","Model boundary: transient is the existing one-pole control surrogate; Bode is the existing CCM Buck LC+ESR small-signal model with digital delay. Saturation/anti-windup affect transient behavior, not the local linear Bode model. Imported SFRA without provenance remains UNVERIFIED_IMPORT.");
    shell.append(heading,controls,blocks,metrics,plots,sfra,boundary);
    host.append(shell);

    let measurements=[];

    function params(){
      return{
        vref:Number(inputs.vref.input.value),
        kp:Number(inputs.kp.input.value),
        ki:Number(inputs.ki.input.value),
        computeUs:Number(inputs.computeUs.input.value),
        dutyMax:Number(inputs.dutyMax.input.value)/100,
        antiWindup:awInput.checked,
        measurements
      };
    }

    function updateOutputs(p){
      inputs.vref.out.textContent=fmt(p.vref,1)+" V";
      inputs.kp.out.textContent=fmt(p.kp,2);
      inputs.ki.out.textContent=fmt(p.ki,0)+" /s";
      inputs.computeUs.out.textContent=fmt(p.computeUs,1)+" µs";
      inputs.dutyMax.out.textContent=fmt(p.dutyMax*100,0)+"%";
    }

    function render(){
      const analysis=Core.analyze(params(),{Models,Control,initial:State.initial});
      const p=analysis.params;updateOutputs(p);
      metric.zero.textContent=analysis.piZeroHz==null?"integrator only":logLabel(analysis.piZeroHz);
      metric.delay.textContent=fmt(analysis.timing.actuation,1)+" µs";
      metric.cross.textContent=analysis.loop.status==="SINGLE"?logLabel(analysis.crossoverHz):analysis.loop.status;
      metric.pm.textContent=analysis.phaseMarginDeg==null?"—":fmt(analysis.phaseMarginDeg,1)+"°";
      metric.sat.textContent=analysis.transient.saturatedSamples+" samples · AW "+(analysis.transient.antiWindup?"ON":"OFF");
      metric.sfra.textContent=analysis.sfra.state+" / "+analysis.sfra.evidence;

      const vals=[...analysis.transient.refs,...analysis.transient.phys];
      const minV=Math.min(...vals),maxV=Math.max(...vals),pad=Math.max(1,(maxV-minV)*.1);
      stepChart.a.setAttribute("d",chartPath(analysis.transient.refs,560,150,minV-pad,maxV+pad));
      stepChart.b.setAttribute("d",chartPath(analysis.transient.phys,560,150,minV-pad,maxV+pad));

      bodeMag.a.setAttribute("d",chartPath(analysis.loop.mags,560,150,-60,60));
      bodeMag.b.setAttribute("d","");
      const minP=Math.min(-180,...analysis.loop.phases),maxP=Math.max(0,...analysis.loop.phases);
      bodePhase.a.setAttribute("d",chartPath(analysis.loop.phases,560,150,minP,maxP));
      bodePhase.b.setAttribute("d","");

      sfraStatus.textContent=analysis.sfra.state+" · "+analysis.sfra.evidence+" · "+analysis.sfra.reason+
        (analysis.correlation?" · RMS Δmag "+fmt(analysis.correlation.rmsMagnitudeDb,2)+" dB · RMS Δphase "+fmt(analysis.correlation.rmsPhaseDeg,1)+"°":"");

      if(typeof onSnapshot==="function")onSnapshot({
        conceptId:conceptId,
        params:p,
        timing:{sampleToActuateUs:analysis.timing.actuation,missedLoads:analysis.timing.missedLoads},
        transient:{
          finalPhysical:analysis.transient.finalPhysical,
          overshoot:analysis.transient.overshoot,
          saturatedSamples:analysis.transient.saturatedSamples,
          antiWindup:analysis.transient.antiWindup
        },
        loop:{status:analysis.loop.status,crossoverHz:analysis.crossoverHz,phaseMarginDeg:analysis.phaseMarginDeg},
        sfra:{state:analysis.sfra.state,evidence:analysis.sfra.evidence,count:analysis.correlation?.count||0}
      });
      return analysis;
    }

    for(const x of Object.values(inputs))x.input.addEventListener("input",render);
    awInput.addEventListener("change",render);
    compare.onclick=()=>{
      try{measurements=Control.parseBodeCsv(ta.value);render();}
      catch(error){sfraStatus.textContent="CSV rejected: "+error.message;}
    };
    clear.onclick=()=>{measurements=[];ta.value="";render();};

    render();
    return{
      render,
      destroy(){host.replaceChildren();},
      getAnalysis:()=>Core.analyze(params(),{Models,Control,initial:State.initial})
    };
  }

  return Object.freeze({supports,mount});
});
