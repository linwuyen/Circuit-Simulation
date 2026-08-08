(function (global) {
  "use strict";
  const Contracts=global.CircuitLabVerificationContracts, Oracles=global.CircuitLabOracles, Assessment=global.CircuitAssessment, Schema=global.CircuitSchema, raw=global.CircuitCurriculum, Learning=global.CircuitLearning;
  if(!Contracts||!Oracles||!Assessment||!Schema||!raw||!Learning) throw new Error("V7 verification dependencies missing");
  const curriculum=Schema.normalizeCurriculum(raw), coverage=Contracts.coverage(curriculum), errors=Contracts.validate(curriculum,Oracles);
  if(errors.length) throw new Error("V7 verification contract invalid: "+errors.join(" | "));

  const aIds=Contracts.list.filter(item=>item.gradeCeiling==="A").map(item=>item.labId);
  if(Array.isArray(Assessment.MEASUREMENT_ORACLE_LABS)) {
    Assessment.MEASUREMENT_ORACLE_LABS.splice(0,Assessment.MEASUREMENT_ORACLE_LABS.length,...aIds);
  }

  const baseReasoning=Assessment.evaluateReasoning.bind(Assessment);
  Assessment.evaluateReasoning=function(labId,draft,context){
    const result=baseReasoning(labId,draft,context), gate=Contracts.reasoningGate(labId,draft||{}), scores={...result.scores};
    if(!gate.passed){
      if(gate.checks.some(item=>item.name.startsWith("mechanism-")&&!item.ok)) scores.mechanism=0;
      if(gate.checks.some(item=>item.name.startsWith("boundary-")&&!item.ok)) scores.boundary=0;
    }
    const total=Object.values(scores).reduce((sum,value)=>sum+Number(value||0),0), essential=scores.claim>=1&&scores.evidence>=1&&scores.mechanism>=1;
    return{...result,scores,total,essential,passed:essential&&total>=8&&gate.passed,contractGate:gate};
  };

  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const methodLabel=contract=>contract.method==="independent-oracle"?"Independent oracle":contract.method==="machine-contract"?"Machine + reasoning contract":contract.method;
  const summaryHtml=()=>`<section class="notice v7-verification-summary"><strong>V7 verification closure：</strong>${coverage.classified}/${coverage.total} labs classified · ${coverage.aCapable} A-capable independent oracles · ${coverage.modules.filter(x=>x.aCapable>0).length}/${coverage.modules.length} modules have an A path。A 代表獨立驗證教材/模型契約，不代表硬體認證。</section>`;

  function annotateLabs(){
    document.querySelectorAll("#labGrid .lab").forEach(card=>{
      const id=card.querySelector("code")&&card.querySelector("code").textContent.trim(),contract=Contracts.get(id);if(!contract)return;
      const list=card.querySelector(".field-list");if(list&&!card.querySelector("[data-v7-contract]"))list.insertAdjacentHTML("beforeend",`<li data-v7-contract><b>Verification contract</b><span>${esc(methodLabel(contract))} · ceiling ${esc(contract.gradeCeiling)} · ${esc(contract.modelScope)}</span></li>`);
      [...card.querySelectorAll(".field-list li")].forEach(li=>{const b=li.querySelector("b"),span=li.querySelector("span");if(b&&span&&/Independent oracle/i.test(b.textContent)){span.textContent=contract.gradeCeiling==="A"?"有；A-capable，需獨立 PASS + reasoning gate":"不設假 oracle；此任務 ceiling B";}});
    });
    const main=document.getElementById("mainContent");if(main&&!main.querySelector(".v7-verification-summary"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",summaryHtml());
  }
  function annotateHome(){const main=document.getElementById("mainContent");if(main&&!main.querySelector(".v7-verification-summary"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",summaryHtml());}
  function annotateProgress(){
    const main=document.getElementById("mainContent");if(!main)return;
    if(!main.querySelector(".v7-verification-summary"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",summaryHtml());
    const matrix=document.getElementById("coverageMatrix");if(matrix&&!document.getElementById("labContractMatrix"))matrix.insertAdjacentHTML("afterend",`<section class="section-head" id="labContractMatrix"><h2>Lab verification contracts</h2><p class="muted">${coverage.classified}/${coverage.total} classified；${coverage.aCapable} A-capable。沒有單一 ground truth 的診斷/調參/紀錄型 lab 明確停在 B ceiling，不以假 oracle 冒充獨立真值。</p><div class="lab-grid">${coverage.modules.map(row=>`<article class="lab"><span class="tag">${esc(row.moduleId)}</span><h3>${row.classified}/${row.total} classified</h3><p>A-capable ${row.aCapable}</p></article>`).join("")}</div></section>`);
  }
  function annotateReport(){
    const select=document.getElementById("labSelect"),brief=document.getElementById("reportBrief");if(!select||!brief)return;
    const render=()=>{const contract=Contracts.get(select.value),old=document.getElementById("v7ReportContract");if(old)old.remove();if(contract)brief.insertAdjacentHTML("beforeend",`<p id="v7ReportContract"><b>Verification：</b>${esc(methodLabel(contract))} · ceiling ${esc(contract.gradeCeiling)} · scope ${esc(contract.modelScope)}</p>`);};
    render();select.addEventListener("change",()=>setTimeout(render,0));
  }

  function wrap(name,after){const original=Learning[name];if(typeof original!=="function")return;Learning[name]=function(){const value=original.apply(this,arguments);after();return value;};}
  wrap("renderHome",annotateHome);wrap("renderLabs",annotateLabs);wrap("renderProgress",annotateProgress);wrap("renderReport",annotateReport);

  global.CircuitVerificationV7={version:"7.0.0",coverage,contracts:Contracts.list,aCapableLabs:aIds,errors};
})(window);