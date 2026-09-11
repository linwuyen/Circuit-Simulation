(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.CircuitWorkspace=api;})(globalThis,function(root){
 'use strict';
 const ids=['duty','inductor','load','probe','timing','error','adjust','overshoot'];
 const titles=['開久一點，輸出會怎樣？','關掉開關，電流就停了嗎？','用電變少，哪裡不同？','數字變小，就是電流變小嗎？','算完，就立刻生效嗎？','離目標還差多少？','怎麼讓它自己靠近目標？','為什麼調太多，反而來回晃？'];
 const abilities=['比較開關時間與輸出','辨認關閉後仍在流動的電流','找出電流停下的區間','分辨電路電流與儀器顯示','分辨算完與生效','看出目標與量測的差距','理解先量再調的過程','辨認過度修正造成的來回變化'];
 const resources={duty:[0],inductor:[0],load:[0],probe:[1,9,12],timing:[6,13],error:[4],adjust:[4,18],overshoot:[4,16,18]};
 const defaults={vin:48,duty:.25,inductanceUh:100,fswKhz:100,loadOhm:5,capacitanceUf:220,esrOhm:0};
 function plan(id,current){
  if(!ids.includes(id))throw new Error('未知課程');
  if(id==='duty'||id==='load')return {...defaults};
  if(id==='inductor')return {...defaults,vin:current.vin,duty:current.duty>=.25&&current.duty<=.5?current.duty:.25};
  return {...current};
 }
 function changed(a,b){return Object.keys(defaults).filter(k=>a[k]!==b[k]);}
 function apply(id,value,model){
  const next={...model};if(id==='duty')next.duty=value/100;if(id==='load')next.loadOhm=value;return next;
 }
 function locate(raw){const id=String(raw||'').replace(/^#/,'');return ids.includes(id)?id:null;}
 function transfer(id,current){
  const cases={
   duty:{model:{...defaults,vin:36,duty:.5},note:'輸入換成 36 V，每輪開關打開一半。'},
   inductor:{model:{...defaults,vin:36,duty:.5},note:'這次電感右端為 18 V，開關已關閉。'},
   load:{model:{...defaults,vin:36,loadOhm:100},note:'換成 36 V 輸入，觀察每輪都有電流停下的區間。'},
   probe:{model:{...defaults,loadOhm:4},note:'電路真實電流為 3 A，實際探棒 10 倍、儀器設定 1 倍。',probe:1},
   timing:{model:{...current,fswKhz:200},note:'每 5 微秒更新一次，6 微秒算完。',ready:6,period:5},
   error:{model:{...current},note:'示意目標換成 15 V，目前量到 12 V。',target:15,initial:12},
   adjust:{model:{...current},note:'示意目標 10 V、目前 7 V，這次補上差距的一半。',target:10,initial:7,gain:.5},
   overshoot:{model:{...current},note:'示意目標 10 V、目前 8 V，這次補上差距的 1.2 倍。',target:10,initial:8,gain:1.2}
  };return cases[id];
 }
 function bucket(id){return ids.indexOf(id)<5?'beginnerLessons':'bridgeLessons';}
 function history(rows,entry){return [...(Array.isArray(rows)?rows:[]),JSON.parse(JSON.stringify(entry))].slice(-20);}
 function experimentLessons(){return (root.CircuitEngineeringCurriculum||(typeof require==='function'?require('./engineering-curriculum.js'):null)).workbenchLessons;}
 const experimentDefaults={vin:48,cycles:1600,controlPeriodUs:10,plantDtUs:.25,inductanceUh:500,capacitanceUf:220,commandProfile:[{cycle:0,vref:24}],loadProfile:[{cycle:0,ohm:12}],controlMode:'manual',manualDuty:.25,kpV:.2,kiV:40,kpI:.05,kiI:100,sensorGain:1,computeUs:1.7,tripCurrent:18,detailCycle:1500};
 function experimentPlan(id){const lessons=experimentLessons(),index=lessons.findIndex(l=>l.id===id);if(index<0)throw Error('未知連續實驗');let before=JSON.parse(JSON.stringify(experimentDefaults));for(let i=0;i<index;i++)before={...before,...lessons[i].prepare,...lessons[i].change};const prepared={...before,...lessons[index].prepare};return {before,prepared,after:{...prepared,...lessons[index].change}};}
 function experimentRun(config){const registry=root.CircuitModelRegistry||(typeof require==='function'?require('./model-registry.js'):null);return registry.run('generic-power-causal-kernel',config);}
 function experimentTransfer(plan){return {before:{...plan.prepared,vin:36},after:{...plan.after,vin:36}};}
 return {experimentLessons,experimentPlan,experimentRun,experimentTransfer,ids,titles,abilities,resources,defaults,plan,changed,apply,transfer,locate,bucket,history};
});
