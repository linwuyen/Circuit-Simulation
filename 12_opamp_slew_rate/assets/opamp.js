(function(root,factory){
  const api=factory(root||globalThis);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.CircuitOpampSimulator=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const doc=root&&root.document?root.document:null;
  const $=id=>doc?doc.getElementById(id):null;
  const fmt=(v,d=3)=>Number.isFinite(v)?Number(v).toFixed(d):"—";
  const finite=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  function calculateMetrics(input={},mode="sine"){
    const fKHz=Math.max(0,finite(input.fKHz,100));
    const vpp=Math.abs(finite(input.vpp,8));
    const srp=Math.max(1e-9,finite(input.srp,5));
    const srn=Math.max(1e-9,finite(input.srn,5));
    const gbw=Math.max(1e-9,finite(input.gbw,10));
    const gain=Math.max(1,finite(input.gain,1));
    const step=finite(input.step,8);
    const tol=Math.max(.001,finite(input.tol,.1));
    const vpk=vpp/2;
    const required=2*Math.PI*fKHz*1e3*vpk/1e6;
    const worst=Math.min(srp,srn);
    const fpbw=worst*1e6/(2*Math.PI*Math.max(vpk,1e-12))/1e3;
    const margin=worst/Math.max(required,1e-12);
    const fcMHz=gbw/gain;
    const tauUs=1/(2*Math.PI*fcMHz*1e6)*1e6;
    const activeStepSr=step>=0?srp:srn;
    const slewUs=Math.abs(step)/activeStepSr;
    const settleLinear=Math.max(0,Math.log(1/(tol/100)))*tauUs;
    // dy/dt = clamp((command-y)/tau, -SR-, SR+), not a cascade
    // of a bandwidth filter followed by an unrelated slew limiter.
    const amplitude=Math.abs(step), threshold=activeStepSr*tauUs;
    const rampUs=Math.max(0,(amplitude-threshold)/activeStepSr);
    const band=amplitude*tol/100;
    const settleUs=amplitude===0||band>=amplitude?0:
      band>=threshold?(amplitude-band)/activeStepSr:
      rampUs+tauUs*Math.log(Math.min(amplitude,threshold)/band);
    const stepDirection=step>0?"POSITIVE":step<0?"NEGATIVE":"ZERO";
    return {mode,fKHz,vpp,srp,srn,gbw,gain,step,tol,vpk,required,worst,fpbw,margin,fcMHz,tauUs,activeStepSr,stepDirection,slewUs,settleLinear,settleUs,slewLimited:margin<1};
  }

  function readNum(id,fallback){const el=$(id);if(!el)return fallback;const n=Number(el.value);return Number.isFinite(n)?n:fallback;}
  function currentMode(){return doc&&doc.body&&doc.body.dataset.mode==="step"?"step":"sine";}
  function metrics(){
    return calculateMetrics({
      fKHz:readNum("op-freq",100),
      vpp:readNum("op-vpp",8),
      srp:readNum("op-sr-plus",5),
      srn:readNum("op-sr-minus",5),
      gbw:readNum("op-gbw",10),
      gain:readNum("op-gain",1),
      step:readNum("op-step",8),
      tol:readNum("op-tol",.1)
    },currentMode());
  }

  function setText(id,text){const el=$(id);if(el)el.textContent=text;}
  function updateMetrics(m,mode=currentMode()){
    setText("op-required-sr",`${fmt(m.required,3)} V/µs`);
    setText("op-fpbw",`${fmt(m.fpbw,1)} kHz`);
    setText("op-margin",fmt(m.margin,2));
    setText("op-step-time",`${fmt(m.slewUs,2)} µs`);
    setText("op-settle-time",`${fmt(m.settleUs,2)} µs`);
    setText("op-cl-bw",`${fmt(m.fcMHz,2)} MHz`);
    const s=$("op-state");
    if(!s)return;
    if(mode==="step"){
      s.className="status";
      if(m.stepDirection==="ZERO")s.textContent="ZERO STEP — no directional slew interval";
      else{
        const srLabel=m.stepDirection==="POSITIVE"?"SR+":"SR−";
        s.textContent=`${m.stepDirection} STEP — using ${srLabel} = ${fmt(m.activeStepSr,2)} V/µs`;
      }
      return;
    }
    s.className="status "+(m.slewLimited?"bad":"");
    s.textContent=m.slewLimited?"SLEW LIMITED — required dV/dt 超過最差方向 SR":"SAFE / not limited — slew-only 條件有餘裕";
  }

  function ensureCanvas(c){const dpr=root.devicePixelRatio||1,w=Math.max(320,c.clientWidth),h=Math.max(220,c.clientHeight);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);}return{w,h,ctx:c.getContext("2d")};}
  function grid(ctx,w,h){ctx.clearRect(0,0,w,h);ctx.strokeStyle="#18304a";ctx.lineWidth=1;for(let i=0;i<=10;i++){let x=w*i/10;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let i=0;i<=8;i++){let y=h*i/8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.strokeStyle="#35516f";ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();}
  function trace(ctx,pts,color,w,h,scale){ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.beginPath();pts.forEach((p,i)=>{const x=i/(pts.length-1)*w,y=h/2-p*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
  // Exact solution for a held command over dt, including the ramp/tail boundary.
  function advance(out,target,dt,tau,srp,srn){
    const error=target-out,sign=Math.sign(error),sr=error>=0?srp:srn;
    const magnitude=Math.abs(error),threshold=sr*tau;
    const ramp=Math.max(0,(magnitude-threshold)/sr);
    if(dt<=ramp)return out+sign*sr*dt;
    return target-sign*Math.min(magnitude,threshold)*Math.exp(-(dt-ramp)/tau);
  }
  function simulate(m,mode){
    const N=900,duration=mode==="sine"?5/Math.max(m.fKHz,1e-9)*1000:Math.max(12,m.settleUs*1.5);
    const dtUs=duration/(N-1),stepStartUs=mode==="step"?duration*.08:0;
    let small=0,out=0;
    const cmd=[],filtered=[],actual=[],timeUs=[];
    for(let i=0;i<N;i++){
      const tUs=i*dtUs,target=mode==="sine"?m.vpk*Math.sin(2*Math.PI*m.fKHz*tUs*.001):(tUs>=stepStartUs?m.step:0);
      if(mode==="step"){
        const age=Math.max(0,tUs-stepStartUs);
        small=m.step*(-Math.expm1(-age/m.tauUs));
        out=advance(0,m.step,age,m.tauUs,m.srp,m.srn);
      }else if(i){
        // Midpoint held sine command; stable exact first-order interval update.
        const middle=m.vpk*Math.sin(2*Math.PI*m.fKHz*(tUs-dtUs/2)*.001);
        small=middle+(small-middle)*Math.exp(-dtUs/m.tauUs);
        out=advance(out,middle,dtUs,m.tauUs,m.srp,m.srn);
      }
      timeUs.push(tUs);cmd.push(target);filtered.push(small);actual.push(out);
    }
    return{cmd,filtered,actual,timeUs,stepStartUs,dtUs};
  }
  function draw(){const c=$("op-scope");if(!c)return;const m=metrics(),mode=currentMode(),{w,h,ctx}=ensureCanvas(c);grid(ctx,w,h);const s=simulate(m,mode),peak=Math.max(1,...s.cmd.map(Math.abs),...s.actual.map(Math.abs)),scale=h*.34/peak;trace(ctx,s.cmd,"#94a3b8",w,h,scale);trace(ctx,s.filtered,"#f3b64a",w,h,scale);trace(ctx,s.actual,"#61dafb",w,h,scale);ctx.fillStyle="#cbd5e1";ctx.font="12px system-ui";ctx.fillText("gray: command   amber: bandwidth-only   cyan: combined SR+BW",12,18);}
  function update(){if(!doc)return;const mode=currentMode(),m=metrics();updateMetrics(m,mode);draw();}

  if(doc){doc.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",update));root.addEventListener("resize",draw);update();}
  return {calculateMetrics,metrics,simulate,update};
});