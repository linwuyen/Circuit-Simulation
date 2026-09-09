(()=>{
 'use strict';
 const E=CircuitEvidence,P=CircuitPlainCourse,W=CircuitWorkspace,U=CircuitUnifiedLearning,B=CircuitTrainingExperiments,$=id=>document.getElementById(id);
 U.registerModules(CircuitLearningMap);
 const initial=E.load(),stored=initial.benchmark.learningWorkspace;
 let workspace=stored?.version===1?stored:{version:1,history:[]},model;
 try{model=B.buckConfig(workspace.model||W.defaults);}catch{model=B.buckConfig(W.defaults);}
 let id,value,record,baseline,planned,prepared=true,stepView=null,mode='lesson',freeReturn=null,phase=.1;
 const lesson=()=>CircuitBeginnerLessons.lessons.find(l=>l.id===id)||P.bridge.find(l=>l.id===id);
 const isConcept=()=>W.ids.indexOf(id)>=5;
 const rowFrom=(state,key)=>state.benchmark[W.bucket(key)]?.rows?.[key];
 const count=()=>W.ids.filter(key=>P.proven(rowFrom(E.load(),key))).length;
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;};
 function save(){
  const state=E.load(),key=W.bucket(id);state.benchmark[key]||={version:1,rows:{}};state.benchmark[key].rows||={};state.benchmark[key].rows[id]=record;
  workspace={...workspace,version:1,currentLesson:id,model:{...model},mode,history:workspace.history||[]};state.benchmark.learningWorkspace=workspace;E.save(state);
  $('ws-save').textContent=E.storageStatus().saved?'進度與電路設定已保存在這個瀏覽器。':'目前只能暫存；離開前請從「我的學習紀錄」下載備份。';renderProgress();
 }
 function log(label,before,after){workspace.history=W.history(workspace.history,{at:new Date().toISOString(),lesson:id,label,before:{...before},after:{...after}});}
 function options(parent,name,choices){const field=el('fieldset',undefined,parent);el('legend','你的判斷',field);for(const[v,t]of choices){const label=el('label',undefined,field),input=el('input',undefined,label);input.type='radio';input.name=name;input.value=v;label.append(document.createTextNode(' '+t));}return field;}
 function select(key,focus=false){
  if(!W.locate(key))return;id=key;mode='lesson';freeReturn=null;stepView=null;record={...(rowFrom(E.load(),id)||{})};const l=lesson();
  value=Number.isFinite(record.value)&&record.value>=l.min&&record.value<=l.max?record.value:l.initial;
  baseline=W.plan(id,model);planned=W.apply(id,value,baseline);if(P.proven(record)&&record.workspaceSnapshot?.model){try{planned=B.buckConfig(record.workspaceSnapshot.model);}catch{}}prepared=W.changed(model,planned).length===0;
  const names={vin:'輸入電壓',duty:'開關打開的比例',inductanceUh:'電感',fswKhz:'開關頻率',loadOhm:'用電部分的電阻',capacitanceUf:'電容',esrOhm:'電容串聯電阻'};
  $('setup-panel').hidden=prepared;$('setup-note').textContent=W.changed(model,planned).map(k=>`${names[k]}：${model[k]} → ${planned[k]}`).join('；')+'。本課要在這些指定條件下比較；上一份設定會留在學習紀錄。';
  if(prepared)model={...planned};phase=id==='inductor'?value/100:.6;
  $('ws-title').textContent=W.titles[W.ids.indexOf(id)];$('ws-count').textContent=`第 ${W.ids.indexOf(id)+1} 課，共 8 課`;$('ws-intro').textContent=l.intro;
  $('ws-explanation-text').textContent=l.explanation;$('ws-hint').open=false;$('ws-explanation').open=false;
  $('legacy-note').hidden=!(record.transferPassed&&!P.proven(record));
  updateControls();draw();renderQuestion();renderProgress();if(prepared)save();if(focus)$('ws-title').focus();
 }
 function updateControls(){const l=lesson();Object.assign($('ws-control'),{min:l.min,max:l.max,step:l.step,value,disabled:!prepared||!record.first});$('ws-control-label').textContent=l.label;$('ws-value').textContent=String(value);$('ws-target').textContent=`把這個數字調到 ${l.target}，比較前後，再回答旁邊的問題。`;$('lesson-control').hidden=mode==='free';$('free-controls').hidden=mode!=='free';document.querySelectorAll('[data-free]').forEach(n=>n.value=model[n.dataset.free]);}
 function renderQuestion(){
  const l=lesson(),stage=P.stage(record),shown=stepView??stage;draw(shown);$('ws-control').disabled=!prepared||!record.first||shown!==1;document.body.dataset.workspaceStage=String(shown);
  $(shown===1?'surface-help':'coach-help').append($('ws-hint'));$('answer-observation').hidden=shown!==1||mode==='free';
  $('ws-feedback').textContent='';$('ws-question').replaceChildren();$('ws-steps').replaceChildren();
  ['先猜','觀察','說原因','換條件'].forEach((t,i)=>{const b=el('button',`${i+1}. ${t}`,$('ws-steps'));b.type='button';b.disabled=!prepared||i>stage;b.setAttribute('aria-current',shown===i?'step':'false');b.onclick=()=>{stepView=i;renderQuestion();};});
  $('ws-result').hidden=stage!==4||mode==='free';$('explore').hidden=stage!==4||mode==='free';$('back-to-lesson').hidden=mode!=='free';$('ws-hint').hidden=shown===4||mode==='free';$('ws-explanation').hidden=mode==='free';
  const hints=isConcept()?[l.hint]:l.hints;
  $('ws-hint-text').textContent=shown===1?(P.checks[id]?.wrong[record.first?.answer]||hints[0]):shown===2?'對照剛才的線條與數字：哪個原因真的能造成這個變化？ '+(hints[1]||hints[0]):hints.at(-1);
  if(mode==='free'){el('h2','就在這台電路上自由探索',$('ws-question'));el('p','每次只改一件事，留意哪個數字與曲線變了。返回課堂會恢復剛才的教學設定；探索設定另外保存。',$('ws-question'));return;}
  if(stage===4){$('ws-ability').textContent='已練習：'+W.abilities[W.ids.indexOf(id)];const next=W.ids[W.ids.indexOf(id)+1];$('ws-transition').textContent=next?'接著用同一台電路問：'+W.titles[W.ids.indexOf(next)]:'八課已完成練習。把示意放下，回到上方真正的電路曲線，試著解釋它。';$('ws-next').textContent=next?'接著觀察：'+W.titles[W.ids.indexOf(next)]:'回到電路，自由探索';}
  if(shown===4)return;
  const box=$('ws-question'),heading=el('h2',['先猜一次','你看到了什麼？','為什麼會這樣？','換個條件，再試一次'][shown],box);heading.tabIndex=-1;
  const check=P.checks[id]||l;
  const prompt=shown===0?l.question:shown===1?check.observation:shown===2?check.reason:l.transfer;el('p',prompt,box);
  const choices=shown===0?l.choices:shown===1?check.observations:shown===2?check.reasons:l.transferChoices;
  let field;if(choices)field=options(box,'workspace-answer',choices);else{field=el('fieldset',undefined,box);el('legend','答案（'+(l.unit||'V')+'）',field);const input=el('input',undefined,field);input.type='number';input.step='any';input.id='workspace-answer';input.setAttribute('aria-label','新條件答案');}
  field.disabled=!prepared||(shown===0&&!!record.first);
  const button=el('button',shown===0?'記下判斷，開始觀察':'檢查我的判斷',box);button.type='button';button.id='workspace-submit';button.className='primary';button.disabled=!prepared||(shown===0&&!!record.first);
  if(shown===0&&record.first)el('p','首次判斷已保留：'+(l.choices.find(([v])=>v===record.first.answer)?.[1]||record.first.answer),box);
  button.onclick=()=>{
   const answer=choices?box.querySelector('input:checked')?.value:$('workspace-answer').value;
   if(answer===undefined||String(answer).trim()===''){$('ws-feedback').textContent='請先選擇或填寫答案。';return;}
   if(shown===1&&!record.operated){$('ws-feedback').textContent='先調到指定數值，看看曲線，再判斷。';return;}
   const expected=shown===0?l.answer:shown===1?check.observed:shown===2?check.because:(l.expected);
   const correct=P.correct(expected,answer);record.edition=2;
   if(shown===0){if(record.first)return;record.first={answer,correct};}
   else if(shown===1||shown===2){const kind=shown===1?'observation':'reason';record[kind+'First']||={answer,correct};if(correct){record.proof||={};record.proof[kind]=true;if(shown===1)record.observed=true;}}
   else{record.transferFirst||={answer,correct};record.transferAttempts=(record.transferAttempts||0)+1;if(correct){record.transferPassed=true;record.transferBefore={...model};const example=W.transfer(id,model);log('換條件驗證：'+example.note,model,example.model);model={...example.model};record.workspaceSnapshot={model:{...model},value};}}
   save();if(correct||shown===0){stepView=null;updateControls();renderQuestion();if(P.stage(record)===1)$('ws-control').focus();else $('ws-question h2')?.focus();}else $('ws-feedback').textContent=shown===1?'再比較前後的數字與線條。若只是儀器設定改了，電路本身會不會改變？':shown===2?'這個原因還不能解釋剛才的變化。可以展開這一步的提示，再選一次。':'先找新題改了哪個條件，再重新判斷。首次答案已保留。';
  };
 }
 function plot(series,xlabel,ylabel,target){
  const svg=$('ws-plot'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);};
  const points=series.flatMap(s=>s.rows),maxX=Math.max(1,...points.map(p=>p.x)),lo=Math.min(0,...points.map(p=>p.y)),hi=Math.max(1,target||0,...points.map(p=>p.y))*1.12;
  const x=v=>65+v/maxX*590,y=v=>220-(v-lo)/(hi-lo)*165;
  add('path',{d:'M65 45V220H655',stroke:'#a7bccd',fill:'none'});add('text',{x:65,y:28},ylabel);add('text',{x:360,y:264},xlabel);add('text',{x:8,y:55},hi.toFixed(1));add('text',{x:20,y:223},lo.toFixed(0));add('text',{x:65,y:244},'0');add('text',{x:600,y:244},maxX.toFixed(0));
  if(target!==undefined){add('path',{d:`M65 ${y(target)}H655`,stroke:'#f0c967','stroke-dasharray':'6 4'});add('text',{x:490,y:y(target)-8},'目標 '+target+' V');}
  for(const s of series)add('polyline',{points:s.rows.map(p=>`${x(p.x)},${y(p.y)}`).join(' '),fill:'none',stroke:s.color,'stroke-width':3,'stroke-dasharray':s.dash||''});
  svg.setAttribute('aria-label',`${ylabel}；${xlabel}。灰色虛線是改動前，綠色實線是現在。`);
 }
 function draw(shown=stepView??P.stage(record)){
  const transfer=(shown===3||shown===4)&&mode!=='free'&&prepared,example=transfer?W.transfer(id,model):null,masked=transfer&&!record.transferPassed;
  const l=lesson(),physical=B.buck(example?.model||model),before=B.buck(transfer?(record.transferBefore||model):(baseline||model)),concept=isConcept()&&mode!=='free';
  $('ws-voltage').textContent=physical.vout.toFixed(2)+' V';$('ws-current').textContent=physical.avgI.toFixed(2)+' A';$('ws-display-wrap').hidden=id!=='probe'||mode==='free';$('ws-display').textContent=(physical.avgI*(example?.probe??value)/10).toFixed(2)+' A';
  $('transfer-preview').hidden=!transfer;$('transfer-preview').textContent=example?.note+(masked?'先預測，答對後再顯示新條件的結果。':'新條件驗證結果；設定已保留。');
  $('lesson-control').hidden=transfer||mode==='free';
  if(masked){$('ws-voltage').textContent='先預測';$('ws-current').textContent='先預測';$('ws-display').textContent='先預測';}
  const on=phase<physical.config.duty,row=physical.rows[Math.min(512,Math.round(phase*512))],zero=row.iL<1e-8;
  $('switch').setAttribute('d',on?'M140 70H200':'M140 70L200 45');$('on-path').style.display=on?'':'none';$('off-path').style.display=!on&&!zero?'':'none';
  document.querySelectorAll('#circuit .labels text').forEach(n=>n.style.fill=n.textContent.includes(id==='inductor'?'電感':id==='load'?'負載':id==='duty'?'開關':'不存在')?'#f5d279':'');
  $('circuit-state').textContent=`這輪的 ${Math.round(phase*100)}%：`+(on?'開關打開，電流走上方路徑。':zero?'電流已停下，等下一輪再送入能量。':'開關關閉，電流仍沿二極體的回路流動。')+` 此刻 ${row.iL.toFixed(2)} A。`;
  $('concept-note').hidden=!concept;$('surface-title').textContent=concept?'電路保持不變，先看調整方向':mode==='free'?'自由探索同一台電路':'電路、儀器與前後變化';
  const grey='#b1becd',green='#63dfbc';
  if(concept){
   const a=id==='error'?[l.initial,l.initial]:P.correction({gain:l.initial}),b=example?(id==='error'?[example.initial,example.initial]:P.correction({target:example.target,initial:example.initial,gain:example.gain})):(id==='error'?[value,value]:P.correction({gain:value}));
   plot([{rows:a.map((y,x)=>({x,y})),color:grey,dash:'7 5'},{rows:b.map((y,x)=>({x,y})),color:green}],id==='error'?'量測位置（示意）':'調整輪次','示意電壓 V',example?.target??12);
   $('ws-comparison').textContent=id==='error'?`示意量測：${l.initial} → ${value} V；離 12 V 目標還差 ${12-value} V。`:`示意第一輪：原本 ${a[1].toFixed(2)} V，現在 ${b[1].toFixed(2)} V。灰色虛線是原規則，綠色實線是調整後。真實電路仍是上方的 ${physical.vout.toFixed(2)} V，不把兩種模型混為一談。`;
  }else if(id==='timing'&&mode!=='free'){
   const update=CircuitBeginnerLessons.updateAt,ready=example?.ready??value,period=example?.period??10;plot([{rows:[{x:l.initial,y:0},{x:update(l.initial),y:1}],color:grey,dash:'7 5'},{rows:[{x:ready,y:0},{x:update(ready,period),y:1}],color:green}],'時間（微秒）','0 算完／1 生效');$('ws-comparison').textContent=`原本 ${l.initial} 微秒算完 → ${update(l.initial)} 微秒生效；現在 ${ready} → ${update(ready,period)} 微秒。現在每 ${period} 微秒更新一次。`;
  }else{
   const series=[{rows:before.rows.map(r=>({x:r.tUs,y:r.iL})),color:grey,dash:'7 5'},{rows:physical.rows.map(r=>({x:r.tUs,y:r.iL})),color:green}];
   if(id==='probe'&&mode!=='free')series.push({rows:physical.rows.map(r=>({x:r.tUs,y:r.iL*(example?.probe??value)/10})),color:'#f0c967',dash:'4 3'});
   plot(series,'時間（微秒）','電路電流 A');
   $('ws-comparison').textContent=id==='probe'&&mode!=='free'?`電路電流 ${physical.avgI.toFixed(2)} A 沒有變；儀器由 ${(physical.avgI*l.initial/10).toFixed(2)} A 顯示成 ${(physical.avgI*value/10).toFixed(2)} A（黃色虛線）。`:id==='inductor'&&mode!=='free'?`現在位於這輪的 ${Math.round(phase*100)}%；觀察上方亮起的回路，和電流曲線關閉後的下降區段。`:`改動前：${before.vout.toFixed(2)} V、${before.avgI.toFixed(2)} A；現在：${physical.vout.toFixed(2)} V、${physical.avgI.toFixed(2)} A。灰色虛線是改動前，綠色實線是現在。`;
  }
  if(transfer){$('circuit-state').textContent=masked?'這是新條件下的同一台電路；先判斷，再看結果。':$('circuit-state').textContent;$('ws-plot').toggleAttribute('hidden',masked);if(masked){$('ws-comparison').textContent=example.note+'請先完成新條件判斷。';$('on-path').style.display='none';$('off-path').style.display='none';}else if(concept){$('ws-comparison').textContent=id==='error'?`新條件：目標 ${example.target} V，量到 ${example.initial} V，還差 ${example.target-example.initial} V。`:`新條件第一輪：${example.initial} + ${example.gain} × (${example.target} − ${example.initial}) = ${P.correction({target:example.target,initial:example.initial,gain:example.gain})[1].toFixed(2)} V。這仍是修正方向的示意。`;}}else $('ws-plot').removeAttribute('hidden');
  $('scope-note').textContent=concept?'示意規則：下次數字 = 這次數字 + 比例 × 剩餘差距。實際電路另有儲能、延遲與限制，不能直接照抄這個比例。':id==='timing'&&mode!=='free'?`這裡以固定每 ${example?.period??10} 微秒更新為例，必須嚴格提早算完。不同硬體規則需要重新判斷。`:'本圖是固定開關比例、已穩定後的一輪理想降壓電路，省略溫升與開關損耗。'+(physical.regime==='DCM'?'現在電流會停下一段時間，不能直接套用「輸出 = 輸入 × 開關比例」。':'目前電流整輪不中斷。')+' 調整後比較的是另一個穩定狀態，不是啟動過程。';
  $('context-words').replaceChildren();const terms=id==='probe'?['ADC','示波器']:id==='timing'?['PWM']:isConcept()?['回授','PI']:['CCM','DCM'];for(const term of terms){const entry=Object.entries(CircuitLearningGlossary).find(([k])=>k.includes(term));if(entry){const d=el('details',undefined,$('context-words'));el('summary',entry[0],d);el('p',entry[1],d);}}
 }
 function renderProgress(){
  const state=E.load(),done=W.ids.filter(key=>P.proven(rowFrom(state,key)));$('workspace-progress').textContent=`已練習 ${done.length} / 8 課 · 電路與作答都留在工作台`;
  $('workspace-route').replaceChildren();W.ids.forEach((key,i)=>{const li=el('li',undefined,$('workspace-route')),b=el('button',`${i+1}. ${done.includes(key)?'已練習：':''}${W.titles[i]}`,li);b.type='button';if(key===id)b.setAttribute('aria-current','step');b.onclick=()=>{if(location.hash==='#'+key)select(key,true);else location.hash=key;document.querySelector('.route').open=false;};});
  $('progress-summary').textContent=`已練習 ${done.length} / 8 課。目前：${W.titles[W.ids.indexOf(id)]}。`+(P.proven(record)?'接著看下一個問題，或沿用設定自由探索。':['先記下自己的預測。','接著辨認操作後的變化。','接著解釋變化的原因。','接著在新條件下判斷。'][P.stage(record)]);
  $('progress-abilities').replaceChildren();for(const key of W.ids){const r=rowFrom(state,key),stage=P.stage(r);el('li',`${P.proven(r)?'已練習：':'待練習：'}${W.abilities[W.ids.indexOf(key)]}`+((r?.observationFirst?.correct===false&&stage===1)?'；目前卡在辨認變化。':r?.reasonFirst?.correct===false&&stage===2?'；目前卡在解釋原因。':r?.transferFirst?.correct===false&&stage===3?'；目前卡在換條件判斷。':''),$('progress-abilities'));}
  $('workspace-history').replaceChildren();for(const h of [...(workspace.history||[])].reverse())el('li',`${h.label}；輸入 ${h.before.vin} → ${h.after.vin} V，開關比例 ${h.before.duty} → ${h.after.duty}，電阻 ${h.before.loadOhm} → ${h.after.loadOhm} Ω。`,$('workspace-history'));
 }
 function explore(){
  if(!P.proven(record))return;freeReturn={model:{...model},baseline:{...baseline},value,phase};mode='free';baseline={...model};if(workspace.freeModel){try{model=B.buckConfig(workspace.freeModel);}catch{}}
  updateControls();draw();renderQuestion();save();$('surface-status').textContent=isConcept()?'已回到真實電路的穩態曲線；上面的修正示意不會當成電路計算。':'課堂設定已保存，現在可以自由改動。';
 }
 function reference(href,title){
  const url=new URL(href,location.href),base=new URL('.',location.href);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  $('workspace-reference').hidden=false;$('reference-title').textContent=title;$('reference-frame').hidden=false;$('reference-frame').src=url.href;$('workspace-reference').scrollIntoView({block:'start'});
 }
 $('answer-observation').onclick=()=>{$('ws-question h2')?.focus();};
 $('apply-setup').onclick=()=>{log('開始本課，明確切換比較條件',model,planned);model={...planned};prepared=true;record.operated=P.correct(lesson().target,value);$('setup-panel').hidden=true;updateControls();draw();renderQuestion();save();};
 $('ws-control').oninput=e=>{if(!prepared||!record.first||mode!=='lesson')return;const old={...model};value=Number(e.target.value);record.value=value;model=W.apply(id,value,model);if(id==='inductor')phase=value/100;if(P.correct(lesson().target,value))record.operated=true;log('本課操作：'+lesson().label+' = '+value,old,model);$('ws-value').textContent=String(value);draw();save();};
 document.querySelectorAll('[data-free]').forEach(input=>input.onchange=()=>{try{if(!input.value.trim())throw Error('請填寫數值');const next=B.buckConfig({...model,[input.dataset.free]:Number(input.value)});B.buck(next);baseline={...model};log('自由探索：'+input.closest('label').childNodes[0].textContent,model,next);model=next;workspace.freeModel={...model};draw();save();$('surface-status').textContent='已保留改動前的曲線，可以繼續比較。';}catch(error){input.value=model[input.dataset.free];$('surface-status').textContent=error.message;}});
 $('ws-next').onclick=()=>{if(!P.proven(record))return;const next=W.ids[W.ids.indexOf(id)+1];if(next)location.hash=next;else explore();};$('explore').onclick=explore;
 $('back-to-lesson').onclick=()=>{if(freeReturn){model=freeReturn.model;baseline=freeReturn.baseline;value=freeReturn.value;phase=freeReturn.phase;}mode='lesson';updateControls();draw();renderQuestion();save();$('surface-status').textContent='已恢復剛才的課堂設定；自由探索設定另外保存。';};
 for(const name of ['ws-hint','ws-explanation'])$(name).addEventListener('toggle',()=>{if($(name).open){record.assisted=true;save();}});
 $('show-progress').onclick=()=>{$('workspace-progress-panel').hidden=!$('workspace-progress-panel').hidden;if(!$('workspace-progress-panel').hidden){renderProgress();$('workspace-progress-panel').scrollIntoView({block:'start'});}};$('close-progress').onclick=()=>{$('workspace-progress-panel').hidden=true;$('ws-title').focus();};
 $('deeper').onclick=()=>{$('workspace-reference').hidden=false;$('reference-frame').hidden=true;$('reference-title').textContent='跟「'+W.titles[W.ids.indexOf(id)]+'」有關的教材';$('reference-links').replaceChildren();for(const m of CircuitLearningMap.filter(m=>W.resources[id].includes(m.number))){const b=el('button',m.title,$('reference-links'));b.type='button';b.onclick=()=>reference(m.href,m.title);}$('workspace-reference').scrollIntoView({block:'start'});};
 $('reference-frame').addEventListener('load',()=>{try{const doc=$('reference-frame').contentDocument;if(!doc)return;doc.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a)return;const target=new URL(a.href),base=new URL('.',location.href);if(target.origin!==base.origin)return;const path=target.pathname.slice(base.pathname.length);if(!['','index.html','learn.html','15_power_capstone/learn_basics.html','control-basics.html'].includes(path))return;const key=W.locate(target.hash);event.preventDefault();$('close-reference').click();if(key&&key!==id)location.hash=key;});}catch{/* External references cannot control the workspace. */}});
 $('close-reference').onclick=()=>{$('workspace-reference').hidden=true;$('reference-frame').removeAttribute('src');$('reference-links').replaceChildren();$('ws-title').focus();};$('detailed-records').onclick=()=>reference('map.html','原有工程課與測驗紀錄');$('all-materials').onclick=()=>reference('catalog.html','完整教材：選擇需要深入的主題');
 $('workspace-backup').onclick=()=>{const url=URL.createObjectURL(new Blob([E.exportBackup()],{type:'application/json'})),a=el('a');a.href=url;a.download='circuit-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const recommendation=U.next(initial,CircuitCoreFlowV1.snapshot()),recommended=W.locate(recommendation.id.replace(/^(basic|bridge)-/,''));
 function renderRecommendation(){const recommendation=U.next(E.load(),CircuitCoreFlowV1.snapshot()),recommended=W.locate(recommendation.id.replace(/^(basic|bridge)-/,''));$('resume-task').hidden=!!recommended;if(!recommended){const b=$('resume-task');b.hidden=false;b.textContent=['formal','quiz'].includes(recommendation.id)?'接續到期複習':'繼續原本的進階任務';b.dataset.route=recommendation.remediation?U.remediationRoute(recommendation.id,recommendation.remediation):U.route(recommendation.id);b.onclick=()=>{if(recommendation.remediation)U.beginReturn(recommendation.id,recommendation.remediation);reference(b.dataset.route,U.task(recommendation.id).title);};}}
 renderRecommendation();window.addEventListener("storage",()=>{renderProgress();renderRecommendation();});
 window.addEventListener('hashchange',()=>select(W.locate(location.hash)||'duty',true));
 select(W.locate(location.hash)||W.locate(workspace.currentLesson)||recommended||'duty');
})();
