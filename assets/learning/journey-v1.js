(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Flow = global.CircuitCoreFlowV1;
  if (!Learning || !Learning.renderHome || !Flow) return;

  const previousRenderHome = Learning.renderHome;
  const layerMeta = {
    physics: { tag: "POWER PHYSICS", why: "用 ON/OFF、volt-second balance 與 iL 建立能量直覺。" },
    sensing: { tag: "SENSING", why: "確認 physical → AFE → ADC pin → count → engineering unit。" },
    feedback: { tag: "FEEDBACK", why: "看懂 r − ŷ → C(z) → duty，而不是先調 gain。" },
    timing: { tag: "REAL-TIME", why: "量 SOCA、EOC、ISR、shadow write 與 active load。" },
    dynamics: { tag: "DYNAMICS", why: "從 load step 理解儲能，再用 Bode / delay 看速度限制。" },
    safety: { tag: "SAFETY", why: "讓 hardware veto 獨立於 control ISR，直接停止能量。" },
    production: { tag: "PRODUCTION", why: "把 state、freshness、ownership 與 re-arm 變成產品契約。" },
    evidence: { tag: "EVIDENCE", why: "分清 Model、SIL、HIL、Image、Binding 與 Board claim。" }
  };
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);

  function layerLink(key) { return Flow.href(key, ""); }
  function layerCards(state) {
    return Flow.layers.map(layer => {
      const done = Boolean(state.completed[layer.key]);
      const current = state.currentLayer === layer.key;
      const meta = layerMeta[layer.key];
      return `<a class="journey-stage${current ? " is-active" : ""}${done ? " is-complete" : ""}" data-journey-stage="${layer.key}" href="${layerLink(layer.key)}">
        <span class="journey-stage-num">${layer.number}</span>
        <span><small>${meta.tag}</small><b>${layer.label}</b></span>
        <span class="journey-stage-progress">${done ? "完成 ✓" : current ? "目前" : "待學"}</span>
      </a>`;
    }).join("");
  }

  function markup() {
    const state = Flow.snapshot();
    const progress = Flow.progress();
    const current = Flow.layers.find(layer => layer.key === state.currentLayer) || Flow.layers[0];
    const meta = layerMeta[current.key];
    return `<section class="journey-shell" data-core-home>
      <header class="journey-section-head">
        <div>
          <p class="journey-eyebrow">ONE BUCK · ONE CAUSAL PATH</p>
          <h2>先走完一台電源，再按需要打開工具</h2>
          <p>唯一主線：預測 → 單變因操作 → 觀察 → 因果解釋 → 下一量測 → 完成本層。</p>
        </div>
        <div class="journey-resume">
          <span>${progress.done}/${progress.total} 層 · ${progress.percent}%</span>
          <a class="button primary" data-core-resume href="${layerLink(current.key)}">繼續 ${current.number} ${current.label} →</a>
        </div>
      </header>
      <div class="journey-progress" aria-label="核心主線進度"><i style="width:${progress.percent}%"></i></div>
      <div class="journey-layout">
        <nav class="journey-stage-list" aria-label="八層學習主線">${layerCards(state)}</nav>
        <aside class="journey-system">
          <span class="tag blue">${meta.tag}</span>
          <h3>${current.number} · ${current.label}</h3>
          <p><b>${esc(current.question)}</b></p>
          <p>${esc(meta.why)}</p>
          <div class="truth-box"><b>下一個量測：</b>${esc(current.measurement)}</div>
        </aside>
      </div>
      <details class="journey-specializations">
        <summary>需要時再打開：Debug、數學、跨拓樸與工程工作台</summary>
        <div class="journey-specialization-links">
          <a href="15_power_capstone/index.html"><b>Module 15 · Debug Bank</b><span>正常主線走通後，再做未知故障隔離。</span></a>
          <a href="16_control_transforms/index.html"><b>Module 16 · Math Lens</b><span>Laplace / Bode / Z / delay 是看同一條 loop 的鏡頭。</span></a>
          <a href="17_power_topology_control/index.html"><b>Module 17 · Transfer</b><span>把控制語法遷移到 Boost / PFC / PSFB / LLC / Inverter。</span></a>
          <a href="18_control_unification/index.html"><b>Module 18 · Workbench</b><span>查控制 grammar、模型與工程參考。</span></a>
        </div>
      </details>
    </section>`;
  }

  function wrapOptional(main, selector, summary, className) {
    const node = main.querySelector(selector);
    if (!node || node.closest(`.${className}`)) return;
    const details = document.createElement("details");
    details.className = className;
    details.innerHTML = `<summary>${summary}</summary>`;
    node.parentNode.insertBefore(details, node);
    details.appendChild(node);
  }

  function enhance(rootId) {
    const root = document.getElementById(rootId);
    const main = root?.querySelector("main");
    const hero = main?.querySelector(".hero");
    if (!main || !hero || main.querySelector("[data-core-home]")) return;
    const state = Flow.snapshot();
    const current = Flow.layers.find(layer => layer.key === state.currentLayer) || Flow.layers[0];
    hero.classList.add("journey-hero");
    hero.innerHTML = `<div class="eyebrow">DIGITAL POWER FIRMWARE · FIRST PRINCIPLES</div><h1>Measure → Decide → Actuate → Protect → Verify</h1><p class="lead">同一台 48 → 12 V Buck、同一份可持久化進度、一次只學一層。</p>`;
    hero.insertAdjacentHTML("afterend", markup());
    wrapOptional(main, ":scope > .metric-grid", "進階證據：benchmark、CI 與 measurement coverage", "journey-advanced-evidence");
    wrapOptional(main, ":scope > .mode-grid", "工具入口：實驗、除錯、測驗、搜尋與工作單", "journey-toolbox");
    const topicHead = [...main.querySelectorAll(":scope > .section-head")].find(head => head.querySelector("h2")?.textContent.trim() === "完整主題");
    const topicGrid = topicHead?.nextElementSibling;
    if (topicHead && topicGrid) {
      const details = document.createElement("details");
      details.className = "journey-topic-details";
      details.innerHTML = "<summary>完整模組索引（查找與補救用）</summary>";
      topicHead.parentNode.insertBefore(details, topicHead);
      details.append(topicHead, topicGrid);
    }
    main.querySelector(":scope > .notice")?.remove();
  }

  Learning.renderHome = function renderJourney(rootId) {
    previousRenderHome(rootId);
    enhance(rootId);
  };
  global.CircuitJourneyV1 = { enhance };
})(window);
