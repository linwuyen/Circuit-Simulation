(function(global){
  "use strict";
  const Assessment=global.CircuitAssessment,AssessmentV8=global.CircuitAssessmentV8,Quiz=global.CircuitQuizBank,Anchors=global.CircuitExternalAnchorsV8,Typed=global.CircuitTypedObservables,Mutation=global.CircuitMutationV8,Oracles=global.CircuitLabOracles,Registry=global.CircuitModelRegistry,Learning=global.CircuitLearning,Evidence=global.CircuitEvidence,Schema=global.CircuitSchema,raw=global.CircuitCurriculum;
  if(!Assessment||!AssessmentV8||!Quiz||!Anchors||!Learning||!Evidence||!Schema||!raw)throw new Error("V8 external-validity dependencies missing");
  AssessmentV8.install(Assessment,Quiz);if(Typed&&Oracles)Typed.install(Oracles);
  const anchorErrors=Anchors.validate(),anchorSummary=Anchors.summary();if(anchorErrors.length)throw new Error("V8 external anchor invalid: "+anchorErrors.join(" | "));
  const mutationSummary=Mutation&&Oracles&&Registry?Mutation.run(Oracles,Registry):null;
  const curriculum=Schema.normalizeCurriculum(raw),esc=value=>String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const moduleLabel=id=>(curriculum.modules.find(m=>m.id===id)||{title:id}).title;
  const v8CoverageBindings={
    "inverter.shoot-through.safety":{moduleId:"inverter",labId:"inverter.lab.inv-shoot"},
    "foc.park.frame":{moduleId:"foc",labId:"foc.lab.foc-park"},
    "pi.integrator.crossover":{moduleId:"pi",labId:"pi.lab.pi-ki"},
    "loop10us.deadline.budget":{moduleId:"loop10us",labId:"loop10us.lab.loop-budget"},
    "bms.failsafe.convergence":{moduleId:"bms",labId:"bms.lab.bms-failsafe"},
    "ad5543.code.mapping":{moduleId:"ad5543",labId:"ad5543.lab.dac-code"},
    "afe.phase.power":{moduleId:"afe",labId:"afe.lab.afe-phase"},
    "acmc.protection.boundary":{moduleId:"acmc-pro",labId:"acmc-pro.lab.acmc-protection"},
    "dds.phase.power":{moduleId:"c2000-dds",labId:"c2000-dds.lab.dds-pf"},
    "opamp.large-signal.slew-rate":{moduleId:"opamp",labId:"opamp.lab.opamp-sine"}
  };
  if(!Assessment.__v8CoverageInstalled){
    const baseCoverage=Assessment.coverageSummary.bind(Assessment);
    Assessment.coverageSummary=function(curr,qs,oracleIds){
      const summary=baseCoverage(curr,qs,oracleIds),rows=(summary.rows||[]).map(row=>({...row})),by=new Map(rows.map(row=>[row.competency,row]));
      Object.entries(v8CoverageBindings).forEach(([competency,binding])=>{const row=by.get(competency)||{competency,lesson:false,lab:false,oracle:false,transfer:false,retention:false,moduleId:binding.moduleId};row.moduleId=binding.moduleId;row.lab=true;row.oracle=!!(Oracles&&Oracles.supports&&Oracles.supports(binding.labId));row.status=row.oracle&&row.transfer&&row.retention?"verified":row.transfer&&row.retention?"measured":"practiced";by.set(competency,row);});
      const outRows=[...by.values()].map(row=>({...row,status:row.oracle&&row.transfer&&row.retention?"verified":row.transfer&&row.retention?"measured":row.lab?"practiced":row.lesson?"taught":"unmeasured"}));
      const moduleRows=(curr&&curr.modules||[]).map(module=>{const items=outRows.filter(row=>row.moduleId===module.id),measured=items.filter(row=>row.transfer&&row.retention).length,verified=items.filter(row=>row.oracle&&row.transfer&&row.retention).length;return{moduleId:module.id,title:module.title,total:items.length,measured,verified,coveragePct:items.length?Math.round(measured/items.length*100):0};});
      return{...summary,total:outRows.length,measured:outRows.filter(row=>row.transfer&&row.retention).length,verified:outRows.filter(row=>row.oracle&&row.transfer&&row.retention).length,rows:outRows,moduleRows};
    };
    Object.defineProperty(Assessment,"__v8CoverageInstalled",{value:true,enumerable:false});
  }
  const summaryHtml=()=>`<section class="notice v8-validity-summary"><strong>V8 external validity：</strong>${anchorSummary.passed}/${anchorSummary.total} golden anchors pass · ${anchorSummary.modules}/12 modules anchored${mutationSummary?` · mutation FDR ${mutationSummary.detected}/${mutationSummary.total} (${Math.round(mutationSummary.rate*100)}%)`:""}。A 仍不等於硬體認證；External Anchor 是另一個獨立維度。</section>`;
  function questions(){return Assessment.expandQuestions(Quiz.getQuestions(curriculum));}
  function state(){const s=Evidence.load();Assessment.normalizeFamilyState(s,questions());Evidence.save(s);return s;}
  function addAfterHero(html){const main=document.getElementById("mainContent");if(main&&!main.querySelector(".v8-validity-summary"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",html);}
  function anchorMatrix(){return `<section class="section-head" id="externalAnchorMatrix"><h2>External Reality Anchors</h2><p class="muted">第三條真相來源：教材 model 與 independent oracle 之外，再對公開 equation / datasheet / safety contract 做 golden-vector check。不是 hardware certification。</p></section><section class="fault-table">${anchorSummary.results.map(r=>`<article class="fault-row"><div><b>${esc(moduleLabel(r.moduleId))}</b><code>${esc(r.anchorId)}</code></div><div><b>Kind</b><p>${esc(r.kind)}</p></div><div><b>Scope</b><p>${esc(r.scope)}</p></div><div><b>Golden vector</b><span class="tag">${r.passed?"PASS":"FAIL"}</span></div><div><b>Source</b><p>${esc(r.source)}</p></div></article>`).join("")}</section>`;}
  function adaptivePanel(){const s=state(),qs=questions(),ranked=Assessment.rankNextTasks?Assessment.rankNextTasks(s,qs,Date.now(),30).slice(0,5):[],psy=Assessment.psychometricSummary?Assessment.psychometricSummary(s,qs):{usable:0,provisional:0,insufficient:0};return `<section class="section-head" id="adaptiveV8"><h2>Adaptive next actions</h2><p class="muted">排序只使用已量到的 transfer / retention / confidence；資料不足時不假裝精準。Psychometric evidence：usable ${psy.usable} · provisional ${psy.provisional} · insufficient ${psy.insufficient}。</p></section><section class="lab-grid">${ranked.map((x,i)=>`<article class="lab"><span class="tag">#${i+1} · ${esc(x.moduleId)}</span><h3>${esc(x.competency)}</h3><p>${esc(x.reason)}</p><p class="muted">score ${x.score} · 約 ${x.estimatedMinutes} min</p><a class="button primary" href="quiz.html?module=${encodeURIComponent(x.moduleId)}">開始這個能力</a></article>`).join("")||'<article class="lab"><h3>目前沒有到期或未完成的量測任務</h3></article>'}</section>`;}
  function annotateHome(){addAfterHero(summaryHtml());}
  function annotateLabs(){addAfterHero(summaryHtml());}
  function annotateProgress(){addAfterHero(summaryHtml());const main=document.getElementById("mainContent");if(!main)return;if(!document.getElementById("externalAnchorMatrix"))main.insertAdjacentHTML("beforeend",anchorMatrix());if(!document.getElementById("adaptiveV8"))main.insertAdjacentHTML("beforeend",adaptivePanel());}
  function annotateQuiz(){addAfterHero(summaryHtml());const main=document.getElementById("mainContent");if(main&&!document.getElementById("adaptiveV8"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",adaptivePanel());}
  function annotateTrouble(){addAfterHero(summaryHtml());const games=global.CircuitEngineeringChallenges&&global.CircuitEngineeringChallenges.diagnosticGames||[];const main=document.getElementById("mainContent");if(main&&!document.getElementById("diagnosticCoverageV8"))main.querySelector(".hero")?.insertAdjacentHTML("afterend",`<section class="notice" id="diagnosticCoverageV8"><strong>Diagnostic coverage：</strong>${games.length} Bayesian cases，涵蓋 Buck / ADC / SPI / PI / FOC / real-time / BMS / DAC / AFE / ACMC。Information gain 仍由 posterior entropy 實算。</section>`);}
  function annotateReport(){addAfterHero(summaryHtml());}
  function wrap(name,after){const original=Learning[name];if(typeof original!=="function"||original.__v8Wrapped)return;const wrapped=function(){const value=original.apply(this,arguments);after();return value;};wrapped.__v8Wrapped=true;Learning[name]=wrapped;}
  wrap("renderHome",annotateHome);wrap("renderLabs",annotateLabs);wrap("renderProgress",annotateProgress);wrap("renderQuiz",annotateQuiz);wrap("renderTrouble",annotateTrouble);wrap("renderReport",annotateReport);
  global.CircuitVerificationV8={version:"8.0.0",anchorSummary,mutationSummary,v8CoverageBindings,questions,adaptive:()=>Assessment.rankNextTasks(state(),questions(),Date.now(),30)};
})(window);
