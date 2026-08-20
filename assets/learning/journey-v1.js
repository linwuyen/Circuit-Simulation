(function (global) {
  "use strict";

  const Learning = global.CircuitLearning;
  const Evidence = global.CircuitEvidence;
  if (!Learning || !Learning.renderHome || !Learning.curriculum) return;

  const originalRenderHome = Learning.renderHome;
  const curriculum = Learning.curriculum;
  const moduleById = curriculum.moduleById || Object.fromEntries((curriculum.modules || []).map(m => [m.id, m]));

  const stages = [
    {
      id: "energy",
      number: "01",
      tag: "POWER PHYSICS",
      title: "能量：先看 Power Stage",
      question: "開關到底怎麼改變電壓、電流與能量？",
      why: "先從 ON/OFF、電感電流與輸出能量建立直覺，不從公式開始。",
      modules: ["buck"],
      active: ["actuator", "plant", "output"],
      timeline: ["PWM switching", "L / C energy", "Load"],
      system: "先證明能量怎麼流，再談控制。"
    },
    {
      id: "sensing",
      number: "02",
      tag: "SENSING",
      title: "量測：MCU 到底看見什麼",
      question: "真實的 A / V，怎麼一路變成 ADC count？",
      why: "Scale、offset、OPA、ADC 任一段錯，控制器就會對錯誤的世界做出合理反應。",
      modules: ["adc"],
      active: ["output", "sensor", "adc"],
      timeline: ["Physical y", "Sensor / scale", "ADC count"],
      system: "量到什麼，controller 就相信什麼。"
    },
    {
      id: "timing",
      number: "03",
      tag: "REAL-TIME",
      title: "時序：Sample 到 Actuate",
      question: "ADC 何時量？新 duty 又何時真的進入 plant？",
      why: "把 SOC、S/H、EOC、ISR/CLA、control 與 PWM shadow load 放在同一條 deadline。",
      modules: ["power-sync", "loop10us"],
      active: ["adc", "controller", "actuator"],
      timeline: ["PWM SOC", "ADC EOC", "ISR / C(z)", "PWM LOAD"],
      system: "算完不等於生效；錯過 load point 就多一拍。"
    },
    {
      id: "control",
      number: "04",
      tag: "FEEDBACK",
      title: "閉迴路：PI 為什麼能控制",
      question: "Reference 和 feedback 差多少，controller 應該怎麼推？",
      why: "先看 error、輸出與 transient，再把 Kp / Ki 翻成 loop shaping。",
      modules: ["pi"],
      active: ["reference", "controller", "actuator", "plant", "output", "sensor", "adc"],
      timeline: ["r − y", "PI / C(z)", "u", "P(s)", "feedback"],
      system: "控制器不是魔法數字；它只是用 error 產生 command。"
    },
    {
      id: "dynamics",
      number: "05",
      tag: "DYNAMICS",
      title: "動態：Bode、Pole、Delay",
      question: "為什麼看似正確的 PI，到了高頻卻會震？",
      why: "Fourier / Laplace / Z 是同一個 loop 的不同鏡頭，用來看 pole、zero、bandwidth 與 phase。",
      modules: ["control-transforms"],
      active: ["controller", "actuator", "plant", "output", "sensor", "adc"],
      timeline: ["P(s)", "Bode", "C(z)", "delay", "SFRA"],
      system: "模型與實機差異，要能被量成 gain / phase / delay。"
    },
    {
      id: "topology",
      number: "06",
      tag: "TOPOLOGY",
      title: "拓撲：同骨架，不同 Plant",
      question: "Buck、PFC、PSFB、LLC 的『油門』為什麼不一樣？",
      why: "保留相同 feedback grammar，只替換 actuator、P(s)、sensor 與 operating-point boundary。",
      modules: ["power-topology-control", "control-unification"],
      active: ["actuator", "plant", "output", "sensor"],
      timeline: ["Duty / phase / fsw", "Plant personality", "Bandwidth boundary"],
      system: "同一套控制理論，不代表同一組 Kp / Ki。"
    },
    {
      id: "safety",
      number: "07",
      tag: "SAFETY",
      title: "安全：Protection 有否決權",
      question: "Fault 發生後，最短多久能讓能量停止？",
      why: "Protection 不是普通 data flow；hardware trip 必須能直接否決 PWM，state 決定是否允許 re-arm。",
      modules: ["protection"],
      active: ["safety", "actuator", "plant"],
      timeline: ["Fault", "CMPSS / filter", "Trip", "PWM OFF"],
      system: "Safety plane 可以凌駕 control command。"
    },
    {
      id: "system",
      number: "08",
      tag: "INTEGRATION",
      title: "整機：Debug Unknown System",
      question: "Vout 不對時，下一個最有資訊量的 measurement 是什麼？",
      why: "把 sensing、timing、control、state、communication、plant 與 evidence 串成同一台系統。",
      modules: ["power-capstone"],
      active: ["reference", "controller", "actuator", "plant", "output", "sensor", "adc", "safety"],
      timeline: ["Signal", "Timing", "Data", "State", "Control", "Plant", "Evidence"],
      system: "真正能力是遇到陌生系統仍能逐層證偽。"
    }
  ];

  const specializationIds = ["spi", "c2000-dds", "bms", "foc", "afe", "acmc-pro"];
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);

  function existingModules(ids) {
    return ids.map(id => moduleById[id]).filter(Boolean);
  }

  function stageEvidence(stage, state) {
    const items = existingModules(stage.modules).flatMap(module => [
      ...(module.lessons || []),
      ...(module.labs || [])
    ]);
    if (!items.length || !Evidence || typeof Evidence.evidenceLevel !== "function") {
      return { done: 0, total: items.length, percent: 0 };
    }
    const done = items.filter(item => Evidence.evidenceLevel(state, item.id) >= 2).length;
    return {
      done,
      total: items.length,
      percent: Math.round(done * 100 / items.length)
    };
  }

  function stageCard(stage, index, state) {
    const progress = stageEvidence(stage, state);
    const module = existingModules(stage.modules)[0];
    const href = module ? module.entry : "#";
    const progressText = progress.total ? `${progress.done}/${progress.total} practiced` : "open path";
    return `<article class="journey-stage ${index === 0 ? "is-active" : ""}" data-journey-stage="${index}" tabindex="0" aria-label="${esc(stage.title)}">
      <div class="journey-stage-top">
        <span class="journey-stage-num">${stage.number}</span>
        <span class="tag">${esc(stage.tag)}</span>
        <span class="journey-stage-progress">${esc(progressText)}</span>
      </div>
      <h3>${esc(stage.title)}</h3>
      <p class="journey-stage-question">${esc(stage.question)}</p>
      <p class="muted">${esc(stage.why)}</p>
      <div class="journey-progress" aria-hidden="true"><i style="width:${progress.percent}%"></i></div>
      <a class="button journey-enter" href="${esc(href)}">進入這一層 →</a>
    </article>`;
  }

  function systemNode(id, symbol, title, sub) {
    return `<div class="journey-system-node" data-system-node="${id}">
      <span>${esc(symbol)}</span><b>${esc(title)}</b><small>${esc(sub)}</small>
    </div>`;
  }

  function journeyMarkup(state) {
    const specializations = existingModules(specializationIds);
    return `<section class="journey-shell" aria-labelledby="journeyTitle">
      <div class="journey-section-head">
        <div>
          <p class="journey-eyebrow">POWER FIRMWARE JOURNEY · ONE MACHINE, EIGHT LAYERS</p>
          <h2 id="journeyTitle">不是學 19 個主題，而是把同一台數位電源一層一層建起來</h2>
          <p>左邊是學習順序；右邊永遠是同一個系統。切換 Stage 時，只改變現在該看哪一段因果鏈。</p>
        </div>
        <button class="button primary" id="journeyPlay" type="button">▶ 逐步播放</button>
      </div>

      <div class="journey-layout">
        <div class="journey-stage-list">
          ${stages.map((stage, index) => stageCard(stage, index, state)).join("")}
        </div>

        <aside class="journey-system" aria-live="polite">
          <div class="journey-system-sticky">
            <div class="journey-system-head">
              <div>
                <span class="tag blue">STICKY MENTAL MODEL</span>
                <h3 id="journeySystemTitle">01 · 能量：先看 Power Stage</h3>
              </div>
              <span class="journey-live-dot">LIVE</span>
            </div>

            <div class="journey-loop" aria-label="Universal digital power feedback loop">
              ${systemNode("reference", "r", "Reference", "target")}
              <span class="journey-arrow">→</span>
              ${systemNode("controller", "C(z)", "Controller", "error → command")}
              <span class="journey-arrow">→</span>
              ${systemNode("actuator", "u", "Actuator", "PWM / phase / fsw")}
              <span class="journey-arrow">→</span>
              ${systemNode("plant", "P(s)", "Power Stage", "energy + dynamics")}
              <span class="journey-arrow">→</span>
              ${systemNode("output", "y", "Output", "V / I / power")}
            </div>

            <div class="journey-feedback">
              ${systemNode("sensor", "H", "Sensor / Scale", "physical → volts")}
              <span class="journey-arrow">→</span>
              ${systemNode("adc", "ADC", "Sampling", "volts → counts")}
              <span class="journey-feedback-return">↖ feedback to error</span>
            </div>

            <div class="journey-safety" data-system-node="safety">
              <span>SAFETY VETO</span>
              <b>CMPSS / Trip / State → PWM OFF</b>
              <small>Protection is not a normal software block.</small>
            </div>

            <div class="journey-system-explain">
              <span id="journeySystemTag">POWER PHYSICS</span>
              <strong id="journeySystemQuestion">開關到底怎麼改變電壓、電流與能量？</strong>
              <p id="journeySystemMeaning">先證明能量怎麼流，再談控制。</p>
            </div>

            <div class="journey-timeline" id="journeyTimeline">
              ${stages[0].timeline.map(item => `<span>${esc(item)}</span>`).join("<i>→</i>")}
            </div>
          </div>
        </aside>
      </div>

      ${specializations.length ? `<div class="journey-specializations">
        <div>
          <span class="tag">SIDE TRACKS</span>
          <h3>工具與專題，不阻塞 Core Path</h3>
          <p class="muted">在主線有上下文之後，再深入通訊、量測、BMS、FOC、AFE 與整機案例。</p>
        </div>
        <div class="journey-specialization-links">
          ${specializations.map(module => `<a href="${esc(module.entry)}"><b>${esc(module.tag)}</b><span>${esc(module.title)}</span></a>`).join("")}
        </div>
      </div>` : ""}
    </section>`;
  }

  function applyStage(index, root) {
    const stage = stages[index];
    if (!stage) return;

    root.querySelectorAll("[data-journey-stage]").forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === index);
    });

    root.querySelectorAll("[data-system-node]").forEach(node => {
      const id = node.getAttribute("data-system-node");
      node.classList.toggle("is-active", stage.active.includes(id));
      node.classList.toggle("is-dim", !stage.active.includes(id));
    });

    const title = root.querySelector("#journeySystemTitle");
    const tag = root.querySelector("#journeySystemTag");
    const question = root.querySelector("#journeySystemQuestion");
    const meaning = root.querySelector("#journeySystemMeaning");
    const timeline = root.querySelector("#journeyTimeline");
    if (title) title.textContent = `${stage.number} · ${stage.title}`;
    if (tag) tag.textContent = stage.tag;
    if (question) question.textContent = stage.question;
    if (meaning) meaning.textContent = stage.system;
    if (timeline) {
      timeline.innerHTML = stage.timeline.map(item => `<span>${esc(item)}</span>`).join("<i>→</i>");
    }
  }

  function bindJourney(root) {
    let timer = null;
    let activeIndex = 0;
    const play = root.querySelector("#journeyPlay");

    const stop = () => {
      if (timer) global.clearInterval(timer);
      timer = null;
      if (play) play.textContent = "▶ 逐步播放";
    };

    const select = index => {
      activeIndex = index;
      applyStage(index, root);
    };

    root.querySelectorAll("[data-journey-stage]").forEach((card, index) => {
      card.addEventListener("mouseenter", () => { stop(); select(index); });
      card.addEventListener("focusin", () => { stop(); select(index); });
      card.addEventListener("click", event => {
        if (event.target.closest("a")) return;
        stop();
        select(index);
      });
    });

    if (play) {
      play.addEventListener("click", () => {
        if (timer) {
          stop();
          return;
        }
        play.textContent = "■ 停止播放";
        select(activeIndex);
        timer = global.setInterval(() => {
          activeIndex = (activeIndex + 1) % stages.length;
          select(activeIndex);
        }, 1500);
      });
    }

    select(0);
  }

  function enhanceHome(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;

    const main = root.querySelector("main");
    const hero = main && main.querySelector(".hero");
    if (!main || !hero || main.querySelector(".journey-shell")) return;

    hero.classList.add("journey-hero");
    hero.innerHTML = `<div class="eyebrow">DIGITAL POWER FIRMWARE · FIRST PRINCIPLES</div>
      <h1>從能量流，一路走到 C2000 閉迴路與整機 Debug</h1>
      <p class="lead">同一台 power converter，逐層加入 sensing、sampling、control、actuation、protection 與 diagnosis。公式不是入口；每一層都先看現象、做預測，再建立可量測的因果鏈。</p>
      <div class="journey-hero-chain" aria-label="core causal chain">
        <span>Power</span><i>→</i><span>Sense</span><i>→</i><span>Sample</span><i>→</i><span>Control</span><i>→</i><span>Actuate</span><i>→</i><span>Protect</span><i>→</i><span>Debug</span>
      </div>`;

    const state = Learning.loadState ? Learning.loadState() : {};
    hero.insertAdjacentHTML("afterend", journeyMarkup(state));
    bindJourney(root);

    const heads = Array.from(main.querySelectorAll(".section-head"));
    const libraryHead = heads.find(head => {
      const h2 = head.querySelector("h2");
      return h2 && h2.textContent.trim() === "完整主題";
    });
    if (libraryHead) {
      const h2 = libraryHead.querySelector("h2");
      const p = libraryHead.querySelector("p");
      h2.textContent = "完整內容索引";
      if (p) p.textContent = "Core Path 之外的 module 仍完整保留；這裡是查找入口，不再代表建議學習順序。";
      const grid = libraryHead.nextElementSibling;
      if (grid) grid.classList.add("journey-topic-library");
    }

    const notice = main.querySelector(".notice");
    if (notice) {
      notice.insertAdjacentHTML("beforeend", ` <span class="journey-contract">Journey 只改 teaching order；既有 canonical ID、evidence history、oracle 與 URL contract 不變。</span>`);
    }
  }

  Learning.renderHome = function renderJourneyHome(rootId) {
    originalRenderHome(rootId);
    enhanceHome(rootId);
  };

  global.CircuitJourneyV1 = { stages, enhanceHome, applyStage };
})(window);
