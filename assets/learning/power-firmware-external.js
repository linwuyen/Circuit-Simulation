(function(root){
  "use strict";
  const Anchors=root.CircuitExternalAnchorsV8,Mutation=root.CircuitMutationV8,Oracles=root.CircuitLabOracles,Registry=root.CircuitModelRegistry;
  if(!Anchors)return;
  if(Anchors.__powerFirmwareAnchorsInstalled)return;
  const anchors=[
    {id:"anchor-power-sync-deadline",moduleId:"power-sync",kind:"published-peripheral-contract",source:"TI C2000 F2838x Driverlib — ePWM Event Trigger / ADC SOC",url:"https://software-dl.ti.com/C2000/docs/C2000_driverlib_api_guide/f2838x/build/html/modules/epwm.html",scope:"periodic ePWM event initiates ADC sampling; teaching vector checks same-cycle latency budget, not device-specific ADC cycle counts",vector:{fswKHz:100,samplePct:50,acqNs:200,convNs:350,isrNs:500,controlNs:1000},expected:{periodNs:10000,marginNs:2950},tolerance:.001},
    {id:"anchor-protection-trip",moduleId:"protection",kind:"published-safety-path-contract",source:"TI C2000 F2838x Driverlib — CMPSS comparator/filter/trip routing",url:"https://software-dl.ti.com/C2000/docs/C2000_driverlib_api_guide/f2838x/build/html/modules/cmpss.html",scope:"generic comparator/filter/trip latency chain versus ADC/ISR software path; values are teaching latencies, not hardware certification",vector:{compNs:80,filterNs:200,tripNs:120,sampleWaitNs:3000,adcNs:500,isrNs:800,decisionNs:700},expected:{hardwareNs:400,softwareNs:5000,speedup:12.5},tolerance:.001},
    {id:"anchor-capstone-budget",moduleId:"power-capstone",kind:"dimensional-deadline-law",source:"BIPM SI Brochure — second and hertz definitions; serial critical-path time must fit inside one period",url:"https://www.bipm.org/en/publications/si-brochure",scope:"generic deterministic periodic deadline arithmetic; does not claim a specific converter, MCU or safety certification",vector:{periodUs:10,sensingUs:1.2,controlUs:2.3,commitUs:.5},expected:{criticalUs:4,marginUs:6},tolerance:.001}
  ];
  const oldGet=Anchors.get.bind(Anchors),oldCalculate=Anchors.calculate.bind(Anchors),oldEvaluate=Anchors.evaluate.bind(Anchors),oldSummary=Anchors.summary.bind(Anchors),oldValidate=Anchors.validate.bind(Anchors);
  const byId=new Map(anchors.map(a=>[a.id,a]));
  function calculate(anchor){
    if(anchor.id==="anchor-power-sync-deadline"){const v=anchor.vector,periodNs=1e6/v.fswKHz,sampleNs=periodNs*v.samplePct/100,updateNs=sampleNs+v.acqNs+v.convNs+v.isrNs+v.controlNs;return{periodNs,marginNs:periodNs-updateNs};}
    if(anchor.id==="anchor-protection-trip"){const v=anchor.vector,hardwareNs=v.compNs+v.filterNs+v.tripNs,softwareNs=v.sampleWaitNs+v.adcNs+v.isrNs+v.decisionNs;return{hardwareNs,softwareNs,speedup:softwareNs/hardwareNs};}
    const v=anchor.vector,criticalUs=v.sensingUs+v.controlUs+v.commitUs;return{criticalUs,marginUs:v.periodUs-criticalUs};
  }
  function evaluateOne(anchor){const actual=calculate(anchor),failures=[];Object.keys(anchor.expected).forEach(field=>{const e=anchor.expected[field],a=actual[field],rel=e===0?Math.abs(a-e):Math.abs(a-e)/Math.abs(e);if(rel>anchor.tolerance)failures.push({field,actual:a,expected:e});});return{anchorId:anchor.id,moduleId:anchor.moduleId,passed:failures.length===0,kind:anchor.kind,scope:anchor.scope,source:anchor.source,url:anchor.url,vector:anchor.vector,expected:anchor.expected,actual,failures};}
  anchors.forEach(a=>Anchors.anchors.push(a));
  Anchors.get=id=>byId.get(id)||oldGet(id);
  Anchors.calculate=a=>a&&byId.has(a.id)?calculate(a):oldCalculate(a);
  Anchors.evaluate=id=>byId.has(id)?evaluateOne(byId.get(id)):oldEvaluate(id);
  Anchors.summary=function(){const base=oldSummary(),extra=anchors.map(evaluateOne),results=(base.results||[]).concat(extra);return{version:"8+opamp+power-fw",total:results.length,passed:results.filter(x=>x.passed).length,modules:new Set(results.map(x=>x.moduleId)).size,results};};
  Anchors.validate=function(){const errors=oldValidate().slice();anchors.forEach(a=>{if(!/^https:\/\//.test(a.url))errors.push("anchor URL missing "+a.id);if(!a.scope)errors.push("anchor scope missing "+a.id);if(!evaluateOne(a).passed)errors.push("anchor vector failed "+a.id);});const s=Anchors.summary();if(s.modules<16)errors.push("external anchors do not cover all 16 modules");return [...new Set(errors)];};

  if(Mutation&&Oracles){
    const oldRun=Mutation.run.bind(Mutation),oldBaseCases=typeof Mutation.baseCases==="function"?Mutation.baseCases.bind(Mutation):()=>[];
    const extraCases=()=>[
      {id:"mutation-power-sync-wrong-margin",labId:"power-sync.lab.timing",snapshot:{controls:{"sync-fsw":"100","sync-sample":"50","sync-acq":"200","sync-conv":"350","sync-isr":"500","sync-control":"1000"},observed:{"sync-period":{text:"10000 ns"},"sync-sample-time":{text:"5000 ns"},"sync-update":{text:"7050 ns"},"sync-margin":{text:"3950 ns"},"sync-state":{text:"PASS / timing closed"}},metrics:[]}},
      {id:"mutation-protection-missing-filter-latency",labId:"protection.lab.trip-latency",snapshot:{controls:{"prot-comp":"80","prot-filter":"200","prot-trip":"120","prot-wait":"3000","prot-adc":"500","prot-isr":"800","prot-decision":"700"},observed:{"prot-hw":{text:"200 ns"},"prot-sw":{text:"5000 ns"},"prot-speedup":{text:"25.0 x"},"prot-state":{text:"PASS / hardware path wins"}},metrics:[]}},
      {id:"mutation-capstone-margin-sign",labId:"power-capstone.lab.integration-budget",snapshot:{controls:{"cap-period":"10","cap-sensing":"1.2","cap-control":"2.3","cap-commit":"0.5","cap-background":"3"},observed:{"cap-critical":{text:"4.00 us"},"cap-margin":{text:"14.00 us"},"cap-util":{text:"40.0 %"},"cap-state":{text:"PASS / deadline closed"}},metrics:[]}}
    ];
    Mutation.baseCases=()=>oldBaseCases().concat(extraCases());
    Mutation.run=function(oracles,registry){const base=oldRun(oracles,registry),extras=extraCases().map(c=>{const result=oracles.verify(c.labId,c.snapshot,registry);return{id:c.id,labId:c.labId,detected:!(result&&result.passed),result};}),results=(base.results||[]).concat(extras),detected=results.filter(x=>x.detected).length;return{version:"8+opamp+power-fw",total:results.length,detected,rate:results.length?detected/results.length:0,results};};
  }
  Object.defineProperty(Anchors,"__powerFirmwareAnchorsInstalled",{value:true,enumerable:false});
  root.CircuitPowerFirmwareExternal={version:"1.0.0",anchors,calculate,evaluate:evaluateOne};
})(typeof globalThis!=="undefined"?globalThis:this);
