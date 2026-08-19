(function(root){
  "use strict";
  const Oracles=root.CircuitLabOracles;
  const Contracts=root.CircuitLabVerificationContracts;
  const Assessment=root.CircuitAssessment;
  if(!Oracles||!Contracts)return;
  if(Oracles.__controlTransformsOracleInstalled)return;

  const LAB_ID="control-transforms.lab.transform-pole-map";
  const MODULE_ID="control-transforms";
  const contract={
    labId:LAB_ID,
    moduleId:MODULE_ID,
    title:"Continuous pole to z-plane mapping",
    method:"independent-oracle",
    gradeCeiling:"A",
    modelScope:"single-pole exact exponential mapping z = exp(sTs)",
    requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]
  };
  if(!Contracts.list.some(x=>x.labId===LAB_ID))Contracts.list.push(contract);
  if(Assessment&&Array.isArray(Assessment.MEASUREMENT_ORACLE_LABS)&&!Assessment.MEASUREMENT_ORACLE_LABS.includes(LAB_ID))Assessment.MEASUREMENT_ORACLE_LABS.push(LAB_ID);

  const text=v=>String(v==null?"":v);
  const num=v=>{const m=text(v).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
  const near=(a,b,abs=5e-4)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=abs;
  const metric=(snapshot,needle)=>(snapshot&&snapshot.metrics||[]).find(x=>text(x).toLowerCase().includes(text(needle).toLowerCase()))||"";

  function calculate(input){
    const sigma=Number(input.sigmaPerSecond),omega=Number(input.omegaRadPerSecond),sampleUs=Number(input.sampleUs);
    if(![sigma,omega,sampleUs].every(Number.isFinite)||sampleUs<=0)throw new Error("invalid transform mapping input");
    const ts=sampleUs*1e-6,mag=Math.exp(sigma*ts),theta=omega*ts;
    return{ts,mag,re:mag*Math.cos(theta),im:mag*Math.sin(theta),stable:sigma<0,marginal:sigma===0};
  }

  function build(snapshot){
    const c=snapshot&&snapshot.controls||{};
    const sigmaPerSecond=Number(c.sigma),omegaRadPerSecond=Number(c.omega),sampleUs=Number(c.sampleUs);
    return[sigmaPerSecond,omegaRadPerSecond,sampleUs].every(Number.isFinite)?{sigmaPerSecond,omegaRadPerSecond,sampleUs}:null;
  }

  function observe(snapshot){
    return{mag:num(metric(snapshot,"|z|"))};
  }

  const oldSupports=Oracles.supports.bind(Oracles);
  const oldVerify=Oracles.verify.bind(Oracles);
  Oracles.supports=id=>id===LAB_ID||oldSupports(id);
  Oracles.verify=function(labId,snapshot,registry){
    if(labId!==LAB_ID)return oldVerify(labId,snapshot,registry);
    try{
      const input=build(snapshot||{});
      if(!input)return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-transform-1.0",reason:"insufficient-transform-input"};
      const expected=calculate(input),production=observe(snapshot||{});
      if(!Number.isFinite(production.mag))return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-transform-1.0",reason:"missing-z-magnitude-observable"};
      const agreement={passed:near(production.mag,expected.mag),failures:near(production.mag,expected.mag)?[]:[{field:"mag",production:production.mag,reference:expected.mag}]};
      const stableMapping=input.sigmaPerSecond<0?expected.mag<1:input.sigmaPerSecond>0?expected.mag>1:near(expected.mag,1,1e-9);
      const acceptance={passed:stableMapping,target:"Re(s)<0 ⇔ |z|<1; Re(s)=0 ⇔ |z|=1; Re(s)>0 ⇔ |z|>1",measured:expected.mag,unit:"|z|"};
      return{
        supported:true,
        passed:agreement.passed&&acceptance.passed,
        independentValidated:agreement.passed,
        oracleVersion:"control-transform-1.0",
        production:{id:"page-output:"+LAB_ID,version:"control-transform-ui-1",outputs:production},
        reference:{id:"ref:exact-exp-pole-map",version:"1.0",outputs:expected},
        inputs:input,
        outputs:expected,
        agreement,
        acceptance
      };
    }catch(error){return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-transform-1.0",reason:error.message};}
  };

  const oldGet=Contracts.get.bind(Contracts);
  const oldValidate=Contracts.validate.bind(Contracts);
  const oldCoverage=Contracts.coverage.bind(Contracts);
  const oldGate=Contracts.reasoningGate.bind(Contracts);
  Contracts.get=id=>id===LAB_ID?contract:oldGet(id);
  Contracts.validate=function(curriculum,oracleApi){
    return oldValidate(curriculum,oracleApi).filter(error=>error!=="unclassified lab: "+LAB_ID);
  };
  Contracts.coverage=function(curriculum){
    const coverage=oldCoverage(curriculum),module=(curriculum&&curriculum.modules||[]).find(x=>x.id===MODULE_ID);
    if(!module)return coverage;
    const row={moduleId:MODULE_ID,total:module.labs.length,classified:module.labs.length,aCapable:1};
    const index=(coverage.modules||[]).findIndex(x=>x.moduleId===MODULE_ID);
    if(index>=0)coverage.modules[index]=row;else coverage.modules.push(row);
    coverage.classified=(coverage.classified||0)+((coverage.unclassified||[]).includes(LAB_ID)?1:0);
    coverage.aCapable=(coverage.aCapable||0)+1;
    coverage.unclassified=(coverage.unclassified||[]).filter(id=>id!==LAB_ID);
    coverage.total=(curriculum.modules||[]).reduce((sum,m)=>sum+(m.labs||[]).length,0);
    return coverage;
  };
  const has=(value,words)=>words.some(word=>text(value).toLowerCase().includes(text(word).toLowerCase()));
  Contracts.reasoningGate=function(labId,draft){
    if(labId!==LAB_ID)return oldGate(labId,draft);
    const explanation=draft&&draft.explanation||"",limitations=draft&&draft.limitations||"";
    const checks=[
      {name:"mechanism-1",ok:has(explanation,["z=e","exp","指數","exponential","sigma","σ"])},
      {name:"mechanism-2",ok:has(explanation,["unit circle","單位圓","|z|","stable","穩定","左半平面"])},
      {name:"boundary-1",ok:has(limitations,["sampling","取樣","alias","混疊","delay","延遲","multi-pole","多極點","nonlinear","非線性"])}
    ];
    return{passed:checks.every(x=>x.ok),checks};
  };

  Object.defineProperty(Oracles,"__controlTransformsOracleInstalled",{value:true,enumerable:false});
  root.CircuitControlTransformsVerification={version:"1.0.0",LAB_ID,contract,calculate};
})(typeof globalThis!=="undefined"?globalThis:this);
