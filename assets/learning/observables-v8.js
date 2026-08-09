(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTypedObservables=api;
  if(root.CircuitLabOracles)api.install(root.CircuitLabOracles);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="1.0.0";
  const text=v=>String(v==null?"":v).replace(/\s+/g," ").trim();
  const num=v=>{const m=text(v).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
  const freqHz=v=>{const n=num(v);if(!Number.isFinite(n))return null;return /mhz/i.test(text(v))?n*1e6:/khz/i.test(text(v))?n*1e3:n;};
  const rawControl=(raw,id)=>raw&&raw.controls?raw.controls[id]:undefined;
  const rawObserved=(raw,id)=>{const v=raw&&raw.observed&&raw.observed[id];return v&&typeof v==="object"?text(v.text):text(v);};
  const rawHidden=(raw,id)=>{const v=raw&&raw.observed&&raw.observed[id];return !!(v&&typeof v==="object"&&v.hidden);};
  const rawMetric=(raw,label)=>((raw&&raw.metrics)||[]).find(x=>text(x).toLowerCase().includes(text(label).toLowerCase()))||"";
  const docValue=(doc,id)=>{const el=doc&&doc.getElementById(id);if(!el)return undefined;return el.type==="checkbox"||el.type==="radio"?!!el.checked:el.value;};
  const docText=(doc,id)=>{const el=doc&&doc.getElementById(id);return el?text(el.textContent):"";};
  const docHidden=(doc,id)=>{const el=doc&&doc.getElementById(id);return !el||!!el.hidden||el.classList.contains("hidden")||(el.style&&el.style.display==="none");};
  const findMetric=(doc,label)=>{if(!doc)return"";const nodes=doc.querySelectorAll(".metric,.ms-metric,[data-metric],.status,.ms-status,.reading,.state-pill,.verdict,.result-card,.readout");for(const el of nodes){const t=text(el.textContent);if(t.toLowerCase().includes(text(label).toLowerCase()))return t;}return"";};
  const get=(doc,raw,id)=>doc?docValue(doc,id):rawControl(raw,id);
  const getText=(doc,raw,id)=>doc?docText(doc,id):rawObserved(raw,id);
  const getHidden=(doc,raw,id)=>doc?docHidden(doc,id):rawHidden(raw,id);
  const metric=(doc,raw,label)=>doc?findMetric(doc,label):rawMetric(raw,label);

  const adapters={
    "buck.lab.buck-ripple":(doc,raw)=>({inputs:{inductanceUh:Number(get(doc,raw,"ind")),switchingKHz:Number(get(doc,raw,"fsw")),outputCurrentA:Number(get(doc,raw,"load"))},outputs:{},state:{}}),
    "adc.lab.adc-divider":(doc,raw)=>({inputs:{rTopKOhm:Number(get(doc,raw,"rtop")),rBottomKOhm:Number(get(doc,raw,"rbot")),busV:Number(get(doc,raw,"bus2"))},outputs:{},state:{}}),
    "inverter.lab.inv-shoot":(doc,raw)=>({inputs:{},outputs:{},state:{q1On:/on/i.test(getText(doc,raw,"status-q1")),q2On:/on/i.test(getText(doc,raw,"status-q2")),warningVisible:/直通|shoot/i.test(getText(doc,raw,"short-circuit-warning"))&&!getHidden(doc,raw,"short-circuit-warning")}}),
    "foc.lab.foc-park":(doc,raw)=>({inputs:{deltaDeg:Number(get(doc,raw,"p-d"))},outputs:{vd:num(getText(doc,raw,"r-vd")),vq:num(getText(doc,raw,"r-vq")),frame:getText(doc,raw,"r-fp")},state:{}}),
    "pi.lab.pi-ki":(doc,raw)=>({inputs:{ki:Number(get(doc,raw,"ki-slider"))},outputs:{f0Hz:freqHz(getText(doc,raw,"f0-val"))},state:{}}),
    "spi.lab.spi-fifo":(doc,raw)=>({inputs:{scenario:text(get(doc,raw,"scenario")||"isr1"),sclkMHz:Number(get(doc,raw,"sclk")),bits:Number(get(doc,raw,"bits")),gapUs:Number(get(doc,raw,"gap")||0),isrOverheadNs:Number(get(doc,raw,"isrOv")||0)},outputs:{arrivalNs:num(getText(doc,raw,"mTa")),serviceNs:num(getText(doc,raw,"mTs"))},state:{}}),
    "loop10us.lab.loop-budget":(doc,raw)=>({inputs:{acqNs:Number(get(doc,raw,"acq")),cpuNs:Number(get(doc,raw,"cpu")),payloadBytes:Number(get(doc,raw,"pay"))},outputs:{criticalNs:num(getText(doc,raw,"s-crit")),marginNs:num(getText(doc,raw,"s-margin"))},state:{}}),
    "bms.lab.bms-failsafe":(doc,raw)=>({inputs:{},outputs:{},state:{system:getText(doc,raw,"system-state"),contactor:getText(doc,raw,"contactor"),fault:raw&&raw.interaction&&raw.interaction.dataset&&raw.interaction.dataset.fault||null}}),
    "ad5543.lab.dac-code":(doc,raw)=>({inputs:{targetV:Number(get(doc,raw,"want")),vrefV:Number(get(doc,raw,"cvref")),mode:text(get(doc,raw,"cmode")||"standard")},outputs:{code:(()=>{const m=getText(doc,raw,"calcOut").match(/D\s*=\s*(\d+)/i);return m?Number(m[1]):null;})()},state:{}}),
    "afe.lab.afe-phase":(doc,raw)=>({inputs:{phaseDeg:Number(get(doc,raw,"ps-phase"))},outputs:{pf:num(getText(doc,raw,"ps-pf"))},state:{}}),
    "acmc-pro.lab.acmc-protection":(doc,raw)=>({inputs:{loadW:Number(get(doc,raw,"ctrl-load")??get(doc,raw,"load")),ocpA:Number(get(doc,raw,"ctrl-ocp")??get(doc,raw,"ocp")),offsetV:Number(get(doc,raw,"ctrl-offset")??get(doc,raw,"offset"))},outputs:{peakA:num(metric(doc,raw,"估計峰值電流")),reason:(metric(doc,raw,"保護原因").match(/\b(OCP|READY)\b|DC\s*SAT/i)||[])[0]||null},state:{}}),
    "c2000-dds.lab.dds-pf":(doc,raw)=>({inputs:{phaseDeg:Number(get(doc,raw,"ctrl-phase")??get(doc,raw,"phase")),vrms:Number(get(doc,raw,"ctrl-vrms")??get(doc,raw,"vrms")),irms:Number(get(doc,raw,"ctrl-irms")??get(doc,raw,"irms"))},outputs:{pf:num(metric(doc,raw,"Total PF")),watts:num(metric(doc,raw,"實功 P"))},state:{}})
  };

  function legacyFromTyped(labId,typed,raw){const t=typed||{inputs:{},outputs:{},state:{}},base={path:raw&&raw.path||"",controls:{},observed:{},metrics:[],interaction:raw&&raw.interaction||null,typed:{contract:"circuit-observables",version:VERSION,labId,...t}};const o=(id,value,hidden)=>{base.observed[id]={text:text(value),hidden:!!hidden};};switch(labId){case"buck.lab.buck-ripple":base.controls={ind:t.inputs.inductanceUh,fsw:t.inputs.switchingKHz,load:t.inputs.outputCurrentA};break;case"adc.lab.adc-divider":base.controls={rtop:t.inputs.rTopKOhm,rbot:t.inputs.rBottomKOhm,bus2:t.inputs.busV};break;case"inverter.lab.inv-shoot":o("status-q1",t.state.q1On?"ON":"OFF");o("status-q2",t.state.q2On?"ON":"OFF");o("short-circuit-warning",t.state.warningVisible?"shoot-through 直通":"",!t.state.warningVisible);break;case"foc.lab.foc-park":base.controls={"p-d":t.inputs.deltaDeg};o("r-vd",t.outputs.vd);o("r-vq",t.outputs.vq);o("r-fp",t.outputs.frame);break;case"pi.lab.pi-ki":base.controls={"ki-slider":t.inputs.ki};o("f0-val",`${t.outputs.f0Hz} Hz`);break;case"spi.lab.spi-fifo":base.controls={scenario:t.inputs.scenario,sclk:t.inputs.sclkMHz,bits:t.inputs.bits,gap:t.inputs.gapUs,isrOv:t.inputs.isrOverheadNs};o("mTa",`${t.outputs.arrivalNs} ns`);o("mTs",`${t.outputs.serviceNs} ns`);break;case"loop10us.lab.loop-budget":base.controls={acq:t.inputs.acqNs,cpu:t.inputs.cpuNs,pay:t.inputs.payloadBytes};o("s-crit",`${t.outputs.criticalNs} ns`);o("s-margin",`${t.outputs.marginNs} ns`);break;case"bms.lab.bms-failsafe":o("system-state",t.state.system);o("contactor",t.state.contactor);base.interaction=base.interaction||{dataset:{fault:t.state.fault}};break;case"ad5543.lab.dac-code":base.controls={want:t.inputs.targetV,cvref:t.inputs.vrefV,cmode:t.inputs.mode};o("calcOut",`D = ${t.outputs.code}`);break;case"afe.lab.afe-phase":base.controls={"ps-phase":t.inputs.phaseDeg};o("ps-pf",t.outputs.pf);break;case"acmc-pro.lab.acmc-protection":base.controls={"ctrl-load":t.inputs.loadW,"ctrl-ocp":t.inputs.ocpA,"ctrl-offset":t.inputs.offsetV};base.metrics=[`估計峰值電流 ${t.outputs.peakA} A`,`保護原因 ${t.outputs.reason}`];break;case"c2000-dds.lab.dds-pf":base.controls={"ctrl-phase":t.inputs.phaseDeg,"ctrl-vrms":t.inputs.vrms,"ctrl-irms":t.inputs.irms};base.metrics=[`Total PF ${t.outputs.pf}`,`實功 P ${t.outputs.watts} W`];break;}return base;}
  function capture(labId,doc,raw){const adapter=adapters[labId];if(!adapter)return null;const typed=adapter(doc||null,raw||{});return{contract:"circuit-observables",version:VERSION,labId,...typed};}
  function normalizeSnapshot(labId,raw,doc){const typed=capture(labId,doc,raw);return typed?legacyFromTyped(labId,typed,raw||{}):raw;}
  function install(Oracles){if(!Oracles||Oracles.__typedObservablesInstalled)return Oracles;const baseVerify=Oracles.verify.bind(Oracles);Oracles.verify=function(labId,snapshot,registry){let normalized=snapshot;try{const liveDocument=typeof document!=="undefined"?document:null;normalized=normalizeSnapshot(labId,snapshot,liveDocument);}catch(_){normalized=snapshot;}const result=baseVerify(labId,normalized,registry);if(result&&result.supported&&normalized&&normalized.typed)result.observableContract={version:VERSION,labId,typed:normalized.typed};return result;};Object.defineProperty(Oracles,"__typedObservablesInstalled",{value:true,enumerable:false});return Oracles;}
  return{VERSION,adapters,capture,normalizeSnapshot,install};
});
