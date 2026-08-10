(function(){
  "use strict";
  const $=id=>document.getElementById(id),num=id=>Number($(id)&&$(id).value);
  const fmt=(v,d=3)=>Number.isFinite(v)?Number(v).toFixed(d):"—";
  function metrics(){
    const fKHz=num("op-freq")||100,vpp=num("op-vpp")||8,srp=num("op-sr-plus")||5,srn=num("op-sr-minus")||5,gbw=num("op-gbw")||10,gain=Math.max(1,num("op-gain")||1),step=Math.abs(num("op-step")||8),tol=Math.max(.001,num("op-tol")||.1);
    const vpk=vpp/2,required=2*Math.PI*fKHz*1e3*vpk/1e6,worst=Math.min(srp,srn),fpbw=worst*1e6/(2*Math.PI*Math.max(vpk,1e-12))/1e3,margin=worst/Math.max(required,1e-12),fcMHz=gbw/gain,tauUs=1/(2*Math.PI*fcMHz*1e6)*1e6,slewUs=step/worst,settleLinear=Math.max(0,Math.log(1/(tol/100)))*tauUs,settleUs=slewUs+settleLinear;
    return{fKHz,vpp,srp,srn,gbw,gain,step,tol,vpk,required,worst,fpbw,margin,fcMHz,tauUs,slewUs,settleUs,slewLimited:margin<1};
  }
  function setText(id,text){const el=$(id);if(el)el.textContent=text;}
  function updateMetrics(m){
    setText("op-required-sr",`${fmt(m.required,3)} V/µs`);setText("op-fpbw",`${fmt(m.fpbw,1)} kHz`);setText("op-margin",fmt(m.margin,2));setText("op-step-time",`${fmt(m.slewUs,2)} µs`);setText("op-settle-time",`${fmt(m.settleUs,2)} µs`);setText("op-cl-bw",`${fmt(m.fcMHz,2)} MHz`);
    const s=$("op-state");if(s){s.className="status "+(m.slewLimited?"bad":"");s.textContent=m.slewLimited?"SLEW LIMITED — required dV/dt 超過最差方向 SR":"SAFE / not limited — slew-only 條件有餘裕";}
  }
  function ensureCanvas(c){const dpr=window.devicePixelRatio||1,w=Math.max(320,c.clientWidth),h=Math.max(220,c.clientHeight);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);}return{w,h,ctx:c.getContext("2d")};}
  function grid(ctx,w,h){ctx.clearRect(0,0,w,h);ctx.strokeStyle="#18304a";ctx.lineWidth=1;for(let i=0;i<=10;i++){let x=w*i/10;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let i=0;i<=8;i++){let y=h*i/8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.strokeStyle="#35516f";ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();}
  function trace(ctx,pts,color,w,h,scale){ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.beginPath();pts.forEach((p,i)=>{const x=i/(pts.length-1)*w,y=h/2-p*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
  function simulate(m,mode){const N=900,dtUs=mode==="sine"?(5/m.fKHz*1000)/N:Math.max(12,m.settleUs*1.3)/N,fcHz=m.fcMHz*1e6,tauUs=1/(2*Math.PI*fcHz)*1e6,alpha=Math.min(1,dtUs/Math.max(tauUs,1e-6));let small=mode==="step"?0:0,out=small;const cmd=[],filtered=[],actual=[];for(let i=0;i<N;i++){const tUs=i*dtUs,target=mode==="sine"?m.vpk*Math.sin(2*Math.PI*m.fKHz*1e3*tUs*1e-6):(tUs>dtUs*80?m.step:0);small+=alpha*(target-small);const delta=small-out,limit=(delta>=0?m.srp:m.srn)*dtUs;out+=Math.max(-Math.abs(limit),Math.min(Math.abs(limit),delta));cmd.push(target);filtered.push(small);actual.push(out);}return{cmd,filtered,actual};}
  function draw(){const c=$("op-scope");if(!c)return;const m=metrics(),mode=document.body.dataset.mode==="step"?"step":"sine",{w,h,ctx}=ensureCanvas(c);grid(ctx,w,h);const s=simulate(m,mode),peak=Math.max(1,...s.cmd.map(Math.abs),...s.actual.map(Math.abs)),scale=h*.34/peak;trace(ctx,s.cmd,"#94a3b8",w,h,scale);trace(ctx,s.filtered,"#f3b64a",w,h,scale);trace(ctx,s.actual,"#61dafb",w,h,scale);ctx.fillStyle="#cbd5e1";ctx.font="12px system-ui";ctx.fillText("gray: command   amber: bandwidth-only   cyan: combined SR+BW",12,18);}
  function update(){const m=metrics();updateMetrics(m);draw();}
  document.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",update));window.addEventListener("resize",draw);update();
  window.CircuitOpampSimulator={metrics,simulate,update};
})();