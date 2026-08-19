(()=>{
  "use strict";
  const $=id=>document.getElementById(id), n=id=>Number($(id).value), out=(id,v)=>{$(id).textContent=v;};
  const hz=f=>f>=1e6?(f/1e6).toFixed(2)+" MHz":f>=1000?(f/1000).toFixed(2)+" kHz":f.toFixed(1)+" Hz";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const bind=(ids,fn)=>ids.forEach(id=>$(id).addEventListener("input",fn));
  const ctx=id=>$(id).getContext("2d");
  function axes(c,title){const w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);c.fillStyle="#07101d";c.fillRect(0,0,w,h);c.strokeStyle="#29435e";c.lineWidth=1;for(let i=1;i<6;i++){const x=55+i*(w-75)/6;c.beginPath();c.moveTo(x,25);c.lineTo(x,h-35);c.stroke()}for(let i=1;i<5;i++){const y=25+i*(h-60)/5;c.beginPath();c.moveTo(55,y);c.lineTo(w-20,y);c.stroke()}c.fillStyle="#9fb1c5";c.font="13px system-ui";c.fillText(title,58,18);}
  function plotLine(c,pts,minY,maxY,stroke){const w=c.canvas.width,h=c.canvas.height,left=55,right=20,top=25,bottom=35;c.strokeStyle=stroke;c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>{const x=left+(w-left-right)*i/(pts.length-1),y=top+(h-top-bottom)*(maxY-p)/(maxY-minY);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();}
  function buck(){
    const vin=n("vinBuck"),D=n("dutyBuck")/100,L=n("lBuck")*1e-6,C=n("cBuck")*1e-6,R=n("rBuck"),esr=n("esrBuck")*1e-3,fs=n("fsBuck")*1e3,vout=vin*D;
    const ripple=(vin-vout)*D/(L*fs),f0=1/(2*Math.PI*Math.sqrt(L*C)),fesr=1/(2*Math.PI*esr*C);
    out("vinBuckOut",vin.toFixed(0)+" V");out("dutyBuckOut",(D*100).toFixed(0)+" %");out("lBuckOut",(L*1e6).toFixed(0)+" µH");out("cBuckOut",(C*1e6).toFixed(0)+" µF");out("rBuckOut",R.toFixed(1)+" Ω");out("esrBuckOut",(esr*1e3).toFixed(0)+" mΩ");out("fsBuckOut",(fs/1e3).toFixed(0)+" kHz");
    out("buckVout",vout.toFixed(2)+" V");out("buckRipple",ripple.toFixed(2)+" A");out("buckF0",hz(f0));out("buckFesr",hz(fesr));
    const ratio=ripple/Math.max(vout/R,1e-9);$("buckExplain").textContent=`LC resonance 約 ${hz(f0)}，ESR zero 約 ${hz(fesr)}。平均輸出電流約 ${(vout/R).toFixed(2)} A，電感 ripple 約 ${(ratio*100).toFixed(1)}%。先用這兩個 corner 定 plant，再把 PWM、sensor filter 與 digital delay 疊上去。`;
    const mag=[],phase=[];for(let i=0;i<160;i++){const f=10*Math.pow(10,i/159*5),w=2*Math.PI*f;const nr=1,ni=w*esr*C,dr=1-w*w*L*C,di=w*L/R;const nm=Math.hypot(nr,ni),dm=Math.hypot(dr,di);mag.push(20*Math.log10(vin*nm/dm));phase.push((Math.atan2(ni,nr)-Math.atan2(di,dr))*180/Math.PI)}
    const c=ctx("buckBode");axes(c,"Buck teaching plant · magnitude dB (cyan), phase mapped (orange)");const lo=Math.min(...mag,-30),hi=Math.max(...mag,40);plotLine(c,mag,lo,hi,"#58d6ff");const phaseMapped=phase.map(p=>lo+(p+180)/180*(hi-lo));plotLine(c,phaseMapped,lo,hi,"#ffcb66");
  }
  function boost(){
    const D=n("dutyBoost")/100,L=n("lBoost")*1e-6,R=n("rBoost"),vin=n("vinBoost"),vout=vin/(1-D),fr=R*Math.pow(1-D,2)/(2*Math.PI*L);
    out("dutyBoostOut",(D*100).toFixed(0)+" %");out("lBoostOut",(L*1e6).toFixed(0)+" µH");out("rBoostOut",R.toFixed(0)+" Ω");out("vinBoostOut",vin.toFixed(0)+" V");out("boostVout",vout.toFixed(1)+" V");out("boostRhpz",hz(fr));out("boostFc5",hz(fr/5));out("boostFc10",hz(fr/10));
  }
  function pfc(){
    const vrms=n("pfcVrms"),P=n("pfcPower"),V=n("pfcBus"),C=n("pfcC")*1e-6,f=n("pfcHz"),eta=.97,irms=P/(vrms*eta),ipk=Math.SQRT2*irms,dv=P/(2*(2*Math.PI*f)*C*V);
    out("pfcVrmsOut",vrms.toFixed(0)+" Vrms");out("pfcPowerOut",P.toFixed(0)+" W");out("pfcBusOut",V.toFixed(0)+" V");out("pfcCOut",(C*1e6).toFixed(0)+" µF");out("pfcHzOut",f.toFixed(0)+" Hz");out("pfcIrms",irms.toFixed(2)+" A");out("pfcIpk",ipk.toFixed(2)+" A");out("pfcRippleHz",(2*f).toFixed(0)+" Hz");out("pfcRippleV",dv.toFixed(2)+" Vpk");
  }
  function psfb(){
    const vin=n("psfbVin"),phi=n("psfbPhase"),turns=n("psfbN"),L=n("psfbLlk")*1e-6,I=n("psfbI"),C=n("psfbCoss")*1e-9,m=phi/180,v=vin*turns*m,El=.5*L*I*I,Ec=.5*C*vin*vin,index=El/Math.max(Ec,1e-12);
    out("psfbVinOut",vin.toFixed(0)+" V");out("psfbPhaseOut",phi.toFixed(0)+"°");out("psfbNOut",turns.toFixed(2));out("psfbLlkOut",(L*1e6).toFixed(0)+" µH");out("psfbIOut",I.toFixed(0)+" A");out("psfbCossOut",(C*1e9).toFixed(1)+" nF");out("psfbM",m.toFixed(3));out("psfbVout",v.toFixed(1)+" V");out("psfbEl",(El*1e6).toFixed(0)+" µJ");out("psfbZvs",index.toFixed(2)+"×");
  }
  function llcGain(fn,Ln,Q){const a=1+(1/Ln)*(1-1/(fn*fn)),b=Q*(fn-1/fn);return 1/Math.sqrt(a*a+b*b)}
  function llc(){
    const Lr=n("llcLr")*1e-6,Cr=n("llcCr")*1e-9,Lm=n("llcLm")*1e-6,Q=n("llcQ"),fs=n("llcFs")*1e3,fr=1/(2*Math.PI*Math.sqrt(Lr*Cr)),Ln=Lm/Lr,fn=fs/fr,g=llcGain(fn,Ln,Q);
    out("llcLrOut",(Lr*1e6).toFixed(0)+" µH");out("llcCrOut",(Cr*1e9).toFixed(0)+" nF");out("llcLmOut",(Lm*1e6).toFixed(0)+" µH");out("llcQOut",Q.toFixed(2));out("llcFsOut",(fs/1e3).toFixed(0)+" kHz");out("llcFr",hz(fr));out("llcLn",Ln.toFixed(2));out("llcFn",fn.toFixed(2));out("llcGain",g.toFixed(3));
    let region=fn<.9?"低於 resonance：通常增益敏感、circulating current 與 soft-switching boundary 要特別小心。":fn>1.1?"高於 resonance：gain 通常往下降，frequency-to-gain slope 取決於 Ln/Q 與 load。":"接近 resonance：tank impedance 與增益轉折最值得觀察，別把這一點的 plant 當成全工作區。";$("llcExplain").textContent=`fr=${hz(fr)}，目前 fn=${fn.toFixed(2)}、Ln=${Ln.toFixed(2)}、Q=${Q.toFixed(2)}。${region}`;
    const pts=[];for(let i=0;i<180;i++){const x=.45+i/179*1.9;pts.push(llcGain(x,Ln,Q))}const c=ctx("llcGainCanvas");axes(c,"Normalized FHA gain · fn 0.45 → 2.35");const hi=Math.max(2,...pts)*1.05;plotLine(c,pts,0,hi,"#58d6ff");const mark=clamp((fn-.45)/1.9,0,1),x=55+(c.canvas.width-75)*mark;c.strokeStyle="#ffcb66";c.beginPath();c.moveTo(x,25);c.lineTo(x,c.canvas.height-35);c.stroke();
  }
  function inverter(){
    const mode=$("invMode").value,Vdc=n("invVdc"),m=n("invM"),L1=n("invL1")*1e-3,C=n("invC")*1e-6,L2=n("invL2")*1e-3,vrms=m*Vdc/Math.SQRT2;let fres,debug,label;
    if(mode==="lcl"){fres=(1/(2*Math.PI))*Math.sqrt((L1+L2)/(L1*L2*C));debug="LCL resonance / damping";label="Grid-tied LCL"}else{fres=1/(2*Math.PI*Math.sqrt(L1*C));debug="LC resonance / voltage loop";label="Standalone LC"}
    out("invVdcOut",Vdc.toFixed(0)+" V");out("invMOut",m.toFixed(2));out("invL1Out",(L1*1e3).toFixed(1)+" mH");out("invCOut",(C*1e6).toFixed(0)+" µF");out("invL2Out",(L2*1e3).toFixed(1)+" mH");out("invVrms",vrms.toFixed(1)+" Vrms");out("invFres",hz(fres));out("invModeText",label);out("invDebug",debug);
  }
  bind(["vinBuck","dutyBuck","lBuck","cBuck","rBuck","esrBuck","fsBuck"],buck);bind(["dutyBoost","lBoost","rBoost","vinBoost"],boost);bind(["pfcVrms","pfcPower","pfcBus","pfcC","pfcHz"],pfc);bind(["psfbVin","psfbPhase","psfbN","psfbLlk","psfbI","psfbCoss"],psfb);bind(["llcLr","llcCr","llcLm","llcQ","llcFs"],llc);bind(["invMode","invVdc","invM","invL1","invC","invL2"],inverter);
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.go).scrollIntoView({behavior:"smooth",block:"start"})));
  buck();boost();pfc();psfb();llc();inverter();
})();
