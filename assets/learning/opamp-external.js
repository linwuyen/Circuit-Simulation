(function(root){
  "use strict";
  const Anchors=root.CircuitExternalAnchorsV8,Mutation=root.CircuitMutationV8,Oracles=root.CircuitLabOracles,Registry=root.CircuitModelRegistry;
  if(!Anchors)throw new Error("OP AMP external validity requires CircuitExternalAnchorsV8");
  if(Anchors.__opampAnchorInstalled)return;
  const anchor={id:"anchor-opamp-slew",moduleId:"opamp",kind:"published-equation",source:"TI Precision Labs — Op Amps: Slew rate introduction; cross-check ADI AN-1026",url:"https://www.ti.com/video/4078676441001",scope:"large-signal sine maximum slope; SRrequired=2πfVpk, independent of small-signal GBW",vector:{vpp:10,frequencyKHz:100},expected:{requiredSrVPerUs:3.141592653589793},tolerance:.001};
  const initialErrors=Anchors.validate(),baseAnchors=Anchors.anchors.slice(),baseGet=Anchors.get.bind(Anchors),baseEvaluate=Anchors.evaluate.bind(Anchors),baseCalculate=Anchors.calculate.bind(Anchors);
  function calculate(){const vpk=anchor.vector.vpp/2;return{requiredSrVPerUs:2*Math.PI*anchor.vector.frequencyKHz*1e3*vpk/1e6};}
  function evaluate(){const actual=calculate(),relative=Math.abs(actual.requiredSrVPerUs-anchor.expected.requiredSrVPerUs)/anchor.expected.requiredSrVPerUs;return{anchorId:anchor.id,moduleId:anchor.moduleId,passed:relative<=anchor.tolerance,kind:anchor.kind,scope:anchor.scope,source:anchor.source,url:anchor.url,vector:anchor.vector,expected:anchor.expected,actual,failures:relative<=anchor.tolerance?[]:[{field:"requiredSrVPerUs",actual:actual.requiredSrVPerUs,expected:anchor.expected.requiredSrVPerUs}]};}
  Anchors.anchors.push(anchor);
  Anchors.get=id=>id===anchor.id?anchor:baseGet(id);
  Anchors.calculate=a=>(a&&a.id===anchor.id)?calculate():baseCalculate(a);
  Anchors.evaluate=id=>id===anchor.id?evaluate():baseEvaluate(id);
  Anchors.summary=function(){const results=baseAnchors.map(a=>baseEvaluate(a.id)).concat(evaluate());return{version:"8+opamp",total:results.length,passed:results.filter(x=>x.passed).length,modules:new Set(results.map(x=>x.moduleId)).size,results};};
  Anchors.validate=function(){const errors=initialErrors.slice(),r=evaluate();if(!/^https:\/\//.test(anchor.url))errors.push("anchor URL missing "+anchor.id);if(!anchor.scope)errors.push("anchor scope missing "+anchor.id);if(!r.passed)errors.push("anchor vector failed "+anchor.id);const mods=new Set(Anchors.summary().results.map(x=>x.moduleId));if(mods.size<13)errors.push("external anchors do not cover all 13 modules");return errors;};

  if(Mutation&&Oracles){
    const baseRun=Mutation.run.bind(Mutation),baseCases=typeof Mutation.baseCases==="function"?Mutation.baseCases.bind(Mutation):()=>[];
    const opCase=()=>({id:"mutation-opamp-missing-2pi",labId:"opamp.lab.opamp-sine",snapshot:{controls:{"op-freq":"100","op-vpp":"10","op-sr-plus":"4.0840704497","op-sr-minus":"4.0840704497","op-gbw":"20","op-gain":"1"},observed:{"op-required-sr":{text:"0.500 V/µs",hidden:false},"op-fpbw":{text:"130.0 kHz",hidden:false},"op-margin":{text:"1.30",hidden:false},"op-state":{text:"SAFE / not limited",hidden:false}},metrics:[]}});
    Mutation.baseCases=()=>baseCases().concat(opCase());
    Mutation.run=function(oracles,registry){const base=baseRun(oracles,registry),c=opCase(),result=oracles.verify(c.labId,c.snapshot,registry),extra={id:c.id,labId:c.labId,detected:!(result&&result.passed),result},results=(base.results||[]).concat(extra),detected=results.filter(x=>x.detected).length;return{version:"8+opamp",total:results.length,detected,rate:results.length?detected/results.length:0,results};};
  }
  Object.defineProperty(Anchors,"__opampAnchorInstalled",{value:true,enumerable:false});
  root.CircuitOpampExternal={version:"1.0.0",anchor,evaluate};
})(typeof globalThis!=="undefined"?globalThis:this);
