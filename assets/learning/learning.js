(function (global) {
  "use strict";

  const KEY = "circuit-learning-done-v1";
  const modules = global.CircuitCurriculum.modules;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadDone() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch (e) { return {}; }
  }

  function saveDone(done) {
    try { localStorage.setItem(KEY, JSON.stringify(done)); }
    catch (e) {}
  }

  function nav(active) {
    const items = [
      ["index.html", "總入口", "home"],
      ["beginner.html", "初學路線", "beginner"],
      ["labs.html", "實驗任務", "labs"],
      ["troubleshooting.html", "故障速查", "trouble"],
      ["glossary.html", "詞彙表", "glossary"],
      ["search.html", "搜尋", "search"],
      ["report.html", "報告產生器", "report"]
    ];
    return '<nav class="topnav"><a class="brand" href="index.html"><span class="brand-mark">SIM</span><span>電路模擬說明</span></a>'
      + '<div class="navlinks">' + items.map(item => '<a class="' + (item[2] === active ? "active" : "") + '" href="' + item[0] + '">' + item[1] + '</a>').join("") + '</div></nav>';
  }

  function moduleHeader(module) {
    return '<div class="module-head">'
      + '<div class="module-title"><div style="display:flex;gap:12px;align-items:flex-start"><span class="num">' + module.number + '</span><div><span class="tag">' + esc(module.tag) + '</span><h2 style="margin-top:7px">' + esc(module.title) + '</h2><p class="muted">' + esc(module.whyUseful) + '</p></div></div>'
      + '<a class="button primary" href="' + module.entry + '">開啟原教材</a></div>'
      + '<div class="concept-grid">'
      + '<div class="concept"><b>一句話先懂</b><p>' + esc(module.oneLine) + '</p></div>'
      + '<div class="concept"><b>生活比喻</b><p>' + esc(module.analogy) + '</p></div>'
      + '<div class="concept"><b>實務用途</b><p>' + esc(module.whyUseful) + '</p></div>'
      + '</div></div>';
  }

  function lessonCard(module, lesson, index, done) {
    const id = module.id + ":lesson:" + index;
    const isDone = !!done[id];
    return '<article class="lesson">'
      + '<span class="tag blue">第 ' + (index + 1) + ' 步</span>'
      + '<h3>' + esc(lesson[1]) + '</h3>'
      + '<ul class="field-list">'
      + '<li><b>目標</b><span>' + esc(lesson[2]) + '</span></li>'
      + '<li><b>操作</b><span>' + esc(lesson[3]) + '</span></li>'
      + '<li><b>判讀</b><span>' + esc(lesson[4]) + '</span></li>'
      + '</ul>'
      + '<div class="actions"><a class="button primary" href="' + module.entry.replace(/[^/]+$/, "") + lesson[0] + '">開啟這步</a>'
      + '<button class="button ' + (isDone ? "done" : "") + '" data-done="' + id + '">' + (isDone ? "已完成" : "標記完成") + '</button></div>'
      + '</article>';
  }

  function renderBeginner(rootId) {
    const root = document.getElementById(rootId);
    const done = loadDone();
    root.innerHTML = nav("beginner")
      + '<section class="hero"><div class="eyebrow">Beginner Route</div><h1>初學者拆解路線</h1><p class="lead">每個主題都拆成「一句話、比喻、最小操作、判讀、實務用途」。不要先讀完整公式，先開一個模擬、改一個變數、看一個現象。</p></section>'
      + '<section class="metric-grid">'
      + '<div class="metric"><span class="tag green">順序</span><h3>先現象後公式</h3><p>每頁只追一個問題，降低初學負擔。</p></div>'
      + '<div class="metric"><span class="tag amber">操作</span><h3>一次只改一個變數</h3><p>避免同時改太多導致看不出因果。</p></div>'
      + '<div class="metric"><span class="tag rose">輸出</span><h3>留下判讀紀錄</h3><p>完成任務後可到報告頁整理成 Markdown。</p></div>'
      + '</section>'
      + '<section class="module-grid" style="margin-top:18px">' + modules.map(module => '<article class="module" id="' + module.id + '">' + moduleHeader(module) + '<div class="module-body"><div class="lesson-list">' + module.lessons.map((lesson, index) => lessonCard(module, lesson, index, done)).join("") + '</div></div></article>').join("") + '</section>';
    bindDone(root);
  }

  function labCard(module, lab, done) {
    const id = module.id + ":lab:" + lab[0];
    const isDone = !!done[id];
    return '<article class="lab" data-module="' + module.id + '">'
      + '<span class="tag">' + esc(module.tag) + '</span>'
      + '<h3>' + esc(lab[1]) + '</h3>'
      + '<ul class="field-list">'
      + '<li><b>任務</b><span>' + esc(lab[3]) + '</span></li>'
      + '<li><b>成功</b><span>' + esc(lab[4]) + '</span></li>'
      + '<li><b>實用</b><span>' + esc(lab[5]) + '</span></li>'
      + '</ul>'
      + '<div class="actions"><a class="button primary" href="' + lab[2] + '">開啟模擬</a><a class="button" href="report.html?lab=' + encodeURIComponent(lab[0]) + '">寫報告</a>'
      + '<button class="button ' + (isDone ? "done" : "") + '" data-done="' + id + '">' + (isDone ? "已完成" : "標記完成") + '</button></div>'
      + '</article>';
  }

  function renderLabs(rootId) {
    const root = document.getElementById(rootId);
    const done = loadDone();
    const allLabs = modules.flatMap(module => module.labs.map(lab => [module, lab]));
    root.innerHTML = nav("labs")
      + '<section class="hero"><div class="eyebrow">Practical Labs</div><h1>實用實驗任務</h1><p class="lead">這裡不是照章節讀，而是照工程任務做。每張任務卡都有明確操作、成功條件與實務用途。</p></section>'
      + '<section class="toolbar"><input class="search" id="labSearch" placeholder="搜尋任務、主題或關鍵字"><span class="muted">共 ' + allLabs.length + ' 個任務</span></section>'
      + '<section class="lab-grid" id="labGrid">' + allLabs.map(pair => labCard(pair[0], pair[1], done)).join("") + '</section>';
    bindDone(root);
    bindSearch("labSearch", "labGrid", ".lab");
  }

  function renderTrouble(rootId) {
    const root = document.getElementById(rootId);
    const rows = modules.flatMap(module => module.faults.map(fault => [module, fault]));
    root.innerHTML = nav("trouble")
      + '<section class="hero"><div class="eyebrow">Troubleshooting</div><h1>故障速查表</h1><p class="lead">從「看到的現象」反查可能原因、確認方式與修法。適合實驗卡住時先縮小範圍。</p></section>'
      + '<section class="toolbar"><input class="search" id="faultSearch" placeholder="搜尋症狀、原因、修法或主題"><span class="muted">共 ' + rows.length + ' 個症狀</span></section>'
      + '<section class="fault-table" id="faultTable">' + rows.map(pair => {
        const m = pair[0], f = pair[1];
        return '<article class="fault-row"><div><b>主題</b><span class="tag">' + esc(m.tag) + '</span></div><div><b>症狀</b><p>' + esc(f[0]) + '</p></div><div><b>可能原因</b><p>' + esc(f[1]) + '</p></div><div><b>確認與修法</b><p>' + esc(f[2]) + '<br>' + esc(f[3]) + '</p></div><div><a class="button primary" href="' + f[4] + '">開啟</a></div></article>';
      }).join("") + '</section>';
    bindSearch("faultSearch", "faultTable", ".fault-row");
  }

  function renderReport(rootId) {
    const root = document.getElementById(rootId);
    root.innerHTML = nav("report")
      + '<section class="hero"><div class="eyebrow">Lab Report</div><h1>實驗報告產生器</h1><p class="lead">把任務、參數、觀察、結論整理成可交付的 Markdown 紀錄。適合學習筆記、作業或設計評審附件。</p></section>'
      + '<section class="report-layout"><form class="panel form-grid" id="reportForm">'
      + '<label>主題<select id="moduleSelect"></select></label>'
      + '<label>任務<select id="labSelect"></select></label>'
      + '<label>實驗目標<textarea id="goal"></textarea></label>'
      + '<label>輸入參數<textarea id="params" placeholder="例如 Vin=24V, Vout=12V, fsw=100kHz"></textarea></label>'
      + '<label>觀察結果<textarea id="obs" placeholder="寫下你看到的波形、數值或狀態變化"></textarea></label>'
      + '<label>工程結論<textarea id="conclusion" placeholder="這代表什麼？實務上要怎麼用？"></textarea></label>'
      + '<div class="actions"><button class="button primary" type="button" id="downloadReport">下載 Markdown</button><button class="button" type="button" id="printReport">列印</button></div>'
      + '</form><section><pre class="report-preview" id="reportPreview"></pre></section></section>';
    bindReport();
  }

  function bindDone(root) {
    root.querySelectorAll("[data-done]").forEach(button => {
      button.addEventListener("click", () => {
        const done = loadDone();
        const id = button.getAttribute("data-done");
        if (done[id]) {
          delete done[id];
          button.classList.remove("done");
          button.textContent = "標記完成";
        } else {
          done[id] = true;
          button.classList.add("done");
          button.textContent = "已完成";
        }
        saveDone(done);
      });
    });
  }

  function bindSearch(inputId, containerId, itemSelector) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      container.querySelectorAll(itemSelector).forEach(item => {
        item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  function bindReport() {
    const moduleSelect = document.getElementById("moduleSelect");
    const labSelect = document.getElementById("labSelect");
    const goal = document.getElementById("goal");
    const params = document.getElementById("params");
    const obs = document.getElementById("obs");
    const conclusion = document.getElementById("conclusion");
    const preview = document.getElementById("reportPreview");
    const query = new URLSearchParams(location.search);

    moduleSelect.innerHTML = modules.map(m => '<option value="' + m.id + '">' + m.number + " " + esc(m.title) + '</option>').join("");

    function selectedModule() {
      return modules.find(m => m.id === moduleSelect.value) || modules[0];
    }

    function selectedLab() {
      const module = selectedModule();
      return module.labs.find(lab => lab[0] === labSelect.value) || module.labs[0];
    }

    function fillLabs(preferredLab) {
      const module = selectedModule();
      labSelect.innerHTML = module.labs.map(lab => '<option value="' + lab[0] + '">' + esc(lab[1]) + '</option>').join("");
      if (preferredLab && module.labs.some(lab => lab[0] === preferredLab)) labSelect.value = preferredLab;
      syncLabText();
    }

    function syncLabText() {
      const lab = selectedLab();
      goal.value = lab[3];
      conclusion.value = lab[5];
      updatePreview();
    }

    function updatePreview() {
      const module = selectedModule();
      const lab = selectedLab();
      const text = [
        "# " + module.title + " - " + lab[1],
        "",
        "## 一句話先懂",
        module.oneLine,
        "",
        "## 實驗目標",
        goal.value.trim(),
        "",
        "## 輸入參數",
        params.value.trim() || "- 尚未填寫",
        "",
        "## 操作頁面",
        lab[2],
        "",
        "## 成功條件",
        lab[4],
        "",
        "## 觀察結果",
        obs.value.trim() || "- 尚未填寫",
        "",
        "## 工程結論",
        conclusion.value.trim(),
        "",
        "## 下一步",
        "回到模擬器調整單一變數，確認結論是否仍成立。"
      ].join("\n");
      preview.textContent = text;
      return text;
    }

    moduleSelect.addEventListener("change", () => fillLabs());
    labSelect.addEventListener("change", syncLabText);
    [goal, params, obs, conclusion].forEach(el => el.addEventListener("input", updatePreview));
    document.getElementById("downloadReport").addEventListener("click", () => {
      const blob = new Blob([updatePreview()], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "circuit-lab-report.md";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    document.getElementById("printReport").addEventListener("click", () => window.print());

    const requestedLab = query.get("lab");
    const requestedModule = modules.find(m => m.labs.some(lab => lab[0] === requestedLab));
    if (requestedModule) moduleSelect.value = requestedModule.id;
    fillLabs(requestedLab);
  }

  global.CircuitLearning = {
    renderBeginner,
    renderLabs,
    renderTrouble,
    renderReport,
    nav
  };
})(window);
