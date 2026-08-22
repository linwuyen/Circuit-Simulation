(()=>{
  "use strict";
  const T=window.CircuitTopologyTransferV1;
  if(!T) throw new Error("CircuitTopologyTransferV1 must load before Module 17 app.js");
  const $=id=>document.getElementById(id), n=id=>Number($(id).value), out=(id,v)=>{$(id).textContent=v;};
  const hz=f=>f>=1e6?(f/1e6).toFixed(2)+" MHz":f>=1000?(f/1000).toFixed(2)+" kHz":f.toFixed(2)+" Hz";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const bind=(ids,fn)=>ids.forEach(id=>$(id)?.addEventListener("input",fn));
  const ctx=id=>$(id).getContext("2d");
  const logspace=(min,max,count=181)=>Array.from({length:count},(_,i)=>min*Math.pow(max/min,i/(count-1)));

  function chartFrame(c,title){
    const w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);c.fillStyle="#07101d";c.fillRect(0,0,w,h);c.fillStyle="#9fb1c5";c.font="12px system-ui";c.fillText(title,58,16);
  }
  function line(c,pts,mapper,stroke){c.strokeStyle=stroke;c.lineWidth=2;c.beginPath();let started=false;pts.forEach((p,i)=>{if(!Number.isFinite(p)) return;const [x,y]=mapper(p,i);if(!started){c.moveTo(x,y);started=true}else c.lineTo(x,y)});if(started)c.stroke();}
  function bode(id,title,minF,maxF,responseAt,units){
    const c=ctx(id),w=c.canvas.width,h=c.canvas.height,left=62,right=18,top=24,mid=h/2,bottom=32;
    chartFrame(c,title);
    const fs=logspace(minF,maxF), rs=fs.map(f=>responseAt(f));
    const mags=rs.map(r=>r.magnitudeDb).filter(Number.isFinite), phases=rs.map(r=>r.phaseDeg).filter(Number.isFinite);
    let magLo=Math.floor((Math.min(...mags)-6)/10)*10,magHi=Math.ceil((Math.max(...mags)+6)/10)*10;
    if(!(magHi>magLo)){magLo-=10;magHi+=10}
    let phaseLo=Math.floor((Math.min(...phases)-10)/45)*45,phaseHi=Math.ceil((Math.max(...phases)+10)/45)*45;
    if(!(phaseHi>phaseLo)){phaseLo-=45;phaseHi+=45}
    const x=f=>left+(w-left-right)*Math.log(f/minF)/Math.log(maxF/minF);
    const yMag=v=>top+(mid-top-14)*(magHi-v)/(magHi-magLo), yPhase=v=>mid+12+(h-bottom-mid-12)*(phaseHi-v)/(phaseHi-phaseLo);
    c.strokeStyle="#29435e";c.lineWidth=1;
    [0,.25,.5,.75,1].forEach(q=>{const xx=left+(w-left-right)*q;c.beginPath();c.moveTo(xx,top);c.lineTo(xx,h-bottom);c.stroke();});
    [top,mid-14,mid+12,h-bottom].forEach(yy=>{c.beginPath();c.moveTo(left,yy);c.lineTo(w-right,yy);c.stroke();});
    line(c,rs,(r,i)=>[x(fs[i]),yMag(r.magnitudeDb)],"#58d6ff");line(c,rs,(r,i)=>[x(fs[i]),yPhase(r.phaseDeg)],"#ffcb66");
    c.fillStyle="#9fb1c5";c.font="11px system-ui";c.fillText(`${magHi.toFixed(0)} dB`,4,top+4);c.fillText(`${magLo.toFixed(0)} dB`,4,mid-16);c.fillText(`${phaseHi.toFixed(0)}°`,8,mid+18);c.fillText(`${phaseLo.toFixed(0)}°`,8,h-bottom);c.fillText(hz(minF),left,h-8);const maxLabel=hz(maxF);c.fillText(maxLabel,w-right-c.measureText(maxLabel).width,h-8);c.fillText(units,w-right-c.measureText(units).width,16);
  }
  function buck(){
    const vin=n("vinBuck"),D=n("dutyBuck")/100,L=n("lBuck")*1e-6,C=n("cBuck")*1e-6,R=n("rBuck"),esr=n("esrBuck")*1e-3,fs=n("fsBuck")*1e3,vout=vin*D;
    const ripple=(vin-vout)*D/(L*fs),f0=1/(2*Math.PI*Math.sqrt(L*C)),fesr=1/(2*Math.PI*esr*C);
    out("vinBuckOut",vin.toFixed(0)+" V");out("dutyBuckOut",(D*100).toFixed(0)+" %");out("lBuckOut",(L*1e6).toFixed(0)+" µH");out("cBuckOut",(C*1e6).toFixed(0)+" µF");out("rBuckOut",R.toFixed(1)+" Ω");out("esrBuckOut",(esr*1e3).toFixed(0)+" mΩ");out("fsBuckOut",(fs/1e3).toFixed(0)+" kHz");
    out("buckVout",vout.toFixed(2)+" V");out("buckRipple",ripple.toFixed(2)+" A");out("buckF0",hz(f0));out("buckFesr",hz(fesr));
    const ratio=ripple/Math.max(vout/R,1e-9);$("buckExplain").textContent=`LC resonance 約 ${hz(f0)}，ESR zero 約 ${hz(fesr)}。平均輸出電流約 ${(vout/R).toFixed(2)} A，電感 ripple 約 ${(ratio*100).toFixed(1)}%。這張圖沿用含 ESR zero 的 averaged Buck model；數位 delay 需另外疊加。`;
    const response=f=>{const w=2*Math.PI*f,nr=vin,ni=vin*w*esr*C,dr=1-w*w*L*C*(1+esr/R),di=w*(L/R+esr*C),den=dr*dr+di*di,re=(nr*dr+ni*di)/den,im=(ni*dr-nr*di)/den,mag=Math.hypot(re,im);return {magnitudeDb:20*Math.log10(mag),phaseDeg:Math.atan2(im,re)*180/Math.PI};};
    bode("buckBode","Buck averaged CCM plant",1,Math.min(50000,.45*fs),response,"V/duty");
  }
  function boost(){
    const p={vin:n("vinBoost"),duty:n("dutyBoost")/100,inductanceH:n("lBoost")*1e-6,capacitanceF:n("cBoost")*1e-6,loadOhm:n("rBoost")};const m=T.boostCCM(p);
    out("dutyBoostOut",(p.duty*100).toFixed(0)+" %");out("lBoostOut",(p.inductanceH*1e6).toFixed(0)+" µH");out("cBoostOut",(p.capacitanceF*1e6).toFixed(0)+" µF");out("rBoostOut",p.loadOhm.toFixed(0)+" Ω");out("vinBoostOut",p.vin.toFixed(0)+" V");out("boostVout",m.vout.toFixed(1)+" V");out("boostRhpz",hz(m.rhpzHz));out("boostF0",hz(m.resonanceHz));out("boostQ",m.qualityFactor.toFixed(2));
    const hi=Math.max(10,Math.min(100000,m.rhpzHz*3));bode("boostBode","Boost CCM duty-to-output plant",1,hi,f=>T.boostControlToOutputAt(p,f),"V/duty");
  }
  function pfc(){
    const p={vrms:n("pfcVrms"),powerW:n("pfcPower"),vbus:n("pfcBus"),busCapF:n("pfcC")*1e-6,lineHz:n("pfcHz"),inductanceH:n("pfcL")*1e-6,efficiency:.97};const m=T.pfcBoost(p);
    out("pfcVrmsOut",p.vrms.toFixed(0)+" Vrms");out("pfcPowerOut",p.powerW.toFixed(0)+" W");out("pfcBusOut",p.vbus.toFixed(0)+" V");out("pfcCOut",(p.busCapF*1e6).toFixed(0)+" µF");out("pfcLOut",(p.inductanceH*1e6).toFixed(0)+" µH");out("pfcHzOut",p.lineHz.toFixed(0)+" Hz");out("pfcIrms",m.inputCurrentRms.toFixed(2)+" A");out("pfcIpk",m.inputCurrentPeak.toFixed(2)+" A");out("pfcRippleHz",m.doubleLineHz.toFixed(0)+" Hz");out("pfcOuterPole",hz(m.outerPoleHz));
    bode("pfcCurrentBode","PFC fast inner plant · stiff Vbus",10,50000,f=>T.pfcCurrentPlantAt({vbus:p.vbus,inductanceH:p.inductanceH},f),"A/duty");
    bode("pfcVoltageBode","PFC slow bus-energy plant · current-peak command",.1,1000,f=>T.pfcVoltagePlantAt(p,f),"V/Apeak");
  }
  function psfb(){
    const p={vin:n("psfbVin"),phaseDeg:n("psfbPhase"),turnsRatio:n("psfbN"),leakageH:n("psfbLlk")*1e-6,primaryCurrentA:n("psfbI"),commutationCapF:n("psfbCoss")*1e-9,outputInductanceH:n("psfbLo")*1e-6,outputCapacitanceF:n("psfbCo")*1e-6,loadOhm:n("psfbR")};const m=T.psfb(p);
    out("psfbVinOut",p.vin.toFixed(0)+" V");out("psfbPhaseOut",p.phaseDeg.toFixed(0)+"°");out("psfbNOut",p.turnsRatio.toFixed(2));out("psfbLlkOut",(p.leakageH*1e6).toFixed(0)+" µH");out("psfbIOut",p.primaryCurrentA.toFixed(0)+" A");out("psfbCossOut",(p.commutationCapF*1e9).toFixed(1)+" nF");out("psfbLoOut",(p.outputInductanceH*1e6).toFixed(0)+" µH");out("psfbCoOut",(p.outputCapacitanceF*1e6).toFixed(0)+" µF");out("psfbROut",p.loadOhm.toFixed(1)+" Ω");out("psfbM",m.modulation.toFixed(3));out("psfbVout",m.idealSecondaryV.toFixed(1)+" V");out("psfbF0",hz(m.outputResonanceHz));out("psfbZvs",m.zvsEnergyMargin.toFixed(2)+"×");
    bode("psfbBode","PSFB ideal no-duty-loss phase-to-output plant",1,50000,f=>T.psfbControlToOutputAt(p,f),"V/degree");
  }
  function llc(){
    const p={resonantInductanceH:n("llcLr")*1e-6,resonantCapF:n("llcCr")*1e-9,magnetizingInductanceH:n("llcLm")*1e-6,q:n("llcQ"),switchingHz:n("llcFs")*1e3},m=T.llc(p);
    out("llcLrOut",(p.resonantInductanceH*1e6).toFixed(0)+" µH");out("llcCrOut",(p.resonantCapF*1e9).toFixed(0)+" nF");out("llcLmOut",(p.magnetizingInductanceH*1e6).toFixed(0)+" µH");out("llcQOut",p.q.toFixed(2));out("llcFsOut",(p.switchingHz/1e3).toFixed(0)+" kHz");out("llcFr",hz(m.resonanceHz));out("llcLn",m.ln.toFixed(2));out("llcFn",m.normalizedFrequency.toFixed(2));out("llcGain",m.gain.toFixed(3));out("llcSlope",m.normalizedGainSlope.toFixed(3));
    const region=m.normalizedFrequency<.9?"低於 resonance":m.normalizedFrequency>1.1?"高於 resonance":"接近 resonance";$("llcExplain").textContent=`fr=${hz(m.resonanceHz)}，fn=${m.normalizedFrequency.toFixed(2)}、Ln=${m.ln.toFixed(2)}、Q=${p.q.toFixed(2)}。${region}；局部 dlnM/dlnf=${m.normalizedGainSlope.toFixed(3)}。這是 FHA steady-state sensitivity，不是 dynamic loop phase。`;
    const pts=[];for(let i=0;i<180;i++){const fn=.45+i/179*1.9;pts.push(T.llcFhaGain(fn,m.ln,p.q))}const c=ctx("llcGainCanvas");chartFrame(c,"Equation-grade normalized FHA steady-state gain · fn 0.45 → 2.35");const w=c.canvas.width,h=c.canvas.height,left=55,right=20,top=25,bottom=35,hi=Math.max(2,...pts)*1.05;c.strokeStyle="#29435e";for(let i=0;i<=4;i++){const y=top+(h-top-bottom)*i/4;c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.stroke()}line(c,pts,(v,i)=>[left+(w-left-right)*i/(pts.length-1),top+(h-top-bottom)*(hi-v)/hi],"#58d6ff");const mark=clamp((m.normalizedFrequency-.45)/1.9,0,1),x=left+(w-left-right)*mark;c.strokeStyle="#ffcb66";c.beginPath();c.moveTo(x,top);c.lineTo(x,h-bottom);c.stroke();c.fillStyle="#9fb1c5";c.font="11px system-ui";c.fillText("M",10,top+5);c.fillText("0.45",left,h-8);c.fillText("fn",w/2,h-8);c.fillText("2.35",w-right-25,h-8);
  }
  function inverter(){
    const p={mode:$("invMode").value,dcBusV:n("invVdc"),modulationIndex:n("invM"),l1H:n("invL1")*1e-3,capF:n("invC")*1e-6,l2H:n("invL2")*1e-3,loadOhm:n("invR")},m=T.inverter(p);
    out("invVdcOut",p.dcBusV.toFixed(0)+" V");out("invMOut",p.modulationIndex.toFixed(2));out("invL1Out",(p.l1H*1e3).toFixed(1)+" mH");out("invCOut",(p.capF*1e6).toFixed(0)+" µF");out("invL2Out",(p.l2H*1e3).toFixed(1)+" mH");out("invROut",p.loadOhm.toFixed(0)+" Ω");out("invVrms",m.fundamentalVrms.toFixed(1)+" Vrms");out("invFres",hz(m.resonanceHz));out("invModeText",p.mode==="lcl"?"Grid-tied LCL":"Standalone LC");out("invDebug",p.mode==="lcl"?"LCL resonance / damping":"LC resonance / load damping");
    const min=1,max=Math.max(1000,Math.min(100000,m.resonanceHz*8));if(p.mode==="lcl") bode("invBode","Ideal undamped LCL modulation-to-grid-current plant",min,max,f=>T.inverterLclGridCurrentAt(p,f),"A/modulation");else bode("invBode","Ideal averaged LC modulation-to-output-voltage plant",min,max,f=>T.inverterLcVoltageAt(p,f),"V/modulation");
  }
  bind(["vinBuck","dutyBuck","lBuck","cBuck","rBuck","esrBuck","fsBuck"],buck);bind(["dutyBoost","lBoost","cBoost","rBoost","vinBoost"],boost);bind(["pfcVrms","pfcPower","pfcBus","pfcC","pfcL","pfcHz"],pfc);bind(["psfbVin","psfbPhase","psfbN","psfbLlk","psfbI","psfbCoss","psfbLo","psfbCo","psfbR"],psfb);bind(["llcLr","llcCr","llcLm","llcQ","llcFs"],llc);bind(["invMode","invVdc","invM","invL1","invC","invL2","invR"],inverter);
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.go).scrollIntoView({behavior:"smooth",block:"start"})));
  buck();boost();pfc();psfb();llc();inverter();
  const p5=document.createElement("script");p5.src="p5-transfer.js";document.body.appendChild(p5);
})();
