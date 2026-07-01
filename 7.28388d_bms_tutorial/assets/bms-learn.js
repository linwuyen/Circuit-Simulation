/*
 * bms-learn.js — 教學增強層（與 bms-sim.js 解耦）
 * 提供:學習進度、詞彙 tooltip、任務驗收、自我檢查小測、事件紀錄匯出。
 * 設計原則:只用注入與 DOM 觀察,不修改 bms-sim.js 的內部狀態。
 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // 第一性原理因果鏈:量測 → 比較 → 決定 → 致動 → 回報,墊著協同,任一步危險就鎖定。
  const CHAPTERS = [
    null,
    { file: "01_overview.html", name: "系統總覽" },
    { file: "02_sense.html", name: "量測:AFE 感測" },
    { file: "03_compare.html", name: "比較:安全門檻" },
    { file: "04_decide.html", name: "決定:BMS 狀態機" },
    { file: "05_actuate.html", name: "致動:接觸器與預充" },
    { file: "06_report.html", name: "回報:CAN/UDS" },
    { file: "07_coordinate.html", name: "協同:多核與 IPC" },
    { file: "08_failsafe.html", name: "失效安全:故障注入" },
    { file: "09_integrate.html", name: "整合實驗" }
  ];

  const GLOSSARY = {
    "AFE": "類比前端:量測電池電壓/電流並透過 SPI 回報。只提供數字,不做最終安全決策。",
    "CPU1": "F28388D 第一顆 C28x 核心:負責底層感測讀取、寫入 IPC/GSRAM、跨核 watchdog。",
    "CPU2": "第二顆 C28x 核心:執行 BMS 狀態機(FSM)與接觸器控制。",
    "CM4": "內建 ARM Cortex-M4 核心:負責 CAN FD 與 UDS 診斷通訊。",
    "IPC": "Inter-Processor Communication:核心之間傳遞訊息與旗標的硬體機制。",
    "GSRAM": "可在核心間共享的全域 SRAM,用來交換資料。",
    "UDS": "ISO 14229 統一診斷服務:診斷儀與 ECU 一問一答的協定。",
    "OVP": "Over-Voltage Protection:過壓保護門檻(本教材為 4250 mV)。",
    "OCP": "Over-Current Protection:過流保護門檻(本教材為 150 A)。",
    "SPI": "串列周邊介面:CPU1 與 AFE 之間的通訊匯流排,可能發生 CRC 錯誤或失聯。",
    "FSM": "有限狀態機:用明確條件決定系統處於哪個狀態,不靠感覺做事。",
    "SoC": "State of Charge:電池目前剩餘電量百分比。",
    "watchdog": "看門狗計時器:逾時沒被餵食就觸發保護,把系統拉回安全狀態。",
    "接觸器": "高壓主迴路的開關:閉合才允許放電,斷開代表禁止高壓或進入安全狀態。",
    "FAULT_LOCK": "故障鎖定狀態:必須明確重置才能離開,不會自動偷偷恢復。",
    "CAN FD": "車用網路匯流排:UDS 診斷封包在它上面傳輸。",
    "ADC": "類比數位轉換器:把電壓類比訊號轉成數字(本教材 12-bit)。",
    "預充": "Precharge:閉合主正接觸器前,先經預充電阻替高壓電容充電,限制突波電流,避免燒毀接觸器與熔絲。",
    "Trip-Zone": "C2000 的硬體保護機制:偵測到越界可在數 µs 內直接切斷 PWM/GPIO,不必等 CPU 介入。",
    "NRC": "Negative Response Code:UDS 負回應碼,7F 後面那個 byte,說明被拒絕的原因(如 35 金鑰錯誤)。",
    "DTC": "Diagnostic Trouble Code:診斷故障碼,記錄發生過的故障供事後讀取。"
  };

  const QUIZ = {
    "1": [
      { q: "BMS 的本質,一句話是?", opts: ["把電池關在安全範圍內,並決定高壓何時能接上負載", "讓電池充得更快", "只是顯示電量百分比"], a: 0 },
      { q: "一顆量測值走過的因果鏈順序是?", opts: ["回報 → 致動 → 決定 → 比較 → 量測", "量測 → 比較 → 決定 → 致動 → 回報", "決定 → 量測 → 致動 → 比較"], a: 1 },
      { q: "鏈上任一步判定危險時,系統會?", opts: ["自動忽略繼續跑", "進入 FAULT_LOCK 並鎖定,不自動恢復", "重開機就好"], a: 1 }
    ],
    "2": [
      { q: "AFE 在 BMS 裡的角色是什麼?", opts: ["提供感測輸入,不做最終安全決策", "負責最終的接觸器開關決策", "執行 BMS 狀態機"], a: 0 },
      { q: "SPI 錯誤累積到 3 次代表什麼?", opts: ["正常抖動", "AFE 失聯風險,感測不可信", "電池過熱"], a: 1 },
      { q: "感測值在送進判斷前,為什麼要先校驗(CRC)?", opts: ["讓畫面好看", "雜訊會翻轉位元,錯的數字會做出錯的決策", "為了加密"], a: 1 }
    ],
    "3": [
      { q: "最高單體電壓 4200 mV 落在哪個區間?", opts: ["可放電窗", "偏高灰帶:未過充但不准放電", "已過充,直接 FAULT"], a: 1 },
      { q: "OVP(4250)與放電上限(4150)為何是兩個不同數字?", opts: ["印刷錯誤", "留安全邊界/遲滯,避免在門檻邊緣抖動", "完全沒差別"], a: 1 },
      { q: "「比較」這一層本身會切換狀態嗎?", opts: ["不會,它只產生判定,切換交給狀態機", "會,直接斷電", "會,直接放電"], a: 0 }
    ],
    "4": [
      { q: "按了「請求放電」就一定會進 DISCHARGE 嗎?", opts: ["會,按了就放電", "不一定,要同時滿足電壓等條件", "只看電流"], a: 1 },
      { q: "DISCHARGE 時電流超過 150 A 會?", opts: ["繼續放電", "進入 FAULT 並斷開接觸器", "只記錄不動作"], a: 1 },
      { q: "FAULT_LOCK 會自己自動恢復嗎?", opts: ["會,過幾秒就好", "不會,需要明確重置", "看溫度決定"], a: 1 }
    ],
    "5": [
      { q: "為什麼不能一開始就直接閉合主正接觸器?", opts: ["為了省電", "大電容突波電流會燒接觸器/熔絲,要先預充限流", "沒差,可以直接合"], a: 1 },
      { q: "預充完成、可閉合主正的判斷條件通常是?", opts: ["電容電壓達電池端約 95%", "固定等 1 秒", "電流剛好為 0"], a: 0 },
      { q: "預充逾時(電壓一直建不起來)最可能代表?", opts: ["電池太滿", "負載側可能短路,應鎖定保護", "正常現象"], a: 1 }
    ],
    "6": [
      { q: "服務 22 01 的正回應前綴(SID+0x40)是?", opts: ["50", "62", "7F"], a: 1 },
      { q: "回應以 7F 開頭代表什麼?", opts: ["正回應", "負回應(條件不成立或不支援)", "種子值"], a: 1 },
      { q: "10 03 是切換到哪個 session?", opts: ["Default", "Extended", "Programming"], a: 1 }
    ],
    "7": [
      { q: "多核心共享資料為什麼要鎖或有效旗標?", opts: ["為了跑得更快", "避免讀到更新到一半的資料", "為了省記憶體"], a: 1 },
      { q: "本頁 IPC 的兩步驟順序是?", opts: ["CM4 先寫,CPU1 再讀", "CPU1 寫入 → CM4 讀取後 ACK", "兩核心同時寫"], a: 1 },
      { q: "GSRAM 是什麼?", opts: ["核心間共享的記憶體區", "一種感測器", "診斷協定"], a: 0 }
    ],
    "8": [
      { q: "故障注入(故意弄壞)的主要目的是?", opts: ["讓畫面變紅好看", "驗證系統能收斂到安全狀態", "加快放電"], a: 1 },
      { q: "OCP 過流觸發時,接觸器應該?", opts: ["維持閉合", "斷開 OPEN", "閃爍但不動"], a: 1 },
      { q: "CM4 掛起後,誰負責把系統拉回安全?", opts: ["AFE", "CPU1 的 watchdog", "診斷儀"], a: 1 }
    ],
    "9": [
      { q: "「診斷讀值一致性」要證明的是?", opts: ["AFE、CPU1、CM4 三邊電壓一致", "電壓越高越好", "CAN 速度最快"], a: 0 },
      { q: "過流保護後為什麼不應自動恢復?", opts: ["省電", "安全需要明確重置與故障紀錄", "沒有原因"], a: 1 },
      { q: "整合測試的精神是?", opts: ["亂按看看", "把操作串成可重現的測試案例", "只看單一元件"], a: 1 }
    ]
  };

  // 任務驗收:每項用 DOM 條件判斷,輪詢偵測,達成後鎖定打勾。
  const seenStates = new Set();
  const STATE_TOKENS = ["INIT", "STANDBY", "DISCHARGE", "FAULT"];
  function curStateText() {
    return ($("#system-state")?.textContent || "").toUpperCase();
  }
  function recordStates() {
    const s = curStateText();
    STATE_TOKENS.forEach((k) => { if (s.includes(k)) seenStates.add(k); });
  }
  let lastState = null;
  function currentToken() {
    const t = curStateText();
    return STATE_TOKENS.find((k) => t.includes(k)) || null;
  }
  function onState() {
    recordStates();
    const cur = currentToken();
    if (cur && cur !== lastState) {
      updateFsmDiagram(lastState, cur);
      lastState = cur;
    }
  }
  function watchStates() {
    const el = $("#system-state");
    if (!el) return;
    onState();
    new MutationObserver(onState).observe(el, { childList: true, subtree: true, characterData: true });
  }
  function seen(token) { return seenStates.has(token); }

  // ---- FSM 即時狀態圖(SVG) ----
  const FSM_EDGES = {
    "INIT>STANDBY": "e1",
    "STANDBY>DISCHARGE": "e2",
    "STANDBY>FAULT": "e3",
    "DISCHARGE>FAULT": "e4",
    "FAULT>INIT": "e5"
  };

  function buildFsmDiagram() {
    const flow = $(".state-flow");
    if (!flow) return;
    const node = (s, x, label) =>
      `<g class="node" data-s="${s}"><rect x="${x}" y="84" width="108" height="46" rx="9"></rect>` +
      `<text x="${x + 54}" y="112" text-anchor="middle">${label}</text></g>`;
    const edge = (id, d) => `<path id="${id}" class="fsm-edge" d="${d}" marker-end="url(#fsmar)"></path>`;
    const elabel = (x, y, t) => `<text class="fsm-elabel" x="${x}" y="${y}" text-anchor="middle">${t}</text>`;
    const wrap = document.createElement("div");
    wrap.className = "fsm-diagram";
    wrap.innerHTML =
      `<svg class="fsm-svg" viewBox="0 0 720 210" role="img" aria-label="BMS 狀態機轉換圖">` +
      `<defs><marker id="fsmar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="fsm-arrow"></path></marker></defs>` +
      edge("e1", "M124,107 L201,107") +
      edge("e2", "M317,107 L394,107") +
      edge("e4", "M510,107 L587,107") +
      edge("e3", "M263,84 C263,42 649,42 649,82") +
      edge("e5", "M649,130 C649,182 70,182 70,132") +
      elabel(162, 100, "啟動完成") +
      elabel(355, 100, "可放電") +
      elabel(548, 100, "過流/失聯") +
      elabel(456, 36, "OVP 過壓") +
      elabel(359, 176, "硬體重置") +
      node("INIT", 16, "INIT") +
      node("STANDBY", 209, "STANDBY") +
      node("DISCHARGE", 402, "DISCHARGE") +
      node("FAULT", 595, "FAULT_LOCK") +
      `</svg>`;
    flow.parentNode.insertBefore(wrap, flow);
    flow.classList.add("hidden");
  }

  function updateFsmDiagram(prev, cur) {
    if (!$(".fsm-svg")) return;
    $$(".fsm-svg .node").forEach((n) => n.classList.toggle("current", n.dataset.s === cur));
    $$(".fsm-edge").forEach((e) => e.classList.remove("active", "fault", "pulse"));
    const id = prev && FSM_EDGES[prev + ">" + cur];
    if (!id) return;
    const e = document.getElementById(id);
    if (!e) return;
    e.classList.add("active");
    if (cur === "FAULT") e.classList.add("fault");
    void e.getBBox();
    e.classList.add("pulse");
  }
  function num(id) { return Number(document.getElementById(id)?.value); }
  function txt(id) { return (document.getElementById(id)?.textContent || "").trim(); }
  function termHas(box, sub) {
    const node = document.getElementById(box);
    if (!node) return false;
    return $$("div", node).some((d) => d.textContent.includes(sub));
  }

  const TASKS = {
    "2": [
      { label: "把電壓降到 ≤ 4150 mV(進入可放電範圍)", check: () => num("voltage-slider") <= 4150 },
      { label: "把電壓拉到 > 4250 mV(觸發 OVP 提示)", check: () => num("voltage-slider") > 4250 },
      { label: "讓 SPI 錯誤累積到 3 次(AFE 失聯風險)", check: () => Number(txt("afe-spi-count")) >= 3 }
    ],
    "3": [
      { label: "點一顆電芯注入過壓(最高電芯 > 4250 mV)", check: () => parseInt(txt("compare-max-cell"), 10) > 4250 },
      { label: "讓某顆電芯欠壓(最低電芯 < 3000 mV)", check: () => parseInt(txt("compare-min-cell"), 10) < 3000 },
      { label: "點一個 NTC 注入過溫(最高溫 > 60 °C)", check: () => parseInt(txt("compare-max-temp"), 10) > 60 },
      { label: "把電流推過 OCP(> 150 A)", check: () => num("compare-current-slider") > 150 }
    ],
    "4": [
      { label: "讓系統成功進入 DISCHARGE", check: () => seen("DISCHARGE") },
      { label: "觸發一次 FAULT_LOCK", check: () => seen("FAULT") },
      { label: "硬體重置,讓系統回到 INIT", check: () => seen("FAULT") && curStateText().includes("INIT") }
    ],
    "5": [
      { label: "完成一次正常預充,接觸器閉合 CLOSED", check: () => txt("contactor").includes("CLOSED") || txt("contactor").includes("閉合") },
      { label: "看到系統進入 RUN(主正閉合、預充斷開)", check: () => txt("pre-stage").includes("RUN") },
      { label: "用短路情境觸發預充逾時 FAULT", check: () => txt("pre-stage").includes("FAULT") }
    ],
    "6": [
      { label: "切換到 Extended session(0x03)", check: () => txt("uds-session") === "0x03" },
      { label: "讀到一筆 62 開頭的正回應(資料)", check: () => termHas("uds-term", "62 ") },
      { label: "遇到一筆 7F 開頭的負回應(看懂原因)", check: () => termHas("uds-term", "7F ") },
      { label: "走完安全存取,看到 67 02 解鎖成功", check: () => termHas("uds-term", "67 02") }
    ],
    "7": [
      { label: "傳輸一次,讓 GSRAM 不再是 0x0000", check: () => { const v = txt("gsram-value"); return v && v !== "0x0000"; } },
      { label: "讓 CM4 讀到資料(IPC_Rx_V 非 0)", check: () => { const v = txt("cm4-rx"); return v && v !== "0x0000"; } }
    ],
    "8": [
      { label: "觸發任一故障,進入 FAULT", check: () => seen("FAULT") },
      { label: "確認接觸器斷開 OPEN", check: () => txt("contactor").includes("OPEN") || txt("contactor").includes("斷開") }
    ],
    "9": [
      { label: "讓系統進入 DISCHARGE", check: () => seen("DISCHARGE") },
      { label: "用 IPC 同步把電壓送到 CM4", check: () => termHas("uds-term", "synced") },
      { label: "觸發一次 FAULT_LOCK", check: () => seen("FAULT") }
    ]
  };

  // ---- 進度儲存 ----
  const KEY = "bms_tutorial_done";
  function getDone() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function isDone(n) { return !!getDone()[n]; }
  function setDone(n) {
    const d = getDone();
    if (d[n]) return false;
    d[n] = true;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return true;
  }

  function chapterNum() {
    const c = document.body.dataset.chapter;
    return c ? String(Number(c)) : null;
  }

  function toast(msg) {
    let t = $("#bms-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "bms-toast";
      t.className = "bms-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function completeChapter(n) {
    if (setDone(n)) {
      toast("✓ 已完成第 " + n + " 章:" + (CHAPTERS[n] ? CHAPTERS[n].name : ""));
      refreshStrip();
    }
  }

  // ---- 進度條 ----
  function refreshStrip() {
    const done = getDone();
    $$(".progress-strip .dot").forEach((dot) => {
      const n = dot.dataset.n;
      dot.classList.toggle("done", !!done[n]);
    });
  }

  function buildStrip() {
    const topbar = $(".topbar");
    if (!topbar) return;
    const cur = chapterNum();
    const strip = document.createElement("div");
    strip.className = "progress-strip";
    const dots = CHAPTERS.slice(1).map((c, i) => {
      const n = i + 1;
      const isCur = cur === String(n);
      return `<a class="dot${isCur ? " current" : ""}" data-n="${n}" href="${c.file}" title="第${n}章 ${c.name}"><span>${n}</span></a>`;
    }).join("");
    strip.innerHTML =
      `<div class="progress-inner"><span class="ps-label">學習進度</span>${dots}` +
      (cur ? `<button type="button" class="ps-mark" id="ps-mark">標記本章完成</button>` : "") +
      `</div>`;
    topbar.insertAdjacentElement("afterend", strip);
    refreshStrip();
    if (cur) {
      $("#ps-mark").addEventListener("click", () => completeChapter(cur));
    }
  }

  // ---- 詞彙 tooltip ----
  let tipEl = null;
  function showTip(el) {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "gloss-tip";
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = el.dataset.tip;
    tipEl.style.display = "block";
    const r = el.getBoundingClientRect();
    const tr = tipEl.getBoundingClientRect();
    let top = r.top - tr.height - 8;
    if (top < 4) top = r.bottom + 8;
    let left = r.left;
    if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - 8 - tr.width;
    if (left < 8) left = 8;
    tipEl.style.top = (top + window.scrollY) + "px";
    tipEl.style.left = (left + window.scrollX) + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.display = "none"; }

  function textNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest(
          ".nav, .terminal, .code, pre, script, style, button, input, .gloss, .progress-strip, .glossary-card, .task-list, .quiz-panel, .bms-toast"
        )) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const out = [];
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function isWordChar(ch) { return ch && /[A-Za-z0-9_]/.test(ch); }
  function isCJK(s) { return /[一-鿿]/.test(s); }

  function wrapGlossary() {
    const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
    terms.forEach((term) => {
      const cjk = isCJK(term);
      const nodes = textNodes();
      for (const node of nodes) {
        const text = node.nodeValue;
        let idx = text.indexOf(term);
        let ok = false;
        while (idx !== -1) {
          if (cjk) { ok = true; break; }
          const before = text[idx - 1];
          const after = text[idx + term.length];
          if (!isWordChar(before) && !isWordChar(after)) { ok = true; break; }
          idx = text.indexOf(term, idx + term.length);
        }
        if (!ok) continue;
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + term.length);
        const span = document.createElement("span");
        span.className = "gloss";
        span.tabIndex = 0;
        span.dataset.tip = GLOSSARY[term];
        try { range.surroundContents(span); } catch (e) { continue; }
        break; // 每個詞只標記第一次出現
      }
    });
    document.addEventListener("mouseover", (e) => {
      const g = e.target.closest && e.target.closest(".gloss");
      if (g) showTip(g);
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest && e.target.closest(".gloss")) hideTip();
    });
    document.addEventListener("focusin", (e) => {
      if (e.target.classList && e.target.classList.contains("gloss")) showTip(e.target);
    });
    document.addEventListener("focusout", hideTip);
    window.addEventListener("scroll", hideTip, { passive: true });
  }

  // ---- 詞彙表浮動面板 ----
  function buildGlossaryCard() {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "glossary-fab";
    fab.textContent = "詞彙表";
    const card = document.createElement("div");
    card.className = "glossary-card";
    card.hidden = true;
    card.innerHTML =
      `<div class="gc-head"><strong>名詞快查</strong><button type="button" class="gc-close" aria-label="關閉">×</button></div>` +
      `<dl>` + Object.keys(GLOSSARY).map((k) => `<dt>${k}</dt><dd>${GLOSSARY[k]}</dd>`).join("") + `</dl>`;
    document.body.appendChild(fab);
    document.body.appendChild(card);
    fab.addEventListener("click", () => { card.hidden = !card.hidden; });
    card.querySelector(".gc-close").addEventListener("click", () => { card.hidden = true; });
  }

  // ---- 事件紀錄匯出 ----
  function addExportButtons() {
    $$(".event-log, .terminal").forEach((box) => {
      const panel = box.closest(".panel");
      if (!panel) return;
      let title = panel.querySelector(".panel-title");
      if (!title) {
        title = document.createElement("div");
        title.className = "panel-title";
        panel.insertBefore(title, panel.firstChild);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-export";
      btn.textContent = "匯出 .txt";
      btn.addEventListener("click", () => {
        const lines = $$(":scope > div", box).map((d) => d.textContent).join("\r\n");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const blob = new Blob([lines || "(空白)"], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bms_log_${stamp}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      title.appendChild(btn);
    });
  }

  // ---- 任務驗收面板 ----
  let taskState = [];
  function buildTasks(cur) {
    const tasks = TASKS[cur];
    if (!tasks || !tasks.length) return;
    const main = $("main.page");
    const footer = $(".footer-nav");
    if (!main) return;
    const panel = document.createElement("section");
    panel.className = "panel task-panel";
    panel.innerHTML =
      `<div class="panel-title"><h2>任務驗收</h2><small>達成會自動打勾</small></div>` +
      `<ul class="task-list">` +
      tasks.map((t, i) => `<li id="task-${i}"><span class="tick" aria-hidden="true"></span><span class="tx">${t.label}</span></li>`).join("") +
      `</ul>`;
    if (footer) main.insertBefore(panel, footer); else main.appendChild(panel);
    taskState = tasks.map(() => false);
    let finished = false;

    const poll = () => {
      if (finished) return;
      recordStates();
      let allDone = true;
      tasks.forEach((t, i) => {
        if (!taskState[i]) {
          let pass = false;
          try { pass = !!t.check(); } catch (e) { pass = false; }
          if (pass) {
            taskState[i] = true;
            $("#task-" + i)?.classList.add("done");
          }
        }
        if (!taskState[i]) allDone = false;
      });
      if (allDone) {
        finished = true;
        clearInterval(timer);
        completeChapter(cur);
      }
    };
    // 輪詢處理非同步狀態(故障倒數等);輸入/點擊則即時評估,避免快速滑過門檻時漏抓。
    const timer = setInterval(poll, 400);
    document.addEventListener("input", poll, true);
    document.addEventListener("click", () => setTimeout(poll, 60), true);
    poll();
  }

  // ---- 自我檢查小測 ----
  function buildQuiz(cur) {
    const quiz = QUIZ[cur];
    if (!quiz || !quiz.length) return;
    const main = $("main.page");
    const footer = $(".footer-nav");
    if (!main) return;
    const panel = document.createElement("section");
    panel.className = "panel quiz-panel";
    panel.innerHTML =
      `<div class="panel-title"><h2>自我檢查</h2><small>點選答案,立刻看對錯</small></div>` +
      quiz.map((item, qi) =>
        `<div class="quiz-q" data-correct="${item.a}"><p class="qtext">${qi + 1}. ${item.q}</p>` +
        `<div class="quiz-opts">` +
        item.opts.map((o, oi) => `<button type="button" class="quiz-opt" data-q="${qi}" data-o="${oi}">${o}</button>`).join("") +
        `</div><p class="quiz-feedback"></p></div>`
      ).join("");
    if (footer) main.insertBefore(panel, footer); else main.appendChild(panel);

    const answered = quiz.map(() => false);
    panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".quiz-opt");
      if (!btn) return;
      const qBox = btn.closest(".quiz-q");
      const correct = Number(qBox.dataset.correct);
      const chosen = Number(btn.dataset.o);
      const qi = Number(btn.dataset.q);
      $$(".quiz-opt", qBox).forEach((b) => { b.disabled = true; b.classList.remove("picked"); });
      btn.classList.add("picked");
      const fb = qBox.querySelector(".quiz-feedback");
      if (chosen === correct) {
        btn.classList.add("correct");
        fb.textContent = "答對了。";
        fb.className = "quiz-feedback ok";
      } else {
        btn.classList.add("wrong");
        $$(".quiz-opt", qBox)[correct].classList.add("correct");
        fb.textContent = "再想一下:正確答案已標綠。";
        fb.className = "quiz-feedback no";
      }
      answered[qi] = chosen === correct;
      if (answered.every(Boolean)) completeChapter(cur);
    });
  }

  // ---- 首頁卡片完成標記 ----
  function enhanceIndexCards() {
    const done = getDone();
    const map = {};
    CHAPTERS.forEach((c, i) => { if (c) map[c.file] = i; });
    $$("a.card[href]").forEach((card) => {
      const n = map[card.getAttribute("href")];
      if (n && done[n] && !card.querySelector(".card-done")) {
        const badge = document.createElement("span");
        badge.className = "card-done";
        badge.textContent = "✓ 已完成";
        card.appendChild(badge);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const cur = chapterNum();
    buildFsmDiagram();
    watchStates();
    buildStrip();
    wrapGlossary();
    buildGlossaryCard();
    addExportButtons();
    if (cur) {
      buildTasks(cur);
      buildQuiz(cur);
    }
    enhanceIndexCards();
  });
})();
