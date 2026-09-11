/* Guided adapter over Module 17's original controls and registered models. */
(()=>{
 'use strict';
 const start=async()=>{
  const W=CircuitWorkspace,E=CircuitEvidence,R=CircuitModelRegistry,$=id=>document.getElementById(id);
  const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
  const panel=el('section');panel.id='guided-applications';panel.className='panel guided-applications';document.querySelector('main').prepend(panel);
  el('h2','把同一種學習方法，帶到四種電路',panel);el('p','每次只改一個條件：先猜、操作原本的工具，再用模型結果說明原因。各電路先明確設定自己的條件。',panel);
  const nav=el('nav',undefined,panel);nav.setAttribute('aria-label','四種電路練習');
  const progress=el('p',undefined,panel);progress.id='application-progress';
  const content=el('div',undefined,panel),status=el('p',undefined,panel);status.id='application-status';status.setAttribute('role','status');
  const back=el('a','返回降壓／升壓比較',panel);back.href='../index.html#topology';
  const lessons=W.applicationLessons();let session,id,record,plan,shown=0,applying=false;
  function save(){if(location.hash!=='#guided-applications'){history.replaceState(null,'','#guided-applications');dispatchEvent(new HashChangeEvent('hashchange'));}session.completed=lessons.every(l=>W.applicationProof(session.rows[l.id]));session.currentLesson=id;const s=E.load();s.benchmark.learningWorkspace||={version:1};s.benchmark.learningWorkspace.topologyApplications=session;E.save(s);}
  function stage(){return W.applicationProof(record)?3:!record.first?0:!record.operated||!record.observationPassed?1:2;}
  function value(id){const n=$(id);return n.tagName==='SELECT'?n.value:Number(n.value);}
  function matches(values){return Object.entries(values).every(([id,v])=>typeof v==='number'?Math.abs(value(id)-v)<1e-8:value(id)===v);}
  function apply(values){
   for(const[id,v]of Object.entries(values)){const input=$(id);if(!input)throw Error('找不到原工具欄位：'+id);if(input.tagName==='SELECT'){if(![...input.options].some(o=>o.value===v))throw Error('原工具不支援這個模式');}else{const min=Number(input.min),max=Number(input.max),step=Number(input.step||1);if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs((v-min)/step-Math.round((v-min)/step))>1e-7)throw Error('原工具無法精確套用：'+id);}}
   applying=true;try{for(const[id,v]of Object.entries(values))$(id).value=String(v);for(const id of Object.keys(values))$(id).dispatchEvent(new Event('input',{bubbles:true}));}finally{applying=false;}
   if(!matches(values))throw Error('原工具實際條件與要求不符，未記錄操作結果。');
  }
  function choose(next,persist=false){id=next;plan=W.applicationPlan(id);record=session.rows[id]||{};shown=stage();if(persist)save();render();}
  function render(){
   const l=lessons.find(l=>l.id===id),current=stage();content.replaceChildren();status.textContent='';nav.replaceChildren();
   for(const lesson of lessons)$(lesson.section).toggleAttribute('data-active-application',lesson.id===id);
   for(const lesson of lessons){const b=el('button',lesson.label+(W.applicationProof(session.rows[lesson.id])?' ✓':''),nav);b.type='button';b.setAttribute('aria-current',id===lesson.id?'step':'false');b.onclick=()=>choose(lesson.id,true);}
   progress.textContent=lessons.filter(l=>W.applicationProof(session.rows[l.id])).length+' / 4 已練習；固定教學練習，不授予正式成績。';
   el('h3',l.title,content);el('p',l.setup,content);
   const steps=el('nav',undefined,content);steps.className='application-steps';steps.setAttribute('aria-label','目前練習步驟');for(const[name,i]of [['先猜',0],['操作／觀察',1],['說明原因',2]]){const b=el('button',`${i+1}. ${name}`,steps);b.disabled=i>current;b.setAttribute('aria-current',shown===i?'step':'false');b.onclick=()=>{shown=i;render();};}
   const controls=el('div',undefined,content);controls.className='application-actions';
   const prepare=el('button','明確套用這次的起始條件',controls);prepare.id='application-prepare';prepare.onclick=()=>{try{apply(plan.before);record.prepared=true;session.rows[id]=record;save();render();status.textContent='原工具已套用起始條件。';}catch(e){status.textContent=e.message;}};
   const view=el('button','查看原電路與圖形',controls);view.onclick=()=>$(l.section).scrollIntoView({block:'start',behavior:'auto'});
   const live=el('p',matches(plan.after)?'原工具目前顯示改動後條件。':matches(plan.before)?'原工具目前顯示起始條件。':'原工具目前是其他設定；下方已存紀錄不代表眼前工具狀態。',content);live.id='application-live-state';
   if(record.operated){
    const table=el('table',undefined,content);table.id='application-comparison';el('caption','這次已保存的模型對照',table);const head=el('tr',undefined,el('thead',undefined,table));['觀察項目','改動前','改動後'].forEach(t=>el('th',t,head));const body=el('tbody',undefined,table);
    for(const[key,label,unit]of l.metrics){const row=el('tr',undefined,body);el('th',label,row);for(const sample of [record.before,record.after])el('td',Number(sample.result[key]).toFixed(3)+' '+unit,row);}
   }
   if(shown===1){const run=el('button',l.action,content);run.id='application-run';run.className='application-primary';run.disabled=!record.first||!matches(plan.before);run.onclick=()=>{try{if(!matches(plan.before))throw Error('條件已變動，請先重新套用起始條件。');const before=W.applicationRun(id,plan.before);apply(plan.after);const after=W.applicationRun(id,plan.after);Object.assign(record,{protocol:'topology-application-v1',operated:true,before,after,controls:{before:plan.before,after:plan.after},model:{id:l.modelId,version:R.describe(l.modelId).version},operatedAt:new Date().toISOString()});session.rows[id]=record;save();render();}catch(e){status.textContent=e.message;}};}
   if(shown<3){
    el('h3',shown===2?'哪個原因能解釋這次結果？':l.question,content);
    const field=el('fieldset',undefined,content);el('legend','你的判斷',field);
    const choices=shown===2?[['reason',l.reason],['other',l.wrong]]:[['lower','變小／降低'],['higher','變大／提高'],['same','不變']];
    for(const[v,text]of choices){const label=el('label',undefined,field),input=el('input',undefined,label);input.type='radio';input.name='application-answer';input.value=v;label.append(' '+text);}
    field.disabled=shown===0?!!record.first||!record.prepared:shown===1?!record.operated:false;
    const submit=el('button',shown===0?'記下預測':'檢查判斷',content);submit.id='application-submit';submit.className='application-primary';submit.disabled=field.disabled;
    const key=shown===0?'first':shown===1?'observationFirst':'reasonFirst';
    if(record[key])el('p','首次判斷已保留：'+(choices.find(c=>c[0]===record[key].answer)?.[1]||record[key].answer)+(record[key].correct?'（符合模型）':'（可繼續修正）'),content);
    submit.onclick=()=>{const answer=field.querySelector('input:checked')?.value;if(!answer){status.textContent='請先選擇判斷。';return;}const correct=answer===(shown===2?'reason':l.answer);record.protocol='topology-application-v1';record[key]||={answer,correct,at:new Date().toISOString()};if(shown===1&&correct)record.observationPassed=true;if(shown===2&&correct)record.reasonPassed=true;session.rows[id]=record;save();if(shown!==0&&!correct){status.textContent='對照數字和適用範圍再想一次，首次判斷會保留。';return;}shown=stage();render();};
   }else{
    el('p','已完成這組條件的預測、操作、觀察與原因練習。',content);
    const next=el('button',lessons.findIndex(l=>l.id===id)<3?'用同樣的方法，進入下一種電路':'回到工程主線做獨立驗證',content);next.id='application-next';next.className='application-primary';next.onclick=()=>{const index=lessons.findIndex(l=>l.id===id);if(index<3)choose(lessons[index+1].id,true);else location.assign(new URL(CircuitUnifiedLearning.route('core-physics'),new URL('../',location.href)));};
   }
   el('p',l.boundary,content).className='application-boundary';const detail=el('details',undefined,content);el('summary','計算來源與已存紀錄',detail);const card=R.describe(l.modelId);el('p',card.id+' · '+card.version+' · '+card.owner,detail);el('p','工作點計算與頻率響應是不同 API；此處表格使用工作點，原圖沿用自己的頻率響應。',detail);
   if(record.operated)el('p','操作時間：'+record.operatedAt,detail);
  }
  try{
   await R.loadTopologyContracts(new URL('../',location.href));const stored=E.load().benchmark.learningWorkspace?.topologyApplications;
   if(stored&&(stored.version!==1||!stored.rows||typeof stored.rows!=='object'||Array.isArray(stored.rows)))throw Error('已有紀錄格式不符，保留資料並停止寫入。');
   session=stored||{version:1,rows:{}};
   for(const lesson of lessons){const r=session.rows[lesson.id];if(r?.operated&&lesson.metrics.some(([key])=>!Number.isFinite(r.before?.result?.[key])||!Number.isFinite(r.after?.result?.[key])))throw Error('已有模型對照不完整，保留資料並停止寫入。');}
   for(const lesson of lessons){const b=el('button','返回這個電路的引導練習');b.className='application-return';b.onclick=()=>{choose(lesson.id,true);panel.scrollIntoView({block:'start'});};$(lesson.section).prepend(b);}
   choose(lessons.some(l=>l.id===session.currentLesson)?session.currentLesson:lessons[0].id);
   for(const key of new Set(lessons.flatMap(l=>Object.keys(l.baseline))))$(key).addEventListener('input',()=>{if(!applying&&Object.hasOwn(plan.before,key))render();});
   if(location.hash==='#guided-applications')panel.scrollIntoView({block:'start'});
  }catch(e){status.textContent=e.message;}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
