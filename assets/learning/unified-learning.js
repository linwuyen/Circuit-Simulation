(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.CircuitUnifiedLearning=api;})(globalThis,function(root){
  'use strict';
  const basics=[['duty','導通比例','physics'],['inductor','電感續流','physics'],['load','負載與模型邊界','physics'],['probe','量測倍率','sensing'],['timing','更新時刻','timing']];
  function coreLayers(){
    const owner=root.CircuitCoreFlowV1||(typeof require==='function'?require('./core-flow-v1.js'):null);
    if(!owner)throw new Error('CoreFlow must load before resolving the engineering path');
    return owner.layers.map(layer=>[layer.key,layer.label]);
  }
  function coreTasks(){for(const [id,title] of coreLayers())tasks['core-'+id]={title:title+'主線任務',href:'19_c2000_buck_firmware_lab/index.html?layer='+id};}
  const stages=[
    {id:'physics',title:'1. 看懂電路',question:'開關、電感、電容與負載如何一起作用？',modules:[0],layers:['physics'],basics:['duty','inductor','load'],focus:'先比較電感電流，再看輸出；基礎已會就接漣波與模型邊界。'},
    {id:'sensing',title:'2. 相信量測之前',question:'真實電流如何變成控制器讀到的數字？',modules:[1,9,12],layers:['sensing'],basics:['probe'],focus:'真實量 → 感測／放大 → ADC 電壓 → 數字 → 還原值。'},
    {id:'feedback',title:'3. 讓輸出跟上目標',question:'同一個誤差，如何連到波形、頻率響應與控制步驟？',modules:[4,16,18],layers:['feedback','dynamics'],basics:[],focus:'先看時間波形，再開頻率與控制工具；不要重做另一套不相干的例子。'},
    {id:'timing',title:'4. 趕上更新時刻',question:'取樣、計算、更新，哪一步讓命令晚了一拍？',modules:[6,13],layers:['timing'],basics:['timing'],focus:'共看一條時間軸：取樣 → 算完 → 硬體更新。'},
    {id:'production',title:'5. 讓資料完整又新鮮',question:'收到資料是否就能當成有效的新命令？',modules:[5,8],layers:['production'],basics:[],focus:'送出 → 完整接收 → 發布 → 使用；SPI 與 DAC 是具體裝置案例。'},
    {id:'safety',title:'6. 故障後安全停下',question:'誰先關掉輸出？什麼條件下才能重新啟動？',modules:[14,7,15],layers:['safety','evidence'],basics:[],focus:'偵測 → 關閉 → 鎖定 → 有條件復歸 → 新條件驗證。BMS 接觸器規則另行學習。'},
    {id:'transfer',title:'7. 換一種應用',question:'哪些觀念可以帶走，哪些模型必須重建？',modules:[2,3,10,11,17,19],layers:[],basics:[],focus:'電源、馬達、電網與電池各自分流；共用控制語言，不照搬模型與保護規則。'}
  ];
  const categories={physics:'physics',sensing:'unit',timing:'timing',dynamics:'model'};
  const tasks={applications:{title:'把比較方法帶到四種電路',href:'17_power_topology_control/index.html#guided-applications'},topology:{title:'沿用條件，比較降壓與升壓',href:'index.html#topology'},experiment:{title:'連續電路實驗',href:'index.html#experiment'},home:{title:'學習總覽',href:'learn.html'},case:{title:'同一案例實驗',href:'learning-case.html'},sandbox:{title:'進階 Buck 量測',href:'15_power_capstone/lab_sandbox.html#training-workbench'},repair:{title:'盲測維修',href:'15_power_capstone/lab_multifault.html#repair-training'},formal:{title:'正式測驗與間隔複習',href:'19_c2000_buck_firmware_lab/index.html?layer=evidence'},quiz:{title:'既有題庫複習',href:'quiz.html'}};
  basics.forEach(([id,title])=>tasks['basic-'+id]={title,href:'index.html#'+id});
  ['error','adjust','overshoot'].forEach((id,i)=>tasks['bridge-'+id]={title:['離目標還差多少','讓輸出自己靠近目標','理解調過頭'][i],href:'index.html#'+id});
  const clone=x=>JSON.parse(JSON.stringify(x));
  function registerModules(modules){for(const m of modules)tasks['module-'+m.number]={title:m.title,href:m.href};}
  function validTask(id){coreTasks();return typeof id==='string'&&Object.hasOwn(tasks,id);}
  function task(id){return validTask(id)?tasks[id]:tasks.home;}
  function basicDone(r){return !!(r?.first&&r.observed===true&&r.transferPassed===true&&(r.proof?.observation===true&&r.proof?.reason===true));}
  function dueReview(e,at=Date.now()){
    const o=e?.benchmark?.outcomeV1;if(!o?.sessions?.post?.completedAt)return null;
    return ['r1','r2','r3','r4'].find(k=>!o.sessions[k]?.completedAt&&Number.isFinite(Date.parse(o.retention?.[k]?.dueAt))&&Date.parse(o.retention[k].dueAt)<=at)||null;
  }
  function next(e={},flow={},at=Date.now()){
    const u=e.benchmark?.unifiedLearning||{},rows=e.benchmark?.beginnerLessons?.rows||{};
    const due=dueReview(e,at);if(due)return {id:'formal',reason:'正式測驗排定的間隔複習已到期；完成後再接續課程。',phase:due};
    if(root.CircuitAssessment&&Object.values(e.questions||{}).some(answer=>root.CircuitAssessment.metrics(answer,at).due))return{id:'quiz',reason:'既有題庫有已到期的間隔複習，先取回已學過的觀念。'};
    const hand=u.returnTask;
    if(hand&&validTask(hand.id)&&categories[hand.id.replace('core-','')]===hand.category&&categories[hand.id.replace('core-','')]&& !flow.completed?.[hand.id.replace('core-','')]){
      if(!hand.passedAt)return {id:hand.id,remediation:hand.category,reason:'先完成從原任務開啟的短實驗與新條件題。'};
      return {id:hand.id,reason:'補強新條件題已通過，回到原任務完成原題驗證。'};
    }
    const applications=e.benchmark?.learningWorkspace?.topologyApplications;
    if(applications?.version===1&&!applications.completed&&u.track!=='core'&&u.track!=='specialize')return{id:'applications',reason:'接續原工具中的電路比較、觀察與原因判斷。'};
    const experiment=e.benchmark?.learningWorkspace?.experiment;
    if(experiment?.version===1&&!experiment.completed&&u.track!=='core'&&u.track!=='specialize')return {id:'experiment',reason:'接續同一台電路的連續實驗；原有課程成績保留。'};
    const topology=e.benchmark?.learningWorkspace?.topologyTransfer;
    if((experiment?.completed||topology)&&u.track!=='core'&&u.track!=='specialize'&&topology?.completed!==true)return{id:'topology',reason:'沿用手動條件，辨認降壓與升壓能共用的觀念和不同限制。'};
    if(topology?.completed===true&&!applications?.completed&&u.track!=='core'&&u.track!=='specialize')return{id:'applications',reason:'把同一種比較方法帶到 PFC、隔離電源、LLC 與逆變器。'};
    const begun=Object.keys(flow.predictions||{}).length>0||Object.keys(flow.completed||{}).length>0;
    if(!experiment?.completed&&(u.track==='beginner'||(!begun&&u.track!=='core'&&u.track!=='specialize'))){
      const missing=basics.find(([id])=>!basicDone(rows[id]));if(missing)return{id:'basic-'+missing[0],reason:'接續尚未完成的入門練習；已完成的課不重做。'};
      const bridge=['error','adjust','overshoot'].find(id=>!basicDone(e.benchmark?.bridgeLessons?.rows?.[id]));if(bridge)return{id:'bridge-'+bridge,reason:'接著練習目標、調整與調過頭，再進入完整電路。'};
    }
    if(u.track==='specialize')return{id:'module-17',reason:'你選擇進階選修，可從應用分流挑選專題。'};
    const missing=coreLayers().find(([id])=>!flow.completed?.[id]);
    if(missing){const id=missing[0],p=flow.predictions?.[id];return {id:'core-'+id,remediation:p&&!p.correct&&!flow.remediations?.[id]?categories[id]:undefined,reason:p&&!p.correct&&!flow.remediations?.[id]?'這一層的首次判斷需要補強；完成後返回原任務。':'接續八層主線尚未完成的能力；原有完成紀錄保留。'};}
    return {id:'repair',reason:'八層主線已完成，使用未知故障與新條件驗證整體理解。'};
  }
  function ability(stage,e={},flow={}){
    const rows=e.benchmark?.beginnerLessons?.rows||{};
    return {basics:stage.basics.filter(id=>basicDone(rows[id])).length,basicTotal:stage.basics.length,core:stage.layers.filter(id=>!!flow.completed?.[id]).length,coreTotal:stage.layers.length,transfer:stage.basics.filter(id=>rows[id]?.transferPassed===true).length};
  }
  function read(){return root.CircuitEvidence?.load().benchmark.unifiedLearning||{version:1,track:'auto',scenarios:{}};}
  function write(patch){const E=root.CircuitEvidence;if(!E)throw new Error('學習儲存尚未載入');const state=E.load();state.benchmark.unifiedLearning={...read(),...clone(patch),version:1};E.save(state);root.dispatchEvent?.(new Event('learning:unified-change'));return read();}
  function beginReturn(id,category){if(!validTask(id)||categories[id.replace('core-','')]!==category)throw new Error('未知補強來源');return write({returnTask:{id,category,startedAt:Date.now(),passedAt:null}});}
  function finishReturn(category,session){const r=read().returnTask;if(!r||r.category!==category||!session?.miniCompleted||!session.transferPassed||!session.first||!Number.isFinite(session.at)||session.at<r.startedAt)return false;write({returnTask:{...r,passedAt:Date.now()}});return true;}
  function route(id,origin){const href=task(id).href;if(!validTask(origin))return href;const [p,h]=href.split('#');return p+(p.includes('?')?'&':'?')+'learnFrom='+encodeURIComponent(origin)+(h?'#'+h:'');}
  function remediationRoute(id,category){if(categories[id.replace('core-','')]!==category)throw new Error('Unknown remediation mapping');return '15_power_capstone/lab_sandbox.html?remediation='+category+'&learnFrom='+id+'#training-remediation';}

  function validateScenario(raw){
    if(!raw||raw.family!=='buck-steady-v1'||raw.version!==1||!raw.model)throw new Error('設定屬於不同模型，不能直接套用');
    const owner=root.CircuitTrainingExperiments||(typeof require==='function'?require('../training-experiments-core.js'):null);
    if(!owner)throw new Error('Buck model owner must load before accepting shared settings');
    const input={};for(const k of Object.keys(owner.BUCK_INPUTS)){const v=raw.model[k];if(typeof v!=='number'||!Number.isFinite(v))throw new Error('設定超出範圍：'+k);input[k]=v;}
    const model=owner.buckConfig(input);
    return {version:1,family:'buck-steady-v1',model,source:validTask(raw.source)?raw.source:'case',savedAt:typeof raw.savedAt==='string'?raw.savedAt:null};
  }
  function saveScenario(model,source){const scenario=validateScenario({version:1,family:'buck-steady-v1',model,source,savedAt:new Date().toISOString()});write({scenarios:{...read().scenarios,'buck-steady-v1':scenario}});return scenario;}
  return {basics,get layers(){return coreLayers();},stages,tasks,categories,registerModules,validTask,task,basicDone,dueReview,next,ability,read,write,beginReturn,finishReturn,route,remediationRoute,validateScenario,saveScenario};
});
