(async()=>{
  'use strict';
  if(window.top!==window)return;
  const base=new URL('../../',document.currentScript.src);
  const load=path=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,base);s.onload=resolve;s.onerror=()=>reject(new Error('教材導航載入失敗'));document.head.append(s);});
  try{
    if(!globalThis.CircuitEvidence)await load('assets/learning/learning-evidence.js');
    if(!globalThis.CircuitCoreFlowV1)await load('assets/learning/core-flow-v1.js');
    if(!globalThis.CircuitAssessment)await load('assets/learning/learning-assessment.js');
    if(!globalThis.CircuitUnifiedLearning)await load('assets/learning/unified-learning.js');
    if(!globalThis.CircuitLearningMap)await load('assets/learning/learning-map.js');
    if(!globalThis.CircuitLearningGlossary)await load('assets/learning/learning-glossary.js');
    const U=CircuitUnifiedLearning,E=CircuitEvidence,F=CircuitCoreFlowV1;
    U.registerModules(CircuitLearningMap);
    const url=(href)=>new URL(href,base).href;
    const relativePath=decodeURIComponent(location.pathname).slice(decodeURIComponent(base.pathname).length);
    const path=!relativePath||relativePath.endsWith('/')?relativePath+'index.html':relativePath;
    const params=new URLSearchParams(location.search),origin=params.get('learnFrom');
    function here(){
      if(path==='15_power_capstone/learn_basics.html')return 'basic-'+(U.basics.find(([id])=>'#'+id===location.hash)?.[0]||'duty');
      if(path==='19_c2000_buck_firmware_lab/index.html')return 'core-'+F.snapshot().currentLayer;
      if(path==='learning-case.html')return 'case';
      return 'module-'+(CircuitLearningMap.find(m=>path.startsWith(m.href.split('/')[0]+'/'))?.number??'');
    }
    const dock=document.createElement('aside');dock.className='learning-bridge';dock.id='learning-navigation';dock.setAttribute('aria-label','統一學習導航');
    document.body.prepend(dock);
    const make=(tag,text,parent)=>{const n=document.createElement(tag);if(text)n.textContent=text;parent?.append(n);return n;};
    function link(parent,text,href){const a=make('a',text,parent);a.href=url(href);return a;}
    function nextLink(parent){const n=U.next(E.load(),F.snapshot()),href=n.remediation?U.remediationRoute(n.id,n.remediation):U.route(n.id);const a=link(parent,'繼續學習：'+U.task(n.id).title,href);a.dataset.unifiedResume='';if(n.remediation)a.addEventListener('click',()=>U.beginReturn(n.id,n.remediation));return n;}
    let rendering=false;
    function render(){
      if(rendering)return;rendering=true;
      try{
        dock.replaceChildren();const nav=make('nav',null,dock);nav.setAttribute('aria-label','跨頁學習入口');
        link(nav,'學習總覽','learn.html');const n=nextLink(nav);link(nav,'同一案例實驗','learning-case.html'+(U.validTask(here())?'?learnFrom='+here():''));
        if(U.validTask(origin))link(nav,'返回原任務：'+U.task(origin).title,U.route(origin));
        const ticket=U.read().returnTask;
        if(ticket&&U.validTask(ticket.id)&&ticket.passedAt&&path==='15_power_capstone/lab_sandbox.html')make('p','補強新條件已通過。請返回原任務作答，原首次判斷保留。',dock);
        const details=make('details',null,dock);make('summary','此刻需要的工具與白話詞彙',details);
        make('p',n.reason,details);
        const active=U.stages.find(s=>s.layers.includes(here().replace('core-',''))||s.basics.includes(here().replace('basic-',''))||s.modules.includes(Number(here().replace('module-',''))));
        if(active){make('p',active.focus,details);const list=make('div',null,details);list.className='learning-links';for(const m of CircuitLearningMap.filter(m=>active.modules.includes(m.number)))link(list,m.title,U.route('module-'+m.number,U.validTask(origin)?origin:here()));}
        const words=make('details',null,details);make('summary','查一個詞，不必離開目前任務',words);
        for(const [term,meaning]of Object.entries(CircuitLearningGlossary)){const d=make('details',null,words);make('summary',term,d);make('p',meaning,d);}
        if(document.querySelector('[data-learning-hub]'))renderHub(n);
      }finally{rendering=false;}
    }
    function renderHub(n){
      const hub=document.querySelector('[data-learning-hub]');hub.replaceChildren();
      make('h1','沿著同一條路學習',hub);make('p','先接續目前任務；只有需要時才打開專題。能力紀錄共用，入門練習、主線完成與正式測驗分開呈現。',hub);
      const resume=make('section',null,hub);resume.className='learning-next';make('h2','你現在的下一步',resume);nextLink(resume);make('p',n.reason,resume);
      const label=make('label','學習起點 ',resume),select=make('select',null,label);select.id='learning-track';
      for(const[v,t]of [['auto','依已有進度接續'],['beginner','從入門補齊'],['core','直接進八層主線'],['specialize','挑選進階應用']]){const option=make('option',t,select);option.value=v;}
      select.value=U.read().track||'auto';select.addEventListener('change',()=>U.write({track:select.value}));
      const ticket=U.read().returnTask;if(ticket){const cancel=make('button','結束這次補強往返',resume);cancel.type='button';cancel.addEventListener('click',()=>U.write({returnTask:null}));}
      const e=E.load(),flow=F.snapshot();
      for(const stage of U.stages){
        const section=make('section',null,hub);section.id=stage.id;section.className='learning-stage';make('h2',stage.title,section);make('p',stage.question,section);make('p',stage.focus,section);
        const a=U.ability(stage,e,flow);make('p',[a.basicTotal?`入門練習 ${a.basics}/${a.basicTotal} · 入門新條件 ${a.transfer}/${a.basicTotal}（練習）`:null,a.coreTotal?`主線完成 ${a.core}/${a.coreTotal}`:null].filter(Boolean).join(' · ')||'依應用選擇專題，沿用前面學會的量測、回授與時序觀念。',section);
        const actions=make('div',null,section);actions.className='learning-links';
        for(const id of stage.basics)if(!U.basicDone(e.benchmark?.beginnerLessons?.rows?.[id]))link(actions,'補基礎：'+U.task('basic-'+id).title,U.route('basic-'+id));
        for(const id of stage.layers)link(actions,(flow.completed?.[id]?'回顧：':'主線：')+U.task('core-'+id).title,U.route('core-'+id));
        const tools=make('details',null,section);make('summary','需要時展開專題工具',tools);const list=make('div',null,tools);list.className='learning-links';
        for(const m of CircuitLearningMap.filter(m=>stage.modules.includes(m.number)))link(list,m.title,U.route('module-'+m.number,stage.layers[0]?'core-'+stage.layers[0]:undefined));
      }
      const formal=make('section',null,hub);formal.className='learning-stage';make('h2','正式測驗與間隔複習',formal);
      const o=e.benchmark?.outcomeV1;make('p',`課前：${o?.sessions?.pre?.completedAt?'已完成':'尚未完成'}；課後：${o?.sessions?.post?.completedAt?'已完成':'尚未完成'}。不把入門作答或瀏覽頁面換算成正式測驗成績。`,formal);
      for(const[k,v]of Object.entries(o?.retention||{})){if(!/^r[1-4]$/.test(k))continue;const date=Date.parse(v.dueAt);make('p',`${k}：${o.sessions?.[k]?.completedAt?'已完成':Number.isFinite(date)?'預定 '+new Date(date).toLocaleDateString():'尚未排定'}`,formal);}
      link(formal,'開啟原正式測驗與複習',U.route('formal'));
      const histories=Object.values(e.questions||{}).map(answer=>CircuitAssessment.metrics(answer));
      make('p',`既有題庫：${histories.filter(x=>x.transfer).length} 個題族已通過新題；${histories.filter(x=>x.retained).length} 個題族有間隔取回紀錄；${histories.filter(x=>x.due).length} 個題族待複習。此統計沿用原題庫判準。`,formal);
      link(formal,'回到既有題庫',U.route('quiz'));
      const b=make('button','下載全部學習進度備份',formal);b.type='button';b.addEventListener('click',()=>{const u=URL.createObjectURL(new Blob([E.exportBackup()],{type:'application/json'})),a=make('a');a.href=u;a.download='circuit-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});link(formal,'還原備份','15_power_capstone/lab_sandbox.html#training-pilot');
      make('p',E.storageStatus().saved?'進度儲存在這個瀏覽器。':'目前無法寫入瀏覽器，離開前請下載備份。',formal);
    }
    const requested=params.get('remediation');
    if(U.validTask(origin)&&U.categories[origin.replace('core-','')]===requested){const old=U.read().returnTask;if(!old||old.id!==origin||old.category!==requested)U.beginReturn(origin,requested);}
    document.addEventListener('learning:remediation-passed',event=>{U.finishReturn(event.detail.category,event.detail);render();});
    // Keep the original task while navigating deeper inside a supporting module.
    document.addEventListener('click',event=>{
      const a=event.target.closest('a[href]');if(!a||!U.validTask(origin)||a.hasAttribute('download'))return;
      const target=new URL(a.href,location.href),folder=path.split('/')[0];
      if(target.origin===base.origin&&decodeURIComponent(target.pathname).startsWith(decodeURIComponent(base.pathname)+folder+'/')&&!target.searchParams.has('learnFrom')){target.searchParams.set('learnFrom',origin);a.href=target.href;}
    },true);
    window.addEventListener('learning:unified-change',render);window.addEventListener('circuit:core-flow-change',render);window.addEventListener('storage',render);window.addEventListener('hashchange',render);
    // Coalesce ordinary input/click changes so existing lesson handlers finish saving first.
    let queued=false;document.addEventListener('click',event=>{if(event.target.closest('.learning-bridge,[data-learning-hub]'))return;if(!queued){queued=true;setTimeout(()=>{queued=false;render();},0);}});
    render();globalThis.CircuitLearningBridge={base,url,render};document.dispatchEvent(new Event('learning:bridge-ready'));
  }catch(error){const p=document.createElement('p');p.className='learning-bridge';p.textContent=error.message+'；原教材仍可使用。';document.body.prepend(p);}
})();
