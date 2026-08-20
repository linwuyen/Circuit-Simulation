(function (global) {
  "use strict";
  const Learning=global.CircuitLearning,Store=global.CircuitPowerSystemStateV1,Stages=global.CircuitPowerStagesV1;
  if(!Learning||typeof Learning.renderHome!=="function"||!Store||!Stages)return;
  const previousRenderHome=Learning.renderHome;
  const stageOrder=[Stages.timing,Stages.feedback,Stages.dynamics,Stages.topology,Stages.protection,Stages.debug].filter(Boolean);
  function mount(root){if(!root||root.querySelector("[data-power-system-live]"))return;const anchor=root.querySelector(".journey-system-explain");if(!anchor)return;anchor.insertAdjacentHTML("afterend",`<div class="power-system-live" data-power-system-live>${stageOrder.map(s=>s.markup()).join("")}</div>`);const live=root.querySelector("[data-power-system-live]"),apis=[];stageOrder.forEach(s=>{const panel=live.querySelector(`[data-power-stage="${s.index}"]`);apis.push(s.mount(root,panel));});function sync(){const index=Number(Store.get("ui.activeStage")||0);live.querySelectorAll("[data-power-stage]").forEach(p=>{p.hidden=Number(p.dataset.powerStage)!==index;});const api=apis[stageOrder.findIndex(s=>s.index===index)];if(api&&api.render)api.render();}const unsubscribe=Store.subscribe((_,change)=>{if(change.path==="ui.activeStage")sync();});sync();global.CircuitPowerSystemLiveV1={Store,Stages,apis,destroy(){unsubscribe();apis.forEach(a=>a&&a.destroy&&a.destroy());}};}
  Learning.renderHome=function renderHomeWithPowerSystem(rootId){previousRenderHome(rootId);mount(document.getElementById(rootId));};
})(window);
