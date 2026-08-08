(function (global) {
  "use strict";

  const Schema = global.CircuitSchema;
  const QuizBank = global.CircuitQuizBank;
  const ModelRegistry = global.CircuitModelRegistry;
  const Evidence = global.CircuitEvidence;
  const Assessment = global.CircuitAssessment;
  const raw = global.CircuitCurriculum;
  if (!Schema || !QuizBank || !ModelRegistry || !Evidence || !Assessment || !raw) {
    throw new Error("Learning v3 dependencies missing");
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

  function saveState(state) {
    return Evidence.save(state);
  }

  const levelName = level => ["未開始", "已瀏覽", "已操作", "已有證據", "已保留"][Math.max(0, Math.min(4, Number(level) || 0))];
  const evidenceLevel = (state, id) => Evidence.evidenceLevel(state, id);

  function nav(active) {
    const items = [
      ["index.html","總入口","home"],
      ["beginner.html","初學路線","beginner"],
      ["labs.html","實驗任務","labs"],
      ["troubleshooting.html","故障速查","trouble"],
      ["progress.html","進度","progress"],
      ["quiz.html","診斷測驗","quiz"],
      ["glossary.html","詞彙表","glossary"],
      ["search.html","搜尋","search"],
      ["report.html","工程工作單","report"]
    ];
    return '<a class="skip-link" href="#mainContent">跳到主要內容</a><nav class="topnav" aria-label="主要導覽"><a class="brand" href="index.html"><span class="brand-mark">SIM</span><span>電路模擬說明</span></a><div class="navlinks">' + items.map(i => '<a ' + (i[2] === active ? 'aria-current="page" class="active"' : '') + ' href="' + i[0] + '">' + i[1] + '</a>').join("") + '</div></nav>';
  }

  function modelCards(module) {
    const cards = ModelRegistry.forModule(module.id);
    if (!cards.length) return "";
    return '<div class="model-card-grid">' + cards.map(card => '<article class="model-card"><div class="model-card-head"><span class="tag blue">' + esc(card.executable ? "EXECUTABLE" : card.type) + '</span><strong>' + esc(card.title) + '</strong></div><p class="muted">v' + esc(card.version || "0") + ' · ' + esc(card.type) + '</p><div><b>適用假設</b><ul>' + (card.assumptions || []).map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div><div><b>停止相信模型的條件</b><ul>' + (card.invalidWhen || []).map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' + (card.inputs ? '<small class="muted">Inputs: ' + esc(Object.entries(card.inputs).map(([k,v]) => k + "[" + v + "]").join(", ")) + '</small>' : '') + '</article>').join("") + '</div>';
  }

  function reportQuality(draft, machineCount) {
    const checks = {
      prediction: /\S+/.test(draft.prediction || "") && /(增|減|升|降|變|不變|方向|正|負|高|低)/.test(draft.prediction || ""),
      parameters: /\d/.test(draft.parameters || "") && /(V|A|Hz|kHz|MHz|Ω|ohm|H|F|%|bit|count|µ|m|s)/i.test(draft.parameters || ""),
      observation: /\S{8,}/.test(draft.observation || ""),
      explanation: /\S{12,}/.test(draft.explanation || "") && (draft.explanation || "").trim() !== (draft.prediction || "").trim(),
      limitations: /\S{8,}/.test(draft.limitations || ""),
      transfer: /\S{8,}/.test(draft.transfer || "")
    };
    return {
      checks,
      humanValid: Object.values(checks).every(Boolean),
      machineBacked: Number(machineCount || 0) > 0,
      missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
    };
  }

  function familyMetrics(familyId, state) {
    return Assessment.mastery(familyId, state, questions, Date.now());
  }

  function renderHome(rootId) {
    const root = document.getElementById(rootId);
    const state = loadState();
    const benchmark = Assessment.benchmarkSummary(state, questions, Date.now());
    const delta = benchmark.deltaPoints == null ? "—" : (benchmark.deltaPoints >= 0 ? "+" : "") + benchmark.deltaPoints + " pp";
    root.innerHTML = nav("home") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Predict → Test → Explain → Transfer → Retain</div><h1>電路、韌體與電力電子學習系統</h1><p class="lead">目標不是看完頁面，而是在陌生工程情境中仍能做出可驗證判斷。</p></section><section class="metric-grid"><div class="metric"><span class="tag blue">Baseline</span><h3>' + (benchmark.baselineAccuracy == null ? "—" : benchmark.baselineAccuracy + "%") + '</h3><p>每個 competency 第一個 variant 的首次作答。</p></div><div class="metric"><span class="tag green">Transfer</span><h3>' + (benchmark.transferAccuracy == null ? "—" : benchmark.transferAccuracy + "%") + '</h3><p>不同 variant 的首次作答。</p></div><div class="metric"><span class="tag amber">Δ</span><h3>' + delta + '</h3><p>目前可觀測的遷移差。</p></div><div class="metric"><span class="tag rose">Review due</span><h3>' + benchmark.due + '</h3><p>已通過 transfer、等待延遲取回。</p></div></section><section class="notice"><strong>工程模型界線：</strong>公式與 heuristic 分開；元件選型、保護門檻與安全驗證仍須回到 datasheet、控制器文件與實測。</section><section class="mode-grid">' + [
      ["beginner.html","BEGINNER","初學路線","建立單變因因果直覺。"],["labs.html","LABS","實驗任務","模擬器客觀紀錄 + 工程工作單。"],["troubleshooting.html","DEBUG","故障速查","症狀到可否證假設。"],["progress.html","PROGRESS","學習進度","看 evidence、transfer 與 retention。"],["quiz.html","QUIZ","診斷測驗","Baseline → variant transfer → delayed retention。"],["search.html","SEARCH","全域搜尋","搜尋能力、模型與故障。"],["glossary.html","WORDS","詞彙表","查跨主題工程名詞。"],["report.html","REPORT","工程工作單","預測—驗證—解釋—遷移。"]
    ].map(x => '<a class="mode" href="' + x[0] + '"><span class="tag">' + x[1] + '</span><h2>' + x[2] + '</h2><p>' + x[3] + '</p></a>').join("") + '</section><section class="section-head"><h2>完整主題</h2><p class="muted">同一份課程資料驅動首頁、搜尋、進度與工作單。</p></section><section class="lab-grid">' + modules.map(m => '<a class="lab" href="' + esc(m.entry) + '"><div class="lesson-meta"><span class="num">' + esc(m.number) + '</span><span class="tag">' + esc(m.tag) + '</span></div><h3>' + esc(m.title) + '</h3><p>' + esc(m.oneLine) + '</p><small class="muted">' + m.lessons.length + ' 個課程 · ' + m.labs.length + ' 個實驗</small></a>').join("") + '</section></main>';
  }

  function renderBeginner(rootId) {
    const root = document.getElementById(rootId);
    const render = () => {
      const state = loadState();
      root.innerHTML = nav("beginner") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence ladder</div><h1>初學者拆解路線</h1><p class="lead">實際教材頁與教學助手會自動寫回同一份 evidence；手動按鈕只作備援。</p></section><section class="module-grid">' + modules.map(m => '<article class="module"><div class="module-head"><div class="module-title"><div><span class="tag">' + esc(m.tag) + '</span><h2>' + esc(m.title) + '</h2><p class="muted">' + esc(m.whyUseful) + '</p></div><a class="button primary" href="' + esc(m.entry) + '">開啟入口</a></div>' + modelCards(m) + '</div><div class="module-body"><div class="lesson-list">' + m.lessons.map((l, i) => {
        const level = evidenceLevel(state, l.id);
        const machineCount = Number(state.evidence[l.id] && state.evidence[l.id].machineCount || 0);
        return '<article class="lesson"><div class="lesson-meta"><span class="tag blue">第 ' + (i + 1) + ' 步</span><span class="evidence-level level-' + level + '">' + levelName(level) + '</span></div><h3>' + esc(l.title) + '</h3><code>' + esc(l.competency) + '</code><ul class="field-list"><li><b>目標</b><span>' + esc(l.objective) + '</span></li><li><b>操作</b><span>' + esc(l.action) + '</span></li><li><b>判讀</b><span>' + esc(l.expectedObservation) + '</span></li><li><b>機器證據</b><span>' + machineCount + ' 筆 simulator snapshot</span></li></ul><div class="actions"><a class="button primary" data-view="' + esc(l.id) + '" href="' + esc(l.href) + '">開啟這步</a><button class="button" data-practice="' + esc(l.id) + '" type="button">手動記錄已操作</button></div></article>';
      }).join("") + '</div></div></article>').join("") + '</section></main>';
      root.querySelectorAll("[data-view]").forEach(a => a.addEventListener("click", () => Evidence.recordEvidence(a.dataset.view, 1, "v3-view", { href: a.getAttribute("href") })));
      root.querySelectorAll("[data-practice]").forEach(b => b.addEventListener("click", () => { Evidence.recordEvidence(b.dataset.practice, 2, "manual-practice"); render(); }));
    };
    render();
  }

  function renderLabs(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.labs.map(lab => ({ module, lab })));
    const state = loadState();
    root.innerHTML = nav("labs") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Machine + human evidence</div><h1>實驗任務</h1><p class="lead">Simulator 操作會留下客觀 snapshot；工作單負責預測、因果解釋、模型限制與遷移。</p></section><section class="toolbar"><input class="search" id="labSearch" placeholder="搜尋任務、主題或能力"><span class="muted">共 ' + rows.length + ' 個任務</span></section><section class="lab-grid" id="labGrid">' + rows.map(({module, lab}) => {
      const ev = state.evidence[lab.id] || {};
      return '<article class="lab" data-search="' + esc([module.title, lab.title, lab.task, lab.competency].join(" ")) + '"><div class="lesson-meta"><span class="tag">' + esc(module.tag) + '</span><span class="evidence-level level-' + evidenceLevel(state, lab.id) + '">' + levelName(evidenceLevel(state, lab.id)) + '</span></div><h3>' + esc(lab.title) + '</h3><code>' + esc(lab.competency) + '</code><ul class="field-list"><li><b>任務</b><span>' + esc(lab.task) + '</span></li><li><b>成功條件</b><span>' + esc(lab.success) + '</span></li><li><b>遷移</b><span>' + esc(lab.transferPrompt) + '</span></li><li><b>機器證據</b><span>' + Number(ev.machineCount || 0) + ' 筆</span></li></ul><div class="actions"><a class="button" href="' + esc(lab.href) + '">開啟模擬</a><a class="button primary" href="report.html?labId=' + encodeURIComponent(lab.id) + '">開啟工作單</a></div></article>';
    }).join("") + '</section></main>';
    bindFilter("labSearch", "#labGrid .lab");
  }

  function renderTrouble(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.faults.map(fault => ({module, fault})));
    root.innerHTML = nav("trouble") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Symptom → Hypothesis → Discriminating test</div><h1>故障速查</h1><p class="lead">先建立可否證假設，再選辨識力最高且成本最低的測試。</p></section><section class="toolbar"><input class="search" id="faultSearch" placeholder="搜尋症狀、原因或測試"><span class="muted">共 ' + rows.length + ' 個症狀</span></section><section class="fault-table" id="faultTable">' + rows.map(({module, fault}) => '<article class="fault-row" data-search="' + esc([module.title,fault.symptom,fault.cause,fault.verify,fault.fix].join(" ")) + '"><div><b>主題</b><span class="tag">' + esc(module.tag) + '</span></div><div><b>症狀</b><p>' + esc(fault.symptom) + '</p></div><div><b>假設</b><p>' + esc(fault.cause) + '</p></div><div><b>辨識性測試</b><p>' + esc(fault.verify) + '</p></div><div><b>修法</b><p>' + esc(fault.fix) + '</p><a class="button" href="' + esc(fault.href) + '">開啟</a></div></article>').join("") + '</section></main>';
    bindFilter("faultSearch", "#faultTable .fault-row");
  }

  function renderQuiz(rootId) {
    const root = document.getElementById(rootId);
    const moduleFilter = new URLSearchParams(location.search).get("module");
    const startedAt = {};
    let feedback = null;

    function render() {
      const state = loadState();
      const groups = familyGroups.filter(group => !moduleFilter || group.questions[0].moduleId === moduleFilter);
      const benchmark = Assessment.benchmarkSummary(state, questions, Date.now());
      root.innerHTML = nav("quiz") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Baseline → Transfer → Delayed retrieval</div><h1>迷思診斷測驗</h1><p class="lead">第一次答錯不會永久鎖死；新的 variant 可驗證 transfer，24 小時後再次正確才標記 retained。Transfer 通過後即可繼續主線。</p></section><section class="metric-grid"><div class="metric"><span class="tag blue">Baseline</span><h3>' + (benchmark.baselineAccuracy == null ? "—" : benchmark.baselineAccuracy + "%") + '</h3><p>首個 variant 首次作答。</p></div><div class="metric"><span class="tag green">Transfer</span><h3>' + (benchmark.transferAccuracy == null ? "—" : benchmark.transferAccuracy + "%") + '</h3><p>第二個 variant 首次作答。</p></div><div class="metric"><span class="tag amber">Transfer passed</span><h3>' + benchmark.transferPassed + '/' + benchmark.families + '</h3><p>至少兩個 variant 已能正確解出。</p></div><div class="metric"><span class="tag rose">Retained</span><h3>' + benchmark.retained + '/' + benchmark.families + '</h3><p>通過延遲取回。</p></div></section><section class="quiz-list">' + groups.map(group => {
        const answer = state.questions[group.familyId];
        const q = Assessment.nextQuestion(group.questions, answer, Date.now());
        const m = Assessment.mastery(group.familyId, state, questions, Date.now());
        const prereqs = Assessment.prerequisitesFor(q.competency);
        const status = m.retained ? "已保留" : m.due ? "到期複習" : m.transfer ? "已遷移，等待延遲複習" : m.recovery ? "已修正，繼續做新 variant" : m.attempts ? "學習中" : "Baseline";
        startedAt[q.id] = startedAt[q.id] || Date.now();
        return '<article class="quiz-card" data-family="' + esc(group.familyId) + '"><div class="quiz-head"><span class="tag">' + esc(q.module.tag) + ' · variant ' + esc(q.variantId) + '</span><span class="evidence-level ' + (m.retained ? 'level-4' : m.transfer ? 'level-3' : 'level-1') + '">' + esc(status) + '</span></div><code>' + esc(q.competency) + '</code>' + (prereqs.length ? '<p class="muted">Prerequisite competencies: ' + esc(prereqs.join(", ")) + '</p>' : '') + '<h3>' + esc(q.prompt) + '</h3><label class="confidence">作答信心<select data-confidence="' + esc(group.familyId) + '"><option value="1">低</option><option value="2" selected>中</option><option value="3">高</option></select></label><div class="quiz-options">' + q.options.map(o => '<button type="button" class="quiz-option" data-question="' + esc(q.id) + '" data-option="' + esc(o.id) + '">' + esc(o.text) + '</button>').join("") + '</div><div class="quiz-result" id="result-' + esc(group.familyId) + '" aria-live="polite"></div></article>';
      }).join("") + '</section></main>';

      root.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
        const q = questions.find(x => x.id === button.dataset.question);
        const option = q && q.options.find(x => x.id === button.dataset.option);
        if (!q || !option) return;
        const stateNow = loadState();
        const entry = Assessment.recordAttempt(stateNow, q, option, now());
        entry.elapsedMs = Math.max(0, Date.now() - (startedAt[q.id] || Date.now()));
        const confidence = root.querySelector('[data-confidence="' + CSS.escape(q.familyId) + '"]');
        entry.confidence = confidence ? Number(confidence.value) : 2;
        saveState(stateNow);
        const correct = q.options.find(x => x.correct);
        feedback = {
          familyId: q.familyId,
          html: option.correct
            ? '<div class="quiz-explain"><b>正確</b><p>' + esc(option.feedback) + '</p></div>'
            : '<div class="quiz-explain misconception"><b>可能迷思：' + esc(option.misconception || "推理鏈不完整") + '</b><p>' + esc(option.feedback) + '</p><p><strong>正確答案：</strong>' + esc(correct.text) + '</p></div>'
        };
        render();
      }));

      if (feedback) {
        const result = document.getElementById("result-" + feedback.familyId);
        if (result) result.innerHTML = feedback.html;
      }
    }
    render();
  }

  function moduleNext(module, state) {
    const lesson = module.lessons.find(x => evidenceLevel(state, x.id) < 2);
    if (lesson) return { label: "下一步：" + lesson.title, href: lesson.href };
    const lab = module.labs.find(x => evidenceLevel(state, x.id) < 3);
    if (lab) return { label: "完成工作單：" + lab.title, href: "report.html?labId=" + encodeURIComponent(lab.id) };
    const groups = familyGroups.filter(g => g.questions[0].moduleId === module.id);
    if (groups.some(g => !familyMetrics(g.familyId, state).transfer)) return { label: "完成遷移診斷", href: "quiz.html?module=" + module.id };
    const idx = modules.indexOf(module);
    const next = modules.slice(idx + 1).find(m => Assessment.moduleUnlocked(m.id, state, questions, Date.now()));
    if (next) return { label: "進入下一主題：" + next.title, href: next.entry };
    const due = groups.some(g => { const m = familyMetrics(g.familyId, state); return m.due && !m.retained; });
    return due ? { label: "做延遲複習", href: "quiz.html?module=" + module.id } : { label: "目前主線完成", href: "quiz.html" };
  }

  function renderProgress(rootId) {
    const root = document.getElementById(rootId);
    const state = loadState();
    const benchmark = Assessment.benchmarkSummary(state, questions, Date.now());
    root.innerHTML = nav("progress") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Evidence + benchmark dashboard</div><h1>學習進度</h1><p class="lead">軟體完成率與能力證據分開：practice 看行為，transfer/retention 看陌生情境表現。</p></section><section class="metric-grid"><div class="metric"><span class="tag blue">Baseline accuracy</span><h3>' + (benchmark.baselineAccuracy == null ? "—" : benchmark.baselineAccuracy + "%") + '</h3><p>' + benchmark.baselineAnswered + ' 個 competency 有 baseline。</p></div><div class="metric"><span class="tag green">Transfer accuracy</span><h3>' + (benchmark.transferAccuracy == null ? "—" : benchmark.transferAccuracy + "%") + '</h3><p>' + benchmark.transferAnswered + ' 個 competency 已做第二 variant。</p></div><div class="metric"><span class="tag amber">Δ transfer</span><h3>' + (benchmark.deltaPoints == null ? "—" : (benchmark.deltaPoints >= 0 ? "+" : "") + benchmark.deltaPoints + " pp") + '</h3><p>用首次作答比較，而不是最後答案。</p></div><div class="metric"><span class="tag rose">Delayed review</span><h3>' + benchmark.due + '</h3><p>到期但尚未 retained。</p></div></section><section class="progress-list">' + modules.map(m => {
      const items = [...m.lessons, ...m.labs];
      const practiced = items.filter(x => evidenceLevel(state, x.id) >= 2).length;
      const verified = items.filter(x => evidenceLevel(state, x.id) >= 3).length;
      const machine = items.reduce((sum, x) => sum + Number(state.evidence[x.id] && state.evidence[x.id].machineCount || 0), 0);
      const groups = familyGroups.filter(g => g.questions[0].moduleId === m.id);
      const transferred = groups.filter(g => familyMetrics(g.familyId, state).transfer).length;
      const retained = groups.filter(g => familyMetrics(g.familyId, state).retained).length;
      const next = moduleNext(m, state);
      const requires = Assessment.requirementsForModule(m.id);
      return '<article class="progress-card"><div class="progress-title"><div><span class="tag">' + esc(m.tag) + '</span><h3>' + esc(m.title) + '</h3></div><a class="button primary" href="' + esc(next.href) + '">' + esc(next.label) + '</a></div>' + (requires.length ? '<p class="muted">Module prerequisites: ' + esc(requires.join(", ")) + '</p>' : '') + '<div class="evidence-grid"><div><b>已操作</b><span>' + practiced + '/' + items.length + '</span></div><div><b>已有證據</b><span>' + verified + '/' + items.length + '</span></div><div><b>Machine snapshots</b><span>' + machine + '</span></div><div><b>Transfer</b><span>' + transferred + '/' + groups.length + '</span></div><div><b>Retained</b><span>' + retained + '/' + groups.length + '</span></div></div></article>';
    }).join("") + '</section><section class="panel state-tools"><h2>備份與還原</h2><p class="muted">V4 包含 evidence、machine snapshots、assessment histories 與 reports。</p><div class="actions"><button class="button" id="exportState">匯出狀態</button><button class="button" id="importState">匯入並合併</button><input hidden type="file" id="stateFile" accept="application/json,.json"><span id="stateMessage" aria-live="polite"></span></div></section></main>';
    document.getElementById("exportState").onclick = () => download(JSON.stringify({...loadState(), exportedAt:now()},null,2), "circuit-learning-state-v4.json", "application/json");
    document.getElementById("importState").onclick = () => document.getElementById("stateFile").click();
    document.getElementById("stateFile").onchange = async e => {
      const message = document.getElementById("stateMessage");
      try {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        Evidence.merge(JSON.parse(await file.text()));
        location.reload();
      } catch (err) {
        message.textContent = err.message || "匯入失敗";
      }
    };
  }

  function renderReport(rootId) {
    const root = document.getElementById(rootId);
    const allLabs = modules.flatMap(module => module.labs.map(lab => ({module,lab})));
    const query = new URLSearchParams(location.search);
    const requested = query.get("labId") || query.get("lab");
    root.innerHTML = nav("report") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Machine evidence + human reasoning</div><h1>預測—驗證—解釋工作單</h1><p class="lead">模擬器負責客觀操作 snapshot；你負責預測、因果、限制與遷移。兩者合併才是強 evidence。</p></section><section class="report-layout"><form class="panel form-grid" id="reportForm"><label>實驗<select id="labSelect"></select></label><div class="report-brief" id="reportBrief"></div>' + [["prediction","1. 操作前預測","變數、方向與原因"],["parameters","2. 參數與條件","至少一組數值與單位"],["observation","3. 實際觀察","數值、波形或狀態"],["explanation","4. 因果解釋","公式、能量流或時序"],["limitations","5. 模型限制","非理想項與不確定性"],["transfer","6. 遷移驗證","換一組條件重新判斷"],["nextStep","7. 下一步","下一個辨識性測試"]].map(f => '<label>' + f[1] + '<textarea id="' + f[0] + '" placeholder="' + f[2] + '"></textarea></label>').join("") + '<div class="actions"><a class="button" id="openSimulator">開啟模擬</a><button class="button primary" id="completeReport" type="button">驗證並完成</button><button class="button" id="downloadReport" type="button">下載 Markdown</button></div><p id="reportMessage" aria-live="polite"></p></form><pre class="report-preview" id="reportPreview"></pre></section></main>';
    const select = document.getElementById("labSelect");
    select.innerHTML = allLabs.map(x => '<option value="' + esc(x.lab.id) + '">' + esc(x.module.title + " — " + x.lab.title) + '</option>').join("");
    const exact = allLabs.find(x => x.lab.id === requested);
    const legacy = allLabs.find(x => x.lab.localId === requested);
    if (requested && !exact && !legacy) document.getElementById("reportMessage").textContent = "找不到指定的實驗 ID，請由實驗任務頁重新開啟。";
    if (exact || legacy) select.value = (exact || legacy).lab.id;
    const fields = ["prediction","parameters","observation","explanation","limitations","transfer","nextStep"];
    const current = () => allLabs.find(x => x.lab.id === select.value) || allLabs[0];
    const draft = () => Object.fromEntries(fields.map(id => [id, document.getElementById(id).value.trim()]));
    const markdown = (x,d,q) => '# ' + x.module.title + ' — ' + x.lab.title + '\n\nEvidence source: ' + (q && q.machineBacked ? 'machine + human' : 'human-only') + '\n\n' + fields.map((id,i) => '## ' + (i+1) + '. ' + id + '\n' + (d[id] || '- 尚未填寫')).join('\n\n');

    function load() {
      const x = current();
      const d = Evidence.getReport(x.lab.id);
      const machine = Evidence.machineEvents(x.lab.id);
      fields.forEach(id => document.getElementById(id).value = d[id] || "");
      const last = machine[machine.length - 1];
      document.getElementById("reportBrief").innerHTML = '<p><b>任務：</b>' + esc(x.lab.task) + '</p><p><b>成功條件：</b>' + esc(x.lab.success) + '</p><p><b>遷移：</b>' + esc(x.lab.transferPrompt) + '</p><p><b>Machine evidence：</b>' + machine.length + ' 筆' + (last ? '；最後紀錄 ' + esc(last.at) : '；尚未從 simulator 收到 snapshot') + '</p><code>' + esc(x.lab.id) + '</code>';
      document.getElementById("openSimulator").href = x.lab.href;
      preview();
    }

    function persist() {
      const x = current();
      Evidence.setReport(x.lab.id, draft());
      preview();
    }

    function preview() {
      const x = current();
      const q = reportQuality(draft(), Evidence.machineEvents(x.lab.id).length);
      document.getElementById("reportPreview").textContent = markdown(x, draft(), q);
    }

    fields.forEach(id => document.getElementById(id).addEventListener("input", persist));
    select.onchange = load;
    document.getElementById("completeReport").onclick = () => {
      const x = current();
      const d = draft();
      const machineCount = Evidence.machineEvents(x.lab.id).length;
      const quality = reportQuality(d, machineCount);
      const message = document.getElementById("reportMessage");
      if (!quality.humanValid) {
        message.textContent = "尚不能完成：請補足方向、數值與單位、具體觀察、因果解釋、模型限制與遷移。";
        return;
      }
      Evidence.setReport(x.lab.id, {...d, quality: quality.checks, machineBacked: quality.machineBacked});
      Evidence.recordEvidence(x.lab.id, 3, quality.machineBacked ? "worksheet+machine" : "worksheet-human-only", { machineCount, quality: quality.checks });
      message.textContent = quality.machineBacked ? "完成：已合併 simulator 客觀 snapshot 與人工推理證據。" : "完成：人工推理通過；目前沒有 simulator snapshot，證據強度較低。";
      load();
    };
    document.getElementById("downloadReport").onclick = () => {
      const x = current();
      const q = reportQuality(draft(), Evidence.machineEvents(x.lab.id).length);
      download(markdown(x, draft(), q), x.lab.id + '.md', 'text/markdown');
    };
    load();
  }

  function renderSearch(rootId) {
    const root = document.getElementById(rootId);
    const rows = [];
    modules.forEach(m => {
      rows.push({type:"主題",tag:m.tag,title:m.title,body:[m.oneLine,m.whyUseful].join(" "),href:m.entry});
      m.lessons.forEach(x => rows.push({type:"課程",tag:m.tag,title:x.title,body:[x.objective,x.action,x.expectedObservation,x.competency].join(" "),href:x.href}));
      m.labs.forEach(x => rows.push({type:"實驗",tag:m.tag,title:x.title,body:[x.task,x.success,x.transferPrompt,x.competency].join(" "),href:"report.html?labId="+encodeURIComponent(x.id)}));
      m.faults.forEach(x => rows.push({type:"故障",tag:m.tag,title:x.symptom,body:[x.cause,x.verify,x.fix,x.competency].join(" "),href:x.href}));
      ModelRegistry.forModule(m.id).forEach(x => rows.push({type:"模型",tag:m.tag,title:x.title,body:[x.type,x.version,...(x.assumptions||[]),...(x.invalidWhen||[]),...(x.references||[]),...Object.keys(x.inputs||{}),...Object.keys(x.outputs||{})].join(" "),href:m.entry}));
    });
    questions.forEach(q => rows.push({type:"診斷",tag:q.module.tag,title:q.prompt,body:[q.competency,q.variantId,q.options.map(o=>[o.text,o.misconception,o.feedback].join(" ")).join(" ")].join(" "),href:"quiz.html?module="+q.moduleId}));
    (curriculum.glossary||[]).forEach(g => rows.push({type:"詞彙",tag:"Glossary",title:g[0],body:g.slice(1).join(" "),href:"glossary.html"}));
    root.innerHTML = nav("search") + '<main id="mainContent"><section class="hero"><div class="eyebrow">Unified index</div><h1>全域搜尋</h1><p class="lead">搜尋課程、competency、模型版本/單位/限制、遷移題、故障與迷思。</p></section><section class="toolbar"><input class="search" id="q" autofocus placeholder="例如 DCM、overrun、offset、model input"><span id="count"></span></section><section class="lab-grid" id="results"></section></main>';
    const q=document.getElementById("q"),results=document.getElementById("results"),count=document.getElementById("count");
    function render(){const term=q.value.trim().toLowerCase(),out=rows.filter(r=>!term||[r.title,r.body,r.tag,r.type].join(" ").toLowerCase().includes(term));count.textContent=out.length+' / '+rows.length+' 筆';results.innerHTML=out.slice(0,140).map(r=>'<a class="lab" href="'+esc(r.href)+'"><span class="tag">'+esc(r.type)+' · '+esc(r.tag)+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.body)+'</p></a>').join("")||'<div class="empty">找不到符合內容。</div>';}
    q.oninput=render;render();
  }

  function renderGlossary(rootId) {
    const root=document.getElementById(rootId),terms=curriculum.glossary||[];
    root.innerHTML=nav("glossary")+'<main id="mainContent"><section class="hero"><div class="eyebrow">Glossary</div><h1>全域詞彙表</h1><p class="lead">共用 V4 evidence 與 V3 runtime。</p></section><section class="toolbar"><input class="search" id="termSearch" placeholder="搜尋 ADC、PWM、Offset"><span>共 '+terms.length+' 個詞彙</span></section><section class="lab-grid" id="terms">'+terms.map(t=>'<article class="lab" data-search="'+esc(t.join(" "))+'"><span class="tag">'+esc(t[0])+'</span><h3>'+esc(t[0])+'</h3><p>'+esc(t[1])+'</p><ul class="field-list"><li><b>實務提示</b><span>'+esc(t[2])+'</span></li></ul></article>').join("")+'</section></main>';
    bindFilter("termSearch","#terms .lab");
  }

  function bindFilter(id,selector){const input=document.getElementById(id);if(!input)return;input.oninput=()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll(selector).forEach(el=>el.hidden=!!q&&!String(el.dataset.search||el.textContent).toLowerCase().includes(q));};}
  function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

  global.CircuitLearning = {
    curriculum,
    questions,
    nav,
    loadState,
    saveState,
    reportQuality,
    renderHome,
    renderBeginner,
    renderLabs,
    renderTrouble,
    renderQuiz,
    renderProgress,
    renderReport,
    renderSearch,
    renderGlossary
  };
})(window);