(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const num = id => Number($(id)?.value);
  const hz = value => value >= 1e6 ? `${(value/1e6).toFixed(2)} MHz` : value >= 1000 ? `${(value/1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function loadModel() {
    if (window.CircuitTopologyTransferV1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../assets/learning/topology-transfer-v1.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("topology-transfer-v1.js load failed"));
      document.head.appendChild(script);
    });
  }

  function appendSurface() {
    if ($("p5TransferVerification")) return;
    const main = document.querySelector("main");
    if (!main) return;
    const section = document.createElement("section");
    section.className = "panel";
    section.id = "p5TransferVerification";
    section.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">P5 · UNSEEN TRANSFER VERIFICATION</p><h2>不要把 Buck 的直覺硬套到別的 power stage</h2></div><span class="badge exact">shared executable model</span></div>
      <p class="lead">這裡不再新增公式清單，而是把目前各 topology 的 operating point 轉成「第一個必須尊重的 constraint」。改上面的 slider，這些 constraint 會同步更新。</p>
      <div class="metric-grid" id="p5ConstraintGrid"></div>
      <div class="cause-chain"><span>Buck grammar</span><b>→</b><span>same r→e→C→u→P→y</span><b>→</b><span>topology-specific constraint</span><b>→</b><span>next measurement / bandwidth decision</span></div>
      <div class="section-head"><div><p class="eyebrow">FIRST ATTEMPT</p><h3>五個 unseen transfer checks</h3></div><span id="p5ChallengeScore">0/5</span></div>
      <div id="p5ChallengeList"></div>
      <p class="boundary">這個 P5 assessment 是 transfer evidence，不是 hardware certification；實板 truth 仍由 Module 19 的 physical closure package 管理。</p>`;
    main.appendChild(section);
  }

  function constraintRows(Model) {
    const rows = [];
    try {
      const x = Model.transferConstraint("boost", { vin:num("vinBoost"), duty:num("dutyBoost")/100, inductanceH:num("lBoost")*1e-6, loadOhm:num("rBoost") });
      rows.push({ name:"BOOST", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("pfc", { vrms:num("pfcVrms"), powerW:num("pfcPower"), vbus:num("pfcBus"), busCapF:num("pfcC")*1e-6, lineHz:num("pfcHz") });
      rows.push({ name:"PFC", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("psfb", { vin:num("psfbVin"), phaseDeg:num("psfbPhase"), turnsRatio:num("psfbN"), leakageH:num("psfbLlk")*1e-6, primaryCurrentA:num("psfbI"), commutationCapF:num("psfbCoss")*1e-9 });
      rows.push({ name:"PSFB", key:x.constraint, value:`${Number(x.value).toFixed(2)}×`, hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("llc", { resonantInductanceH:num("llcLr")*1e-6, resonantCapF:num("llcCr")*1e-9, magnetizingInductanceH:num("llcLm")*1e-6, q:num("llcQ"), switchingHz:num("llcFs")*1e3 });
      rows.push({ name:"LLC", key:x.constraint, value:Number(x.value).toFixed(3), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("inverter", { mode:$("invMode")?.value || "lcl", dcBusV:num("invVdc"), modulationIndex:num("invM"), l1H:num("invL1")*1e-3, capF:num("invC")*1e-6, l2H:num("invL2")*1e-3 });
      rows.push({ name:"INVERTER", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    return rows;
  }

  function renderConstraints(Model) {
    const grid = $("p5ConstraintGrid"); if (!grid) return;
    grid.innerHTML = constraintRows(Model).map(row => `<div data-p5-constraint="${row.name.toLowerCase()}"><span>${escapeHtml(row.name)} · ${escapeHtml(row.key)}</span><strong>${escapeHtml(row.value)}</strong><small>${escapeHtml(row.hint)}</small></div>`).join("");
  }

  function renderChallenges(Model) {
    const list = $("p5ChallengeList"); if (!list) return;
    const cases = Model.challengeSet(20260821);
    const first = new Map();
    const score = () => {
      const correct = [...first.entries()].filter(([id,answer]) => cases.find(item=>item.id===id)?.expected === answer).length;
      $("p5ChallengeScore").textContent = `${correct}/${cases.length} first attempts`;
    };
    list.innerHTML = cases.map(item => `<article class="explain-card" data-p5-case="${item.id}"><h3>${escapeHtml(item.topology.toUpperCase())}</h3><p>${escapeHtml(item.prompt)}</p><div class="topology-nav">${item.choices.map(choice=>`<button type="button" data-p5-answer="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div><small data-p5-result>First attempt 尚未作答</small></article>`).join("");
    list.querySelectorAll("[data-p5-case]").forEach(card => card.querySelectorAll("[data-p5-answer]").forEach(button => button.addEventListener("click", () => {
      const item = cases.find(row=>row.id===card.dataset.p5Case);
      if (!first.has(item.id)) first.set(item.id, button.dataset.p5Answer);
      const locked = first.get(item.id);
      card.querySelector("[data-p5-result]").textContent = locked === item.expected ? "✓ first attempt correct" : `✗ first attempt locked · expected: ${item.expected}`;
      score();
    })));
    score();
  }

  async function init() {
    appendSurface();
    try { await loadModel(); }
    catch (error) { $("p5ConstraintGrid").textContent = error.message; return; }
    const Model = window.CircuitTopologyTransferV1;
    renderConstraints(Model);
    renderChallenges(Model);
    document.querySelectorAll("input,select").forEach(input => input.addEventListener("input", () => renderConstraints(Model)));
  }

  init();
})();
