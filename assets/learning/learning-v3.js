(function (global) {
  "use strict";

  const Schema = global.CircuitSchema;
  const QuizBank = global.CircuitQuizBank;
  const ModelRegistry = global.CircuitModelRegistry;
  const Evidence = global.CircuitEvidence;
  const Assessment = global.CircuitAssessment;
  const Challenges = global.CircuitEngineeringChallenges || null;
  const raw = global.CircuitCurriculum;
  if (!Schema || !QuizBank || !ModelRegistry || !Evidence || !Assessment || !raw) {
    throw new Error("Learning runtime dependencies missing");
  }

  const curriculum = Schema.normalizeCurriculum(raw);
  const modules = curriculum.modules;
  const baseQuestions = QuizBank.getQuestions(curriculum);
  const questions = Assessment.expandQuestions(baseQuestions);
  const familyGroups = Assessment.families(questions);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const now = () => new Date().toISOString();

  function loadState() {
    const state = Evidence.load();
    Assessment.normalizeFamilyState(state, questions);
    Evidence.save(state);
    return state;
  }
  const saveState = state => Evidence.save(state);
  const evidenceLevel = (state, id) => Evidence.evidenceLevel(state, id);
  const levelName = level => ["未開始","已瀏覽","已操作","已有證據","已保留"][Math.max(0, Math.min(4, Number(level) || 0))];
  const strengthName = value => value === "A" ? "A · machine verified" : value === "B" ? "B · preregistered + machine" : value === "C" ? "C · human only/post-hoc" : "—";

  function nav(active) {
    const items = [["index.html","總入口","home"],["beginner.html","初學路線","beginner"],["labs.html","實驗任務","labs"],["troubleshooting.html","故障速查","trouble"],["progress.html","進度","progress"],["quiz.html","診斷測驗","quiz"],["glossary.html","詞彙表","glossary"],["search.html","搜尋","search"],["report.html","工程工作單","report"]];
    return `<a class="skip-link" href="#mainContent">跳到主要內容</a><nav class="topnav" aria-label="主要導覽"><a class="brand" href="index.html"><span class="brand-mark">SIM</span><span>電路模擬說明</span></a><div class="navlinks">${items.map(item => `<a ${item[2] === active ? 'aria-current="page" class="active"' : ""} href="${item[0]}">${item[1]}</a>`).join("")}</div></nav>`;
  }

  function modelCards(module) {
    const cards = ModelRegistry.forModule(module.id);
    if (!cards.length) return "";
    return `<div class="model-card-grid">${cards.map(card => `<article class="model-card"><div class="model-card-head"><span class="tag blue">${esc(card.executable ? "EXECUTABLE" : card.type)}</span><strong>${esc(card.title)}</strong></div><p class="muted">v${esc(card.version || "0")} · ${esc(card.type)}</p><div><b>適用假設</b><ul>${(card.assumptions || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><b>停止相信模型的條件</b><ul>${(card.invalidWhen || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></article>`).join("")}</div>`;
  }

  function reportQuality(draft) {
    const checks = {
      prediction: /\S+/.test(draft.prediction || "") && /(增|減|升|降|變|不變|方向|正|負|高|低|大|小)/.test(draft.prediction || ""),
      parameters: /\d/.test(draft.parameters || "") && /(V|A|Hz|kHz|MHz|Ω|ohm|H|F|%|bit|count|µ|m|s)/i.test(draft.parameters || ""),
      observation: /\S{8,}/.test(draft.observation || ""),
      explanation: /\S{12,}/.test(draft.explanation || "") && (draft.explanation || "").trim() !== (draft.prediction || "").trim(),
      limitations: /\S{8,}/.test(draft.limitations || ""),
      transfer: /\S{8,}/.test(draft.transfer || "")
    };
    return { checks, humanValid: Object.values(checks).every(Boolean), missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key) };
  }

  const familyMetrics = (familyId, state) => Assessment.mastery(familyId, state, questions, Date.now());

  function renderHome(rootId) {
    const root = document.getElementById(rootId);
    const state = loadState();
    const benchmark = Assessment.benchmarkSummary(state, questions, Date.now());
    const cal = benchmark.calibration || {};
    const delta = benchmark.deltaPoints == null ? "—" : `${benchmark.deltaPoints >= 0 ? "+" : ""}${benchmark.deltaPoints} pp`;
    const modes = [["beginner.html","BEGINNER","初學路線","建立單變因因果直覺。"],["labs.html","LABS","實驗任務","先預測，再操作，再驗證。"],["troubleshooting.html","DEBUG","故障速查","用最少測試排除假設。"],["progress.html","PROGRESS","學習進度","Stage 與 evidence strength 分開看。"],["quiz.html","QUIZ","診斷測驗","首次 transfer + spaced retention。"],["search.html","SEARCH","全域搜尋","搜尋能力、模型與故障。"],["glossary.html","WORDS","詞彙表","查跨主題工程名詞。"],["report.html","REPORT","工程工作單","Prediction commit → simulator → reasoning。"]];
    root.innerHTML = `${nav("home")}<main id="mainContent"><section class="hero"><div class="eyebrow">Predict → Test → Explain → Transfer → Retain</div><h1>工程能力訓練系統</h1><p class="lead">核心 KPI 是未見情境的首次判斷，不是完成頁數。</p></section><section class="metric-grid"><div class="metric"><span class="tag blue">Paired baseline</span><h3>${benchmark.baselineAccuracy == null ? "—" : benchmark.baselineAccuracy + "%"}</h3><p>同時有 baseline 與 transfer 的 competency。</p></div><div class="metric"><span class="tag green">Paired transfer</span><h3>${benchmark.transferAccuracy == null ? "—" : benchmark.transferAccuracy + "%"}</h3><p>unseen variant 第一次作答。</p></div><div class="metric"><span class="tag amber">Δ · N=${benchmark.pairedN}</span><h3>${delta}</h3><p>paired 差，不混 denominator。</p></div><div class="metric"><span class="tag rose">Calibration</span><h3>${cal.calibrationGap == null ? "—" : `${cal.calibrationGap >= 0 ? "+" : ""}${cal.calibrationGap} pp`}</h3><p>信心 − 實際正確率。</p></div></section><section class="notice"><strong>證據規則：</strong>Prediction 必須先 commit；machine interaction 不等於 machine verification；模型版本會跟 evidence 一起保存。</section><section class="mode-grid">${modes.map(x => `<a class="mode" href="${x[0]}"><span class="tag">${x[1]}</span><h2>${x[2]}</h2><p>${x[3]}</p></a>`).join("")}</section><section class="section-head"><h2>完整主題</h2><p class="muted">所有正式入口共用 normalized curriculum 與 V5 evidence。</p></section><section class="lab-grid">${modules.map(m => `<a class="lab" href="${esc(m.entry)}"><div class="lesson-meta"><span class="num">${esc(m.number)}</span><span class="tag">${esc(m.tag)}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.oneLine)}</p><small class="muted">${m.lessons.length} 課 · ${m.labs.length} 實驗</small></a>`).join("")}</section></main>`;
  }

  function renderBeginner(rootId) {
    const root = document.getElementById(rootId);
    const render = () => {
      const state = loadState();
      root.innerHTML = `${nav("beginner")}<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence ladder</div><h1>初學者拆解路線</h1><p class="lead">Tutor 與正式頁面共用 canonical ID；手動記錄只作備援。</p></section><section class="module-grid">${modules.map(m => `<article class="module"><div class="module-head"><div class="module-title"><div><span class="tag">${esc(m.tag)}</span><h2>${esc(m.title)}</h2><p class="muted">${esc(m.whyUseful)}</p></div><a class="button primary" href="${esc(m.entry)}">開啟入口</a></div>${modelCards(m)}</div><div class="module-body"><div class="lesson-list">${m.lessons.map((l,i) => { const ev=state.evidence[l.id]||{}; return `<article class="lesson"><div class="lesson-meta"><span class="tag blue">第 ${i+1} 步</span><span class="evidence-level level-${evidenceLevel(state,l.id)}">${levelName(evidenceLevel(state,l.id))}</span></div><h3>${esc(l.title)}</h3><code>${esc(l.competency)}</code><ul class="field-list"><li><b>目標</b><span>${esc(l.objective)}</span></li><li><b>操作</b><span>${esc(l.action)}</span></li><li><b>判讀</b><span>${esc(l.expectedObservation)}</span></li><li><b>Evidence</b><span>${esc(strengthName(ev.strength))} · ${Number(ev.machineCount||0)} snapshots</span></li></ul><div class="actions"><a class="button primary" data-view="${esc(l.id)}" href="${esc(l.href)}">開啟這步</a><button class="button" data-practice="${esc(l.id)}" type="button">手動記錄已操作</button></div></article>`; }).join("")}</div></div></article>`).join("")}</section></main>`;
      root.querySelectorAll("[data-view]").forEach(a => a.addEventListener("click", () => Evidence.recordEvidence(a.dataset.view,1,"v3-view",{href:a.getAttribute("href")})));
      root.querySelectorAll("[data-practice]").forEach(b => b.addEventListener("click", () => { Evidence.recordEvidence(b.dataset.practice,2,"manual-practice"); render(); }));
    };
    render();
  }

  function renderLabs(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.labs.map(lab => ({module,lab})));
    const state = loadState();
    root.innerHTML = `${nav("labs")}<main id="mainContent"><section class="hero"><div class="eyebrow">Prediction first</div><h1>實驗任務</h1><p class="lead">強 evidence 必須先鎖定預測，再開 simulator；直接進 simulator 只能算練習。</p></section><section class="toolbar"><input class="search" id="labSearch" placeholder="搜尋任務、主題或能力"><span class="muted">共 ${rows.length} 個任務</span></section><section class="lab-grid" id="labGrid">${rows.map(({module,lab}) => { const ev=state.evidence[lab.id]||{}, pred=Evidence.predictionStatus(lab.id); return `<article class="lab" data-search="${esc([module.title,lab.title,lab.task,lab.competency].join(" "))}"><div class="lesson-meta"><span class="tag">${esc(module.tag)}</span><span class="evidence-level level-${evidenceLevel(state,lab.id)}">${levelName(evidenceLevel(state,lab.id))}</span></div><h3>${esc(lab.title)}</h3><code>${esc(lab.id)}</code><ul class="field-list"><li><b>任務</b><span>${esc(lab.task)}</span></li><li><b>成功條件</b><span>${esc(lab.success)}</span></li><li><b>Prediction</b><span>${pred.committed ? (pred.preRegistered ? "已預先鎖定" : "事後補寫") : "尚未 commit"}</span></li><li><b>Evidence</b><span>${esc(strengthName(ev.strength))} · ${Number(ev.machineCount||0)} snapshots</span></li></ul><div class="actions"><a class="button primary" href="report.html?labId=${encodeURIComponent(lab.id)}">開始驗證流程</a><a class="button" href="${esc(lab.href)}">直接模擬（練習）</a></div></article>`; }).join("")}</section></main>`;
    bindFilter("labSearch","#labGrid .lab");
  }

  function renderTrouble(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.faults.map(fault => ({module,fault})));
    const games = Challenges ? Challenges.diagnosticGames : [];
    root.innerHTML = `${nav("trouble")}<main id="mainContent"><section class="hero"><div class="eyebrow">Symptom → Hypothesis → Discriminating test</div><h1>故障診斷</h1><p class="lead">Diagnostic game 不先告訴答案，而是評分測試成本與 information gain。</p></section>${games.length ? `<section class="section-head"><h2>Diagnostic games</h2></section><section class="lab-grid" id="diagnosticGames">${games.map(game => `<article class="lab diagnostic-game" data-game="${esc(game.id)}"><span class="tag">${esc(game.moduleId)}</span><h3>${esc(game.title)}</h3><p><b>症狀：</b>${esc(game.symptom)}</p><div class="game-tests">${game.tests.map(test => `<button type="button" class="button" data-game-test="${esc(game.id)}" data-test="${esc(test.id)}">${esc(test.text)}</button>`).join("")}</div><div class="game-evidence" aria-live="polite"></div><h4>你的 root cause</h4><div class="game-causes">${game.causes.map(cause => `<button type="button" class="button" data-game-cause="${esc(game.id)}" data-cause="${esc(cause.id)}">${esc(cause.text)}</button>`).join("")}</div><p class="game-score" aria-live="polite"></p></article>`).join("")}</section>` : ""}<section class="section-head"><h2>故障速查</h2></section><section class="toolbar"><input class="search" id="faultSearch" placeholder="搜尋症狀、原因或測試"><span class="muted">共 ${rows.length} 個症狀</span></section><section class="fault-table" id="faultTable">${rows.map(({module,fault}) => `<article class="fault-row" data-search="${esc([module.title,fault.symptom,fault.cause,fault.verify,fault.fix].join(" "))}"><div><b>主題</b><span class="tag">${esc(module.tag)}</span></div><div><b>症狀</b><p>${esc(fault.symptom)}</p></div><div><b>假設</b><p>${esc(fault.cause)}</p></div><div><b>辨識性測試</b><p>${esc(fault.verify)}</p></div><div><b>修法</b><p>${esc(fault.fix)}</p><a class="button" href="${esc(fault.href)}">開啟</a></div></article>`).join("")}</section></main>`;
    bindFilter("faultSearch","#faultTable .fault-row");
    if (!games.length) return;
    const selections = {};
    root.querySelectorAll("[data-game-test]").forEach(button => button.addEventListener("click", () => {
      const game=games.find(x=>x.id===button.dataset.gameTest), test=game&&game.tests.find(x=>x.id===button.dataset.test); if(!game||!test)return;
      selections[game.id]=selections[game.id]||[]; if(!selections[game.id].includes(test.id)) selections[game.id].push(test.id);
      button.closest(".diagnostic-game").querySelector(".game-evidence").innerHTML += `<p><b>${esc(test.text)}：</b>${esc(test.result)} <small>cost ${test.cost} / IG ${test.informationGain}</small></p>`;
      button.disabled=true;
    }));
    root.querySelectorAll("[data-game-cause]").forEach(button => button.addEventListener("click", () => {
      const game=games.find(x=>x.id===button.dataset.gameCause); if(!game)return;
      const result=Challenges.scoreDiagnostic(game.id,selections[game.id]||[],button.dataset.cause); Evidence.recordDiagnosticGame(game.id,{...result,selectedTests:selections[game.id]||[],causeId:button.dataset.cause});
      button.closest(".diagnostic-game").querySelector(".game-score").textContent=result.solved?`Root cause 正確；效率分數 ${result.efficiency}/100。`:"Root cause 不符目前 evidence；繼續縮小假設。";
    }));
  }

  function renderQuiz(rootId) {
    const root = document.getElementById(rootId);
    const moduleFilter = new URLSearchParams(location.search).get("module");
    const startedAt = {};
    let feedback = null;
    function render() {
      const state=loadState();
      const groups=familyGroups.filter(group=>!moduleFilter||group.questions[0].moduleId===moduleFilter);
      const numeric=Challenges?Challenges.numericTasks.filter(task=>!moduleFilter||task.moduleId===moduleFilter):[];
      const cards=groups.map(group=>{
        const answer=state.questions[group.familyId],m=Assessment.mastery(group.familyId,state,questions,Date.now()),q=Assessment.nextQuestion(group.questions,answer,Date.now());
        if(!q)return `<article class="quiz-card"><span class="tag">${esc(group.questions[0].module.tag)}</span><h3>${esc(group.questions[0].competency)}</h3><p>${m.fullyRetained?"R4 完成：90-day retention 已驗證。":m.transfer?`Transfer 已通過；下一次 review：${esc(m.nextReviewAt||"尚未到期")}`:"目前無題目。"}</p></article>`;
        startedAt[q.id]=startedAt[q.id]||Date.now();
        const status=m.fullyRetained?"R4":m.retained?`R${m.retentionStage}`:m.due?"Review due":m.transfer?"Transfer pass":m.recovery?"Recovered":"Baseline/Transfer";
        return `<article class="quiz-card" data-current-question="${esc(q.id)}"><div class="quiz-head"><span class="tag">${esc(q.module.tag)} · ${esc(q.assessmentRole)} · ${esc(q.variantId)}</span><span class="evidence-level ${m.retained?"level-4":m.transfer?"level-3":"level-1"}">${esc(status)}</span></div><code>${esc(q.competency)}</code><h3>${esc(q.prompt)}</h3><label>作答信心<select data-confidence="${esc(group.familyId)}"><option value="0.5">50%</option><option value="0.7" selected>70%</option><option value="0.9">90%</option></select></label><div class="quiz-options">${q.options.map(option=>`<button type="button" class="quiz-option" data-question="${esc(q.id)}" data-family="${esc(group.familyId)}" data-option="${esc(option.id)}">${esc(option.text)}</button>`).join("")}</div><div class="quiz-result" aria-live="polite">${feedback&&feedback.familyId===group.familyId?feedback.html:""}</div></article>`;
      }).join("");
      const numericHtml=numeric.length?`<section class="section-head"><h2>Numeric open-response</h2><p class="muted">不給選項，只接受數值、單位與容差。</p></section><section class="lab-grid">${numeric.map(task=>`<article class="lab"><span class="tag">${esc(task.moduleId)}</span><h3>${esc(task.prompt)}</h3><div class="actions"><input class="search" style="max-width:180px" data-numeric-answer="${esc(task.id)}" inputmode="decimal" placeholder="數值"><input class="search" style="max-width:110px" data-numeric-unit="${esc(task.id)}" value="${esc(task.unit)}"><button type="button" class="button primary" data-numeric-submit="${esc(task.id)}">檢查</button></div><p data-numeric-result="${esc(task.id)}" aria-live="polite"></p></article>`).join("")}</section>`:"";
      root.innerHTML=`${nav("quiz")}<main id="mainContent"><section class="hero"><div class="eyebrow">Unseen first attempt</div><h1>診斷與遷移測驗</h1><p class="lead">答錯的 variant 只能算 recovery；transfer 只認下一個未見 variant 的第一次作答正確。</p></section><section class="quiz-list">${cards}</section>${numericHtml}</main>`;
      root.querySelectorAll("[data-question]").forEach(button=>button.addEventListener("click",()=>{
        const familyId=button.dataset.family,group=groups.find(g=>g.familyId===familyId),current=group&&Assessment.nextQuestion(group.questions,loadState().questions[familyId],Date.now());
        if(!current||current.id!==button.dataset.question)return;
        const option=current.options.find(x=>x.id===button.dataset.option); if(!option)return;
        const stateNow=loadState(),confidence=root.querySelector(`[data-confidence="${CSS.escape(familyId)}"]`);
        Assessment.recordAttempt(stateNow,current,option,{at:now(),elapsedMs:Math.max(0,Date.now()-(startedAt[current.id]||Date.now())),confidence:confidence?Number(confidence.value):0.7,hintsUsed:0}); saveState(stateNow);
        const correct=current.options.find(x=>x.correct); feedback={familyId,html:option.correct?`<div class="quiz-explain"><b>正確</b><p>${esc(option.feedback)}</p></div>`:`<div class="quiz-explain misconception"><b>可能迷思：${esc(option.misconception||"推理鏈不完整")}</b><p>${esc(option.feedback)}</p><p><strong>本 variant 正解：</strong>${esc(correct.text)}</p><p>這個 variant 已不能再當 transfer 證據；會換未見 variant。</p></div>`}; render();
      }));
      if(Challenges)root.querySelectorAll("[data-numeric-submit]").forEach(button=>button.addEventListener("click",()=>{
        const id=button.dataset.numericSubmit,answer=root.querySelector(`[data-numeric-answer="${CSS.escape(id)}"]`).value,unit=root.querySelector(`[data-numeric-unit="${CSS.escape(id)}"]`).value,previous=(loadState().openResponses[id]||[]).length,result=Challenges.evaluateNumeric(id,answer,unit);
        Evidence.recordOpenResponse(id,{...result,answer,enteredUnit:unit,firstAttempt:previous===0});
        root.querySelector(`[data-numeric-result="${CSS.escape(id)}"]`).textContent=result.correct?`正確。${result.explanation}`:`尚未通過；目前誤差 ${Number.isFinite(result.relativeError)?Math.round(result.relativeError*1000)/10+"%":"—"}。`;
      }));
    }
    render();
  }

  function moduleNext(module,state) {
    const lesson=module.lessons.find(item=>evidenceLevel(state,item.id)<2); if(lesson)return{label:`下一步：${lesson.title}`,href:lesson.href};
    const lab=module.labs.find(item=>evidenceLevel(state,item.id)<3); if(lab)return{label:`開始驗證：${lab.title}`,href:`report.html?labId=${encodeURIComponent(lab.id)}`};
    const groups=familyGroups.filter(group=>group.questions[0].moduleId===module.id); if(groups.some(group=>!familyMetrics(group.familyId,state).transfer))return{label:"完成 unseen transfer",href:`quiz.html?module=${module.id}`};
    if(groups.some(group=>familyMetrics(group.familyId,state).due))return{label:"做 spaced review",href:`quiz.html?module=${module.id}`};
    const index=modules.indexOf(module),next=modules.slice(index+1).find(item=>Assessment.moduleUnlocked(item.id,state,questions,Date.now()));return next?{label:`進入下一主題：${next.title}`,href:next.entry}:{label:"目前主線完成",href:"quiz.html"};
  }

  function renderProgress(rootId) {
    const root=document.getElementById(rootId),state=loadState(),bench=Assessment.benchmarkSummary(state,questions,Date.now());
    root.innerHTML=`${nav("progress")}<main id="mainContent"><section class="hero"><div class="eyebrow">Stage ≠ Evidence strength</div><h1>學習進度</h1><p class="lead">完成階段與證據可信度分開顯示；paired benchmark N=${bench.pairedN}。</p></section><section class="metric-grid"><div class="metric"><span>Paired baseline</span><h3>${bench.baselineAccuracy==null?"—":bench.baselineAccuracy+"%"}</h3></div><div class="metric"><span>Paired transfer</span><h3>${bench.transferAccuracy==null?"—":bench.transferAccuracy+"%"}</h3></div><div class="metric"><span>R1+ retained</span><h3>${bench.retained}</h3></div><div class="metric"><span>R4 retained</span><h3>${bench.fullyRetained}</h3></div></section><section class="progress-list">${modules.map(module=>{const items=[...module.lessons,...module.labs],counts=[1,2,3].map(level=>items.filter(item=>evidenceLevel(state,item.id)>=level).length),strengths={A:0,B:0,C:0};items.forEach(item=>{const s=state.evidence[item.id]&&state.evidence[item.id].strength;if(strengths[s]!=null)strengths[s]++;});const groups=familyGroups.filter(g=>g.questions[0].moduleId===module.id),retained=groups.filter(g=>familyMetrics(g.familyId,state).retained).length,next=moduleNext(module,state);return `<article class="progress-card"><div class="progress-title"><div><span class="tag">${esc(module.tag)}</span><h3>${esc(module.title)}</h3></div><a class="button primary" href="${esc(next.href)}">${esc(next.label)}</a></div><div class="evidence-grid"><div><b>已瀏覽</b><span>${counts[0]}/${items.length}</span></div><div><b>已操作</b><span>${counts[1]}/${items.length}</span></div><div><b>Verified stage</b><span>${counts[2]}/${items.length}</span></div><div><b>Retained</b><span>${retained}/${groups.length}</span></div><div><b>A 強證據</b><span>${strengths.A}</span></div><div><b>B 中證據</b><span>${strengths.B}</span></div><div><b>C 弱證據</b><span>${strengths.C}</span></div></div></article>`;}).join("")}</section><section class="panel state-tools"><h2>備份與安全合併</h2><div class="actions"><button class="button" id="exportState">匯出 V5</button><button class="button" id="importState">匯入並 semantic merge</button><input hidden type="file" id="stateFile" accept="application/json,.json"><span id="stateMessage" aria-live="polite"></span></div></section></main>`;
    document.getElementById("exportState").onclick=()=>download(JSON.stringify({...loadState(),exportedAt:now()},null,2),"circuit-learning-state-v5.json","application/json");
    document.getElementById("importState").onclick=()=>document.getElementById("stateFile").click();
    document.getElementById("stateFile").onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2_000_000)throw new Error("狀態檔過大");Evidence.merge(JSON.parse(await file.text()));location.reload();}catch(error){document.getElementById("stateMessage").textContent=error.message;}};
  }

  function renderReport(rootId) {
    const root=document.getElementById(rootId),allLabs=modules.flatMap(module=>module.labs.map(lab=>({module,lab}))),query=new URLSearchParams(location.search),requested=query.get("labId")||query.get("lab");
    root.innerHTML=`${nav("report")}<main id="mainContent"><section class="hero"><div class="eyebrow">Pre-register → Test → Explain</div><h1>工程工作單</h1><p class="lead">第一份 Prediction 在 simulator 前 commit 才算 preregistered；後續修訂保留完整 revision history。</p></section><section class="report-layout"><form class="panel form-grid" id="reportForm"><label>實驗<select id="labSelect"></select></label><div id="reportBrief"></div><fieldset id="predictionBox"><legend>0. Prediction Commit</legend><label>操作前預測<textarea id="prediction" placeholder="哪個變數改變？方向？為什麼？"></textarea></label><label>預設參數<textarea id="parameters" placeholder="例如 Vin=12 V, L=2.2 µH, fsw=500 kHz"></textarea></label><label>預測信心<select id="predictionConfidence"><option value="0.5">50%</option><option value="0.7" selected>70%</option><option value="0.9">90%</option></select></label><div class="actions"><button class="button primary" id="commitPrediction" type="button">鎖定預測</button><span id="predictionStatus" aria-live="polite"></span></div></fieldset>${[["observation","1. 實際觀察","數值、波形或狀態"],["explanation","2. 因果解釋","公式、能量流或時序"],["limitations","3. 模型限制","非理想項與不確定性"],["transfer","4. 遷移驗證","換一組條件重新判斷"],["nextStep","5. 下一步","下一個辨識性測試"]].map(field=>`<label>${field[1]}<textarea id="${field[0]}" placeholder="${field[2]}"></textarea></label>`).join("")}<div class="actions"><a class="button" id="openSimulator" aria-disabled="true">先鎖定預測才能開始</a><button class="button primary" id="completeReport" type="button">驗證並完成</button><button class="button" id="downloadReport" type="button">下載 Markdown</button></div><p id="machineEvidence"></p><p id="reportMessage" aria-live="polite"></p></form><pre class="report-preview" id="reportPreview"></pre></section></main>`;
    const select=document.getElementById("labSelect");
    select.innerHTML=allLabs.map(x=>`<option value="${esc(x.lab.id)}">${esc(x.module.title+" — "+x.lab.title)}</option>`).join("");
    const exact=allLabs.find(x=>x.lab.id===requested),legacy=allLabs.find(x=>x.lab.localId===requested);if(exact||legacy)select.value=(exact||legacy).lab.id;
    const fields=["observation","explanation","limitations","transfer","nextStep"];
    const current=()=>allLabs.find(x=>x.lab.id===select.value)||allLabs[0];
    const draft=()=>Object.fromEntries(fields.map(id=>[id,document.getElementById(id).value.trim()]));
    function combinedDraft(){const pred=Evidence.getPrediction(current().lab.id).active||{};return{prediction:pred.prediction||document.getElementById("prediction").value.trim(),parameters:pred.parameters||document.getElementById("parameters").value.trim(),...draft()};}
    function preview(){const x=current(),d=combinedDraft(),status=Evidence.predictionStatus(x.lab.id),verified=Evidence.machineEvents(x.lab.id).find(e=>e.verification&&e.verification.passed);document.getElementById("reportPreview").textContent=`# ${x.module.title} — ${x.lab.title}\n\nPrediction integrity: ${status.preRegistered?"preregistered":"post-hoc / not committed"}\nMachine oracle: ${verified?`PASS ${verified.verification.model.id}@${verified.verification.model.version}`:"not verified"}\n\n${Object.entries(d).map(([k,v])=>`## ${k}\n${v||"- 尚未填寫"}`).join("\n\n")}`;}
    function refresh(){const x=current(),report=Evidence.getReport(x.lab.id),pred=Evidence.getPrediction(x.lab.id),status=Evidence.predictionStatus(x.lab.id),events=Evidence.machineEvents(x.lab.id),verified=events.filter(e=>e.verification&&e.verification.passed),ev=Evidence.getEvidence(x.lab.id);fields.forEach(id=>document.getElementById(id).value=report[id]||"");const active=pred.active||{};document.getElementById("prediction").value=active.prediction||"";document.getElementById("parameters").value=active.parameters||"";document.getElementById("predictionConfidence").value=String(active.confidence||0.7);document.getElementById("reportBrief").innerHTML=`<p><b>任務：</b>${esc(x.lab.task)}</p><p><b>成功條件：</b>${esc(x.lab.success)}</p><code>${esc(x.lab.id)}</code>`;const open=document.getElementById("openSimulator");if(status.committed){open.href=x.lab.href;open.textContent="開啟模擬";open.setAttribute("aria-disabled","false");}else{open.removeAttribute("href");open.textContent="先鎖定預測才能開始";open.setAttribute("aria-disabled","true");}document.getElementById("predictionStatus").textContent=!status.committed?"尚未 commit":status.preRegistered?"✓ preregistered；第一版不可覆寫":"⚠ 已有 simulator evidence，這次 Prediction 屬事後補寫";document.getElementById("machineEvidence").textContent=`Machine: ${events.length} snapshots · structured pass ${verified.length} · ${strengthName(ev.strength)}`;preview();}
    function persist(){Evidence.setReport(current().lab.id,{...draft(),draft:true});preview();}
    document.getElementById("commitPrediction").onclick=()=>{try{Evidence.commitPrediction(current().lab.id,{prediction:document.getElementById("prediction").value,parameters:document.getElementById("parameters").value,confidence:Number(document.getElementById("predictionConfidence").value)});refresh();}catch(error){document.getElementById("predictionStatus").textContent=error.message;}};
    fields.forEach(id=>document.getElementById(id).addEventListener("input",persist));select.onchange=refresh;
    document.getElementById("completeReport").onclick=()=>{const x=current(),status=Evidence.predictionStatus(x.lab.id),d=combinedDraft(),quality=reportQuality(d),events=Evidence.machineEvents(x.lab.id),verified=events.filter(e=>e.verification&&e.verification.passed),machineCount=events.length,message=document.getElementById("reportMessage");if(!status.committed){message.textContent="尚不能完成：先鎖定 Prediction。";return;}if(!quality.humanValid){message.textContent="尚不能完成：補足具體觀察、因果解釋、模型限制與遷移。";return;}const strength=status.preRegistered&&verified.length?"A":status.preRegistered&&machineCount?"B":"C",provenance=verified.length?verified[verified.length-1].verification.model:null;Evidence.setReport(x.lab.id,{...d,quality:quality.checks,predictionRevision:status.first&&status.first.revision,preRegistered:status.preRegistered,machineCount,machineVerified:verified.length>0,modelProvenance:provenance});Evidence.recordEvidence(x.lab.id,3,"worksheet",{machineCount,preRegistered:status.preRegistered,modelProvenance:provenance},{stage:"verified",strength});message.textContent=`完成：Verified stage；Evidence strength ${strength}。`;refresh();};
    document.getElementById("downloadReport").onclick=()=>download(document.getElementById("reportPreview").textContent,current().lab.id+".md","text/markdown");refresh();
  }

  function renderSearch(rootId) {
    const root=document.getElementById(rootId),rows=[];
    modules.forEach(m=>{rows.push({type:"主題",tag:m.tag,title:m.title,body:[m.oneLine,m.whyUseful].join(" "),href:m.entry});m.lessons.forEach(x=>rows.push({type:"課程",tag:m.tag,title:x.title,body:[x.objective,x.action,x.expectedObservation,x.competency].join(" "),href:x.href}));m.labs.forEach(x=>rows.push({type:"實驗",tag:m.tag,title:x.title,body:[x.task,x.success,x.transferPrompt,x.competency].join(" "),href:"report.html?labId="+encodeURIComponent(x.id)}));m.faults.forEach(x=>rows.push({type:"故障",tag:m.tag,title:x.symptom,body:[x.cause,x.verify,x.fix].join(" "),href:x.href}));ModelRegistry.forModule(m.id).forEach(x=>rows.push({type:"模型",tag:m.tag,title:x.title,body:[...(x.assumptions||[]),...(x.invalidWhen||[]),...(x.references||[])].join(" "),href:m.entry}));});
    root.innerHTML=`${nav("search")}<main id="mainContent"><section class="hero"><div class="eyebrow">Unified index</div><h1>全域搜尋</h1></section><section class="toolbar"><input class="search" id="q" autofocus placeholder="例如 DCM、overrun、offset"><span id="count"></span></section><section class="lab-grid" id="results"></section></main>`;
    const q=document.getElementById("q"),results=document.getElementById("results"),count=document.getElementById("count");function render(){const term=q.value.trim().toLowerCase(),out=rows.filter(r=>!term||[r.title,r.body,r.tag,r.type].join(" ").toLowerCase().includes(term));count.textContent=`${out.length} / ${rows.length} 筆`;results.innerHTML=out.slice(0,120).map(r=>`<a class="lab" href="${esc(r.href)}"><span class="tag">${esc(r.type)} · ${esc(r.tag)}</span><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p></a>`).join("")||'<div class="empty">找不到符合內容。</div>';}q.oninput=render;render();
  }

  function renderGlossary(rootId) {
    const root=document.getElementById(rootId),terms=curriculum.glossary||[];
    root.innerHTML=`${nav("glossary")}<main id="mainContent"><section class="hero"><div class="eyebrow">Glossary</div><h1>全域詞彙表</h1></section><section class="toolbar"><input class="search" id="termSearch" placeholder="搜尋 ADC、PWM、Offset"><span>共 ${terms.length} 個詞彙</span></section><section class="lab-grid" id="terms">${terms.map(term=>`<article class="lab" data-search="${esc(term.join(" "))}"><span class="tag">${esc(term[0])}</span><h3>${esc(term[0])}</h3><p>${esc(term[1])}</p><ul class="field-list"><li><b>實務提示</b><span>${esc(term[2])}</span></li></ul></article>`).join("")}</section></main>`;bindFilter("termSearch","#terms .lab");
  }

  function bindFilter(id,selector){const input=document.getElementById(id);if(!input)return;input.oninput=()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll(selector).forEach(el=>el.hidden=!!q&&!String(el.dataset.search||el.textContent).toLowerCase().includes(q));};}
  function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type:type+";charset=utf-8"})),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

  global.CircuitLearning={curriculum,nav,loadState,saveState,reportQuality,renderHome,renderBeginner,renderLabs,renderTrouble,renderQuiz,renderProgress,renderReport,renderSearch,renderGlossary};
})(window);