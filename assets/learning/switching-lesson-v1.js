(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CircuitSwitchingLessonV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Display-only projection of samples recorded inside the existing power kernel.
 // Never recompute the plant, voltage balance, switch timing, or protection state.
 function snapshot(result,index){
  const rows=result?.waveform;
  if(!Array.isArray(rows)||!rows.length)return null;
  const i=Math.max(0,Math.min(rows.length-1,Math.trunc(Number(index)||0)));
  const x=rows[i];
  if(!Number.isFinite(x.phaseUs)||!Number.isFinite(x.iL)||!Number.isFinite(x.vOut))return null;
  const phase=x.gate?'on':x.iL>1e-6?'freewheel':'idle';
  const label=phase==='on'?'開關 ON：輸入經開關、電感送往輸出':phase==='freewheel'?'開關 OFF：電感經二極體續流':'開關 OFF：電感電流已到零（簡化 DCM 區段）';
  const explanation=phase==='on'?'輸入端供電，電感電流斜率由當下電感電壓決定。':phase==='freewheel'?'電感電流不能瞬間歸零；二極體形成續流路徑，電感逐漸釋放能量。':'電流已降到零，二極體不再維持續流；此模型沒有提供完整 DCM 開關節點電壓。';
  const showSlope=phase!=='idle'&&Number.isFinite(x.vL)&&Number.isFinite(x.diDtAperS);
  return Object.freeze({index:i,count:rows.length,phase,phaseUs:x.phaseUs,currentA:x.iL,outputV:x.vOut,inductorV:showSlope?x.vL:null,slopeAperMs:showSlope?x.diDtAperS/1000:null,label,explanation,source:'既有 generic-power-causal-kernel 同一輪的 microstep；不是實測示波器波形'});
 }
 return Object.freeze({snapshot});
});
