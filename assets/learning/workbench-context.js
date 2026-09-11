(function(root){
  'use strict';
  // Presentation adapter only: joins existing owners lazily; no localStorage, formulas or grading.
  const pending=new Map();
  const instances=new Set();
  window.addEventListener('hashchange',()=>{for(const item of instances){if(!item.details.isConnected)instances.delete(item);else item.update();}});
  function script(path,base){const url=new URL(path,base).href;if(pending.has(url))return pending.get(url);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{pending.delete(url);reject(Error('無法載入 '+path));};document.head.append(s);});pending.set(url,p);return p;}
  async function owners(base){
    if(!root.CircuitCurriculum)await script('assets/learning/curriculum.js',base);
    if(root.CircuitCurriculum.modules.length<19)for(const file of ['opamp-module.js','power-firmware-modules.js','control-transforms-module.js','power-topology-control-module.js','control-unification-module.js'])await script('assets/learning/'+file,base);
    for(const[global,file]of [['CircuitSchema','curriculum-schema-v3.js'],['CircuitModels','engineering-models.js'],['CircuitModelRegistry','model-registry.js'],['CircuitEngineeringCurriculum','engineering-curriculum.js'],['CircuitEngineeringContext','engineering-context.js']])if(!root[global])await script('assets/learning/'+file,base);
    if(root.CircuitModelRegistry.loadTopologyContracts)await root.CircuitModelRegistry.loadTopologyContracts(base);
    return {curriculum:root.CircuitSchema.normalizeCurriculum(root.CircuitCurriculum),registry:root.CircuitModelRegistry,facts:root.CircuitEngineeringCurriculum,map:root.CircuitLearningMap,unified:root.CircuitUnifiedLearning,flow:root.CircuitCoreFlowV1};
  }
  function mount(parent,base){
    if(parent.querySelector('[data-engineering-context]'))return;
    if(!document.querySelector('link[data-workbench-context-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('assets/learning/workbench-context.css',base).href;link.dataset.workbenchContextStyle='';document.head.append(link);}
    const el=(tag,text,target)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(target)target.append(n);return n;};
    const details=el('details',undefined,parent);details.className='engineering-context';details.dataset.engineeringContext='';
    el('summary','把目前問題接回完整工程鏈：模型、五視圖與證據',details);
    const body=el('div',undefined,details);let loaded=false,ownerSet;
    function current(){const path=decodeURIComponent(location.pathname).slice(decodeURIComponent(base.pathname).length);return root.CircuitEngineeringContext.resolve({path,search:location.search,hash:location.hash},ownerSet);}
    function draw(){
      const c=current(),F=ownerSet.facts,U=ownerSet.unified;body.replaceChildren();
      el('h2',c.title||'工程情境',body);el('p',c.boundary||c.reason,body);
      el('small','目前學習範圍：'+(c.topics.map(id=>F.taxonomy[id]+' / '+id).join(' · ')||'UNKNOWN：尚未對應'),body);
      const tabs=el('div',undefined,body);tabs.className='ec-tabs';tabs.setAttribute('aria-label','共用五視圖');const panel=el('section',undefined,body);panel.className='ec-view';panel.setAttribute('aria-live','polite');
      function view(key){const v=F.views[key];panel.replaceChildren();el('h3',v.title,panel);const flow=el('div',undefined,panel);flow.className='ec-flow';v.flow.forEach((text,i)=>{if(i)el('i','→',flow).setAttribute('aria-hidden','true');el('span',text,flow);});el('p',v.note,panel);for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.view===key));}
      for(const[key,v]of Object.entries(F.views)){const b=el('button',v.title,tabs);b.type='button';b.dataset.view=key;b.onclick=()=>view(key);}view('physical');
      el('small','這五個視圖是同一套定位語言；不會修改本頁模擬器或把不同模型的數字混在一起。',body);
      el('h3','這個數字由誰計算？',body);el('p',c.mapping==='PAGE_MODEL'?'已對應本頁模型。':c.mapping==='MODULE_SCOPE'?'以下是模組層級的模型；尚不能保證每個頁面數值都已逐項對應。':'UNKNOWN：本頁尚無精確註冊模型。請使用原頁面的模型說明，不推測數值來源。',body);
      const models=el('div',undefined,body);models.className='ec-models';
      for(const model of c.models){const article=el('article',undefined,models);article.className='ec-model';el('h3',model.title,article);el('code',model.id+' · '+(model.version||'UNKNOWN'),article);el('p','Owner：'+(model.owner||'描述性模型，沒有可執行計算'),article);
        el('p','輸入：'+Object.entries(model.inputs||{}).map(([k,v])=>`${k} (${v})`).join('，'),article);el('p','輸出：'+Object.entries(model.outputs||{}).map(([k,v])=>`${k} (${v})`).join('，'),article);
        el('p','適用假設：'+(model.assumptions||[]).join('；'),article);el('p','邊界：'+(model.boundary||(model.invalidWhen||[]).join('；')),article);
        if(model.contractStatus==='PARTIAL')el('p','契約尚未完整：可用範圍仍有待驗證項目。',article);
        if(model.testIds?.length)el('small','回歸檢查：'+model.testIds.join('、'),article);
      }
      if(c.moduleNumber===17){const p=el('p','拓撲的 equation / IO / boundary 由 model-contracts-v1.json 管理。',body);const a=el('a','查看 canonical contract',p);a.href=new URL('assets/learning/model-contracts-v1.json',base).href;}
      el('p','已對應能力：'+(c.competencies.join('、')||'尚未逐項對應；不據此授予能力完成。'),body);
      el('p','先備項目：'+(c.prerequisites.join('、')||'本頁沒有明列的先備 ID；依原有學習路線接續。'),body);
      const truth=el('p','此面板的狀態：'+c.status+'。'+(c.evidenceOwner?'證據由 '+c.evidenceOwner+' 判定。':'')+'沒有實體量測就不能宣稱 BOARD_PASS；模擬與頁面瀏覽不會改写真板或正式測驗成績。',body);truth.className='ec-truth';
      const diagnosis=el('details',undefined,body);el('summary','遇到問題，怎麼選下一個量測？',diagnosis);el('p',F.diagnosticChain.join(' → '),diagnosis);el('p',Object.entries(F.faultTaxonomy).map(([id,label])=>label+' / '+id).join(' · '),diagnosis).className='ec-faults';
      const nav=el('nav',undefined,body);nav.className='ec-navigation';nav.setAttribute('aria-label','返回同一學習路徑');
      const source=new URLSearchParams(location.search).get('learnFrom');
      const origin=U.validTask(source)?source:c.task;
      const link=(label,task)=>{const a=el('a',label,nav);a.href=new URL(U.route(task,origin),base).href;return a;};
      link('用既有連續電源核心驗證','sandbox');link('回到核心工程主線','core-physics');
      const next=U.next(root.CircuitEvidence.load(),ownerSet.flow.snapshot());
      const resume=link('保留原紀錄，接著學',next.id);
      if(next.remediation){resume.href=new URL(U.remediationRoute(next.id,next.remediation),base).href;resume.onclick=()=>U.beginReturn(next.id,next.remediation);}
      el('small','這裡只提供情境與來源；操作紀錄仍留在 Evidence V5，下一步仍由 UnifiedLearning 決定。',body);
    }
    details.addEventListener('toggle',async()=>{if(!details.open)return;try{if(!loaded){body.textContent='正在讀取既有課程與模型來源…';ownerSet=await owners(base);loaded=true;}draw();}catch(error){body.replaceChildren();el('p',error.message+'。原教材仍可繼續操作。',body);const b=el('button','重試載入來源',body);b.type='button';b.onclick=()=>{loaded=false;details.open=false;details.open=true;};}});
    for(const item of instances)if(!item.details.isConnected)instances.delete(item);
    instances.add({details,update:()=>{if(loaded&&details.open)draw();}});
  }
  root.CircuitWorkbenchContext={mount};
})(globalThis);
