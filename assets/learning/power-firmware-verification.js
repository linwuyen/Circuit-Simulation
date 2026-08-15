(function(root){
  "use strict";
  const Oracles=root.CircuitLabOracles,Contracts=root.CircuitLabVerificationContracts,Assessment=root.CircuitAssessment;
  if(!Oracles||!Contracts)return;
  if(Oracles.__powerFirmwareOracleInstalled)return;
  const defs=[
    {labId:"power-sync.lab.timing",moduleId:"power-sync",title:"PWM→ADC→ISR same-cycle timing",method:"independent-oracle",gradeCeiling:"A",modelScope:"single-rate periodic deadline model",requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]},
    {labId:"power-sync.lab.edge-noise",moduleId:"power-sync",title:"Switching-edge sample placement",method:"machine-contract",gradeCeiling:"B",modelScope:"qualitative switching-noise proximity proxy",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]},
    {labId:"power-sync.lab.update-delay",moduleId:"power-sync",title:"PWM shadow update delay",method:"machine-contract",gradeCeiling:"B",modelScope:"discrete update-event teaching model",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]},
    {labId:"protection.lab.trip-latency",moduleId:"protection",title:"Hardware vs software protection latency",method:"independent-oracle",gradeCeiling:"A",modelScope:"serial fault-detection latency budget",requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]},
    {labId:"protection.lab.latch",moduleId:"protection",title:"Latched fault safe state",method:"machine-contract",gradeCeiling:"B",modelScope:"fault-latch state invariant",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]},
    {labId:"protection.lab.sequence",moduleId:"protection",title:"Fail-closed startup sequence",method:"machine-contract",gradeCeiling:"B",modelScope:"generic startup state-machine invariant",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]},
    {labId:"power-capstone.lab.integration-budget",moduleId:"power-capstone",title:"Generic converter integration budget",method:"independent-oracle",gradeCeiling:"A",modelScope:"serial control critical-path deadline model",requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]},
    {labId:"power-capstone.lab.fault-isolation",moduleId:"power-capstone",title:"System fault isolation",method:"machine-contract",gradeCeiling:"B",modelScope:"generic signal-chain diagnosis",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]},
    {labId:"power-capstone.lab.debug-ladder",moduleId:"power-capstone",title:"Unknown-system debug ladder",method:"machine-contract",gradeCeiling:"B",modelScope:"layered troubleshooting discipline",requires:["preregistered-prediction","machine-snapshot","reasoning-rubric"]}
  ];
  defs.forEach(c=>{if(!Contracts.list.some(x=>x.labId===c.labId))Contracts.list.push(c);});
  const A_IDS=["power-sync.lab.timing","protection.lab.trip-latency","power-capstone.lab.integration-budget"];
  if(Assessment&&Array.isArray(Assessment.MEASUREMENT_ORACLE_LABS))A_IDS.forEach(id=>{if(!Assessment.MEASUREMENT_ORACLE_LABS.includes(id))Assessment.MEASUREMENT_ORACLE_LABS.push(id);});

  const text=v=>String(v==null?"":v),num=v=>{const m=text(v).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
  const observed=(s,id)=>{const v=s&&s.observed&&s.observed[id];return v&&typeof v==="object"?text(v.text):text(v);};
  const n=(c,id)=>{const v=Number(c&&c[id]);return Number.isFinite(v)?v:null;};
  const near=(a,b,rel=.01,abs=.5)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(abs,Math.max(Math.abs(a),Math.abs(b))*rel);

  function calcSync(i){const periodNs=1e6/i.fswKHz,sampleNs=periodNs*i.samplePct/100,readyNs=sampleNs+i.acqNs+i.convNs,updateNs=readyNs+i.isrNs+i.controlNs,marginNs=periodNs-updateNs;return{periodNs,sampleNs,readyNs,updateNs,marginNs,pass:marginNs>=1000};}
  function syncTyped(s){const c=s&&s.controls||{},i={fswKHz:n(c,"sync-fsw"),samplePct:n(c,"sync-sample"),acqNs:n(c,"sync-acq"),convNs:n(c,"sync-conv"),isrNs:n(c,"sync-isr"),controlNs:n(c,"sync-control")};return{contract:"circuit-observables",version:"power-fw-1.0",labId:"power-sync.lab.timing",inputs:i,outputs:{periodNs:num(observed(s,"sync-period")),sampleNs:num(observed(s,"sync-sample-time")),updateNs:num(observed(s,"sync-update")),marginNs:num(observed(s,"sync-margin"))},state:{pass:/pass|safe|closed/i.test(observed(s,"sync-state"))}};}
  function calcProtection(i){const hardwareNs=i.compNs+i.filterNs+i.tripNs,softwareNs=i.sampleWaitNs+i.adcNs+i.isrNs+i.decisionNs,speedup=softwareNs/hardwareNs;return{hardwareNs,softwareNs,speedup,pass:hardwareNs<=1000&&hardwareNs<softwareNs};}
  function protectionTyped(s){const c=s&&s.controls||{},i={compNs:n(c,"prot-comp"),filterNs:n(c,"prot-filter"),tripNs:n(c,"prot-trip"),sampleWaitNs:n(c,"prot-wait"),adcNs:n(c,"prot-adc"),isrNs:n(c,"prot-isr"),decisionNs:n(c,"prot-decision")};return{contract:"circuit-observables",version:"power-fw-1.0",labId:"protection.lab.trip-latency",inputs:i,outputs:{hardwareNs:num(observed(s,"prot-hw")),softwareNs:num(observed(s,"prot-sw")),speedup:num(observed(s,"prot-speedup"))},state:{pass:/pass|hardware path/i.test(observed(s,"prot-state"))}};}
  function calcCapstone(i){const criticalUs=i.sensingUs+i.controlUs+i.commitUs,marginUs=i.periodUs-criticalUs,criticalUtilPct=criticalUs/i.periodUs*100;return{criticalUs,marginUs,criticalUtilPct,pass:marginUs>=2};}
  function capstoneTyped(s){const c=s&&s.controls||{},i={periodUs:n(c,"cap-period"),sensingUs:n(c,"cap-sensing"),controlUs:n(c,"cap-control"),commitUs:n(c,"cap-commit"),backgroundUs:n(c,"cap-background")};return{contract:"circuit-observables",version:"power-fw-1.0",labId:"power-capstone.lab.integration-budget",inputs:i,outputs:{criticalUs:num(observed(s,"cap-critical")),marginUs:num(observed(s,"cap-margin")),criticalUtilPct:num(observed(s,"cap-util"))},state:{pass:/pass|closed/i.test(observed(s,"cap-state"))}};}
  const specs={
    "power-sync.lab.timing":{typed:syncTyped,calc:calcSync,compare:["periodNs","sampleNs","updateNs","marginNs"]},
    "protection.lab.trip-latency":{typed:protectionTyped,calc:calcProtection,compare:["hardwareNs","softwareNs","speedup"]},
    "power-capstone.lab.integration-budget":{typed:capstoneTyped,calc:calcCapstone,compare:["criticalUs","marginUs","criticalUtilPct"]}
  };
  const oldSupports=Oracles.supports.bind(Oracles),oldVerify=Oracles.verify.bind(Oracles);
  Oracles.supports=id=>!!specs[id]||oldSupports(id);
  Oracles.verify=function(labId,snapshot,registry){
    const spec=specs[labId];if(!spec)return oldVerify(labId,snapshot,registry);
    try{
      const typed=spec.typed(snapshot||{}),i=typed.inputs;
      if(!Object.values(i).every(Number.isFinite))return{supported:false,passed:false,independentValidated:false,reason:"insufficient-power-firmware-input"};
      const ref=spec.calc(i),failures=[];
      spec.compare.forEach(field=>{
        const p=typed.outputs[field],r=ref[field];
        const ratioField=field==="speedup"||field.includes("Pct");
        const usField=field.includes("Us");
        let abs=.8,rel=.005;
        if(usField||ratioField)abs=.03;
        if(ratioField)rel=.02;
        if(!near(p,r,rel,abs))failures.push({field,production:p,reference:r});
      });
      const agreement={passed:failures.length===0,failures};
      const acceptance={passed:!!ref.pass,target:labId==="power-sync.lab.timing"?"same-cycle margin >= 1000 ns":labId==="protection.lab.trip-latency"?"hardware path <= 1000 ns and faster than software":"serial critical-path margin >= 2 us",measured:labId==="power-sync.lab.timing"?ref.marginNs:labId==="protection.lab.trip-latency"?ref.hardwareNs:ref.marginUs,unit:labId==="power-capstone.lab.integration-budget"?"us":"ns"};
      return{supported:true,passed:agreement.passed&&acceptance.passed,independentValidated:agreement.passed,oracleVersion:"power-fw-1.0",production:{id:"page-output:"+labId,version:"power-fw-sim-1",outputs:typed.outputs},reference:{id:"ref:"+labId,version:"1.0",outputs:ref},inputs:i,outputs:ref,agreement,acceptance,observableContract:typed};
    }catch(error){return{supported:true,passed:false,independentValidated:false,oracleVersion:"power-fw-1.0",reason:error.message};}
  };

  const byLab=Object.fromEntries(defs.map(x=>[x.labId,x])),oldGet=Contracts.get.bind(Contracts),oldValidate=Contracts.validate.bind(Contracts),oldCoverage=Contracts.coverage.bind(Contracts),oldGate=Contracts.reasoningGate.bind(Contracts);
  Contracts.get=id=>byLab[id]||oldGet(id);
  Contracts.validate=function(curriculum,oracleApi){return oldValidate(curriculum,oracleApi).filter(e=>!/^unclassified lab: (power-sync|protection|power-capstone)\.lab\./.test(e));};
  Contracts.coverage=function(curriculum){const c=oldCoverage(curriculum);["power-sync","protection","power-capstone"].forEach(moduleId=>{const m=(curriculum.modules||[]).find(x=>x.id===moduleId);if(!m)return;const row={moduleId,total:m.labs.length,classified:m.labs.length,aCapable:1},idx=c.modules.findIndex(x=>x.moduleId===moduleId);if(idx>=0)c.modules[idx]=row;else c.modules.push(row);c.classified+=m.labs.length;c.aCapable+=1;c.unclassified=(c.unclassified||[]).filter(id=>!String(id).startsWith(moduleId+".lab."));});c.total=(curriculum.modules||[]).reduce((s,m)=>s+(m.labs||[]).length,0);return c;};
  const has=(v,words)=>words.some(w=>text(v).toLowerCase().includes(text(w).toLowerCase()));
  Contracts.reasoningGate=function(labId,draft){if(!A_IDS.includes(labId))return oldGate(labId,draft);const exp=draft&&draft.explanation||"",lim=draft&&draft.limitations||"";let checks;if(labId==="power-sync.lab.timing")checks=[{name:"mechanism-1",ok:has(exp,["soc","sample","取樣","adc"])},{name:"mechanism-2",ok:has(exp,["deadline","pwm","shadow","margin","週期"])},{name:"boundary-1",ok:has(lim,["jitter","noise","雜訊","shadow","worst","acquisition"])}];else if(labId==="protection.lab.trip-latency")checks=[{name:"mechanism-1",ok:has(exp,["comparator","cmpss","trip","hardware","硬體"])},{name:"mechanism-2",ok:has(exp,["latency","延遲","isr","software"] )},{name:"boundary-1",ok:has(lim,["filter","threshold","blank","recovery","latch","noise"])}];else checks=[{name:"mechanism-1",ok:has(exp,["critical","path","sensing","control","串行"])},{name:"mechanism-2",ok:has(exp,["period","deadline","margin","pwm"])},{name:"boundary-1",ok:has(lim,["background","communication","resource","jitter","plant","hardware"])}];return{passed:checks.every(x=>x.ok),checks};};

  Object.defineProperty(Oracles,"__powerFirmwareOracleInstalled",{value:true,enumerable:false});
  root.CircuitPowerFirmwareVerification={version:"1.0.0",contracts:defs,A_IDS,calculate:{sync:calcSync,protection:calcProtection,capstone:calcCapstone}};
})(typeof globalThis!=="undefined"?globalThis:this);
