(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  if (!Learning || !Learning.renderHome) return;
  const previous = Learning.renderHome;

  const coreLayers = Object.freeze({
    energy: "physics",
    sensing: "sensing",
    control: "feedback",
    timing: "timing",
    dynamics: "dynamics",
    safety: "safety",
    production: "production",
    capstone: "evidence"
  });

  function retargetCoreJourney(root) {
    Object.entries(coreLayers).forEach(([stageId, layer]) => {
      const card = root.querySelector(`[data-stage-id="${stageId}"]`);
      const link = card && card.querySelector(".journey-enter");
      if (!link) return;
      link.href = `19_c2000_buck_firmware_lab/index.html?layer=${layer}`;
      link.textContent = "進入 Module 19 這一層 →";
      link.dataset.coreLayer = layer;
    });
  }

  function collapseTopicLibrary(root) {
    const grid = root.querySelector(".journey-topic-library");
    const head = grid && grid.previousElementSibling;
    if (!grid || !head || grid.closest("[data-topic-index]")) return;

    const details = document.createElement("details");
    details.className = "journey-topic-index panel";
    details.dataset.topicIndex = "1";
    const summary = document.createElement("summary");
    summary.textContent = "進階查找：完整主題索引（不是建議學習順序）";
    head.parentNode.insertBefore(details, head);
    details.append(summary, head, grid);
  }

  Learning.renderHome = function renderHomeWithC2000Lab(rootId) {
    previous(rootId);
    const root = document.getElementById(rootId);
    const journey = root && root.querySelector(".journey-shell");
    if (!journey) return;

    retargetCoreJourney(root);
    collapseTopicLibrary(root);
    if (root.querySelector("[data-c2000-buck-lab-entry]")) return;

    journey.insertAdjacentHTML("afterend", `
      <section class="panel" data-c2000-buck-lab-entry style="margin:1.25rem 0">
        <div class="eyebrow">ONE AUTHORITATIVE CORE · MODULE 19</div>
        <h2 style="margin-top:.35rem">先把同一台 C2000 Buck 從 Physics 走到 Board evidence</h2>
        <p class="muted">首頁八層現在都 deep-link 到 Module 19 的同一份 executable causal surface。Module 15 留給未知故障；Module 17 留給 topology transfer，不再和核心路徑搶角色。</p>
        <div class="actions">
          <a class="button primary" href="19_c2000_buck_firmware_lab/index.html?layer=physics">從 01 · Power Physics 開始 →</a>
          <a class="button" href="15_power_capstone/index.html">做 Debug Challenge Bank</a>
          <a class="button" href="17_power_topology_control/index.html#atlas">進入 Transfer Atlas</a>
        </div>
      </section>`);
  };
})(window);
