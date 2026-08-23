(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Flow = global.CircuitCoreFlowV1;
  if (!Learning || !Flow) return;

  const previousLabs = Learning.renderLabs;
  const previousTrouble = Learning.renderTrouble;
  const previousProgress = Learning.renderProgress;
  const previousQuiz = Learning.renderQuiz;
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);

  function current() {
    const state = Flow.snapshot();
    return { state, layer: Flow.layers.find(layer => layer.key === state.currentLayer) || Flow.layers[0], progress: Flow.progress() };
  }

  function layerGrid(state) {
    return `<section class="core-page-layers" aria-label="八層主線">${Flow.layers.map(layer => {
      const done = Boolean(state.completed[layer.key]);
      const active = state.currentLayer === layer.key;
      return `<a class="core-page-layer${done ? " is-complete" : ""}${active ? " is-active" : ""}" href="${Flow.href(layer.key, "")}">
        <span>${layer.number}</span><b>${esc(layer.label)}</b><small>${done ? "完成 ✓" : active ? "目前" : "待學"}</small>
      </a>`;
    }).join("")}</section>`;
  }

  function resumeCard(kicker, title) {
    const { layer, progress } = current();
    return `<section class="core-page-resume">
      <div><span class="tag blue">${esc(kicker)}</span><h2>${esc(title)}</h2><p><b>${esc(layer.question)}</b></p><p>下一個量測：${esc(layer.measurement)}</p></div>
      <div><span>${progress.done}/${progress.total} 層 · ${progress.percent}%</span><a class="button primary" href="${Flow.href(layer.key, "")}">繼續 ${layer.number} ${esc(layer.label)} →</a></div>
    </section>`;
  }

  function wrapNodes(main, nodes, summary, className) {
    if (!main || !nodes.length || main.querySelector(`.${className}`)) return;
    const details = document.createElement("details");
    details.className = className;
    details.innerHTML = `<summary>${summary}</summary>`;
    nodes[0].parentNode.insertBefore(details, nodes[0]);
    nodes.forEach(node => details.appendChild(node));
  }

  Learning.renderBeginner = function renderCoreBeginner(rootId) {
    const root = document.getElementById(rootId);
    const { state, layer, progress } = current();
    const modules = Learning.curriculum.modules || [];
    root.innerHTML = `${Learning.nav("beginner")}<main id="mainContent">
      <section class="hero"><div class="eyebrow">START HERE · ONE LAYER AT A TIME</div><h1>初學不是展開 85 個待辦</h1><p class="lead">先走完目前一層；卡住時才回完整模組索引補觀念。</p></section>
      ${resumeCard("CURRENT LAYER", `${layer.number} · ${layer.label} · ${progress.done}/${progress.total}`)}
      ${layerGrid(state)}
      <details class="core-page-library"><summary>完整模組索引（補救與查找用）</summary><div class="lab-grid">${modules.map(module => `<a class="lab" href="${esc(module.entry)}"><span class="tag">Module ${esc(module.number)} · ${esc(module.tag)}</span><h3>${esc(module.title)}</h3><p>${esc(module.oneLine)}</p><small>${module.lessons.length} 課 · ${module.labs.length} 實驗</small></a>`).join("")}</div></details>
    </main>`;
  };

  Learning.renderLabs = function renderCoreLabs(rootId) {
    previousLabs(rootId);
    const root = document.getElementById(rootId);
    const main = root?.querySelector("main");
    const hero = main?.querySelector(".hero");
    if (!main || !hero) return;
    hero.querySelector("h1").textContent = "目前層的單變因實驗";
    hero.querySelector(".lead").textContent = "先做主線推薦實驗；完整實驗庫保留作查找與加練。";
    hero.insertAdjacentHTML("afterend", resumeCard("RECOMMENDED NOW", "同一台 Buck、同一份進度"));
    wrapNodes(main, [main.querySelector(":scope > .toolbar"), main.querySelector(":scope > #labGrid")].filter(Boolean), "完整實驗庫（搜尋與加練）", "core-page-library");
  };

  Learning.renderTrouble = function renderCoreTrouble(rootId) {
    previousTrouble(rootId);
    const root = document.getElementById(rootId);
    const main = root?.querySelector("main");
    const hero = main?.querySelector(".hero");
    if (!main || !hero) return;
    hero.querySelector("h1").textContent = "先量第一個分歧點";
    hero.querySelector(".lead").textContent = "固定順序：症狀 → 假設 → 下一量測 → 更新假設；不要先改 gain 或 code。";
    hero.insertAdjacentHTML("afterend", `<section class="core-page-resume"><div><span class="tag blue">DEBUG ROUTINE</span><h2>未知故障才進 Debug Bank</h2><p>正常八層因果鏈先走通，再用最有資訊量的 measurement 縮小 hypothesis space。</p></div><a class="button primary" href="15_power_capstone/index.html">開啟 Module 15 →</a></section>`);
    const optional = [...main.children].filter(node => node !== hero && !node.classList.contains("core-page-resume"));
    wrapNodes(main, optional, "故障題庫與完整速查", "core-page-library");
  };

  Learning.renderProgress = function renderCoreProgress(rootId) {
    previousProgress(rootId);
    const root = document.getElementById(rootId);
    const main = root?.querySelector("main");
    const hero = main?.querySelector(".hero");
    if (!main || !hero) return;
    const { state } = current();
    hero.querySelector("h1").textContent = "八層主線進度";
    hero.querySelector(".lead").textContent = "完成狀態與目前層由同一份 CoreFlow state 提供；assessment evidence 另列為進階證據。";
    hero.insertAdjacentHTML("afterend", `${resumeCard("CORE FLOW", "可續學、可重新整理")}${layerGrid(state)}`);
    const optional = [...main.children].filter(node => node !== hero && !node.classList.contains("core-page-resume") && !node.classList.contains("core-page-layers"));
    wrapNodes(main, optional, "進階證據：coverage、CI、retention 與狀態備份", "core-page-library");
  };

  function simplifyQuiz(root, view) {
    const main = root?.querySelector("main");
    const list = main?.querySelector(".quiz-list");
    if (!main || !list) return;
    const cards = [...list.querySelectorAll(":scope > .quiz-card")];
    if (!cards.length) return;
    const questionId = card => card.querySelector("[data-question]")?.dataset.question || "";
    let index = Math.max(0, cards.findIndex(card => questionId(card) === view.questionId));
    let pager = main.querySelector(".core-quiz-pager");
    if (!pager) {
      pager = document.createElement("nav");
      pager.className = "core-quiz-pager";
      pager.innerHTML = '<button class="button" type="button" data-quiz-prev>← 上一題</button><span data-quiz-position></span><button class="button" type="button" data-quiz-next>下一題 →</button>';
      list.after(pager);
    }
    const show = next => {
      index = Math.max(0, Math.min(cards.length - 1, next));
      view.questionId = questionId(cards[index]);
      cards.forEach((card, cardIndex) => { card.hidden = cardIndex !== index; });
      const position = `${index + 1}/${cards.length}`;
      const label = pager.querySelector("[data-quiz-position]");
      if (label.textContent !== position) label.textContent = position;
      pager.querySelector("[data-quiz-prev]").disabled = index === 0;
      pager.querySelector("[data-quiz-next]").disabled = index === cards.length - 1;
    };
    pager.querySelector("[data-quiz-prev]").onclick = () => show(index - 1);
    pager.querySelector("[data-quiz-next]").onclick = () => show(index + 1);
    show(index);
    const numericHead = [...main.querySelectorAll(":scope > .section-head")].find(head => head.textContent.includes("Parameterized numeric"));
    if (numericHead && numericHead.nextElementSibling) wrapNodes(main, [numericHead, numericHead.nextElementSibling], "數值開放題（進階）", "core-page-library");
  }

  Learning.renderQuiz = function renderCoreQuiz(rootId) {
    previousQuiz(rootId);
    const root = document.getElementById(rootId);
    const view = { questionId: "" };
    simplifyQuiz(root, view);
    const observer = new MutationObserver(() => global.requestAnimationFrame(() => simplifyQuiz(root, view)));
    observer.observe(root, { childList: true, subtree: true });
  };
})(window);
