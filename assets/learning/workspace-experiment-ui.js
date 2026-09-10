/* Rendering adapter for CircuitWorkspace. Model: registry; facts: curriculum;
   proof gates: PlainCourse; persistence: Evidence V5; recommendations: UnifiedLearning. */
(()=>{
 'use strict';
 const W=CircuitWorkspace,P=CircuitPlainCourse,E=CircuitEvidence,U=CircuitUnifiedLearning;
 W.mountExperiment=()=>{
  const $=id=>document.getElementById(id),lessons=W.experimentLessons();
  const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;};
  const initial=E.load().benchmark.learningWorkspace?.experiment;
  let session=initial?.version===1?initial:{version:1,rows:{},history:[]},id,record,plan,before,after,prepared,shown;
  if(!session.rows||typeof session.rows!=='object'||Array.isArray(session.rows))session.rows={};
  session.history=Array.isArray(session.history)?session.history.filter(h=>h&&h.config&&h.summary&&Number.isFinite(h.summary.avgV)).slice(-32):[];
  U.registerModules(CircuitLearningMap);
  document.body.dataset.continuousExperiment='true';
  CircuitWorkbenchContext.mount($('workbench-context-slot'),new URL('.',location.href));
  for(const key of ['lesson-control','free-controls','concept-note','explore','back-to-lesson','ws-hint','ws-explanation','legacy-note'])$(key).hidden=true;
  $('ws-steps').setAttribute('aria-label','先猜、操作觀察、說原因、換條件');
  const run=el('button','', $('surface-help'));run.id='experiment-run';run.type='button';run.className='primary';
  const caption=el('p','每次從零電流、零電壓重跑相同時間（16 ms），比較單一改動。課程之間沿用設定；不是連續運轉的真板。',$('surface-help'));caption.className='experiment-boundary';
  const timeline=el('ol',undefined,$('surface-help'));timeline.id='experiment-events';timeline.className='experiment-events';
  const legacy=el('a','重看原有八課與作答',document.querySelector('footer'));legacy.href='index.html#duty';
  const lesson=()=>lessons.find(l=>l.id===id);
  const proven=key=>P.proven(session.rows[key]);
  const currentIndex=()=>lessons.findIndex(l=>l.id===id);
  function save(){
   session.rows[id]=record;session.currentLesson=id;session.completed=lessons.every(l=>proven(l.id));
   const state=E.load();state.benchmark.learningWorkspace={...(state.benchmark.learningWorkspace||{version:1,history:[]}),experiment:session};E.save(state);
   $('ws-save').textContent=E.storageStatus().saved?'電路條件、首次判斷與試驗紀錄已儲存。':'目前只能暫存，請下載學習備份。';progress();recommendation();
  }
  function retain(kind,result){session.history=[...session.history,{at:new Date().toISOString(),lesson:id,kind,modelId:'generic-power-causal-kernel',modelVersion:CircuitEngineeringSandboxCore.version,config:result.config,summary:result.summary}].slice(-32);}
  function choose(key){
   const index=lessons.findIndex(l=>l.id===key);if(index<0)return;
   if(lessons.slice(0,index).some(l=>!proven(l.id))){key=lessons.find(l=>!proven(l.id)).id;history.replaceState(null,'','#experiment-'+key);}
   id=key;record=session.rows[id]&&typeof session.rows[id]==='object'&&!Array.isArray(session.rows[id])?session.rows[id]:{};plan=W.experimentPlan(id);prepared=!lesson().prepare||record.prepared===true;shown=P.stage(record);
   before=W.experimentRun(prepared?plan.prepared:plan.before);after=record.operated?W.experimentRun(plan.after):null;
   $('setup-panel').hidden=prepared;
   $('setup-note').textContent=id==='feedback'?'目前量測倍率仍為 0.8。先修回 1，重跑確認讀值，再比較手動與自動控制。':'目前計算需要 11 µs。先修回 1.7 µs，再單獨比较修正強度；電路元件與負載保持原設定。';
   $('apply-setup').textContent='先修正這個條件，保留修正前紀錄';
   $('ws-title').textContent=lesson().title;$('ws-count').textContent=`連續實驗 ${currentIndex()+1} / ${lessons.length}`;$('ws-intro').textContent=lesson().intro;
   $('surface-title').textContent='同一台降壓電路：電能、讀值與命令一起看';
   $('scope-note').textContent='這是現有 generic-power-causal-kernel 的切換電路、量測、控制、更新時序與保護結果。模型目前未涵蓋完整元件損耗、熱、硬體校準；教學練習不代表正式能力認證或真板通過。';
   $('context-words').textContent='讀值＝控制器看見的量測數字；目標減讀值＝誤差；開關比例＝每輪允許送電的時間；累積修正＝把過去未消除的差距逐步加入調整。';
   session.currentConfig=record.operated?plan.after:prepared?plan.prepared:plan.before;
   save();render();
  }
  const fmt=n=>Number(n).toFixed(2);
  function plot(result,previous,view){
   const svg=$('ws-plot'),NS='http://www.w3.org/2000/svg';svg.replaceChildren();
   const node=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n;};
   let data;
   if(view==='current')data=[{r:result.waveform.map(x=>[x.phaseUs,x.iL]),color:'#12684d',label:'電感電流'}];
   else if(view==='signal')data=[{r:result.trace.map(x=>[x.tUs/1000,x.samplePhysicalV]),color:'#12684d',label:'實際電壓'},{r:result.trace.map(x=>[x.tUs/1000,x.sampledV]),color:'#956000',label:'控制器讀值',dash:'5 4'}];
   else data=[{r:previous.trace.map(x=>[x.tUs/1000,x.vOut]),color:'#6d7772',label:'改動前',dash:'5 4'},{r:result.trace.map(x=>[x.tUs/1000,x.vOut]),color:'#12684d',label:'改動後'}];
   const xmax=Math.max(...data.map(d=>d.r.at(-1)[0]),1),ymax=Math.max(1,...data.flatMap(d=>d.r.map(x=>x[1])))*1.1;
   node('path',{d:'M85 30V230H695',stroke:'#66756b',fill:'none'});
   for(let j=0;j<5;j++){const y=j*ymax/4;node('text',{x:77,y:234-200*j/4,'text-anchor':'end','font-size':15,fill:'#254036'},y.toFixed(1));}
   for(let j=0;j<5;j++)node('text',{x:85+j*610/4,y:253,'text-anchor':j===0?'start':j===4?'end':'middle','font-size':15,fill:'#254036'},(j*xmax/4).toFixed(1));
   data.forEach(d=>node('polyline',{points:d.r.filter((_,i)=>i%Math.max(1,Math.floor(d.r.length/420))===0).map(([x,y])=>`${85+x/xmax*610},${230-y/ymax*200}`).join(' '),fill:'none',stroke:d.color,'stroke-width':2.5,...(d.dash?{'stroke-dasharray':d.dash}:{})}));
   node('text',{x:85,y:24,'font-size':16,fill:'#254036'},view==='current'?'電感電流（A）':'電壓（V）');
   node('text',{x:690,y:276,'text-anchor':'end','font-size':16,fill:'#254036'},view==='current'?'一輪內的時間（µs）':'從啟動開始（ms）');
   svg.setAttribute('aria-label',view==='current'?'一輪內電流，包含開關關閉後的下降區段':'同一起點重跑的電壓比較曲線');
  }
  function draw(){
   const l=lesson(),transfer=shown===3||(shown===4&&record.transferPassed),masked=transfer&&!record.transferPassed;
   const trial=transfer?W.experimentTransfer(plan):null;
   const first=trial?W.experimentRun(trial.before):before,result=trial?W.experimentRun(trial.after):(after||before);
   $('transfer-preview').hidden=!transfer;$('transfer-preview').textContent='新條件：輸入由 48 V 換成 36 V，其餘改動相同。先預測，再揭曉；這份試驗不覆蓋主電路。';
   $('ws-voltage').textContent=masked?'先預測':fmt(result.summary.avgV)+' V';
   const tail=result.trace.slice(-320),avgI=tail.reduce((s,r)=>s+r.vOut/r.load,0)/tail.length;
   $('ws-current').textContent=masked?'先預測':fmt(avgI)+' A';
   $('ws-display-wrap').hidden=false;$('ws-display').textContent=masked?'先預測':fmt(result.trace.at(-1).sampledV)+' V';
   $('ws-voltage').parentNode.firstChild.textContent='最後一段平均輸出';$('ws-current').parentNode.firstChild.textContent='最後一段平均負載電流';$('ws-display-wrap').firstChild.textContent='最後一次電壓讀值';
   $('ws-plot').toggleAttribute('hidden',masked);if(!masked)plot(result,first,l.view);
   $('on-path').style.display='none';$('off-path').style.display=!masked&&l.view==='current'?'':'none';
   $('switch').setAttribute('d','M140 70L200 45');
   $('circuit-state').textContent=masked?'新條件尚未揭曉。':`輸入 ${result.config.vin} V · 電感 ${result.config.inductanceUh} µH · 電容 ${result.config.capacitanceUf} µF · 負載 ${result.config.loadProfile[0].ohm} Ω · ${result.config.controlMode==='manual'?'固定開關比例':'依量測自動調整'} · ${result.summary.tripSeen?'保護已鎖定':'允許運作'}`;
   $('ws-comparison').textContent=masked?'請根據剛才的因果關係判斷，不先查看新條件的答案。':l.view==='current'?'綠線来自同一次模擬內的一輪；開關關閉後，電流仍為正，並逐步下降。':`平均輸出 ${fmt(first.summary.avgV)} → ${fmt(result.summary.avgV)} V；最高輸出 ${fmt(first.summary.peakV)} → ${fmt(result.summary.peakV)} V。${l.view==='signal'?'綠線是真實量，黃虛線是讀值。':'灰虛線是改動前，綠線是改動後。'}`;
   timeline.replaceChildren();timeline.hidden=masked||!['deadline','protection'].includes(id);
   if(!timeline.hidden){const types=id==='deadline'?['ADC_SOC','CONTROL_DONE','PWM_COMMIT_MISSED','PWM_SHADOW_LOAD']:['TRIP_DETECT','TRIP_ACTUATE'];const names={ADC_SOC:'開始量測',CONTROL_DONE:'計算完成',PWM_COMMIT_MISSED:'寫入已晚於這輪更新點',PWM_SHADOW_LOAD:'命令真正載入開關',TRIP_DETECT:'偵測過流',TRIP_ACTUATE:'保護禁止開關'};for(const type of types){const e=result.events.find(e=>e.type===type);el('li',e?`${names[type]}：${fmt(e.tUs)} µs${e.sourceCycle!==undefined?'（來自第 '+e.sourceCycle+' 輪）':''}`:names[type]+'：這次未發生',timeline);}}
  }
  function render(){
   const l=lesson(),stage=P.stage(record);document.body.dataset.workspaceStage=String(shown);
   $('ws-question').replaceChildren();$('ws-steps').replaceChildren();$('ws-feedback').textContent='';
   ['先猜','操作／觀察','說原因','換條件'].forEach((name,i)=>{const b=el('button',`${i+1}. ${name}`,$('ws-steps'));b.disabled=!prepared||i>stage;b.setAttribute('aria-current',shown===i?'step':'false');b.onclick=()=>{shown=i;render();};});
   run.hidden=shown!==1;run.disabled=!prepared;run.textContent=record.operated?'再重跑一次，對照相同改動':l.action;
   $('answer-observation').hidden=shown!==1||!record.operated;$('answer-observation').onclick=()=>$('ws-question h2')?.focus();
   $('ws-result').hidden=stage!==4; $('ws-ability').textContent='已完成這個模型條件下的觀察、原因與新條件練習。';
   $('ws-transition').textContent=currentIndex()<7?'下一個問題會沿用這份電路設定。':'八個實驗完成。接著到原有工程主線與獨立驗證檢查理解；這裡的練習不代替正式測驗。';
   $('ws-next').textContent=currentIndex()<7?'沿用電路，進入下一個問題':'帶著紀錄進入工程主線';
   draw();if(shown===4)return;
   const heading=el('h2',['先記下你的預測','跑過電路後，你看到了什麼？','哪個原因符合結果？','換成 36 V，還能判斷嗎？'][shown],$('ws-question'));heading.tabIndex=-1;
   el('p',shown===2?'對照真實電壓、讀值、命令與事件，選出能解釋剛才結果的原因。':l.question,$('ws-question'));
   let choices=shown===2?[['reason',l.reason],['other',l.wrong]]:l.choices;
   if(currentIndex()%2)choices=[...choices].reverse();
   const field=el('fieldset',undefined,$('ws-question'));el('legend','你的判斷',field);
   for(const[value,text]of choices){const label=el('label',undefined,field),input=el('input',undefined,label);input.type='radio';input.name='experiment-answer';input.value=value;label.append(' '+text);}
   field.disabled=!prepared||(shown===0&&!!record.first)||(shown===1&&!record.operated);
   const submit=el('button',shown===0?'記下預測，開始操作':'檢查判斷',$('ws-question'));submit.id='workspace-submit';submit.className='primary';submit.disabled=field.disabled;
   if(shown===0&&record.first)el('p','首次判斷已保留：'+l.choices.find(c=>c[0]===record.first.answer)?.[1],$('ws-question'));
   submit.onclick=()=>{
    const answer=field.querySelector('input:checked')?.value;if(!answer){$('ws-feedback').textContent='請先選擇一個判斷。';return;}
    const correct=P.correct(shown===2?'reason':l.answer,answer),attempt={answer,correct,at:new Date().toISOString()};
    record.protocol='causal-workbench-v1';record.modelVersion=CircuitEngineeringSandboxCore.version;
    if(shown===0){if(record.first)return;record.first=attempt;}
    else if(shown===1||shown===2){if(shown===1&&!record.operated)return;const key=shown===1?'observation':'reason';record[key+'First']||=attempt;record.proof||={};if(correct)record.proof[key]=true;}
    else{record.transferFirst||=attempt;if(correct){record.transferPassed=true;const t=W.experimentTransfer(plan);retain('新條件驗證（不覆蓋主電路）',W.experimentRun(t.after));}}
    save();if(shown!==0&&!correct){$('ws-feedback').textContent='這個判斷還不能解釋結果。請回看曲線或事件，首次作答仍會保留。';return;}
    shown=P.stage(record);render();$('ws-question h2')?.focus();
   };
  }
  run.onclick=()=>{after=W.experimentRun(plan.after);record.operated=true;record.config=plan.after;session.currentConfig=plan.after;retain(lesson().action,after);save();render();};
  $('apply-setup').onclick=()=>{retain('修正比較條件前',before);prepared=true;record.prepared=true;before=W.experimentRun(plan.prepared);session.currentConfig=plan.prepared;retain('修正比較條件後',before);$('setup-panel').hidden=true;save();render();};
  function progress(){
   const count=lessons.filter(l=>proven(l.id)).length;$('workspace-progress').textContent=`連續電路實驗 ${count} / 8 · 電路、讀值與控制使用同一核心`;
   $('workspace-route').replaceChildren();lessons.forEach((l,i)=>{const li=el('li',undefined,$('workspace-route')),b=el('button',`${i+1}. ${proven(l.id)?'已練習：':''}${l.title}`,li);b.disabled=lessons.slice(0,i).some(x=>!proven(x.id));b.setAttribute('aria-current',l.id===id?'step':'false');b.onclick=()=>{location.hash='experiment-'+l.id;document.querySelector('.route').open=false;};});
   $('progress-summary').textContent=`連續實驗已練習 ${count} / 8。舊八課與正式測驗成績保持各自的判定。`;$('progress-abilities').replaceChildren();lessons.forEach(l=>el('li',(proven(l.id)?'已練習：':'待練習：')+l.title,$('progress-abilities')));
   $('workspace-history').replaceChildren();for(const h of [...session.history].reverse())el('li',`${h.kind} · 輸入 ${h.config.vin} V · 平均輸出 ${fmt(h.summary.avgV)} V · ${h.summary.tripSeen?'保護觸發':'未觸發保護'}`,$('workspace-history'));
  }
  function reference(href,title){const url=new URL(href,location.href),base=new URL('.',location.href);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;$('workspace-reference').hidden=false;$('reference-frame').hidden=false;$('reference-frame').src=url.href;$('reference-title').textContent=title;$('workspace-reference').scrollIntoView({block:'start'});}
  function recommendation(){const n=U.next(E.load(),CircuitCoreFlowV1.snapshot()),b=$('resume-task');b.hidden=n.id==='experiment'||/^(basic|bridge)-/.test(n.id);b.textContent=['formal','quiz'].includes(n.id)?'接續到期複習':'繼續原本的進階任務';b.dataset.route=n.remediation?U.remediationRoute(n.id,n.remediation):U.route(n.id);b.onclick=()=>{if(n.remediation)U.beginReturn(n.id,n.remediation);reference(b.dataset.route,U.task(n.id).title);};}
  $('ws-next').onclick=()=>{if(!proven(id))return;const next=lessons[currentIndex()+1];if(next)location.hash='experiment-'+next.id;else reference(U.route('core-physics'),'工程主線：獨立驗證與韌體');};
  $('show-progress').onclick=()=>{$('workspace-progress-panel').hidden=false;progress();$('workspace-progress-panel').scrollIntoView({block:'start'});};$('close-progress').onclick=()=>{$('workspace-progress-panel').hidden=true;$('ws-title').focus();};
  $('workspace-backup').onclick=()=>{const url=URL.createObjectURL(new Blob([E.exportBackup()],{type:'application/json'})),a=el('a');a.href=url;a.download='circuit-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('detailed-records').onclick=()=>reference('map.html','原有紀錄與正式測驗');$('all-materials').onclick=()=>reference('catalog.html','完整教材');
  $('deeper').onclick=()=>{$('workspace-reference').hidden=false;$('reference-frame').hidden=true;$('reference-title').textContent='接回目前電路的問題';$('reference-links').replaceChildren();for(const m of CircuitLearningMap.filter(m=>lesson().modules.includes(m.number))){const b=el('button',m.title,$('reference-links'));b.onclick=()=>reference(m.href,m.title);}};
  $('close-reference').onclick=()=>{$('workspace-reference').hidden=true;$('reference-frame').removeAttribute('src');$('ws-title').focus();};
  window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#experiment')){location.reload();return;}choose(location.hash.slice(12)||session.currentLesson||lessons[0].id);});
  window.addEventListener('storage',()=>recommendation());
  const requested=location.hash.slice(12),start=lessons.some(l=>l.id===requested)?requested:lessons.some(l=>l.id===session.currentLesson)?session.currentLesson:lessons[0].id;
  history.replaceState(null,'','#experiment-'+start);choose(start);
 };
})();
