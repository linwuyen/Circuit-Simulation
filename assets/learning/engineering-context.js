(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CircuitEngineeringContext=api;})(globalThis,function(){
  'use strict';
  // A read-only join of canonical owners. No model equations, routes, grades or storage here.
  function cleanPath(value){
    let path;try{path=decodeURIComponent(String(value||''));}catch{return null;}
    if(/^[a-z]+:/i.test(path)||path.startsWith('/')||path.split('/').includes('..'))return null;
    path=path.split(/[?#]/)[0];return !path||path.endsWith('/')?path+'index.html':path;
  }
  function resolve(input,owners){
    const path=cleanPath(input.path),{map=[],curriculum,registry,facts,unified,flow}=owners;
    if(!path||!facts||!registry||!unified||!flow)return {known:false,status:'UNKNOWN',models:[],competencies:[],topics:[],reason:'缺少可驗證的頁面或 canonical owner'};
    const home=['index.html','learn.html'].includes(path),shared=path==='learning-case.html';
    const entry=map.find(m=>path.startsWith(m.href.split('/')[0]+'/'));
    const module=entry&&curriculum?.modules.find(m=>Number(m.number)===entry.number);
    const matches=module?[...module.lessons,...module.labs,...module.faults].filter(item=>cleanPath(item.href)===path):[];
    const explicit=[...new Set(matches.map(i=>i.modelId).filter(Boolean))];
    let modelIds=explicit;
    if(home||shared||path==='15_power_capstone/learn_basics.html')modelIds=['buck-steady-v1'];
    else if(/^15_power_capstone\/lab_(sandbox|dma|state_v2|multifault|code_trace)\.html$/.test(path))modelIds=['generic-power-causal-kernel'];
    const topology=home&&input.hash==='#topology';
    if(topology)modelIds=['buck-ccm-control-output-esr','boost-ccm-control-output'];
    const continuous=home&&(!input.hash||input.hash.startsWith('#experiment'));
    if(continuous)modelIds=['generic-power-causal-kernel'];
    const precise=modelIds.length>0;
    if(!precise&&module)modelIds=registry.forModule(module.id).map(c=>c.id);
    const models=modelIds.map(id=>registry.describe(id)||{id,title:id,claim:'UNKNOWN',boundary:'此 model ID 尚未登錄，不推論數值來源。'});
    const number=topology?17:continuous?15:home||shared?0:entry?.number;
    const topics=number!==undefined?(facts.moduleTopics[number]||[]):[];
    let task=home?'basic-'+(unified.basics.find(([id])=>'#'+id===input.hash)?.[0]||'duty'):shared?'case':entry?'module-'+entry.number:null;
    if(entry?.number===19){const layer=new URLSearchParams(input.search||'').get('layer');task='core-'+(flow.layerKeys.includes(layer)?layer:flow.snapshot().currentLayer);}
    if(home&&['#error','#adjust','#overshoot'].includes(input.hash))task='bridge-'+input.hash.slice(1);
    if(continuous)task='experiment';
    if(topology)task='topology';
    const known=!!(home||shared||entry);
    return {known,status:known?'MODEL_ONLY':'UNKNOWN',path,moduleNumber:number,title:home?(topology?'降壓／升壓同條件比較':continuous?'連續電路實驗':'入門工作台'):shared?'同一案例的模型鏡頭':entry?.title||'尚未登錄的頁面',
      task:unified.validTask(task)?task:null,topics,models,mapping:precise?'PAGE_MODEL':models.length?'MODULE_SCOPE':'UNMAPPED',
      competencies:[...new Set(matches.map(i=>i.competency).filter(Boolean))],
      prerequisites:module?.prerequisites||[],items:matches.map(i=>({id:i.id,title:i.title||i.symptom,competency:i.competency})),
      evidenceOwner:(continuous||topology)?'Evidence V5 / PlainCourse 教學練習（不授予正式能力成績）':entry?.number===19?'CoreFlow / outcome-session / physical-board-closure / board-evidence':'Evidence V5 / learning-assessment / lab-verification-contracts',
      boundary:topology?'沿用元件條件，比較既有 CCM 解析工作點；不帶入切換暫態、控制器或故障狀態。固定教學練習不授予正式能力或真板認證。':continuous?'全部連續實驗使用同一切換電路核心；每次從相同零能量起點重跑，保留條件與紀錄。這是教學模型，沒有真板或正式測驗認證。':home?'前五課是固定比例穩態電路；後三課為獨立修正示意，不是同一個閉環。':shared?'共用工作點，時間與頻率鏡頭的假設不同；不可把結果混成同一模型。':entry?.number===19?'教學、SIL、HIL、target image 與真板證據分層判定。此面板不讀取或授予 BOARD_PASS。':'這裡列出模型來源與範圍；精確數值及驗證仍由原頁面與 model owner 負責。',
      faults:Object.keys(facts.faultTaxonomy)};
  }
  function graph(curriculum,facts){
    const nodes=[],edges=[],seen=new Set();const add=(id,type,label)=>{if(!seen.has(id)){seen.add(id);nodes.push({id,type,label});}};
    for(const[id,label]of Object.entries(facts.taxonomy))add('topic:'+id,'topic',label);
    for(const module of curriculum.modules){
      add('module:'+module.id,'module',module.title);
      for(const topic of facts.moduleTopics[Number(module.number)]||[])edges.push({from:'module:'+module.id,to:'topic:'+topic,type:'covers'});
      for(const item of [...module.lessons,...module.labs,...module.faults]){
        add(item.id,'item',item.title||item.symptom);edges.push({from:item.id,to:'module:'+module.id,type:'belongsTo'});
        if(item.competency){add('competency:'+item.competency,'competency',item.competency);edges.push({from:item.id,to:'competency:'+item.competency,type:'teachesOrPractices'});}
      }
    }
    return {nodes,edges,claim:'CURRICULUM_RELATIONSHIPS_ONLY',boundary:'Relationships do not award learning evidence; missing model/assessment coverage remains a gap.'};
  }
  return {cleanPath,resolve,graph};
});
