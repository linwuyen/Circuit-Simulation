(()=>{
 'use strict';const $=id=>document.getElementById(id),U=CircuitUnifiedLearning,B=CircuitTrainingExperiments;
 let model=B.buckConfig(),control={kp:.3,ki:100,delayUs:10};
 function plot(id,rows,xlabel,ylabel,log=false){const svg=$(id);svg.replaceChildren();if(!rows.length)return;const ns='http://www.w3.org/2000/svg';const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n;};const transform=x=>log?Math.log10(x):x,loX=Math.min(...rows.map(r=>transform(r.x))),hiX=Math.max(...rows.map(r=>transform(r.x))),loY=Math.min(0,...rows.map(r=>r.y)),hiY=Math.max(1,...rows.map(r=>r.y))*1.05;node('path',{d:'M65 20V215H775',stroke:'#a0b4c7',fill:'none'});node('polyline',{points:rows.map(r=>`${65+(transform(r.x)-loX)/Math.max(1e-12,hiX-loX)*710},${215-(r.y-loY)/Math.max(1e-12,hiY-loY)*185}`).join(' '),fill:'none',stroke:'#6cddbb','stroke-width':3});node('text',{x:5,y:20},ylabel);node('text',{x:520,y:252},xlabel);node('text',{x:5,y:44},hiY.toFixed(1));node('text',{x:5,y:212},loY.toFixed(1));node('text',{x:65,y:235},rows[0].x.toFixed(1));node('text',{x:695,y:235},rows.at(-1).x.toFixed(1));}
 function render(){const v=CircuitSharedCase.views(model,control),p=v.physical;
  $('case-summary').textContent=`${p.regime} · 輸出 ${p.vout.toFixed(2)} V · 電流 ${p.avgI.toFixed(2)} A · 週期 ${v.periodUs.toFixed(2)} 微秒`;
  plot('case-physical',p.rows.map(r=>({x:r.tUs,y:r.iL})),'時間（微秒）','電流 A');
  const s=v.sensing;$('case-sensing').textContent=`真實輸出 ${p.vout.toFixed(3)} V → ADC 端 ${s.adcInputV.toFixed(3)} V → ${s.code} / ${s.maxCode} → 還原 ${s.reconstructedV.toFixed(3)} V。${s.clipped?'超出 ADC 範圍，發生削波！':'目前未削波。'}`;
  $('case-timing').textContent=`每 ${v.periodUs.toFixed(2)} 微秒更新；${v.readyUs.toFixed(2)} 微秒算完 → ${v.commitUs.toFixed(2)} 微秒套用。`;
  $('case-boundary').textContent=v.boundary;
  plot('case-transient',v.transient?v.transient.points.map(r=>({x:r.tS*1000,y:r.voutV})):[],'時間（毫秒）','電壓 V');
  plot('case-frequency',v.frequency.map(r=>({x:r.frequencyHz,y:r.magnitudeDb})),'頻率 Hz（對數）','幅度 dB',true);
  const probe=v.frequency.length?v.frequency.reduce((a,b)=>Math.abs(b.frequencyHz-1000)<Math.abs(a.frequencyHz-1000)?b:a):null;
  $('case-frequency-note').textContent=probe?`在 ${probe.frequencyHz.toFixed(0)} Hz：功率級相位 ${probe.plantPhaseDeg.toFixed(1)}°，更新等待的延遲相位 ${probe.delayPhaseDeg.toFixed(1)}°，合計 ${probe.totalPhaseDeg.toFixed(1)}°；這不是閉環相位裕度。`:'此工作點沒有可用的 CCM 頻率曲線。';
  $('case-code').textContent=`本頁雙環模型的控制步驟（示意，不是可燒錄韌體）：\n目標電壓 = ${p.vout.toFixed(3)} V\n電壓誤差 = 目標 − 回授電壓\n目標電流 = 限幅(${control.kp} × 電壓誤差 + 電壓積分，0..8 A)\n電壓積分依 Ki=${control.ki} 與模型時間步長累積，受反積分飽和條件限制\n電流誤差 = 目標電流 − 電感電流\n導通比例 = 限幅(目標電壓 / ${model.vin} + 0.02 × 電流誤差 + 電流積分，0..0.9)\n電流積分使用 Ki=500；硬體更新與保護需在主線另行驗證`;
 }
 function apply(){document.querySelectorAll('[data-case]').forEach(n=>n.value=model[n.dataset.case]);render();}
 document.querySelectorAll('[data-case],[data-control]').forEach(input=>input.addEventListener('change',()=>{try{if(!input.value.trim())throw new Error('請填寫完整數值');const nextModel=input.dataset.case?B.buckConfig({...model,[input.dataset.case]:Number(input.value)}):model;const nextControl=input.dataset.control?{...control,[input.dataset.control]:Number(input.value)}:control;CircuitSharedCase.views(nextModel,nextControl);model=nextModel;control=nextControl;render();$('case-storage').textContent='設定已更新所有視圖；跨頁前請保存共用設定。';}catch(e){$('case-storage').textContent=e.message;input.value=input.dataset.case?model[input.dataset.case]:control[input.dataset.control];}}));
 const tabs=[...document.querySelectorAll('[data-view]')];function activate(tab){tabs.forEach(b=>{b.setAttribute('aria-selected',String(b===tab));b.tabIndex=b===tab?0:-1;document.getElementById('view-'+b.dataset.view).hidden=b!==tab;});}
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>activate(b));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();activate(tabs[next]);tabs[next].focus();}});});activate(tabs[0]);
 $('case-save').onclick=()=>{U.saveScenario(model,'case');$('case-storage').textContent=CircuitEvidence.storageStatus().saved?'已保存，進階量測頁可預覽後套用。':'瀏覽器無法寫入，請從學習總覽下載備份。';};
 $('case-load-saved').onclick=()=>{try{model=U.validateScenario(U.read().scenarios?.['buck-steady-v1']).model;apply();$('case-storage').textContent='已套用同模型設定；目前控制器參數保持本頁設定。';}catch(e){$('case-storage').textContent=e.message;}};
 render();
})();
