(function (global) {
  "use strict";

  const Schema = global.CircuitSchema;
  const QuizBank = global.CircuitQuizBank;
  const ModelRegistry = global.CircuitModelRegistry;
  const rawCurriculum = global.CircuitCurriculum;
  if (!Schema || !QuizBank || !ModelRegistry || !rawCurriculum) {
    throw new Error("Learning Core v2 dependencies are missing");
  }

  const curriculum = Schema.normalizeCurriculum(rawCurriculum);
  const modules = curriculum.modules;
  const questions = QuizBank.getQuestions(curriculum);
  const STATE_KEY = "circuit-learning-state-v2";
  const LEGACY_DONE_KEY = "circuit-learning-done-v1";
  const STATE_SCHEMA = "circuit-learning-state";
  const STATE_VERSION = 2;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function emptyState() {
    return {
      schema: STATE_SCHEMA,
      version: STATE_VERSION,
      completed: {},
      questions: {},
      reports: {},
      migratedLegacy: false,
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(value) {
    const state = value && value.schema === STATE_SCHEMA && value.version === STATE_VERSION ? value : emptyState();
    state.completed = state.completed && typeof state.completed === "object" ? state.completed : {};
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    state.reports = state.reports && typeof state.reports === "object" ? state.reports : {};
    return state;
  }

  function loadState() {
    const state = normalizeState(readJson(STATE_KEY, null));
    if (!state.migratedLegacy) {
      const legacyDone = readJson(LEGACY_DONE_KEY, {});
      Object.assign(state.completed, Schema.migrateLegacyDone(rawCurriculum, legacyDone));
      state.migratedLegacy = true;
      saveState(state);
    }
    return state;
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn("Unable to persist learning state", error); }
  }

  function nav(active) {
    const items = [
      ["index.html", "總入口", "home"],
      ["beginner.html", "初學路線", "beginner"],
      ["labs.html", "實驗任務", "labs"],
      ["troubleshooting.html", "故障速查", "trouble"],
      ["progress.html", "進度", "progress"],
      ["quiz.html", "診斷測驗", "quiz"],
      ["glossary.html", "詞彙表", "glossary"],
      ["search.html", "搜尋", "search"],
      ["report.html", "工程工作單", "report"]
    ];
    return '<nav class="topnav"><a class="brand" href="index.html"><span class="brand-mark">SIM</span><span>電路模擬說明</span></a>'
      + '<div class="navlinks">' + items.map(item => '<a class="' + (item[2] === active ? "active" : "") + '" href="' + item[0] + '">' + item[1] + '</a>').join("") + '</div></nav>';
  }

  function modelCards(module) {
    const cards = ModelRegistry.forModule(module.id);
    if (!cards.length) return "";
    return '<div class="model-card-grid">' + cards.map(card => '<article class="model-card">'
      + '<div class="model-card-head"><span class="tag blue">' + esc(card.type) + '</span><strong>' + esc(card.title) + '</strong></div>'
      + '<div><b>適用假設</b><ul>' + card.assumptions.map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></div>'
      + '<div><b>停止相信模型的條件</b><ul>' + card.invalidWhen.map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></div>'
      + '<small class="muted">來源：' + esc(card.source) + '</small>'
      + '</article>').join("") + '</div>';
  }

  function moduleHeader(module) {
    return '<div class="module-head">'
      + '<div class="module-title"><div style="display:flex;gap:12px;align-items:flex-start"><span class="num">' + esc(module.number) + '</span><div><span class="tag">' + esc(module.tag) + '</span><h2 style="margin-top:7px">' + esc(module.title) + '</h2><p class="muted">' + esc(module.whyUseful) + '</p></div></div>'
      + '<a class="button primary" href="' + esc(module.entry) + '">開啟入口</a></div>'
      + '<div class="concept-grid">'
      + '<div class="concept"><b>一句話先懂</b><p>' + esc(module.oneLine) + '</p></div>'
      + '<div class="concept"><b>生活比喻</b><p>' + esc(module.analogy) + '</p></div>'
      + '<div class="concept"><b>可遷移能力</b><p>完成後應能處理不同參數與新情境，而不只重複頁面答案。</p></div>'
      + '</div>' + modelCards(module) + '</div>';
  }

  function lessonCard(module, lesson, state, index) {
    const done = !!state.completed[lesson.id];
    return '<article class="lesson" data-lesson="' + esc(lesson.id) + '">'
      + '<div class="lesson-meta"><span class="tag blue">第 ' + (index + 1) + ' 步</span><code>' + esc(lesson.competency) + '</code></div>'
      + '<h3>' + esc(lesson.title) + '</h3>'
      + '<ul class="field-list">'
      + '<li><b>目標</b><span>' + esc(lesson.objective) + '</span></li>'
      + '<li><b>操作</b><span>' + esc(lesson.action) + '</span></li>'
      + '<li><b>判讀</b><span>' + esc(lesson.expectedObservation) + '</span></li>'
      + '</ul>'
      + '<div class="actions"><a class="button primary" href="' + esc(lesson.href) + '">開啟這步</a>'
      + '<button class="button ' + (done ? "done" : "") + '" type="button" data-complete="' + esc(lesson.id) + '">' + (done ? "已完成操作與判讀" : "我已完成操作與判讀") + '</button></div>'
      + '</article>';
  }

  function bindCompletion(root, rerender) {
    root.querySelectorAll("[data-complete]").forEach(button => {
      button.addEventListener("click", () => {
        const state = loadState();
        const id = button.dataset.complete;
        if (state.completed[id]) delete state.completed[id];
        else state.completed[id] = { at: new Date().toISOString(), evidence: "self-check" };
        saveState(state);
        rerender();
      });
    });
  }

  function renderBeginner(rootId) {
    const root = document.getElementById(rootId);
    function render() {
      const state = loadState();
      root.innerHTML = nav("beginner")
        + '<section class="hero"><div class="eyebrow">Predict → Test → Explain → Transfer</div><h1>初學者拆解路線</h1><p class="lead">完成不等於看過。每一步都先預測，再只改一個變數，最後用自己的話解釋因果。</p></section>'
        + '<section class="metric-grid">'
        + '<div class="metric"><span class="tag green">預測</span><h3>操作前先下注</h3><p>先寫下方向與理由，避免看答案後產生理解錯覺。</p></div>'
        + '<div class="metric"><span class="tag amber">驗證</span><h3>一次只改一個變數</h3><p>保留因果辨識能力。</p></div>'
        + '<div class="metric"><span class="tag rose">遷移</span><h3>換參數仍能判斷</h3><p>真正能力是處理沒看過的情境。</p></div>'
        + '</section>'
        + '<section class="module-grid" style="margin-top:18px">' + modules.map(module => '<article class="module" id="' + esc(module.id) + '">' + moduleHeader(module) + '<div class="module-body"><div class="lesson-list">' + module.lessons.map((lesson, index) => lessonCard(module, lesson, state, index)).join("") + '</div></div></article>').join("") + '</section>';
      bindCompletion(root, render);
    }
    render();
  }

  function renderLabs(rootId) {
    const root = document.getElementById(rootId);
    const allLabs = modules.flatMap(module => module.labs.map(lab => ({ module, lab })));
    function render() {
      const state = loadState();
      root.innerHTML = nav("labs")
        + '<section class="hero"><div class="eyebrow">Evidence-based Labs</div><h1>實用實驗任務</h1><p class="lead">每個實驗都必須留下「預測、觀察、解釋、限制」。只有完成工作單才算完成，不再只是按一下勾選。</p></section>'
        + '<section class="toolbar"><input class="search" id="labSearch" placeholder="搜尋任務、能力或主題"><span class="muted">共 ' + allLabs.length + ' 個任務</span></section>'
        + '<section class="lab-grid" id="labGrid">' + allLabs.map(({ module, lab }) => {
          const done = !!state.completed[lab.id];
          return '<article class="lab" data-search="' + esc([module.title, lab.title, lab.task, lab.competency].join(" ")) + '">'
            + '<div class="lesson-meta"><span class="tag">' + esc(module.tag) + '</span><code>' + esc(lab.competency) + '</code></div>'
            + '<h3>' + esc(lab.title) + '</h3>'
            + '<ul class="field-list"><li><b>任務</b><span>' + esc(lab.task) + '</span></li><li><b>成功條件</b><span>' + esc(lab.success) + '</span></li><li><b>遷移問題</b><span>' + esc(lab.transferPrompt) + '</span></li></ul>'
            + '<div class="actions"><a class="button" href="' + esc(lab.href) + '">開啟模擬</a><a class="button primary" href="report.html?lab=' + encodeURIComponent(lab.localId) + '">先預測並記錄</a><span class="completion-badge ' + (done ? "is-done" : "") + '">' + (done ? "有完整證據" : "尚未完成工作單") + '</span></div>'
            + '</article>';
        }).join("") + '</section>';
      bindTextFilter("labSearch", "#labGrid .lab");
    }
    render();
  }

  function renderTrouble(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.faults.map(fault => ({ module, fault })));
    root.innerHTML = nav("trouble")
      + '<section class="hero"><div class="eyebrow">Symptom → Hypothesis → Test</div><h1>故障速查表</h1><p class="lead">不要從答案開始。先把症狀轉成可驗證假設，再用最便宜、辨識力最高的量測排除原因。</p></section>'
      + '<section class="toolbar"><input class="search" id="faultSearch" placeholder="搜尋症狀、原因、驗證或能力"><span class="muted">共 ' + rows.length + ' 個症狀</span></section>'
      + '<section class="fault-table" id="faultTable">' + rows.map(({ module, fault }) => '<article class="fault-row" data-search="' + esc([module.title, fault.symptom, fault.cause, fault.verify, fault.fix].join(" ")) + '">'
        + '<div><b>主題</b><span class="tag">' + esc(module.tag) + '</span></div>'
        + '<div><b>症狀</b><p>' + esc(fault.symptom) + '</p></div>'
        + '<div><b>假設</b><p>' + esc(fault.cause) + '</p></div>'
        + '<div><b>辨識性測試</b><p>' + esc(fault.verify) + '</p></div>'
        + '<div><b>修法</b><p>' + esc(fault.fix) + '</p><a class="button primary" href="' + esc(fault.href) + '">開啟</a></div>'
        + '</article>').join("") + '</section>';
    bindTextFilter("faultSearch", "#faultTable .fault-row");
  }

  function bindTextFilter(inputId, selector) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", () => {
      const term = input.value.trim().toLowerCase();
      document.querySelectorAll(selector).forEach(item => {
        const haystack = (item.dataset.search || item.textContent).toLowerCase();
        item.style.display = !term || haystack.includes(term) ? "" : "none";
      });
    });
  }

  function questionStatus(question, state) {
    const answer = state.questions[question.id];
    if (!answer) return "unanswered";
    return answer.correct ? "correct" : "wrong";
  }

  function renderQuiz(rootId) {
    const root = document.getElementById(rootId);
    const query = new URLSearchParams(location.search);
    const initialModule = query.get("module") || "all";

    root.innerHTML = nav("quiz")
      + '<section class="hero"><div class="eyebrow">Diagnostic Quiz</div><h1>迷思診斷測驗</h1><p class="lead">題目只使用人工設計的常見錯誤觀念，不再從全站隨機拼湊答案。答錯時會指出可能的思考偏差。</p></section>'
      + '<section class="notice"><strong>目前標竿題庫：</strong>Buck、ADC、SPI。其他主題在完成迷思設計前不會用低品質自動題目填充。</section>'
      + '<section class="toolbar quiz-toolbar"><select id="quizModule"><option value="all">全部標竿主題</option>'
      + ["buck", "adc", "spi"].map(id => curriculum.moduleById[id]).filter(Boolean).map(module => '<option value="' + esc(module.id) + '">' + esc(module.title) + '</option>').join("")
      + '</select><select id="quizStatus"><option value="all">全部題目</option><option value="unanswered">未答</option><option value="wrong">答錯</option><option value="correct">答對</option></select><span class="muted" id="quizCount"></span></section>'
      + '<section class="metric-grid" id="quizMetrics"></section><section class="quiz-list" id="quizList"></section>';

    const moduleSelect = document.getElementById("quizModule");
    const statusSelect = document.getElementById("quizStatus");
    if (questions.some(q => q.moduleId === initialModule)) moduleSelect.value = initialModule;

    function render() {
      const state = loadState();
      let visible = questions.filter(question => moduleSelect.value === "all" || question.moduleId === moduleSelect.value);
      if (statusSelect.value !== "all") visible = visible.filter(question => questionStatus(question, state) === statusSelect.value);
      const scope = questions.filter(question => moduleSelect.value === "all" || question.moduleId === moduleSelect.value);
      const correct = scope.filter(question => questionStatus(question, state) === "correct").length;
      const wrong = scope.filter(question => questionStatus(question, state) === "wrong").length;
      document.getElementById("quizCount").textContent = visible.length + " / " + scope.length + " 題";
      document.getElementById("quizMetrics").innerHTML = '<div class="metric"><span class="tag green">已掌握</span><h3>' + correct + '</h3><p>目前最後一次作答正確。</p></div>'
        + '<div class="metric"><span class="tag rose">已識別迷思</span><h3>' + wrong + '</h3><p>答錯不是失敗，而是找到具體錯誤模型。</p></div>'
        + '<div class="metric"><span class="tag amber">題庫品質</span><h3>人工設計</h3><p>每個干擾項對應一個常見迷思。</p></div>';
      document.getElementById("quizList").innerHTML = visible.map(question => questionCard(question, state.questions[question.id])).join("") || '<div class="empty">這個條件下沒有題目。</div>';
      bindQuestionButtons();
    }

    function questionCard(question, answer) {
      const status = answer ? (answer.correct ? "is-correct" : "is-wrong") : "";
      const selected = answer && question.options.find(option => option.id === answer.choiceId);
      const correctOption = question.options.find(option => option.correct);
      let feedback = "";
      if (answer) {
        feedback = answer.correct
          ? '<div class="quiz-explain"><b>正確推理</b><p>' + esc(correctOption.feedback) + '</p></div>'
          : '<div class="quiz-explain misconception"><b>可能迷思：' + esc(selected && selected.misconception || "推理鏈尚未建立") + '</b><p>' + esc(selected && selected.feedback || correctOption.feedback) + '</p><p><strong>正確答案：</strong>' + esc(correctOption.text) + '</p></div>';
      }
      return '<article class="quiz-card ' + status + '"><div class="quiz-head"><span class="tag">' + esc(question.kind) + ' · ' + esc(question.module.tag) + '</span><code>' + esc(question.competency) + '</code></div>'
        + '<h3>' + esc(question.prompt) + '</h3><div class="quiz-options">' + question.options.map(option => '<button class="quiz-option ' + (answer && answer.choiceId === option.id ? "selected" : "") + '" type="button" data-question="' + esc(question.id) + '" data-option="' + esc(option.id) + '">' + esc(option.text) + '</button>').join("") + '</div>'
        + feedback + '<div class="actions"><a class="button" href="' + esc(question.href) + '">回到對應教材</a></div></article>';
    }

    function bindQuestionButtons() {
      document.querySelectorAll("[data-question][data-option]").forEach(button => {
        button.addEventListener("click", () => {
          const question = questions.find(item => item.id === button.dataset.question);
          const option = question && question.options.find(item => item.id === button.dataset.option);
          if (!question || !option) return;
          const state = loadState();
          const previous = state.questions[question.id];
          state.questions[question.id] = {
            choiceId: option.id,
            correct: !!option.correct,
            attempts: (previous && previous.attempts || 0) + 1,
            competency: question.competency,
            updatedAt: new Date().toISOString()
          };
          saveState(state);
          render();
        });
      });
    }

    moduleSelect.addEventListener("change", render);
    statusSelect.addEventListener("change", render);
    render();
  }

  function moduleProgress(module, state) {
    const practice = [...module.lessons, ...module.labs];
    const practiceDone = practice.filter(item => state.completed[item.id]).length;
    const diagnostics = questions.filter(question => question.moduleId === module.id);
    const diagnosticCorrect = diagnostics.filter(question => state.questions[question.id] && state.questions[question.id].correct).length;
    return {
      practiceDone,
      practiceTotal: practice.length,
      practicePercent: practice.length ? Math.round(practiceDone / practice.length * 100) : 0,
      diagnosticCorrect,
      diagnosticTotal: diagnostics.length,
      diagnosticPercent: diagnostics.length ? Math.round(diagnosticCorrect / diagnostics.length * 100) : null
    };
  }

  function nextItem(module, state) {
    const lesson = module.lessons.find(item => !state.completed[item.id]);
    if (lesson) return { label: "下一步：" + lesson.title, href: lesson.href };
    const lab = module.labs.find(item => !state.completed[item.id]);
    if (lab) return { label: "下一個工作單：" + lab.title, href: "report.html?lab=" + encodeURIComponent(lab.localId) };
    if (questions.some(question => question.moduleId === module.id)) return { label: "做遷移診斷", href: "quiz.html?module=" + encodeURIComponent(module.id) };
    return { label: "回主題入口複習", href: module.entry };
  }

  function downloadState(state) {
    const payload = { ...state, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "circuit-learning-state-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importState(file) {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.schema !== STATE_SCHEMA || payload.version !== STATE_VERSION) throw new Error("不支援的學習狀態檔案。");
    const current = loadState();
    Object.assign(current.completed, payload.completed || {});
    Object.assign(current.questions, payload.questions || {});
    Object.assign(current.reports, payload.reports || {});
    saveState(current);
  }

  function renderProgress(rootId) {
    const root = document.getElementById(rootId);
    function render() {
      const state = loadState();
      const totals = modules.reduce((acc, module) => {
        const progress = moduleProgress(module, state);
        acc.done += progress.practiceDone;
        acc.total += progress.practiceTotal;
        return acc;
      }, { done: 0, total: 0 });
      const answered = questions.filter(question => state.questions[question.id]).length;
      const correct = questions.filter(question => state.questions[question.id] && state.questions[question.id].correct).length;
      root.innerHTML = nav("progress")
        + '<section class="hero"><div class="eyebrow">Evidence Dashboard</div><h1>學習進度</h1><p class="lead">分開顯示「做過」與「能遷移」。完成率是練習證據；診斷正確率才接近能力證據。</p></section>'
        + '<section class="metric-grid"><div class="metric"><span class="tag green">練習證據</span><h3>' + totals.done + ' / ' + totals.total + '</h3><p>課程操作與完整工作單。</p></div><div class="metric"><span class="tag blue">診斷證據</span><h3>' + correct + ' / ' + questions.length + '</h3><p>標竿主題的最後一次遷移判斷。</p></div><div class="metric"><span class="tag amber">已作答</span><h3>' + answered + '</h3><p>答錯會保留迷思類型供複習。</p></div></section>'
        + '<section class="progress-list">' + modules.map(module => {
          const progress = moduleProgress(module, state);
          const next = nextItem(module, state);
          return '<article class="progress-card"><div class="progress-title"><div><span class="tag">' + esc(module.tag) + '</span><h3>' + esc(module.title) + '</h3></div><a class="button primary" href="' + esc(next.href) + '">' + esc(next.label) + '</a></div>'
            + '<div class="evidence-row"><div><b>練習</b><span>' + progress.practiceDone + ' / ' + progress.practiceTotal + '</span><div class="progress-track"><i style="width:' + progress.practicePercent + '%"></i></div></div>'
            + '<div><b>診斷</b><span>' + (progress.diagnosticTotal ? progress.diagnosticCorrect + ' / ' + progress.diagnosticTotal : "題庫建置中") + '</span><div class="progress-track diagnostic"><i style="width:' + (progress.diagnosticPercent || 0) + '%"></i></div></div></div></article>';
        }).join("") + '</section>'
        + '<section class="panel state-tools"><h2>備份與還原</h2><p class="muted">第二代狀態使用穩定課程 ID；重新排序課程不會把舊進度指到別的頁面。</p><div class="actions"><button class="button" id="exportState" type="button">匯出狀態</button><button class="button" id="importState" type="button">匯入並合併</button><input id="stateFile" type="file" accept="application/json,.json" hidden><span id="stateMessage" class="muted" aria-live="polite"></span></div></section>';
      document.getElementById("exportState").addEventListener("click", () => downloadState(loadState()));
      document.getElementById("importState").addEventListener("click", () => document.getElementById("stateFile").click());
      document.getElementById("stateFile").addEventListener("change", async event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const message = document.getElementById("stateMessage");
        try { await importState(file); message.textContent = "匯入完成"; render(); }
        catch (error) { message.textContent = error.message || "匯入失敗"; }
      });
    }
    render();
  }

  function reportMarkdown(module, lab, draft) {
    return [
      "# " + module.title + " — " + lab.title,
      "",
      "## 能力標籤",
      lab.competency,
      "",
      "## 任務",
      lab.task,
      "",
      "## 成功條件",
      lab.success,
      "",
      "## 1. 操作前預測",
      draft.prediction || "- 尚未填寫",
      "",
      "## 2. 輸入參數與條件",
      draft.parameters || "- 尚未填寫",
      "",
      "## 3. 實際觀察",
      draft.observation || "- 尚未填寫",
      "",
      "## 4. 因果解釋",
      draft.explanation || "- 尚未填寫",
      "",
      "## 5. 模型限制與不確定性",
      draft.limitations || "- 尚未填寫",
      "",
      "## 6. 遷移驗證",
      lab.transferPrompt,
      "",
      draft.transfer || "- 尚未填寫",
      "",
      "## 7. 下一步",
      draft.nextStep || "- 尚未填寫",
      "",
      "---",
      "更新時間：" + (draft.updatedAt || new Date().toISOString())
    ].join("\n");
  }

  function renderReport(rootId) {
    const root = document.getElementById(rootId);
    const query = new URLSearchParams(location.search);
    const requestedLab = query.get("lab");
    root.innerHTML = nav("report")
      + '<section class="hero"><div class="eyebrow">Engineering Worksheet</div><h1>預測—驗證—解釋工作單</h1><p class="lead">先留下預測，再開模擬。沒有預測、觀察與因果解釋，就不能標記實驗完成。</p></section>'
      + '<section class="report-layout"><form class="panel form-grid" id="reportForm">'
      + '<label>主題<select id="moduleSelect"></select></label><label>實驗<select id="labSelect"></select></label>'
      + '<div class="report-brief" id="reportBrief"></div>'
      + '<label>1. 操作前預測<textarea id="prediction" placeholder="改變哪個變數？輸出會往哪個方向？為什麼？"></textarea></label>'
      + '<label>2. 輸入參數與條件<textarea id="parameters" placeholder="例如 Vin=24 V、Vout=12 V、L=100 µH、fsw=100 kHz"></textarea></label>'
      + '<label>3. 實際觀察<textarea id="observation" placeholder="記錄數值、波形、狀態轉換與預測差異"></textarea></label>'
      + '<label>4. 因果解釋<textarea id="explanation" placeholder="用公式、能量流或時序解釋觀察結果"></textarea></label>'
      + '<label>5. 模型限制與不確定性<textarea id="limitations" placeholder="哪些非理想項、量測誤差或適用條件尚未納入？"></textarea></label>'
      + '<label>6. 遷移驗證<textarea id="transfer" placeholder="換一組參數或故障條件後，結論是否仍成立？"></textarea></label>'
      + '<label>7. 下一步<textarea id="nextStep" placeholder="下一個可區分假設的實驗或量測是什麼？"></textarea></label>'
      + '<div class="actions"><a class="button" id="openSimulator">開啟模擬</a><button class="button primary" type="button" id="completeReport">驗證並完成</button><button class="button" type="button" id="downloadReport">下載 Markdown</button><button class="button" type="button" id="clearReport">清除草稿</button></div><p id="reportMessage" class="muted" aria-live="polite"></p>'
      + '</form><section><pre class="report-preview" id="reportPreview"></pre></section></section>';

    const fields = ["prediction", "parameters", "observation", "explanation", "limitations", "transfer", "nextStep"];
    const moduleSelect = document.getElementById("moduleSelect");
    const labSelect = document.getElementById("labSelect");
    moduleSelect.innerHTML = modules.filter(module => module.labs.length).map(module => '<option value="' + esc(module.id) + '">' + esc(module.number + " " + module.title) + '</option>').join("");
    const requestedModule = modules.find(module => module.labs.some(lab => lab.localId === requestedLab));
    if (requestedModule) moduleSelect.value = requestedModule.id;

    function selectedModule() { return curriculum.moduleById[moduleSelect.value] || modules[0]; }
    function selectedLab() { return selectedModule().labs.find(lab => lab.localId === labSelect.value) || selectedModule().labs[0]; }
    function currentDraft(state) { return state.reports[selectedLab().id] || {}; }

    function populateLabs(preferred) {
      const module = selectedModule();
      labSelect.innerHTML = module.labs.map(lab => '<option value="' + esc(lab.localId) + '">' + esc(lab.title) + '</option>').join("");
      if (preferred && module.labs.some(lab => lab.localId === preferred)) labSelect.value = preferred;
      loadDraft();
    }

    function draftFromFields() {
      const draft = {};
      fields.forEach(id => { draft[id] = document.getElementById(id).value.trim(); });
      draft.updatedAt = new Date().toISOString();
      return draft;
    }

    function updatePreview() {
      document.getElementById("reportPreview").textContent = reportMarkdown(selectedModule(), selectedLab(), draftFromFields());
    }

    function saveDraft() {
      const state = loadState();
      state.reports[selectedLab().id] = draftFromFields();
      saveState(state);
      updatePreview();
    }

    function loadDraft() {
      const module = selectedModule();
      const lab = selectedLab();
      const state = loadState();
      const draft = currentDraft(state);
      fields.forEach(id => { document.getElementById(id).value = draft[id] || ""; });
      document.getElementById("reportBrief").innerHTML = '<p><b>任務：</b>' + esc(lab.task) + '</p><p><b>成功條件：</b>' + esc(lab.success) + '</p><p><b>遷移問題：</b>' + esc(lab.transferPrompt) + '</p><code>' + esc(lab.competency) + '</code>';
      document.getElementById("openSimulator").href = lab.href;
      document.getElementById("reportMessage").textContent = state.completed[lab.id] ? "此工作單已有完成證據；修改後可重新驗證。" : "草稿會自動保存在本瀏覽器。";
      updatePreview();
    }

    fields.forEach(id => document.getElementById(id).addEventListener("input", saveDraft));
    moduleSelect.addEventListener("change", () => populateLabs());
    labSelect.addEventListener("change", loadDraft);

    document.getElementById("completeReport").addEventListener("click", () => {
      const draft = draftFromFields();
      const missing = [
        ["prediction", "操作前預測"],
        ["observation", "實際觀察"],
        ["explanation", "因果解釋"],
        ["transfer", "遷移驗證"]
      ].filter(([key]) => !draft[key]).map(item => item[1]);
      const message = document.getElementById("reportMessage");
      if (missing.length) {
        message.textContent = "尚不能完成：請補上「" + missing.join("、") + "」。";
        return;
      }
      const state = loadState();
      state.reports[selectedLab().id] = draft;
      state.completed[selectedLab().id] = { at: new Date().toISOString(), evidence: "worksheet" };
      saveState(state);
      message.textContent = "完成：已保存預測、觀察、解釋與遷移證據。";
    });

    document.getElementById("downloadReport").addEventListener("click", () => {
      const markdown = reportMarkdown(selectedModule(), selectedLab(), draftFromFields());
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = Schema.slug(selectedModule().id + "-" + selectedLab().localId) + "-" + new Date().toISOString().slice(0, 10) + ".md";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

    document.getElementById("clearReport").addEventListener("click", () => {
      if (!confirm("確定清除這份工作單草稿與完成狀態？")) return;
      const state = loadState();
      delete state.reports[selectedLab().id];
      delete state.completed[selectedLab().id];
      saveState(state);
      loadDraft();
    });

    populateLabs(requestedLab);
  }

  global.CircuitLearning = {
    curriculum,
    nav,
    renderBeginner,
    renderLabs,
    renderTrouble,
    renderQuiz,
    renderProgress,
    renderReport
  };
})(window);
