(function (global) {
  "use strict";

  const Schema = global.CircuitSchema;
  const QuizBank = global.CircuitQuizBank;
  const ModelRegistry = global.CircuitModelRegistry;
  const raw = global.CircuitCurriculum;
  if (!Schema || !QuizBank || !ModelRegistry || !raw) throw new Error("Learning v3 dependencies missing");

  const curriculum = Schema.normalizeCurriculum(raw);
  const modules = curriculum.modules;
  const questions = QuizBank.getQuestions(curriculum);
  const STATE_KEY = "circuit-learning-state-v3";
  const V2_KEY = "circuit-learning-state-v2";
  const SCHEMA = "circuit-learning-state";
  const VERSION = 3;
  const REQUIRED_REPORT_FIELDS = ["prediction", "parameters", "observation", "explanation", "limitations", "transfer"];

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const now = () => new Date().toISOString();
  const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? fallback : v; } catch (_) { return fallback; } };

  function emptyState() {
    return { schema: SCHEMA, version: VERSION, evidence: {}, questions: {}, reports: {}, migratedV2: false, updatedAt: now() };
  }

  function normalizeState(value) {
    const state = value && value.schema === SCHEMA && value.version === VERSION ? value : emptyState();
    state.evidence = state.evidence && typeof state.evidence === "object" ? state.evidence : {};
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    state.reports = state.reports && typeof state.reports === "object" ? state.reports : {};
    return state;
  }

  function loadState() {
    const state = normalizeState(read(STATE_KEY, null));
    if (!state.migratedV2) {
      const old = read(V2_KEY, {});
      Object.entries(old.completed || {}).forEach(([id, value]) => {
        const mapped = Schema.resolveLegacyId ? Schema.resolveLegacyId(curriculum, id) : id;
        state.evidence[mapped] = { level: value && value.evidence === "worksheet" ? 3 : 2, at: value && value.at || now(), source: value && value.evidence || "v2" };
      });
      Object.assign(state.questions, old.questions || {});
      Object.entries(old.reports || {}).forEach(([id, report]) => {
        const mapped = Schema.resolveLegacyId ? Schema.resolveLegacyId(curriculum, id) : id;
        state.reports[mapped] = report;
      });
      state.migratedV2 = true;
      saveState(state);
    }
    return state;
  }

  function saveState(state) {
    state.updatedAt = now();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function nav(active) {
    const items = [["index.html","總入口","home"],["beginner.html","初學路線","beginner"],["labs.html","實驗任務","labs"],["troubleshooting.html","故障速查","trouble"],["progress.html","進度","progress"],["quiz.html","診斷測驗","quiz"],["glossary.html","詞彙表","glossary"],["search.html","搜尋","search"],["report.html","工程工作單","report"]];
    return '<a class="skip-link" href="#mainContent">跳到主要內容</a><nav class="topnav" aria-label="主要導覽"><a class="brand" href="index.html"><span class="brand-mark">SIM</span><span>電路模擬說明</span></a><div class="navlinks">' + items.map(i => '<a ' + (i[2] === active ? 'aria-current="page" class="active"' : '') + ' href="' + i[0] + '">' + i[1] + '</a>').join("") + '</div></nav>';
  }

  const levelName = level => ["未開始", "已瀏覽", "已操作", "已有證據", "已保留"][Math.max(0, Math.min(4, Number(level) || 0))];
  const evidenceLevel = (state, id) => Number(state.evidence[id] && state.evidence[id].level || 0);

  function setEvidence(state, id, level, source) {
    const current = state.evidence[id] || {};
    state.evidence[id] = { ...current, level: Math.max(Number(current.level || 0), level), source, at: now() };
  }

  function reportQuality(draft) {
    const checks = {
      prediction: /\S+/.test(draft.prediction || "") && /(增|減|升|降|變|不變|方向|正|負)/.test(draft.prediction || ""),
      parameters: /\d/.test(draft.parameters || "") && /(V|A|Hz|kHz|MHz|Ω|ohm|H|F|%|bit|count|µ|m)/i.test(draft.parameters || ""),
      observation: /\S{8,}/.test(draft.observation || ""),
      explanation: /\S{12,}/.test(draft.explanation || "") && (draft.explanation || "").trim() !== (draft.prediction || "").trim(),
      limitations: /\S{8,}/.test(draft.limitations || ""),
      transfer: /\S{8,}/.test(draft.transfer || "")
    };
    return { checks, valid: Object.values(checks).every(Boolean), missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key) };
  }

  function questionMastery(question, answer) {
    if (!answer) return false;
    const history = Array.isArray(answer.history) ? answer.history : [];
    const lastTwo = history.slice(-2);
    return history.length >= 2 && lastTwo.length === 2 && lastTwo.every(x => x.correct) && history.some(x => x.firstTry && x.correct);
  }

  function renderHome(rootId) {
    const root = document.getElementById(rootId);
    root.innerHTML = nav("home") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Predict → Test → Explain → Transfer</div><h1>電路、韌體與電力電子學習系統</h1><p class="lead">不是把頁面看完，而是留下可驗證的預測、操作、觀察、解釋與遷移證據。</p></section><section class="notice"><strong>工程模型界線：</strong>公式與教學指標分開呈現；任何元件選型、保護門檻與安全驗證仍須回到 datasheet、控制器文件與實測。</section><section class="mode-grid">' + [
      ["beginner.html","BEGINNER","初學路線","建立單變因因果直覺。"],["labs.html","LABS","實驗任務","以工程工作單留下證據。"],["troubleshooting.html","DEBUG","故障速查","症狀到辨識性測試。"],["progress.html","PROGRESS","學習進度","分開看操作與能力證據。"],["quiz.html","QUIZ","診斷測驗","辨識錯誤心智模型。"],["search.html","SEARCH","全域搜尋","搜尋能力、模型與故障。"],["glossary.html","WORDS","詞彙表","查跨主題工程名詞。"],["report.html","REPORT","工程工作單","預測—驗證—解釋—遷移。"]
    ].map(x => '<a class="mode" href="' + x[0] + '"><span class="tag">' + x[1] + '</span><h2>' + x[2] + '</h2><p>' + x[3] + '</p></a>').join("") + '</section><section class="section-head"><h2>完整主題</h2><p class="muted">同一份正規化課程資料驅動首頁、搜尋、進度與工作單。</p></section><section class="lab-grid">' + modules.map(m => '<a class="lab" href="' + esc(m.entry) + '"><div class="lesson-meta"><span class="num">' + esc(m.number) + '</span><span class="tag">' + esc(m.tag) + '</span></div><h3>' + esc(m.title) + '</h3><p>' + esc(m.oneLine) + '</p><small class="muted">' + m.lessons.length + ' 個課程 · ' + m.labs.length + ' 個實驗</small></a>').join("") + '</section></main>';
  }

  function renderBeginner(rootId) {
    const root = document.getElementById(rootId);
    const render = () => {
      const state = loadState();
      root.innerHTML = nav("beginner") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence ladder</div><h1>初學者拆解路線</h1><p class="lead">每一步依序累積：已瀏覽 → 已操作 → 已有證據 → 已保留。</p></section><section class="module-grid">' + modules.map(m => '<article class="module"><div class="module-head"><div class="module-title"><div><span class="tag">' + esc(m.tag) + '</span><h2>' + esc(m.title) + '</h2><p class="muted">' + esc(m.whyUseful) + '</p></div><a class="button primary" href="' + esc(m.entry) + '">開啟入口</a></div></div><div class="module-body"><div class="lesson-list">' + m.lessons.map((l, i) => {
        const level = evidenceLevel(state, l.id);
        return '<article class="lesson"><div class="lesson-meta"><span class="tag blue">第 ' + (i + 1) + ' 步</span><span class="evidence-level level-' + level + '">' + levelName(level) + '</span></div><h3>' + esc(l.title) + '</h3><ul class="field-list"><li><b>目標</b><span>' + esc(l.objective) + '</span></li><li><b>操作</b><span>' + esc(l.action) + '</span></li><li><b>判讀</b><span>' + esc(l.expectedObservation) + '</span></li></ul><div class="actions"><a class="button primary" data-view="' + esc(l.id) + '" href="' + esc(l.href) + '">開啟這步</a><button class="button" data-practice="' + esc(l.id) + '" type="button">記錄已完成操作</button></div></article>';
      }).join("") + '</div></div></article>').join("") + '</section></main>';
      root.querySelectorAll("[data-view]").forEach(a => a.addEventListener("click", () => { const s = loadState(); setEvidence(s, a.dataset.view, 1, "view"); saveState(s); }));
      root.querySelectorAll("[data-practice]").forEach(b => b.addEventListener("click", () => { const s = loadState(); setEvidence(s, b.dataset.practice, 2, "practice"); saveState(s); render(); }));
    };
    render();
  }

  function renderLabs(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.labs.map(lab => ({ module, lab })));
    const state = loadState();
    root.innerHTML = nav("labs") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence-based labs</div><h1>實驗任務</h1><p class="lead">只有工作單品質規則通過，才會升級為「已有證據」。</p></section><section class="toolbar"><input class="search" id="labSearch" placeholder="搜尋任務、主題或能力"><span class="muted">共 ' + rows.length + ' 個任務</span></section><section class="lab-grid" id="labGrid">' + rows.map(({module, lab}) => '<article class="lab" data-search="' + esc([module.title, lab.title, lab.task, lab.competency].join(" ")) + '"><div class="lesson-meta"><span class="tag">' + esc(module.tag) + '</span><span class="evidence-level level-' + evidenceLevel(state, lab.id) + '">' + levelName(evidenceLevel(state, lab.id)) + '</span></div><h3>' + esc(lab.title) + '</h3><ul class="field-list"><li><b>任務</b><span>' + esc(lab.task) + '</span></li><li><b>成功條件</b><span>' + esc(lab.success) + '</span></li><li><b>遷移</b><span>' + esc(lab.transferPrompt) + '</span></li></ul><div class="actions"><a class="button" href="' + esc(lab.href) + '">開啟模擬</a><a class="button primary" href="report.html?labId=' + encodeURIComponent(lab.id) + '">開啟工作單</a></div></article>').join("") + '</section></main>';
    bindFilter("labSearch", "#labGrid .lab");
  }

  function renderTrouble(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.faults.map(fault => ({module, fault})));
    root.innerHTML = nav("trouble") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Symptom → Hypothesis → Test</div><h1>故障速查</h1><p class="lead">先建立可否證假設，再選辨識力最高且成本最低的測試。</p></section><section class="toolbar"><input class="search" id="faultSearch" placeholder="搜尋症狀、原因或測試"><span class="muted">共 ' + rows.length + ' 個症狀</span></section><section class="fault-table" id="faultTable">' + rows.map(({module, fault}) => '<article class="fault-row" data-search="' + esc([module.title,fault.symptom,fault.cause,fault.verify,fault.fix].join(" ")) + '"><div><b>主題</b><span class="tag">' + esc(module.tag) + '</span></div><div><b>症狀</b><p>' + esc(fault.symptom) + '</p></div><div><b>假設</b><p>' + esc(fault.cause) + '</p></div><div><b>辨識性測試</b><p>' + esc(fault.verify) + '</p></div><div><b>修法</b><p>' + esc(fault.fix) + '</p><a class="button" href="' + esc(fault.href) + '">開啟</a></div></article>').join("") + '</section></main>';
    bindFilter("faultSearch", "#faultTable .fault-row");
  }

  function renderQuiz(rootId) {
    const root = document.getElementById(rootId);
    const state = loadState();
    root.innerHTML = nav("quiz") + '<main id="mainContent"><section class="hero"><div class="eyebrow">First attempt · Recovery · Retention</div><h1>迷思診斷測驗</h1><p class="lead">不是點到正確就算掌握；至少兩次連續正確，且曾在首次嘗試答對。</p></section><section class="quiz-list">' + questions.map(q => {
      const a = state.questions[q.id];
      const mastered = questionMastery(q, a);
      return '<article class="quiz-card"><div class="quiz-head"><span class="tag">' + esc(q.module.tag) + '</span><span class="evidence-level ' + (mastered ? 'level-4' : 'level-1') + '">' + (mastered ? '已保留' : '待驗證') + '</span></div><h3>' + esc(q.prompt) + '</h3><div class="quiz-options">' + q.options.map(o => '<button type="button" class="quiz-option" aria-pressed="false" data-question="' + esc(q.id) + '" data-option="' + esc(o.id) + '">' + esc(o.text) + '</button>').join("") + '</div><div class="quiz-result" id="result-' + esc(q.id) + '" aria-live="polite"></div></article>';
    }).join("") + '</section></main>';
    root.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
      const q = questions.find(x => x.id === button.dataset.question);
      const o = q && q.options.find(x => x.id === button.dataset.option);
      if (!q || !o) return;
      const s = loadState();
      const prev = s.questions[q.id] || { history: [] };
      const history = Array.isArray(prev.history) ? prev.history : [];
      history.push({ choiceId: o.id, correct: !!o.correct, firstTry: history.length === 0, at: now() });
      s.questions[q.id] = { history, choiceId: o.id, correct: !!o.correct, attempts: history.length };
      if (questionMastery(q, s.questions[q.id])) setEvidence(s, q.moduleId + ".diagnostic", 4, "retention");
      saveState(s);
      const correct = q.options.find(x => x.correct);
      document.getElementById("result-" + q.id).innerHTML = o.correct ? '<div class="quiz-explain"><b>正確</b><p>' + esc(o.feedback) + '</p></div>' : '<div class="quiz-explain misconception"><b>可能迷思：' + esc(o.misconception || "推理鏈不完整") + '</b><p>' + esc(o.feedback) + '</p><p><strong>正確答案：</strong>' + esc(correct.text) + '</p></div>';
    }));
  }

  function moduleNext(module, state) {
    const lesson = module.lessons.find(x => evidenceLevel(state, x.id) < 2);
    if (lesson) return { label: "下一步：" + lesson.title, href: lesson.href };
    const lab = module.labs.find(x => evidenceLevel(state, x.id) < 3);
    if (lab) return { label: "完成工作單：" + lab.title, href: "report.html?labId=" + encodeURIComponent(lab.id) };
    const qs = questions.filter(q => q.moduleId === module.id);
    if (qs.length && !qs.every(q => questionMastery(q, state.questions[q.id]))) return { label: "完成保留診斷", href: "quiz.html?module=" + module.id };
    const idx = modules.indexOf(module);
    const next = modules.slice(idx + 1).find(m => (m.prerequisites || []).every(id => evidenceLevel(state, id) >= 3));
    return next ? { label: "進入下一主題：" + next.title, href: next.entry } : { label: "全部完成，進行複習", href: "quiz.html" };
  }

  function renderProgress(rootId) {
    const root = document.getElementById(rootId);
    const state = loadState();
    root.innerHTML = nav("progress") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence dashboard</div><h1>學習進度</h1><p class="lead">瀏覽、操作、證據與保留分開計算，避免把點擊誤認成能力。</p></section><section class="progress-list">' + modules.map(m => {
      const items = [...m.lessons, ...m.labs];
      const counts = [1,2,3].map(level => items.filter(x => evidenceLevel(state,x.id) >= level).length);
      const retained = questions.filter(q => q.moduleId === m.id && questionMastery(q,state.questions[q.id])).length;
      const next = moduleNext(m,state);
      return '<article class="progress-card"><div class="progress-title"><div><span class="tag">' + esc(m.tag) + '</span><h3>' + esc(m.title) + '</h3></div><a class="button primary" href="' + esc(next.href) + '">' + esc(next.label) + '</a></div><div class="evidence-grid"><div><b>已瀏覽</b><span>' + counts[0] + '/' + items.length + '</span></div><div><b>已操作</b><span>' + counts[1] + '/' + items.length + '</span></div><div><b>已有證據</b><span>' + counts[2] + '/' + items.length + '</span></div><div><b>已保留</b><span>' + retained + '/' + questions.filter(q=>q.moduleId===m.id).length + '</span></div></div></article>';
    }).join("") + '</section><section class="panel state-tools"><h2>備份與還原</h2><div class="actions"><button class="button" id="exportState">匯出狀態</button><button class="button" id="importState">匯入並合併</button><input hidden type="file" id="stateFile" accept="application/json,.json"><span id="stateMessage" aria-live="polite"></span></div></section></main>';
    document.getElementById("exportState").onclick = () => download(JSON.stringify({...loadState(), exportedAt:now()},null,2), "circuit-learning-state.json", "application/json");
    document.getElementById("importState").onclick = () => document.getElementById("stateFile").click();
    document.getElementById("stateFile").onchange = async e => { try { const p=JSON.parse(await e.target.files[0].text()); if(p.schema!==SCHEMA||p.version!==VERSION) throw new Error("不支援的狀態格式"); const s=loadState(); Object.assign(s.evidence,p.evidence||{}); Object.assign(s.questions,p.questions||{}); Object.assign(s.reports,p.reports||{}); saveState(s); location.reload(); } catch(err) { document.getElementById("stateMessage").textContent=err.message; } };
  }

  function renderReport(rootId) {
    const root = document.getElementById(rootId);
    const allLabs = modules.flatMap(module => module.labs.map(lab => ({module,lab})));
    const query = new URLSearchParams(location.search);
    const requested = query.get("labId") || query.get("lab");
    root.innerHTML = nav("report") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Engineering worksheet</div><h1>預測—驗證—解釋工作單</h1><p class="lead">完整 lab ID 直接定位實驗；找不到時不會靜默選到其他模組。</p></section><section class="report-layout"><form class="panel form-grid" id="reportForm"><label>實驗<select id="labSelect"></select></label><div class="report-brief" id="reportBrief"></div>' + [["prediction","1. 操作前預測","變數、方向與原因"],["parameters","2. 參數與條件","至少一組數值與單位"],["observation","3. 實際觀察","數值、波形或狀態"],["explanation","4. 因果解釋","公式、能量流或時序"],["limitations","5. 模型限制","非理想項與不確定性"],["transfer","6. 遷移驗證","換一組條件重新判斷"],["nextStep","7. 下一步","下一個辨識性測試"]].map(f => '<label>' + f[1] + '<textarea id="' + f[0] + '" placeholder="' + f[2] + '"></textarea></label>').join("") + '<div class="actions"><a class="button" id="openSimulator">開啟模擬</a><button class="button primary" id="completeReport" type="button">驗證並完成</button><button class="button" id="downloadReport" type="button">下載 Markdown</button></div><p id="reportMessage" aria-live="polite"></p></form><pre class="report-preview" id="reportPreview"></pre></section></main>';
    const select = document.getElementById("labSelect");
    select.innerHTML = allLabs.map(x => '<option value="' + esc(x.lab.id) + '">' + esc(x.module.title + " — " + x.lab.title) + '</option>').join("");
    const exact = allLabs.find(x => x.lab.id === requested);
    const legacy = allLabs.find(x => x.lab.localId === requested);
    if (requested && !exact && !legacy) document.getElementById("reportMessage").textContent = "找不到指定的實驗 ID，請由實驗任務頁重新開啟。";
    if (exact || legacy) select.value = (exact || legacy).lab.id;
    const fields = ["prediction","parameters","observation","explanation","limitations","transfer","nextStep"];
    const current = () => allLabs.find(x => x.lab.id === select.value) || allLabs[0];
    const draft = () => Object.fromEntries(fields.map(id => [id, document.getElementById(id).value.trim()]));
    const markdown = (x,d) => '# ' + x.module.title + ' — ' + x.lab.title + '\n\n' + fields.map((id,i) => '## ' + (i+1) + '. ' + id + '\n' + (d[id] || '- 尚未填寫')).join('\n\n');
    function load() { const x=current(), s=loadState(), d=s.reports[x.lab.id]||{}; fields.forEach(id=>document.getElementById(id).value=d[id]||""); document.getElementById("reportBrief").innerHTML='<p><b>任務：</b>'+esc(x.lab.task)+'</p><p><b>成功條件：</b>'+esc(x.lab.success)+'</p><p><b>遷移：</b>'+esc(x.lab.transferPrompt)+'</p><code>'+esc(x.lab.id)+'</code>'; document.getElementById("openSimulator").href=x.lab.href; preview(); }
    function persist() { const x=current(), s=loadState(); s.reports[x.lab.id]={...draft(),updatedAt:now()}; saveState(s); preview(); }
    function preview(){ document.getElementById("reportPreview").textContent=markdown(current(),draft()); }
    fields.forEach(id=>document.getElementById(id).addEventListener("input",persist)); select.onchange=load;
    document.getElementById("completeReport").onclick=()=>{ const x=current(),d=draft(),q=reportQuality(d),m=document.getElementById("reportMessage"); if(!q.valid){m.textContent='尚不能完成：內容需包含方向、數值與單位、充分觀察、不同的因果解釋、限制與遷移。';return;} const s=loadState();s.reports[x.lab.id]={...d,updatedAt:now(),quality:q.checks};setEvidence(s,x.lab.id,3,"worksheet");saveState(s);m.textContent='完成：工作單已通過證據品質規則。';};
    document.getElementById("downloadReport").onclick=()=>download(markdown(current(),draft()),current().lab.id+'.md','text/markdown');
    load();
  }

  function renderSearch(rootId) {
    const root=document.getElementById(rootId), rows=[];
    modules.forEach(m=>{rows.push({type:"主題",tag:m.tag,title:m.title,body:[m.oneLine,m.whyUseful].join(" "),href:m.entry});m.lessons.forEach(x=>rows.push({type:"課程",tag:m.tag,title:x.title,body:[x.objective,x.action,x.expectedObservation,x.competency].join(" "),href:x.href}));m.labs.forEach(x=>rows.push({type:"實驗",tag:m.tag,title:x.title,body:[x.task,x.success,x.transferPrompt,x.competency].join(" "),href:"report.html?labId="+encodeURIComponent(x.id)}));m.faults.forEach(x=>rows.push({type:"故障",tag:m.tag,title:x.symptom,body:[x.cause,x.verify,x.fix].join(" "),href:x.href}));ModelRegistry.forModule(m.id).forEach(x=>rows.push({type:"模型",tag:m.tag,title:x.title,body:[...(x.assumptions||[]),...(x.invalidWhen||[]),x.source].join(" "),href:m.entry}));});questions.forEach(q=>rows.push({type:"診斷",tag:q.module.tag,title:q.prompt,body:q.options.map(o=>[o.text,o.misconception,o.feedback].join(" ")).join(" "),href:"quiz.html?module="+q.moduleId}));(curriculum.glossary||[]).forEach(g=>rows.push({type:"詞彙",tag:"Glossary",title:g[0],body:g.slice(1).join(" "),href:"glossary.html"}));
    root.innerHTML=nav("search")+'<main id="mainContent"><section class="hero"><div class="eyebrow">Unified index</div><h1>全域搜尋</h1><p class="lead">搜尋課程、能力、模型限制、遷移問題、故障與迷思。</p></section><section class="toolbar"><input class="search" id="q" autofocus placeholder="例如 DCM、overrun、offset、模型限制"><span id="count"></span></section><section class="lab-grid" id="results"></section></main>';
    const q=document.getElementById("q"),results=document.getElementById("results"),count=document.getElementById("count");function render(){const term=q.value.trim().toLowerCase(),out=rows.filter(r=>!term||[r.title,r.body,r.tag,r.type].join(" ").toLowerCase().includes(term));count.textContent=out.length+' / '+rows.length+' 筆';results.innerHTML=out.slice(0,120).map(r=>'<a class="lab" href="'+esc(r.href)+'"><span class="tag">'+esc(r.type)+' · '+esc(r.tag)+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.body)+'</p></a>').join("")||'<div class="empty">找不到符合內容。</div>';}q.oninput=render;render();
  }

  function renderGlossary(rootId) {
    const root=document.getElementById(rootId),terms=curriculum.glossary||[];root.innerHTML=nav("glossary")+'<main id="mainContent"><section class="hero"><div class="eyebrow">Glossary</div><h1>全域詞彙表</h1><p class="lead">共用 v3 導覽與搜尋行為。</p></section><section class="toolbar"><input class="search" id="termSearch" placeholder="搜尋 ADC、PWM、Offset"><span>共 '+terms.length+' 個詞彙</span></section><section class="lab-grid" id="terms">'+terms.map(t=>'<article class="lab" data-search="'+esc(t.join(" "))+'"><span class="tag">'+esc(t[0])+'</span><h3>'+esc(t[0])+'</h3><p>'+esc(t[1])+'</p><ul class="field-list"><li><b>實務提示</b><span>'+esc(t[2])+'</span></li></ul></article>').join("")+'</section></main>';bindFilter("termSearch","#terms .lab");
  }

  function bindFilter(id,selector){const input=document.getElementById(id);if(!input)return;input.oninput=()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll(selector).forEach(el=>el.hidden=!!q&&!String(el.dataset.search||el.textContent).toLowerCase().includes(q));};}
  function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

  global.CircuitLearning = { curriculum, nav, loadState, saveState, reportQuality, questionMastery, renderHome, renderBeginner, renderLabs, renderTrouble, renderQuiz, renderProgress, renderReport, renderSearch, renderGlossary };
})(window);
