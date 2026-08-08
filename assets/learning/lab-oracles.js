(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitLabOracles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ORACLE_VERSION = "2.0.0";
  const REFERENCE_VERSION = "1.0.0";
  const number = (controls, key, scale) => {
    const value = Number(controls && controls[key]);
    return Number.isFinite(value) ? value * (scale == null ? 1 : scale) : null;
  };
  const nearlyEqual = (a, b, rel, abs) => {
    const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return x===y;
    const delta=Math.abs(x-y),scale=Math.max(Math.abs(x),Math.abs(y),1e-12);return delta<=(abs==null?1e-9:abs)||delta/scale<=(rel==null?1e-6:rel);
  };

  // Independent hand-derived references: these functions must never call CircuitModels/ModelRegistry.
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
  const references={
    "ref-buck-ripple-ccm":{id:"ref-buck-ripple-ccm",version:REFERENCE_VERSION,calculate:referenceBuck},
    "ref-adc-divider":{id:"ref-adc-divider",version:REFERENCE_VERSION,calculate:referenceDivider}
  };

  const definitions = {
    "buck.lab.buck-ripple": {
      modelId:"buck-ripple-ccm",referenceId:"ref-buck-ripple-ccm",compareFields:["duty","deltaIA","boundaryCurrentA"],
      build(snapshot){const c=snapshot&&snapshot.controls||{},inductanceH=number(c,"ind",1e-6),switchingHz=number(c,"fsw",1e3),outputCurrentA=number(c,"load",1);if(![inductanceH,switchingHz,outputCurrentA].every(Number.isFinite))return null;return{vin:12,vout:3.3,inductanceH,switchingHz,outputCurrentA};},
      accept(output,input){const ratio=input.outputCurrentA>0?output.deltaIA/input.outputCurrentA:Infinity;return{passed:output.mode==="CCM"&&Math.abs(ratio-0.20)<=0.02,target:"ΔI/Iout = 20% ±2% 且維持 CCM",measured:Number.isFinite(ratio)?ratio:null,unit:"ratio"};}
    },
    "adc.lab.adc-divider": {
      modelId:"adc-divider",referenceId:"ref-adc-divider",compareFields:["adcInputV","topPowerW","bottomPowerW","maxBusV"],
      build(snapshot){const c=snapshot&&snapshot.controls||{},topOhm=number(c,"rtop",1e3),bottomOhm=number(c,"rbot",1e3),busV=number(c,"bus2",1);if(![topOhm,bottomOhm,busV].every(Number.isFinite))return null;return{busV,topOhm,bottomOhm,vrefV:3.3,bits:12};},
      accept(output){return{passed:output.adcInputV>0&&output.adcInputV<3.3,target:"ADC input < 3.3 V",measured:output.adcInputV,unit:"V"};}
    }
  };

  function compareOutputs(definition,production,reference){const failures=[];(definition.compareFields||[]).forEach(field=>{const a=production&&production[field],b=reference&&reference[field];if(typeof a==="string"||typeof b==="string"){if(a!==b)failures.push({field,production:a,reference:b});}else if(!nearlyEqual(a,b,1e-6,1e-9))failures.push({field,production:a,reference:b});});return{passed:failures.length===0,failures};}

  function verify(labId,snapshot,registry){
    const definition=definitions[labId];if(!definition||!registry||typeof registry.get!=="function"||typeof registry.run!=="function")return{supported:false,passed:false,reason:"no-independent-oracle"};
    const card=registry.get(definition.modelId),reference=references[definition.referenceId],input=definition.build(snapshot);if(!card||!reference||!input)return{supported:false,passed:false,reason:"insufficient-input-or-reference"};
    try{
      const productionOutput=registry.run(definition.modelId,input),referenceOutput=reference.calculate(input),agreement=compareOutputs(definition,productionOutput,referenceOutput),acceptance=definition.accept(referenceOutput,input);
      return{supported:true,passed:!!acceptance.passed&&agreement.passed,independentValidated:agreement.passed,oracleVersion:ORACLE_VERSION,model:{id:card.id,version:card.version},production:{id:card.id,version:card.version,outputs:productionOutput},reference:{id:reference.id,version:reference.version,outputs:referenceOutput},inputs:input,outputs:referenceOutput,agreement,acceptance};
    }catch(error){return{supported:true,passed:false,independentValidated:false,oracleVersion:ORACLE_VERSION,model:card?{id:card.id,version:card.version}:null,reference:{id:reference.id,version:reference.version},reason:error.message};}
  }

  return{ORACLE_VERSION,REFERENCE_VERSION,definitions,references,supports:labId=>!!definitions[labId],verify,_reference:{buckRipple:referenceBuck,divider:referenceDivider,nearlyEqual}};
});