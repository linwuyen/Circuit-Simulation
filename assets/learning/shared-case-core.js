(function(root,factory){const B=root.CircuitTrainingExperiments||(typeof require==='function'?require('../training-experiments-core.js'):null),G=root.CircuitGuidedLayerModelsV1||(typeof require==='function'?require('./guided-layer-models-v1.js'):null);const api=factory(B,G);if(typeof module==='object'&&module.exports)module.exports=api;root.CircuitSharedCase=api;})(globalThis,function(B,G){
 'use strict';
 function views(input={},control={}){
  const physical=B.buck(input),c=physical.config;
  const kp=control.kp===undefined?.3:Number(control.kp),ki=control.ki===undefined?100:Number(control.ki),delayUs=control.delayUs===undefined?10:Number(control.delayUs);
  if(!Number.isFinite(kp)||kp<0||kp>1||!Number.isFinite(ki)||ki<0||ki>500||!Number.isFinite(delayUs)||delayUs<0||delayUs>100)throw new Error('控制參數超出範圍');
  const modelValid=physical.regime==='CCM'&&c.esrOhm===0&&physical.validSmallRipple;
  const sensing=G.sensingSample({physicalV:physical.vout,rippleVpp:physical.vRipple,phaseDeg:0,divider:.05});
  const periodUs=1000/c.fswKhz,readyUs=delayUs,commitUs=(Math.floor(readyUs/periodUs)+1)*periodUs;
  const frequency=modelValid?Array.from({length:160},(_,i)=>{const frequencyHz=10*Math.pow((c.fswKhz*1000*.2)/10,i/159);return {frequencyHz,...G.dynamicsAt({vin:c.vin,L:c.inductanceUh*1e-6,C:c.capacitanceUf*1e-6,loadOhm:c.loadOhm,frequencyHz,delayS:commitUs*1e-6})};}):[];
  // A separate averaged closed-loop lens at the same operating point; it does not model PWM delay.
  const transient=modelValid?G.feedbackResponse({vin:c.vin,referenceV:physical.vout,initialV:physical.vout*.8,loadOhm:c.loadOhm,L:c.inductanceUh*1e-6,C:c.capacitanceUf*1e-6,kp,ki,dt:Math.min(periodUs*1e-6,Math.sqrt(c.inductanceUh*1e-6*c.capacitanceUf*1e-6)/30),durationS:.006}):null;
  const finiteTransient=transient&&transient.points.every(p=>Number.isFinite(p.voutV)&&Number.isFinite(p.iLA));
  return {physical,sensing,periodUs,readyUs,commitUs,frequency,transient:finiteTransient?transient:null,modelValid,control:{kp,ki,delayUs},boundary:modelValid?'頻率圖是同工作點的開環功率級加純延遲，不含 PI，不能當成閉環相位裕度。閉環時間圖沿用雙環平均模型，不包含這裡的更新等待；兩者不可直接疊合。':'目前進入 DCM、非零 ESR 或超出小漣波條件；此處的 CCM 平均閉環與頻率視圖停用。穩態電路與量測仍可觀察。'};
 }
 return {views};
});
