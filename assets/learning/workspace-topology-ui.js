/* CircuitWorkspace renderer. Shared state: Evidence V5; calculations: model registry. */
(()=>{
 'use strict';
 const W=CircuitWorkspace,E=CircuitEvidence,U=CircuitUnifiedLearning,P=CircuitPlainCourse;
 W.mountTopology=async()=>{
  const $=id=>document.getElementById(id),el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
  document.body.dataset.topologyWorkspace='true';
  for(const id of ['setup-panel','lesson-control','free-controls','concept-note','transfer-preview','ws-plot','ws-hint','ws-explanation','legacy-note','explore','back-to-lesson','answer-observation','ws-display-wrap','workspace-reference','workbench-context-slot'])$(id).setAttribute('hidden','');
  $('ws-count').textContent='把同一個問題，帶到另一種電路';$('ws-title').textContent='開久一點，降壓和升壓都一樣嗎？';
  $('ws-intro').textContent='沿用手動實驗的元件與輸入，只把開關比例加上 10 個百分點。先看能共用的觀念，再找不能照搬的限制。';
  $('surface-title').textContent='同條件，並排比較';$('workspace-surface').querySelector('.eyebrow').textContent='比較的是穩定工作點，並非啟動波形';
  $('scope-note').textContent='CCM 表示每輪電感電流都未降到零。本比較要求兩種電路都在這個範圍，且忽略損耗與電容串聯電阻。RHP 零點是升壓模型的一項動態限制，不代表量到的頻寬；不模擬切換暫態、數位延遲或真板。';
  $('context-words').textContent='Buck：降壓電路。Boost：升壓電路。控制反應速度：控制器想多快地把偏差修回來。';
  $('circuit').setAttribute('aria-labelledby','circuit-title');$('circuit').setAttribute('aria-describedby','circuit-desc');$('circuit').setAttribute('viewBox','0 0 720 225');$('circuit').innerHTML='<title id="circuit-title">降壓與升壓的能量路徑示意</title><desc id="circuit-desc">降壓：開關在電感前。升壓：先把能量存入電感，開關關閉後經二極體送到輸出。</desc><g fill="none" stroke="#9eb3c5" stroke-width="3"><path d="M30 87V70H95M115 70H145q10 -30 20 0t20 0t20 0H310V145H30V123M95 70L115 55 M240 70V105M228 105H252M228 116H252M240 116V145 M290 90h20v35h-20z"/><path d="M390 87V70H415q10 -30 20 0t20 0t20 0H535M555 70H690V145H390V123M495 70V100L505 120M495 130V145 M535 58L555 70L535 82Z M555 55V85 M615 70V105M603 105H627M603 116H627M615 116V145 M670 90h20v35h-20z"/><circle cx="30" cy="105" r="18"/><circle cx="390" cy="105" r="18"/><path d="M125 70V104M114 104H136M114 126L125 104L136 126Z M125 126V145"/></g><g><text x="30" y="28">降壓 Buck</text><text x="390" y="28">升壓 Boost</text><text x="50" y="195">開關 → 電感 → 輸出</text><text x="390" y="195">電感儲能 → 關閉後送出</text></g>';
  const conditions=$('circuit-state'),source=el('p',undefined,$('surface-help'));
  const compare=el('div',undefined,$('surface-help'));compare.id='topology-comparison';
  const run=el('button','把開關比例加上 10 個百分點，計算比較',$('surface-help'));run.id='topology-run';run.className='primary';
  const contracts=el('details',undefined,$('surface-help'));el('summary','模型來源與適用範圍',contracts);
  const steps=CircuitEngineeringCurriculum.topologySteps;
  let session,comparison,shown=0;
  const stage=()=>W.topologyProof(session)?4:!session.rows.prediction?.first?0:!session.operated||!session.rows.observation?.passed?1:!session.rows.reason?.passed?2:3;
  function save(){session.models=['buck-ccm-control-output-esr','boost-ccm-control-output'].map(id=>({id,version:CircuitModelRegistry.describe(id).version}));session.completed=W.topologyProof(session);const s=E.load();s.benchmark.learningWorkspace||={version:1};s.benchmark.learningWorkspace.topologyTransfer=session;E.save(s);$('ws-save').textContent=E.storageStatus().saved?'比較條件與首次判斷已保存在這個瀏覽器。':'目前只能暫存，離開前請下載學習備份。';}
  function draw(){
   const reveal=session.operated,fmt=n=>n.toFixed(2),p=session.params;
   conditions.textContent=`輸入 ${p.vin} V · 電感 ${(p.inductanceH*1e6).toFixed(0)} µH · 電容 ${(p.capacitanceF*1e6).toFixed(0)} µF · 負載 ${p.loadOhm} Ω · 開關 ${(p.switchingHz/1000).toFixed(0)} kHz · 忽略損耗`;
   source.textContent=session.source+'。只帶入設定，不帶入上一段的儲能、控制器或故障狀態。';
   $('ws-voltage').parentNode.firstChild.textContent='降壓輸出';$('ws-current').parentNode.firstChild.textContent='升壓輸出';
   $('ws-voltage').textContent=reveal?fmt(comparison.buck.after.vout)+' V':'先預測';$('ws-current').textContent=reveal?fmt(comparison.boost.after.vout)+' V':'先預測';
   compare.replaceChildren();compare.hidden=!reveal;
   if(reveal){const table=el('table',undefined,compare);el('caption',`開關比例 ${(p.duty*100).toFixed(0)}% → ${(comparison.changed.duty*100).toFixed(0)}%`,table);const head=el('tr',undefined,el('thead',undefined,table));['要比較的事','改動前','改動後'].forEach(t=>el('th',t,head));const body=el('tbody',undefined,table);
    for(const[label,a,b,unit]of [['降壓輸出',comparison.buck.before.vout,comparison.buck.after.vout,'V'],['升壓輸出',comparison.boost.before.vout,comparison.boost.after.vout,'V'],['升壓動態限制（RHP 零點）',comparison.boost.before.rhpzHz,comparison.boost.after.rhpzHz,'Hz']]){const row=el('tr',undefined,body);el('th',label,row);el('td',fmt(a)+' '+unit,row);el('td',fmt(b)+' '+unit,row);}
   }
   $('ws-comparison').textContent=reveal?'兩種電路的輸出都提高；但升壓那項動態限制降到更低的頻率。想提高輸出，不代表也能把回授調得更快。':'先猜兩種輸出如何改變，再操作揭曉數字。';
   run.hidden=shown!==1;run.disabled=!session.rows.prediction?.first;run.textContent=session.operated?'用相同條件再算一次':'把開關比例加上 10 個百分點，計算比較';
  }
  function render(){
   const current=stage();document.body.dataset.workspaceStage=String(shown);$('ws-steps').replaceChildren();$('ws-question').replaceChildren();$('ws-feedback').textContent='';
   steps.forEach((s,i)=>{const b=el('button',`${i+1}. ${s.label}`,$('ws-steps'));b.disabled=i>current;b.setAttribute('aria-current',shown===i?'step':'false');b.onclick=()=>{shown=i;render();};});
   $('ws-result').hidden=current!==4;$('ws-ability').textContent='已練習：共用元件條件，比較輸出，再辨認升壓特有的限制。';$('ws-transition').textContent='接著用相同的比較方法，操作其他電路的原有工具；每一種先明確設定自己的條件，教學紀錄不授予正式能力成績。';$('ws-next').textContent='用同樣的方法，練習其他電路';
   $('workspace-progress').textContent=W.topologyProof(session)?'降壓／升壓比較：已練習':'降壓／升壓比較：'+steps[Math.min(current,3)].label;
   draw();if(shown===4)return;
   const s=steps[shown],r=session.rows[s.id]||{};el('h2',s.title,$('ws-question'));el('p',s.note,$('ws-question'));
   const field=el('fieldset',undefined,$('ws-question'));el('legend','你的判斷',field);for(const[value,text]of s.choices){const label=el('label',undefined,field),input=el('input',undefined,label);input.type='radio';input.name='topology-answer';input.value=value;label.append(' '+text);}
   field.disabled=(shown===0&&!!r.first)||(shown===1&&!session.operated);
   const submit=el('button',shown===0?'記下預測':'檢查判斷',$('ws-question'));submit.id='topology-submit';submit.className='primary';submit.disabled=field.disabled;
   if(r.first)el('p','首次判斷：'+(s.choices.find(c=>c[0]===r.first.answer)?.[1]||r.first.answer)+(r.first.correct?'（符合模型）':'（已保留，可繼續修正）'),$('ws-question'));
   submit.onclick=()=>{const answer=field.querySelector('input:checked')?.value;if(!answer){$('ws-feedback').textContent='請先選擇判斷。';return;}const correct=P.correct(s.answer,answer);session.rows[s.id]||={};const row=session.rows[s.id];row.first||={answer,correct,at:new Date().toISOString()};if(correct)row.passed=true;save();if(shown!==0&&!correct){$('ws-feedback').textContent='回看比較結果：輸出變化和控制速度限制是兩件事。首次判斷已保留，請再試一次。';return;}shown=stage();render();};
  }
  try{
   await CircuitModelRegistry.loadTopologyContracts(new URL('.',location.href));
   const stored=E.load().benchmark.learningWorkspace?.topologyTransfer;
   if(stored){if(stored.version!==1||stored.protocol!=='topology-workbench-v1'||!stored.rows||typeof stored.rows!=='object'||Array.isArray(stored.rows))throw Error('已存比較紀錄格式不符，請先匯出備份。');session=stored;}
   else{const plan=W.topologyPlan(E.load());session={version:1,protocol:'topology-workbench-v1',params:plan.params,source:plan.source,rows:{},operated:false};}
   comparison=W.topologyCompare(session.params);if(!comparison.valid)throw Error('這組條件有電感電流降到零，超出目前比較模型的範圍。請返回手動實驗確認條件。');
   for(const id of ['buck-ccm-control-output-esr','boost-ccm-control-output']){const c=CircuitModelRegistry.describe(id);el('p',`${c.title} · ${c.id} · ${c.type}`,contracts);el('p',c.validRegion+'；'+c.invalidWhen.join('；'),contracts);const a=el('a','檢視原始模型契約',contracts);a.href='assets/learning/model-contracts-v1.json';}
   $('workbench-context-slot').hidden=false;CircuitWorkbenchContext.mount($('workbench-context-slot'),new URL('.',location.href));
   shown=stage();save();render();
  }catch(error){$('ws-question').textContent=error.message;run.hidden=true;$('ws-save').textContent='未覆蓋已有紀錄。';const a=el('a','返回手動電路實驗',$('ws-question'));a.href='#experiment-energy';}
  run.onclick=()=>{session.operated=true;save();render();};
  $('workspace-route').replaceChildren();for(const[href,label]of [['#experiment','回到連續電路實驗'],['#topology','降壓／升壓比較']]){const a=el('a',label,el('li',undefined,$('workspace-route')));a.href=href;}
  $('deeper').textContent='用這份條件，打開完整電路工具';$('deeper').onclick=()=>location.assign('17_power_topology_control/index.html#workspace-transfer');
  $('ws-next').onclick=()=>{if(W.topologyProof(session))location.assign(U.route('applications'));};
  $('show-progress').onclick=()=>{$('workspace-progress-panel').hidden=false;$('progress-summary').textContent=W.topologyProof(session)?'比較練習完成；正式成績由原驗證系統判定。':'比較練習尚未完成。';$('progress-abilities').replaceChildren();if(session)for(const s of steps){const r=session.rows[s.id];el('li',s.label+'：'+(r?.first?(r.first.correct?'首次符合模型':'首次需修正'):'尚未作答'),$('progress-abilities'));}};
  $('close-progress').onclick=()=>$('workspace-progress-panel').hidden=true;
  $('workspace-backup').onclick=()=>{const url=URL.createObjectURL(new Blob([E.exportBackup()],{type:'application/json'})),a=el('a');a.href=url;a.download='circuit-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('detailed-records').onclick=()=>location.assign('map.html');$('all-materials').onclick=()=>location.assign('catalog.html');
  const n=U.next(E.load(),CircuitCoreFlowV1.snapshot());$('resume-task').hidden=!['formal','quiz'].includes(n.id);$('resume-task').textContent='先完成到期複習';$('resume-task').onclick=()=>location.assign(U.route(n.id));
  addEventListener('hashchange',()=>{if(location.hash!=='#topology')location.reload();});
 };
})();
