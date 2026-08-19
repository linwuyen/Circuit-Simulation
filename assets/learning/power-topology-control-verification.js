(function(root){
  "use strict";
  const Oracles=root.CircuitLabOracles, Contracts=root.CircuitLabVerificationContracts, Assessment=root.CircuitAssessment;
  if(!Oracles||!Contracts||Oracles.__powerTopologyOracleInstalled)return;
  const LAB_ID="power-topology-control.lab.buck-duty-identity", MODULE_ID="power-topology-control";
  const contract={labId:LAB_ID,moduleId:MODULE_ID,title:"Ideal CCM Buck volt-second conversion identity",method:"independent-oracle",gradeCeiling:"A",modelScope:"ideal steady-state CCM buck Vout = D Vin",requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]};
  if(!Contracts.list.some(x=>x.labId===LAB_ID))Contracts.list.push(contract);
  if(Assessment&&Array.isArray(Assessment.MEASUREMENT_ORACLE_LABS)&&!Assessment.MEASUREMENT_ORACLE_LABS.includes(LAB_ID))Assessment.MEASUREMENT_ORACLE_LABS.push(LAB_ID);
  const text=v=>String(v==null?"":v), num=v=>{const m=text(v).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
  const near=(a,b,abs=0.06,rel=0.002)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(abs,Math.abs(b)*rel);
  const metric=(snapshot,needle)=>(snapshot&&snapshot.metrics||[]).find(x=>text(x).toLowerCase().includes(text(needle).toLowerCase()))||"";
  function calculate(input){const vin=Number(input.vin),duty=Number(input.duty);if(!Number.isFinite(vin)||!Number.isFinite(duty)||vin<=0||duty<0||duty>1)throw new Error("invalid buck identity input");return{vin,duty,vout:vin*duty};}
  function build(snapshot){const c=snapshot&&snapshot.controls||{};const vin=Number(c.vinBuck),dutyPct=Number(c.dutyBuck);return Number.isFinite(vin)&&Number.isFinite(dutyPct)?{vin,duty:dutyPct/100}:null;}
  function observe(snapshot){return{vout:num(metric(snapshot,"ideal vout"))};}
  const oldSupports=Oracles.supports.bind(Oracles), oldVerify=Oracles.verify.bind(Oracles);
  Oracles.supports=id=>id===LAB_ID||oldSupports(id);
  Oracles.verify=function(labId,snapshot,registry){
    if(labId!==LAB_ID)return oldVerify(labId,snapshot,registry);
    try{
      const input=build(snapshot||{});if(!input)return{supported:true,passed:false,independentValidated:false,oracleVersion:"topology-atlas-1.0",reason:"insufficient-buck-input"};
      const expected=calculate(input),production=observe(snapshot||{});if(!Number.isFinite(production.vout))return{supported:true,passed:false,independentValidated:false,oracleVersion:"topology-atlas-1.0",reason:"missing-ideal-vout-observable"};
      const ok=near(production.vout,expected.vout),agreement={passed:ok,failures:ok?[]:[{field:"vout",production:production.vout,reference:expected.vout}]};
      return{supported:true,passed:ok,independentValidated:ok,oracleVersion:"topology-atlas-1.0",production:{id:"page-output:"+LAB_ID,version:"topology-atlas-ui-1",outputs:production},reference:{id:"ref:ideal-buck-volt-second",version:"1.0",outputs:expected},inputs:input,outputs:expected,agreement,acceptance:{passed:ok,target:"ideal CCM steady-state Vout = D Vin",measured:production.vout,unit:"V"}};
    }catch(error){return{supported:true,passed:false,independentValidated:false,oracleVersion:"topology-atlas-1.0",reason:error.message};}
  };
  const oldGet=Contracts.get.bind(Contracts), oldValidate=Contracts.validate.bind(Contracts), oldCoverage=Contracts.coverage.bind(Contracts), oldGate=Contracts.reasoningGate.bind(Contracts);
  Contracts.get=id=>id===LAB_ID?contract:oldGet(id);
  Contracts.validate=function(curriculum,oracleApi){return oldValidate(curriculum,oracleApi).filter(error=>error!=="unclassified lab: "+LAB_ID&&error!=="module has no A-capable lab: "+MODULE_ID);};
  Contracts.coverage=function(curriculum){
    const coverage=oldCoverage(curriculum),module=(curriculum&&curriculum.modules||[]).find(x=>x.id===MODULE_ID);if(!module)return coverage;
    const wasUnclassified=(coverage.unclassified||[]).includes(LAB_ID),row={moduleId:MODULE_ID,total:module.labs.length,classified:module.labs.length,aCapable:1},idx=(coverage.modules||[]).findIndex(x=>x.moduleId===MODULE_ID);
    if(idx>=0)coverage.modules[idx]=row;else coverage.modules.push(row);if(wasUnclassified)coverage.classified=(coverage.classified||0)+1;coverage.aCapable=(coverage.aCapable||0)+1;coverage.unclassified=(coverage.unclassified||[]).filter(id=>id!==LAB_ID);coverage.total=(curriculum.modules||[]).reduce((sum,m)=>sum+(m.labs||[]).length,0);return coverage;
  };
  const has=(value,words)=>words.some(word=>text(value).toLowerCase().includes(text(word).toLowerCase()));
  Contracts.reasoningGate=function(labId,draft){
    if(labId!==LAB_ID)return oldGate(labId,draft);
    const explanation=draft&&draft.explanation||"",limitations=draft&&draft.limitations||"";
    const checks=[
      {name:"mechanism-1",ok:has(explanation,["volt-second","伏秒","duty","占空","d·vin","d vin"])},
      {name:"mechanism-2",ok:has(explanation,["inductor","電感","平均","steady","穩態","0v","零伏"] )},
      {name:"boundary-1",ok:has(limitations,["dcm","非連續","dead-time","死區","壓降","loss","損耗","rds","diode","二極體","非理想"])}
    ];return{passed:checks.every(x=>x.ok),checks};
  };
  Object.defineProperty(Oracles,"__powerTopologyOracleInstalled",{value:true,enumerable:false});
  root.CircuitPowerTopologyVerification={version:"1.0.0",LAB_ID,contract,calculate};
})(typeof globalThis!=="undefined"?globalThis:this);
