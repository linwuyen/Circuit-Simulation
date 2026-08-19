(function(root){
  "use strict";
  const Oracles=root.CircuitLabOracles;
  const Contracts=root.CircuitLabVerificationContracts;
  const Assessment=root.CircuitAssessment;
  if(!Oracles||!Contracts)return;
  if(Oracles.__controlUnificationOracleInstalled)return;

  const LAB_ID="control-unification.lab.unified-delay-budget";
  const MODULE_ID="control-unification";
  const contract={
    labId:LAB_ID,
    moduleId:MODULE_ID,
    title:"Pure-delay phase cost at crossover",
    method:"independent-oracle",
    gradeCeiling:"A",
    modelScope:"pure time delay contribution phi_delay = -360 * fc * Td at crossover",
    requires:["preregistered-prediction","machine-snapshot","independent-oracle","reasoning-gate"]
  };

  if(!Contracts.list.some(x=>x.labId===LAB_ID))Contracts.list.push(contract);
  if(Assessment&&Array.isArray(Assessment.MEASUREMENT_ORACLE_LABS)&&!Assessment.MEASUREMENT_ORACLE_LABS.includes(LAB_ID))Assessment.MEASUREMENT_ORACLE_LABS.push(LAB_ID);

  const text=v=>String(v==null?"":v);
  const num=v=>{
    const m=text(v).replace(/−/g,"-").match(/[-+]?\d+(?:\.\d+)?/);
    return m?Number(m[0]):null;
  };
  const near=(a,b,abs=.15)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=abs;
  const metric=(snapshot,needle)=>(snapshot&&snapshot.metrics||[]).find(x=>text(x).toLowerCase().includes(text(needle).toLowerCase()))||"";

  function calculate(input){
    const fcHz=Number(input.fcHz),delayUs=Number(input.delayUs),basePmDeg=Number(input.basePmDeg);
    if(![fcHz,delayUs,basePmDeg].every(Number.isFinite)||fcHz<=0||delayUs<0)throw new Error("invalid delay budget input");
    const phaseLossDeg=-360*fcHz*delayUs*1e-6;
    return{phaseLossDeg,estimatedPmDeg:basePmDeg+phaseLossDeg,cycleFraction:fcHz*delayUs*1e-6};
  }

  function build(snapshot){
    const c=snapshot&&snapshot.controls||{};
    const fcHz=Number(c.fc),delayUs=Number(c.delayUs),basePmDeg=Number(c.basePm);
    return[fcHz,delayUs,basePmDeg].every(Number.isFinite)?{fcHz,delayUs,basePmDeg}:null;
  }

  function observe(snapshot){
    return{
      phaseLossDeg:num(metric(snapshot,"delay phase loss")),
      estimatedPmDeg:num(metric(snapshot,"estimated pm"))
    };
  }

  const oldSupports=Oracles.supports.bind(Oracles);
  const oldVerify=Oracles.verify.bind(Oracles);
  Oracles.supports=id=>id===LAB_ID||oldSupports(id);
  Oracles.verify=function(labId,snapshot,registry){
    if(labId!==LAB_ID)return oldVerify(labId,snapshot,registry);
    try{
      const input=build(snapshot||{});
      if(!input)return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-unification-1.0",reason:"insufficient-delay-input"};
      const expected=calculate(input),production=observe(snapshot||{});
      if(!Number.isFinite(production.phaseLossDeg)||!Number.isFinite(production.estimatedPmDeg)){
        return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-unification-1.0",reason:"missing-delay-observable"};
      }
      const failures=[];
      if(!near(production.phaseLossDeg,expected.phaseLossDeg))failures.push({field:"phaseLossDeg",production:production.phaseLossDeg,reference:expected.phaseLossDeg});
      if(!near(production.estimatedPmDeg,expected.estimatedPmDeg))failures.push({field:"estimatedPmDeg",production:production.estimatedPmDeg,reference:expected.estimatedPmDeg});
      const agreement={passed:failures.length===0,failures};
      const acceptance={
        passed:expected.phaseLossDeg<=0,
        target:"phi_delay = -360 * fc * Td; pure delay contributes non-positive phase lag for fc,Td >= 0",
        measured:expected.phaseLossDeg,
        unit:"deg"
      };
      return{
        supported:true,
        passed:agreement.passed&&acceptance.passed,
        independentValidated:agreement.passed,
        oracleVersion:"control-unification-1.0",
        production:{id:"page-output:"+LAB_ID,version:"control-unification-ui-1",outputs:production},
        reference:{id:"ref:pure-delay-phase",version:"1.0",outputs:expected},
        inputs:input,
        outputs:expected,
        agreement,
        acceptance
      };
    }catch(error){
      return{supported:true,passed:false,independentValidated:false,oracleVersion:"control-unification-1.0",reason:error.message};
    }
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
      {name:"mechanism-1",ok:has(explanation,["-360","360","phase","相位","角度","delay","延遲"])},
      {name:"mechanism-2",ok:has(explanation,["frequency","頻率","fc","crossover","交越","越高","更大"])},
      {name:"boundary-1",ok:has(limitations,["plant","pole","zero","filter","濾波","zoh","operating","工作點","nonlinear","非線性"])}
    ];
    return{passed:checks.every(x=>x.ok),checks};
  };

  Object.defineProperty(Oracles,"__controlUnificationOracleInstalled",{value:true,enumerable:false});
  root.CircuitControlUnificationVerification={version:"1.0.0",LAB_ID,contract,calculate};
})(typeof globalThis!=="undefined"?globalThis:this);
