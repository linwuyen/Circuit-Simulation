(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitLabOracles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ORACLE_VERSION = "3.0.0";
  const REFERENCE_VERSION = "2.0.0";
  const number = (controls, key, scale) => {
    const value = Number(controls && controls[key]);
    return Number.isFinite(value) ? value * (scale == null ? 1 : scale) : null;
  };
  const firstNumber = (controls, keys, scale) => {
    for (const key of keys || []) {
      const value = number(controls, key, scale);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  const nearlyEqual = (a, b, rel, abs) => {
    const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return x===y;
    const delta=Math.abs(x-y),scale=Math.max(Math.abs(x),Math.abs(y),1e-12);return delta<=(abs==null?1e-9:abs)||delta/scale<=(rel==null?1e-6:rel);
  };
  const text = value => String(value == null ? "" : value);
  const parseNumber = value => {
    const match=text(value).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };
  const observedText = (snapshot, id) => {
    const value=snapshot&&snapshot.observed&&snapshot.observed[id];
    return value && typeof value === "object" ? text(value.text) : text(value);
  };
  const observedHidden = (snapshot,id) => {
    const value=snapshot&&snapshot.observed&&snapshot.observed[id];
    return !!(value&&typeof value==="object"&&value.hidden);
  };
  const metricText = (snapshot, label) => (snapshot&&snapshot.metrics||[]).find(item=>text(item).toLowerCase().includes(text(label).toLowerCase())) || "";
  const parseFrequencyHz = value => {
    const n=parseNumber(value);if(!Number.isFinite(n))return null;
    return /khz/i.test(text(value))?n*1e3:/mhz/i.test(text(value))?n*1e6:n;
  };

  // Independent references: these functions must never call page simulator code, CircuitModels or ModelRegistry.
  function referenceBuck(input) {
    const vin=Number(input.vin),vout=Number(input.vout),L=Number(input.inductanceH),f=Number(input.switchingHz),iout=Math.max(0,Number(input.outputCurrentA));
    if(![vin,vout,L,f,iout].every(Number.isFinite)||vin<=0||vout<=0||vout>=vin||L<=0||f<=0)throw new Error("invalid reference Buck input");
    const duty=vout/vin,deltaIA=((vin-vout)*duty)/(f*L),boundaryCurrentA=deltaIA/2,eps=Math.max(1e-12,boundaryCurrentA*1e-9);
    const mode=iout>boundaryCurrentA+eps?"CCM":Math.abs(iout-boundaryCurrentA)<=eps?"BOUNDARY":"DCM";
    return{duty,deltaIA,boundaryCurrentA,outputCurrentA:iout,peakA:mode==="DCM"?deltaIA:iout+deltaIA/2,valleyA:mode==="DCM"?0:Math.max(0,iout-deltaIA/2),mode};
  }
  function referenceDivider(input) {
    const bus=Number(input.busV),top=Number(input.topOhm),bottom=Number(input.bottomOhm),vref=Number(input.vrefV);
    if(![bus,top,bottom].every(Number.isFinite)||top<=0||bottom<=0)throw new Error("invalid reference divider input");
    const total=top+bottom,currentA=bus/total;
    return{adcInputV:currentA*bottom,dividerCurrentA:currentA,topPowerW:currentA*currentA*top,bottomPowerW:currentA*currentA*bottom,maxBusV:Number.isFinite(vref)?vref*total/bottom:null};
  }
  function referencePark(input){const d=Number(input.deltaDegrees)*Math.PI/180,m=Number(input.magnitude);return{vd:m*Math.sin(d),vq:m*Math.cos(d)};}
  function referenceIntegrator(input){const ki=Number(input.ki);return{f0Hz:ki/(2*Math.PI),slopeDbPerDecade:-20,phaseDeg:-90};}
  function referenceSpiFifo(input){
    const models={none:{depth:1,per:200,batch:1,dma:false},isr1:{depth:16,per:200,batch:1,dma:false},isrN:{depth:16,per:200,batch:8,dma:false},dma:{depth:16,per:40,batch:1,dma:true}};
    const m=models[input.scenario]||models.isr1,sclk=Math.max(.5,Number(input.sclkMHz)),bits=Math.max(1,Math.trunc(Number(input.bits))),gapNs=Math.max(0,Number(input.gapUs))*1000,isrOv=m.dma?0:Math.max(0,Number(input.isrOverheadNs));
    const wordNs=bits*1000/sclk,Ta=wordNs+gapNs,Ts=isrOv/m.batch+m.per;
    return{TaNs:Ta,TsNs:Ts,keepUp:Ts<=Ta,depth:m.depth};
  }
  function referenceLoop(input){
    const total=10000,extAdc=550,cpu2Start=500,cpu2Tx=200,acq=Number(input.acqNs),cpu=Number(input.cpuNs),pay=Number(input.payloadBytes);
    const cpu1End=acq+cpu,fsiStart=cpu2Start+cpu2Tx,fsiDur=480+pay*40,fsiEnd=fsiStart+fsiDur,rxStart=fsiEnd+1200,rxEnd=rxStart+300,crit=Math.max(cpu1End,rxEnd);
    return{criticalNs:crit,marginNs:total-crit,fsiUtilPct:fsiDur/total*100,maxFrequencyKHz:1e6/crit,corrupted:acq<extAdc,timeout:crit>total};
  }
  function referenceDac(input){
    const target=Number(input.targetV),vref=Number(input.vrefV),mode=input.mode||"standard";if(!Number.isFinite(target)||!Number.isFinite(vref)||Math.abs(vref)<1e-12)throw new Error("invalid DAC input");
    const ratio=mode==="positive"?target/vref:-target/vref,exact=ratio*65536,raw=Math.round(exact),code=Math.max(0,Math.min(65535,raw)),reachable=raw>=0&&raw<=65535,achieved=(mode==="positive"?1:-1)*vref*(code/65536);
    return{code,reachable,achievedV:achieved,errorV:achieved-target};
  }
  function referencePhasePower(input){const deg=Number(input.phaseDeg),vrms=Number(input.vrms||1),irms=Number(input.irms||1),pf=Math.cos(deg*Math.PI/180);return{pf,watts:vrms*irms*pf};}
  function referenceAcmcTrip(input){const load=Number(input.loadW),ocp=Number(input.ocpA),offset=Number(input.offsetV),peak=load/220*Math.SQRT2,reason=peak>ocp?"OCP":Math.abs(offset)>1.5?"DC SAT":"READY";return{peakA:peak,reason,trip:reason!=="READY"};}

  const references={
    "ref-buck-ripple-ccm":{id:"ref-buck-ripple-ccm",version:REFERENCE_VERSION,calculate:referenceBuck},
    "ref-adc-divider":{id:"ref-adc-divider",version:REFERENCE_VERSION,calculate:referenceDivider},
    "ref-foc-park":{id:"ref-foc-park",version:REFERENCE_VERSION,calculate:referencePark},
    "ref-pi-integrator":{id:"ref-pi-integrator",version:REFERENCE_VERSION,calculate:referenceIntegrator},
    "ref-spi-fifo":{id:"ref-spi-fifo",version:REFERENCE_VERSION,calculate:referenceSpiFifo},
    "ref-loop-budget":{id:"ref-loop-budget",version:REFERENCE_VERSION,calculate:referenceLoop},
    "ref-ad5543-code":{id:"ref-ad5543-code",version:REFERENCE_VERSION,calculate:referenceDac},
    "ref-ac-phase-power":{id:"ref-ac-phase-power",version:REFERENCE_VERSION,calculate:referencePhasePower},
    "ref-acmc-trip":{id:"ref-acmc-trip",version:REFERENCE_VERSION,calculate:referenceAcmcTrip}
  };

  const definitions = {
    "buck.lab.buck-ripple": {
      kind:"registry-reference",modelId:"buck-ripple-ccm",referenceId:"ref-buck-ripple-ccm",compareFields:["duty","deltaIA","boundaryCurrentA"],
      build(snapshot){const c=snapshot&&snapshot.controls||{},inductanceH=firstNumber(c,["ind"],1e-6),switchingHz=firstNumber(c,["fsw"],1e3),outputCurrentA=firstNumber(c,["load"],1);if(![inductanceH,switchingHz,outputCurrentA].every(Number.isFinite))return null;return{vin:12,vout:3.3,inductanceH,switchingHz,outputCurrentA};},
      accept(output,input){const ratio=input.outputCurrentA>0?output.deltaIA/input.outputCurrentA:Infinity;return{passed:output.mode==="CCM"&&Math.abs(ratio-.20)<=.02,target:"ΔI/Iout = 20% ±2% 且維持 CCM",measured:Number.isFinite(ratio)?ratio:null,unit:"ratio"};}
    },
    "adc.lab.adc-divider": {
      kind:"registry-reference",modelId:"adc-divider",referenceId:"ref-adc-divider",compareFields:["adcInputV","topPowerW","bottomPowerW","maxBusV"],
      build(snapshot){const c=snapshot&&snapshot.controls||{},topOhm=firstNumber(c,["rtop"],1e3),bottomOhm=firstNumber(c,["rbot"],1e3),busV=firstNumber(c,["bus2"],1);if(![topOhm,bottomOhm,busV].every(Number.isFinite))return null;return{busV,topOhm,bottomOhm,vrefV:3.3,bits:12};},
      accept(output){return{passed:output.adcInputV>0&&output.adcInputV<3.3,target:"ADC input < 3.3 V",measured:output.adcInputV,unit:"V"};}
    },
    "inverter.lab.inv-shoot": {
      kind:"state-invariant",referenceId:"invariant-half-bridge-shoot-through",
      check(snapshot){const q1=/on/i.test(observedText(snapshot,"status-q1")),q2=/on/i.test(observedText(snapshot,"status-q2")),warning=/直通|shoot/i.test(observedText(snapshot,"short-circuit-warning"))&&!observedHidden(snapshot,"short-circuit-warning");return{passed:q1&&q2&&warning,expected:"Q1=ON + Q2=ON => shoot-through warning visible",observed:{q1,q2,warning}};}
    },
    "foc.lab.foc-park": {
      kind:"page-reference",referenceId:"ref-foc-park",compareFields:[{field:"vd",abs:.015},{field:"vq",abs:.015}],
      build(snapshot){const c=snapshot&&snapshot.controls||{},delta=firstNumber(c,["p-d"]);return Number.isFinite(delta)?{deltaDegrees:delta,magnitude:.8}:null;},
      observe(snapshot){return{vd:parseNumber(observedText(snapshot,"r-vd")),vq:parseNumber(observedText(snapshot,"r-vq")),frame:observedText(snapshot,"r-fp")};},
      accept(output,input,snapshot,production){return{passed:/θ|theta/i.test(text(production.frame)),target:"locked dq frame matches analytic Park target",measured:production};}
    },
    "pi.lab.pi-ki": {
      kind:"page-reference",referenceId:"ref-pi-integrator",compareFields:[{field:"f0Hz",rel:.002,abs:1}],
      build(snapshot){const ki=firstNumber(snapshot&&snapshot.controls||{},["ki-slider"]);return Number.isFinite(ki)?{ki}:null;},
      observe(snapshot){return{f0Hz:parseFrequencyHz(observedText(snapshot,"f0-val"))};},
      accept(){return{passed:true,target:"f0 = Ki/(2π)"};}
    },
    "spi.lab.spi-fifo": {
      kind:"page-reference",referenceId:"ref-spi-fifo",compareFields:[{field:"TaNs",abs:1.1},{field:"TsNs",abs:1.1}],
      build(snapshot){const c=snapshot&&snapshot.controls||{};return{scenario:text(c.scenario||"isr1"),sclkMHz:firstNumber(c,["sclk"]),bits:firstNumber(c,["bits"]),gapUs:firstNumber(c,["gap"])||0,isrOverheadNs:firstNumber(c,["isrOv"])||0};},
      observe(snapshot){return{TaNs:parseNumber(observedText(snapshot,"mTa")),TsNs:parseNumber(observedText(snapshot,"mTs"))};},
      accept(){return{passed:true,target:"displayed Ta/Ts agree with independent service-rate calculation"};}
    },
    "loop10us.lab.loop-budget": {
      kind:"page-reference",referenceId:"ref-loop-budget",compareFields:[{field:"criticalNs",abs:1.1},{field:"marginNs",abs:1.1}],
      build(snapshot){const c=snapshot&&snapshot.controls||{},acqNs=firstNumber(c,["acq"]),cpuNs=firstNumber(c,["cpu"]),payloadBytes=firstNumber(c,["pay"]);return[acqNs,cpuNs,payloadBytes].every(Number.isFinite)?{acqNs,cpuNs,payloadBytes}:null;},
      observe(snapshot){return{criticalNs:parseNumber(observedText(snapshot,"s-crit")),marginNs:parseNumber(observedText(snapshot,"s-margin"))};},
      accept(output){return{passed:!output.corrupted&&!output.timeout&&output.marginNs>=0,target:"ADC valid and critical path <= 10us",measured:output.marginNs,unit:"ns"};}
    },
    "bms.lab.bms-failsafe": {
      kind:"state-invariant",referenceId:"invariant-bms-failsafe",
      check(snapshot){const interaction=snapshot&&snapshot.interaction||{},fault=interaction.dataset&&interaction.dataset.fault,state=observedText(snapshot,"system-state"),contactor=observedText(snapshot,"contactor");const locked=/fault_lock|fault lock/i.test(state),open=/open|斷開/i.test(contactor);return{passed:!!fault&&locked&&open,expected:"injected fault => FAULT_LOCK and contactor OPEN",observed:{fault,state,contactor}};}
    },
    "ad5543.lab.dac-code": {
      kind:"page-reference",referenceId:"ref-ad5543-code",compareFields:[{field:"code",abs:0}],
      build(snapshot){const c=snapshot&&snapshot.controls||{},targetV=firstNumber(c,["want"]),vrefV=firstNumber(c,["cvref"]),mode=text(c.cmode||"standard");return[targetV,vrefV].every(Number.isFinite)?{targetV,vrefV,mode}:null;},
      observe(snapshot){const out=observedText(snapshot,"calcOut"),match=out.match(/D\s*=\s*(\d+)/i);return{code:match?Number(match[1]):null};},
      accept(output){return{passed:output.reachable,target:"displayed 16-bit code matches independent VREF ratio mapping",measured:output.code,unit:"code"};}
    },
    "afe.lab.afe-phase": {
      kind:"page-reference",referenceId:"ref-ac-phase-power",compareFields:[{field:"pf",abs:.0015}],
      build(snapshot){const phaseDeg=firstNumber(snapshot&&snapshot.controls||{},["ps-phase"]);return Number.isFinite(phaseDeg)?{phaseDeg,vrms:1,irms:1}:null;},
      observe(snapshot){return{pf:parseNumber(observedText(snapshot,"ps-pf"))};},
      accept(){return{passed:true,target:"PF = cos(phase)"};}
    },
    "acmc-pro.lab.acmc-protection": {
      kind:"page-reference",referenceId:"ref-acmc-trip",compareFields:[{field:"peakA",abs:.06},{field:"reason"}],
      build(snapshot){const c=snapshot&&snapshot.controls||{},loadW=firstNumber(c,["ctrl-load","load"]),ocpA=firstNumber(c,["ctrl-ocp","ocp"]),offsetV=firstNumber(c,["ctrl-offset","offset"]);return[loadW,ocpA,offsetV].every(Number.isFinite)?{loadW,ocpA,offsetV}:null;},
      observe(snapshot){return{peakA:parseNumber(metricText(snapshot,"估計峰值電流")),reason:(metricText(snapshot,"保護原因").match(/\b(OCP|READY)\b|DC\s*SAT/i)||[])[0]||null};},
      accept(output){return{passed:output.trip,target:"independently reproduce published teaching OCP/DC-SAT rule",measured:output.reason,scope:"220Vrms PF=1 resistive teaching estimate; not hardware certification"};}
    },
    "c2000-dds.lab.dds-pf": {
      kind:"page-reference",referenceId:"ref-ac-phase-power",compareFields:[{field:"pf",abs:.0015},{field:"watts",abs:.7}],
      build(snapshot){const c=snapshot&&snapshot.controls||{},phaseDeg=firstNumber(c,["ctrl-phase","phase"]),vrms=firstNumber(c,["ctrl-vrms","vrms"]),irms=firstNumber(c,["ctrl-irms","irms"]);return[phaseDeg,vrms,irms].every(Number.isFinite)?{phaseDeg,vrms,irms}:null;},
      observe(snapshot){return{pf:parseNumber(metricText(snapshot,"Total PF")),watts:parseNumber(metricText(snapshot,"實功 P"))};},
      accept(){return{passed:true,target:"P=Vrms·Irms·cos(phi) and PF=cos(phi) for sinusoidal signals"};}
    }
  };

  function compareOutputs(definition,production,reference){
    const failures=[];(definition.compareFields||[]).forEach(spec=>{const cfg=typeof spec==="string"?{field:spec}:spec,field=cfg.field,a=production&&production[field],b=reference&&reference[field];if(typeof a==="string"||typeof b==="string"){if(text(a).trim().toUpperCase()!==text(b).trim().toUpperCase())failures.push({field,production:a,reference:b});}else if(!nearlyEqual(a,b,cfg.rel==null?1e-6:cfg.rel,cfg.abs==null?1e-9:cfg.abs))failures.push({field,production:a,reference:b});});return{passed:failures.length===0,failures};
  }

  function verify(labId,snapshot,registry){
    const definition=definitions[labId];if(!definition)return{supported:false,passed:false,reason:"no-independent-oracle"};
    try{
      if(definition.kind==="state-invariant"){
        const result=definition.check(snapshot||{}),agreement={passed:!!result.passed,failures:result.passed?[]:[{field:"state-invariant",production:result.observed,reference:result.expected}]};
        return{supported:true,passed:!!result.passed,independentValidated:!!result.passed,oracleVersion:ORACLE_VERSION,model:{id:"page-state:"+labId,version:"dom-v1"},production:{id:"page-state:"+labId,version:"dom-v1",outputs:result.observed},reference:{id:definition.referenceId,version:REFERENCE_VERSION,outputs:{expected:result.expected}},inputs:{interaction:snapshot&&snapshot.interaction||null},outputs:result.observed,agreement,acceptance:{passed:!!result.passed,target:result.expected,measured:result.observed}};
      }
      const reference=references[definition.referenceId],input=definition.build(snapshot||{});if(!reference||!input)return{supported:false,passed:false,reason:"insufficient-input-or-reference"};
      const referenceOutput=reference.calculate(input);
      if(definition.kind==="page-reference"){
        const productionOutput=definition.observe(snapshot||{}),agreement=compareOutputs(definition,productionOutput,referenceOutput),acceptance=definition.accept?definition.accept(referenceOutput,input,snapshot,productionOutput):{passed:true};
        return{supported:true,passed:agreement.passed&&!!acceptance.passed,independentValidated:agreement.passed,oracleVersion:ORACLE_VERSION,model:{id:"page-output:"+labId,version:"dom-v1"},production:{id:"page-output:"+labId,version:"dom-v1",outputs:productionOutput},reference:{id:reference.id,version:reference.version,outputs:referenceOutput},inputs:input,outputs:referenceOutput,agreement,acceptance};
      }
      if(!registry||typeof registry.get!=="function"||typeof registry.run!=="function")return{supported:false,passed:false,reason:"model-registry-unavailable"};
      const card=registry.get(definition.modelId);if(!card)return{supported:false,passed:false,reason:"production-model-unavailable"};
      const productionOutput=registry.run(definition.modelId,input),agreement=compareOutputs(definition,productionOutput,referenceOutput),acceptance=definition.accept(referenceOutput,input,snapshot,productionOutput);
      return{supported:true,passed:!!acceptance.passed&&agreement.passed,independentValidated:agreement.passed,oracleVersion:ORACLE_VERSION,model:{id:card.id,version:card.version},production:{id:card.id,version:card.version,outputs:productionOutput},reference:{id:reference.id,version:reference.version,outputs:referenceOutput},inputs:input,outputs:referenceOutput,agreement,acceptance};
    }catch(error){return{supported:true,passed:false,independentValidated:false,oracleVersion:ORACLE_VERSION,model:{id:"verification:"+labId,version:"v3"},reference:{id:definition.referenceId||"unknown",version:REFERENCE_VERSION},reason:error.message};}
  }

  function browserBridge(api){
    if(typeof document==="undefined"||typeof window==="undefined")return;
    let timer=null,lastInteraction=null;
    const currentPath=()=>decodeURIComponent(location.pathname).replace(/\\/g,"/").replace(/^\/+/,"").toLowerCase();
    function snapshot(){
      const controls={};document.querySelectorAll("input,select,textarea").forEach(el=>{if(el.closest(".clt-root")||el.type==="hidden"||el.type==="file")return;const key=el.id||el.name||el.getAttribute("aria-label");if(key)controls[key]=el.type==="checkbox"||el.type==="radio"?!!el.checked:el.value;});
      const observed={};let count=0;document.querySelectorAll("[id]").forEach(el=>{if(count>=100||el.closest(".clt-root")||/^(SCRIPT|STYLE|CANVAS|SVG)$/i.test(el.tagName))return;const t=text(el.textContent).replace(/\s+/g," ").trim();if(!t||t.length>360)return;const hidden=!!el.hidden||el.classList.contains("hidden")||(el.style&&el.style.display==="none");observed[el.id]={text:t,hidden};count++;});
      const metrics=[];document.querySelectorAll(".metric,.ms-metric,[data-metric],.status,.ms-status,.reading,.state-pill,.verdict,.result-card,.readout").forEach(el=>{if(el.closest(".clt-root"))return;const t=text(el.textContent).replace(/\s+/g," ").trim();if(t&&!metrics.includes(t))metrics.push(t.slice(0,300));});
      return{path:currentPath(),controls,observed,metrics:metrics.slice(0,40),interaction:lastInteraction};
    }
    function labsHere(){const Schema=window.CircuitSchema,raw=window.CircuitCurriculum;if(!Schema||!raw)return[];const curriculum=Schema.normalizeCurriculum(raw),path=currentPath();return curriculum.modules.flatMap(m=>m.labs||[]).filter(l=>path.endsWith(text(l.href).replace(/\\/g,"/").toLowerCase())&&api.supports(l.id));}
    function capture(){clearTimeout(timer);timer=setTimeout(()=>{const Evidence=window.CircuitEvidence,Registry=window.CircuitModelRegistry;if(!Evidence)return;const snap=snapshot();labsHere().forEach(lab=>{const result=api.verify(lab.id,snap,Registry);Evidence.recordMachine(lab.id,"independent-oracle-v7",snap,result&&result.supported?result:null);});},220);}
    document.addEventListener("input",e=>{if(!e.target.closest||!e.target.closest(".clt-root"))capture();},true);
    document.addEventListener("change",e=>{if(!e.target.closest||!e.target.closest(".clt-root"))capture();},true);
    document.addEventListener("click",e=>{if(!e.target.closest||e.target.closest(".clt-root"))return;const target=e.target.closest("button,[data-sw],[data-fault],[data-preset]");if(!target)return;lastInteraction={id:target.id||"",tag:target.tagName,dataset:{...target.dataset},text:text(target.textContent).replace(/\s+/g," ").trim().slice(0,160)};capture();},true);
  }

  const api={ORACLE_VERSION,REFERENCE_VERSION,definitions,references,supports:labId=>!!definitions[labId],verify,_reference:{buckRipple:referenceBuck,divider:referenceDivider,park:referencePark,integrator:referenceIntegrator,spiFifo:referenceSpiFifo,loopBudget:referenceLoop,dacCode:referenceDac,phasePower:referencePhasePower,acmcTrip:referenceAcmcTrip,nearlyEqual}};
  browserBridge(api);
  return api;
});