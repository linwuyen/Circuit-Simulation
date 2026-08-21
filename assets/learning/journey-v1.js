(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Evidence = global.CircuitEvidence;
  const Store = global.CircuitPowerSystemStateV1;
  if (!Learning || !Learning.renderHome || !Learning.curriculum) return;

  const previousRenderHome = Learning.renderHome;
  const curriculum = Learning.curriculum;
  const moduleById = curriculum.moduleById || Object.fromEntries((curriculum.modules || []).map(module => [module.id, module]));
  const stages = [
    { id:"energy", number:"01", tag:"POWER PHYSICS", title:"能量：先看 Power Stage", question:"開關到底怎麼改變電壓、電流與能量？", why:"先從 ON/OFF、volt-second balance 與電感電流建立直覺。", modules:["buck"], active:["actuator","plant","output"], timeline:["PWM switching","vL","di/dt","L / C energy","Load"], system:"先證明能量怎麼流，再談 controller。", model:"L1 · Ideal switching physics", liveIndex:0 },
    { id:"sensing", number:"02", tag:"SENSING", title:"量測：MCU 到底看見什麼", question:"真實的 A / V，怎麼一路變成 ADC count？", why:"Scale、offset、OPA、ADC 任一段錯，controller 就會相信錯誤世界。", modules:["adc"], active:["output","sensor","adc"], timeline:["Physical y","Sensor / scale","ADC count"], system:"先確認 measurement truth，再讓 feedback 相信它。", model:"L2 · Measurement model", liveIndex:1 },
    { id:"control", number:"03", tag:"FEEDBACK", title:"閉迴路：PI 為什麼能控制", question:"Reference 和 feedback 差多少，controller 應該怎麼推？", why:"先理解 error → command → plant → feedback，再談 deadline 與頻域。", modules:["pi"], active:["reference","controller","actuator","plant","output","sensor","adc"], timeline:["r − ŷ","PI / C(z)","u","P","physical y","feedback"], system:"控制器不是魔法：它只根據相信的 measurement 產生 command。", model:"L3 · Feedback surrogate", liveIndex:3 },
    { id:"timing", number:"04", tag:"REAL-TIME", title:"時序：Sample 到 Actuate", question:"ADC 何時量？新 duty 又何時真的進入 plant？", why:"知道 feedback 在做什麼後，再看 SOC、EOC、ISR/CLA、shadow write 與 PWM load deadline。", modules:["power-sync","loop10us"], active:["adc","controller","actuator"], timeline:["PWM SOCA","ADC ready","ISR","CMP shadow write","PWM ZERO load"], system:"CPU 算完不等於 plant 已經看到新 duty；錯過 load event 就多一拍。", model:"L4 · Discrete timing", liveIndex:2 },
    { id:"dynamics", number:"05", tag:"MATH LENS", title:"動態：Pole、Bode、Z、Delay", question:"為什麼低頻看似正確的 PI，高頻卻可能失去 phase margin？", why:"Laplace / Bode / Z / SFRA 是同一條 loop 的不同觀察鏡頭，不是四門互不相干的數學。", modules:["control-transforms"], active:["controller","actuator","plant","output","sensor","adc"], timeline:["P(s)","Bode","C(z)","sample-to-actuate Td","SFRA"], system:"把 plant dynamics 與數位 delay 分開量，再合成 loop judgment。", model:"L5 · Dynamic / frequency lens", liveIndex:4 },
    { id:"safety", number:"06", tag:"SAFETY", title:"安全：Protection 有否決權", question:"Fault 發生後，哪條路徑最先讓能量停止？", why:"CMPSS / XBAR / Digital Compare / Trip Zone 應能獨立於 control ISR 直接 veto PWM。", modules:["protection"], active:["safety","actuator","plant"], timeline:["Fault","CMPSS","XBAR / DCAEVT1","Trip Zone","PWM LOW"], system:"Safety authority 高於 control authority；fault source 消失也不等於允許自動 re-arm。", model:"L6 · Hardware safety invariant", liveIndex:6 },
    { id:"production", number:"07", tag:"PRODUCTION", title:"產品韌體：State、Command、Data Ownership", question:"誰有權 enable？誰刷新 command freshness？誰能 clear fault？", why:"把 timeout、ownership、calibration、startup qualification 與 fail-closed policy 放進產品契約。", modules:["power-capstone"], href:"19_c2000_buck_firmware_lab/index.html", active:["reference","controller","actuator","adc","safety"], timeline:["validated command","freshness","state","authority","telemetry / evidence"], system:"ADC ISR 不能自己製造 heartbeat；權限必須有唯一 owner。", model:"L7 · Production firmware contract", liveIndex:7 },
    { id:"capstone", number:"08", tag:"CAPSTONE", title:"整機：SIL → HIL → Target → Board", question:"Vout 不對時，下一個最有資訊量的 measurement 是什麼？", why:"用同一份 semantic contract 串起 physics、sensing、timing、control、safety 與實板 evidence。", modules:["power-capstone"], href:"19_c2000_buck_firmware_lab/index.html", active:["reference","controller","actuator","plant","output","sensor","adc","safety"], timeline:["Physics","SIL","HIL","C2000 target","Board evidence"], system:"真正能力是遇到陌生系統仍能逐層證偽，而且不把模型 PASS 冒充實板 PASS。", model:"L8 · Evidence-backed debug", liveIndex:7 }
  ];

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
  const modules = ids => ids.map(id => moduleById[id]).filter(Boolean);

  function evidence(stage, state) {
    const items = modules(stage.modules).flatMap(module => [...(module.lessons || []), ...(module.labs || [])]);
    if (!items.length || !Evidence || typeof Evidence.evidenceLevel !== "function") return { done:0, total:items.length, percent:0 };
    const done = items.filter(item => Evidence.evidenceLevel(state, item.id) >= 2).length;
    return { done, total:items.length, percent:Math.round(done * 100 / items.length) };
  }

  function stageCard(stage, index, state) {
    const progress = evidence(stage, state);
    const firstModule = modules(stage.modules)[0];
    const href = stage.href || (firstModule ? firstModule.entry : "#");
    return `<article class="journey-stage ${index === 0 ? "is-active" : ""}" data-journey-stage="${index}" data-stage-id="${stage.id}" tabindex="0">
      <div class="journey-stage-top"><span class="journey-stage-num">${stage.number}</span><span class="tag">${stage.tag}</span><span class="journey-stage-progress">${progress.total ? `${progress.done}/${progress.total} practiced` : "open path"}</span></div>
      <h3>${stage.title}</h3><p class="journey-stage-question">${stage.question}</p><p class="muted">${stage.why}</p>
      <div class="journey-progress"><i style="width:${progress.percent}%"></i></div><a class="button journey-enter" href="${esc(href)}">進入這一層 →</a>
    </article>`;
  }

  function node(id, symbol, title, sub) {
    return `<div class="journey-system-node" data-system-node="${id}"><span>${symbol}</span><b>${title}</b><small>${sub}</small></div>`;
  }

  function specialization(id, role, description) {
    const module = moduleById[id];
    if (!module) return "";
    return `<a href="${esc(module.entry)}"><b>${role}</b><span>${description}</span></a>`;
  }

  function markup(state) {
    return `<section class="journey-shell">
      <div class="journey-section-head"><div><p class="journey-eyebrow">POWER FIRMWARE CORE · ONE BUCK, EIGHT LAYERS</p><h2>不是先收集 19 個主題，而是先把一台數位電源真的控制起來</h2><p>核心順序只回答一件事：你是否能從 energy → measurement → feedback → timing → dynamics → safety → production → evidence 建立可證偽的因果鏈。</p></div><button class="button primary" id="journeyPlay" type="button">▶ 逐步播放</button></div>
      <div class="journey-kpis" aria-label="學習成效指標">
        <div><span>FIRST ATTEMPT</span><b>先預測方向</b><small>看答案前 commit judgment</small></div>
        <div><span>NEXT MEASUREMENT</span><b>先決定量什麼</b><small>不要先改 gain / code</small></div>
        <div><span>UNSEEN TRANSFER</span><b>換真實條件</b><small>fsw / plant / sensor / fault</small></div>
        <div><span>RETENTION</span><b>1d / 7d / 30d / 90d</b><small>靠取回，不靠重看頁面</small></div>
      </div>
      <div class="journey-layout"><div class="journey-stage-list">${stages.map((stage,index) => stageCard(stage,index,state)).join("")}</div><aside class="journey-system"><div class="journey-system-sticky">
        <div class="journey-system-head"><div><span class="tag blue">STICKY CONTROL GRAMMAR</span><h3 id="journeySystemTitle"></h3></div><span class="journey-live-dot">LIVE</span></div>
        <div class="journey-model-fidelity"><span>MODEL FIDELITY</span><strong id="journeyModelLevel"></strong></div>
        <div class="journey-loop">${node("reference","r","Reference","target")}<span class="journey-arrow">→</span>${node("controller","C(z)","Controller","error → command")}<span class="journey-arrow">→</span>${node("actuator","u","Actuator","PWM / phase / fsw")}<span class="journey-arrow">→</span>${node("plant","P","Power Stage","energy + dynamics")}<span class="journey-arrow">→</span>${node("output","y","Output","V / I / power")}</div>
        <div class="journey-feedback">${node("sensor","H","Sensor / Scale","physical → volts")}<span class="journey-arrow">→</span>${node("adc","ADC","Sampling","volts → counts")}<span class="journey-feedback-return">↖ feedback to error</span></div>
        <div class="journey-safety" data-system-node="safety"><span>SAFETY VETO</span><b>CMPSS / XBAR / Trip → PWM OFF</b><small>Protection is an independent authority plane.</small></div>
        <div class="journey-system-explain"><span id="journeySystemTag"></span><strong id="journeySystemQuestion"></strong><p id="journeySystemMeaning"></p></div><div class="journey-timeline" id="journeyTimeline"></div>
      </div></aside></div>
      <section class="journey-specializations"><div><span class="tag">AFTER CORE / WHEN NEEDED</span><h3>工具與遷移，不再搶在核心因果鏈前面</h3><p class="muted">先用 Buck 建立可遷移 grammar，再換 plant 或數學鏡頭。</p></div><div class="journey-specialization-links">
        ${specialization("control-transforms","Module 16 · Math Lens","Laplace / Fourier / Z / Bode / delay：需要時拿來看同一條 loop")}
        ${specialization("power-topology-control","Module 17 · Transfer Atlas","把已會的 feedback grammar 遷移到 Boost / PFC / PSFB / LLC / Inverter")}
        ${specialization("control-unification","Module 18 · Control Grammar","查 r → e → C(z) → u → P → y；不是另一門必修課")}
        <a href="19_c2000_buck_firmware_lab/index.html"><b>Module 19 · Executable Capstone</b><span>Physics → SIL → HIL → driverlib target → board evidence</span></a>
      </div></section>
    </section>`;
  }

  function applyStage(index, root) {
    const stage = stages[index];
    if (!stage) return;
    root.querySelectorAll("[data-journey-stage]").forEach((card, i) => card.classList.toggle("is-active", i === index));
    root.querySelectorAll("[data-system-node]").forEach(element => {
      const id = element.dataset.systemNode;
      element.classList.toggle("is-active", stage.active.includes(id));
      element.classList.toggle("is-dim", !stage.active.includes(id));
    });
    root.querySelector("#journeySystemTitle").textContent = `${stage.number} · ${stage.title}`;
    root.querySelector("#journeyModelLevel").textContent = stage.model;
    root.querySelector("#journeySystemTag").textContent = stage.tag;
    root.querySelector("#journeySystemQuestion").textContent = stage.question;
    root.querySelector("#journeySystemMeaning").textContent = stage.system;
    root.querySelector("#journeyTimeline").innerHTML = stage.timeline.map(item => `<span>${item}</span>`).join("<i>→</i>");
    if (Store) Store.set("ui.activeStage", stage.liveIndex, { source:"journey" });
  }

  function bind(root) {
    let timer = null;
    let active = 0;
    const play = root.querySelector("#journeyPlay");
    const stop = () => { if (timer) global.clearInterval(timer); timer = null; if (play) play.textContent = "▶ 逐步播放"; };
    const select = index => { active = index; applyStage(index, root); };
    root.querySelectorAll("[data-journey-stage]").forEach((card, index) => {
      card.addEventListener("focusin", () => { stop(); select(index); });
      card.addEventListener("click", event => { if (event.target.closest("a")) return; stop(); select(index); });
    });
    if (play) play.addEventListener("click", () => {
      if (timer) { stop(); return; }
      play.textContent = "■ 停止播放";
      select(active);
      timer = global.setInterval(() => select(active = (active + 1) % stages.length), 1500);
    });
    select(0);
  }

  function wrapAdvancedEvidence(main) {
    const metricGrid = main.querySelector(":scope > .metric-grid");
    if (!metricGrid || metricGrid.closest(".journey-advanced-evidence")) return;
    const details = document.createElement("details");
    details.className = "journey-advanced-evidence";
    details.innerHTML = `<summary>進階：查看 evidence grade / CI / measurement coverage</summary>`;
    metricGrid.parentNode.insertBefore(details, metricGrid);
    details.appendChild(metricGrid);
    const notice = main.querySelector(":scope > .notice");
    if (notice) details.appendChild(notice);
  }

  function enhance(rootId) {
    const root = document.getElementById(rootId);
    const main = root && root.querySelector("main");
    const hero = main && main.querySelector(".hero");
    if (!main || !hero || main.querySelector(".journey-shell")) return;

    hero.classList.add("journey-hero");
    hero.innerHTML = `<div class="eyebrow">DIGITAL POWER FIRMWARE · FIRST PRINCIPLES</div><h1>Measure → Decide → Actuate → Protect → Verify</h1><p class="lead">先用同一台 Buck 把因果鏈走通；數學工具與其他 topology 在需要遷移時再展開。</p><div class="journey-hero-chain"><span>Power</span><i>→</i><span>Sense</span><i>→</i><span>Feedback</span><i>→</i><span>Timing</span><i>→</i><span>Dynamics</span><i>→</i><span>Protect</span><i>→</i><span>Production</span><i>→</i><span>Verify</span></div>`;
    hero.insertAdjacentHTML("afterend", markup(Learning.loadState ? Learning.loadState() : {}));
    bind(root);
    wrapAdvancedEvidence(main);

    const heads = Array.from(main.querySelectorAll(".section-head"));
    const libraryHead = heads.find(head => { const h2 = head.querySelector("h2"); return h2 && h2.textContent.trim() === "完整主題"; });
    if (libraryHead) {
      const h2 = libraryHead.querySelector("h2");
      const p = libraryHead.querySelector("p");
      h2.textContent = "完整內容索引";
      if (p) p.textContent = "這裡是查找入口，不代表建議學習順序。Core Path 先建立一台數位電源的因果鏈。";
      const grid = libraryHead.nextElementSibling;
      if (grid) grid.classList.add("journey-topic-library");
    }
  }

  Learning.renderHome = function renderJourney(rootId) { previousRenderHome(rootId); enhance(rootId); };
  global.CircuitJourneyV1 = { stages, applyStage, enhance };
})(window);
