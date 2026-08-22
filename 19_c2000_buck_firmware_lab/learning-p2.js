(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const layerTargets = Object.freeze({
    physics: { selector: "#inductanceRange", mode: "guided" },
    sensing: { selector: "#senseRipple", mode: "guided" },
    feedback: { selector: "#feedbackInitial", mode: "guided" },
    timing: { selector: "#computeRange", mode: "guided" },
    dynamics: { selector: "#dynLoad", mode: "guided" },
    safety: { selector: "#safeCmp", mode: "guided" },
    production: { selector: "#prodTimeout", mode: "guided" },
    transfer: { selector: "#transferVin", mode: "sandbox" },
    evidence: { selector: '[data-core-layer-panel="evidence"]', mode: "guided" }
  });

  const coreLayers = Object.freeze([
    { key: "physics", label: "01 物理", status: "問題：開關每一拍如何搬運能量？｜先量：switch node + iL ripple。" },
    { key: "sensing", label: "02 量測", status: "問題：物理量如何變成可信的 ADC count？｜先量：DMM → ADC pin → raw count。" },
    { key: "feedback", label: "03 回授", status: "問題：error 的方向如何改變 duty？｜先量：reference、feedback、error、duty request。" },
    { key: "timing", label: "04 時序", status: "問題：算出的 duty 何時真的生效？｜先量：SOCA → EOC → ISR → shadow → ZERO。" },
    { key: "dynamics", label: "05 動態", status: "問題：儲能與 delay 如何限制閉環？｜先量：load step，再用 frequency lens。" },
    { key: "safety", label: "06 安全", status: "問題：危險發生時哪條 veto 最先贏？｜先量：fault edge → Trip Zone → gate LOW。" },
    { key: "production", label: "07 量產", status: "問題：誰擁有 command freshness 與 re-arm？｜先量：sequence、age、clear token、authority。" },
    { key: "evidence", label: "08 證據", status: "問題：目前證據真正能支持哪一層主張？｜依序：Model → SIL → HIL → Image → Binding → Board。" }
  ]);

  let activateCoreLayer = null;

  const measurementChoices = Object.freeze([
    ["power-path", "Switch node + iL + Vout"],
    ["adc-chain", "DMM + ADC pin + ADCRESULT/count"],
    ["control-trace", "reference + ŷ + error + duty request"],
    ["timing-trace", "SOCA/EOC + ISR/CLA + shadow/active PWM"],
    ["trip-path", "fault/comparator + Trip Zone + gate/PWM"],
    ["command-age", "producer sequence + publish timestamp + command age"]
  ]);

  const debugChallenges = Object.freeze([
    {
      id: "scale-mismatch",
      scenario: "adc-stuck",
      symptom: "DMM 顯示 Vout 正常，但 firmware engineering-unit 固定差一個比例；PI 看起來一直在補償。",
      correct: "adc-chain",
      explain: "先找 physical → AFE → ADC pin → count → scaling 的第一個分歧點。若 measurement truth 錯，調 PI 只是在控制錯誤世界。"
    },
    {
      id: "shadow-miss",
      scenario: "load-step",
      symptom: "duty request 已更新，但 physical PWM 要到下一個 switching cycle 才改；提高 fsw 後問題更常出現。",
      correct: "timing-trace",
      explain: "這是 sample-to-actuate / shadow-load 假設。先量完整 deadline，確認是不是 missed load event，再談 compensator。"
    },
    {
      id: "trip-veto",
      scenario: "ocp",
      symptom: "controller duty request 非零、state trace 也曾進 RUN，但 gate output 仍被壓 LOW。",
      correct: "trip-path",
      explain: "PWM 有獨立 safety veto。先證明 CMPSS/XBAR/Trip Zone/gate path，再查 controller；command 不等於 physical authority。"
    },
    {
      id: "stale-command",
      scenario: "command-timeout",
      symptom: "PWM timing 正常、ADC 也持續更新，但系統在固定 age budget 後進 COMMAND_TIMEOUT。",
      correct: "command-age",
      explain: "freshness 的 owner 是外部 producer。先查 publish sequence/timestamp 與 consumer age，ADC ISR 不能自己刷新 heartbeat。"
    },
    {
      id: "control-sign",
      scenario: "nominal",
      symptom: "ADC scale、timing、state 都已驗證；reference 高於 feedback 時，第一拍 duty request 反而下降。",
      correct: "control-trace",
      explain: "lower layers 已被證偽後，才輪到 error sign / controller polarity。同步 trace r、ŷ、e、u，找第一個方向錯誤。"
    },
    {
      id: "plant-path",
      scenario: "load-step",
      symptom: "active PWM duty 與 timing 都符合預期，但 load step 後 iL 幾乎沒有按預期 ramp，Vout 持續下陷。",
      correct: "power-path",
      explain: "當 command、authority、timing 都成立，才回到 energy path。量 switch node、iL、Vout，確認 power stage 是否真的得到預期 vL。"
    },
    {
      id: "false-pi-fix",
      scenario: "adc-stuck",
      symptom: "把 Kp/Ki 改大後 Vout 暫時看起來比較接近目標，但 raw ADC 與獨立 DMM 仍對不上。",
      correct: "adc-chain",
      explain: "『調 gain 後看起來好一點』不能證明 controller 是 root cause。先關閉 sensing truth，避免用 control gain 掩蓋 scale/offset fault。"
    },
    {
      id: "hardware-latency",
      scenario: "ovp",
      symptom: "software fault flag 有出現，但你不知道危險能量是否在 CPU 知道以前就已經停止。",
      correct: "trip-path",
      explain: "真正 safety KPI 是 fault edge → PWM/gate actually-low latency。scope 同時抓 comparator/fault 與 gate，software flag 只負責 state/evidence。"
    }
  ]);

  function installOwnershipLedger() {
    const panel = $("#prodTimeout")?.closest("article");
    if (!panel || panel.querySelector("[data-ownership-ledger]")) return;
    const ledger = document.createElement("div");
    ledger.className = "trace-wrap";
    ledger.dataset.ownershipLedger = "1";
    ledger.innerHTML = `
      <div class="section-kicker">DATA / STATE OWNERSHIP · ONE WRITER PER TRUTH</div>
      <h3>先問「誰擁有這筆 truth」，再問「哪個 ISR 能改它」</h3>
      <table>
        <thead><tr><th>Owner</th><th>Writes / owns</th><th>Consumer</th><th>Forbidden shortcut</th></tr></thead>
        <tbody>
          <tr><td>Host / comm producer</td><td>complete command + publish timestamp</td><td>control/state</td><td>consumer 不能替 producer 刷 freshness</td></tr>
          <tr><td>ADC / acquisition owner</td><td>sample bundle + validity</td><td>controller / telemetry</td><td>sample ISR 不擁有 command heartbeat</td></tr>
          <tr><td>Controller</td><td>duty / phase / fsw request</td><td>state + actuator</td><td>request 不能繞過 authority / trip</td></tr>
          <tr><td>State machine</td><td>software PWM grant / recovery policy</td><td>actuator</td><td>不能默默清 hardware fault latch</td></tr>
          <tr><td>CMPSS / XBAR / TZ</td><td>hardware veto</td><td>physical PWM + software evidence</td><td>RUN / duty request 不能 override</td></tr>
          <tr><td>ePWM</td><td>shadow → active physical commit</td><td>power stage</td><td>錯過 load event 不能假裝同一拍生效</td></tr>
        </tbody>
      </table>
      <p class="truth-box"><b>Debug rule：</b>看到 stale、錯值或輸出不一致時，先找到 authoritative writer、publication 邊界與 consumer；不要讓兩個 owner 同時「幫忙修正」同一份 truth。</p>
    `;
    const authority = panel.querySelector("[data-authority-model]");
    (authority || panel.querySelector(".metric-grid"))?.after(ledger);
  }

  function installTransferBridge() {
    const panel = $("#transferVin")?.closest("article");
    if (!panel || panel.querySelector("[data-transfer-bridge]")) return;
    const bridge = document.createElement("div");
    bridge.className = "trace-wrap";
    bridge.dataset.transferBridge = "1";
    bridge.innerHTML = `
      <div class="section-kicker">TRANSFER RULE · GRAMMAR STAYS, PLANT CONSTRAINT CHANGES</div>
      <h3>不要背五套 controller；先問哪個 constraint 換了</h3>
      <table>
        <thead><tr><th>Topology</th><th>可以沿用</th><th>必須重查</th></tr></thead>
        <tbody>
          <tr><td>Boost CCM</td><td>r → e → C → command → plant → y</td><td>RHP zero / non-minimum phase</td></tr>
          <tr><td>Boost PFC</td><td>feedback + saturation + timing discipline</td><td>fast current / slow voltage + 2ω energy ripple</td></tr>
          <tr><td>PSFB</td><td>error → actuator → plant</td><td>phase-shift actuator + light-load ZVS margin</td></tr>
          <tr><td>LLC</td><td>closed-loop grammar / sensing truth</td><td>fsw actuator + operating-point-dependent resonant gain</td></tr>
          <tr><td>Inverter</td><td>measurement / control / timing / authority</td><td>LC/LCL resonance + damping + sync hierarchy</td></tr>
        </tbody>
      </table>
      <p><a class="button" href="../17_power_topology_control/index.html#atlas">到 Module 17 做完整 Unseen Transfer →</a></p>
      <p class="muted">Module 19 只示範 Boost RHP-zero constraint；其他 topology 使用 Module 17 已有的 authoritative transfer model，避免複製第二套公式。</p>
    `;
    panel.querySelector("#transferBoundary")?.after(bridge);
  }

  function chooseRandomChallenge(excludeId = null) {
    const forced = new URLSearchParams(window.location.search).get("debug_case");
    if (forced) return debugChallenges.find(item => item.id === forced) || debugChallenges[0];
    const candidates = debugChallenges.filter(item => item.id !== excludeId);
    const bytes = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes[0] = Math.floor(Math.random() * 0xffffffff);
    return candidates[bytes[0] % candidates.length];
  }

  function installDiagnosticChallenge() {
    const panel = $("#hilScenario")?.closest("section");
    const scenarioRow = panel?.querySelector(".scenario-row");
    if (!panel || !scenarioRow || panel.querySelector("[data-diagnostic-challenge]")) return;

    const card = document.createElement("div");
    card.className = "lab-panel";
    card.dataset.diagnosticChallenge = "1";
    scenarioRow.after(card);
    let current = null;

    function render(item) {
      current = item;
      const scenarioButton = panel.querySelector(`[data-scenario="${item.scenario}"]`);
      scenarioButton?.click();
      card.dataset.caseId = item.id;
      card.dataset.answered = "0";
      card.innerHTML = `
        <div class="section-kicker">RANDOM PRACTICE · FAULT → NEXT MEASUREMENT</div>
        <h3>症狀：${item.symptom}</h3>
        <p><b>如果現在只能先量一組訊號，哪一組最能縮小 hypothesis space？</b></p>
        <div class="prediction-row">
          ${measurementChoices.map(([value, label]) => `<button type="button" data-diagnostic-choice="${value}">${label}</button>`).join("")}
        </div>
        <p class="prediction-status" data-diagnostic-status aria-live="polite">先 commit measurement，再看 root-cause 解釋。這是隨機 practice，不寫入 PRE/POST benchmark evidence。</p>
        <button class="button" type="button" data-diagnostic-next>換一個未知故障</button>
      `;
      const status = card.querySelector("[data-diagnostic-status]");
      card.querySelectorAll("[data-diagnostic-choice]").forEach(button => {
        button.addEventListener("click", () => {
          if (card.dataset.answered === "1") return;
          card.dataset.answered = "1";
          const pass = button.dataset.diagnosticChoice === item.correct;
          button.dataset.selected = "1";
          card.querySelectorAll("[data-diagnostic-choice]").forEach(choice => {
            choice.disabled = true;
            if (choice.dataset.diagnosticChoice === item.correct) choice.dataset.correct = "1";
          });
          status.dataset.result = pass ? "pass" : "fail";
          status.textContent = `${pass ? "✓ 最高資訊量方向正確。" : "✗ 先修正 measurement order。"} ${item.explain}`;
        });
      });
      card.querySelector("[data-diagnostic-next]").addEventListener("click", () => render(chooseRandomChallenge(current.id)));
    }

    render(chooseRandomChallenge());
  }

  function installCoreFlow() {
    const root = $("[data-core-flow]");
    if (!root) return;
    const panels = new Map(coreLayers.map(layer => [layer.key, $(`[data-core-layer-panel="${layer.key}"]`)]));
    const buttons = $$('[data-core-step]');
    const status = root.querySelector('[data-core-status]');
    const previous = root.querySelector('[data-core-prev]');
    const next = root.querySelector('[data-core-next]');

    activateCoreLayer = (key, options = {}) => {
      const index = coreLayers.findIndex(layer => layer.key === key);
      if (index < 0 || !panels.get(key)) return;
      if (options.ensureGuided !== false && document.body.dataset.activeLearningMode !== 'guided') {
        $(`[data-learning-mode="guided"]`)?.click();
      }
      document.body.dataset.coreStep = key;
      panels.forEach((panel, panelKey) => {
        panel?.classList.toggle('is-core-active', panelKey === key);
        if (panelKey === key) panel.dataset.coreFocus = key;
        else panel?.removeAttribute('data-core-focus');
      });
      $$('[data-core-support]').forEach(panel => panel.classList.toggle('is-core-active', panel.dataset.coreSupport === key));
      buttons.forEach(button => {
        const selected = button.dataset.coreStep === key;
        button.classList.toggle('selected', selected);
        if (selected) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      status.textContent = coreLayers[index].status;
      previous.disabled = index === 0;
      next.disabled = index === coreLayers.length - 1;
      previous.textContent = index === 0 ? '← 已在起點' : `← ${coreLayers[index - 1].label}`;
      next.textContent = index === coreLayers.length - 1 ? '八層主線完成' : `${coreLayers[index + 1].label} →`;

      if (options.updateUrl !== false) {
        const url = new URL(window.location.href);
        url.searchParams.set('layer', key);
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
      if (options.scroll !== false) {
        const panel = panels.get(key);
        window.requestAnimationFrame(() => {
          panel.scrollIntoView({ behavior: options.instant ? 'auto' : 'smooth', block: 'start' });
          panel.setAttribute('tabindex', '-1');
          panel.focus({ preventScroll: true });
        });
      }
    };

    buttons.forEach(button => button.addEventListener('click', () => activateCoreLayer(button.dataset.coreStep)));
    previous.addEventListener('click', () => {
      const index = coreLayers.findIndex(layer => layer.key === document.body.dataset.coreStep);
      if (index > 0) activateCoreLayer(coreLayers[index - 1].key);
    });
    next.addEventListener('click', () => {
      const index = coreLayers.findIndex(layer => layer.key === document.body.dataset.coreStep);
      if (index >= 0 && index < coreLayers.length - 1) activateCoreLayer(coreLayers[index + 1].key);
    });

    const requested = new URLSearchParams(window.location.search).get('layer');
    activateCoreLayer(coreLayers.some(layer => layer.key === requested) ? requested : 'physics', { scroll: false, updateUrl: false });
  }

  function focusRequestedLayer() {
    const key = new URLSearchParams(window.location.search).get("layer");
    const target = layerTargets[key];
    if (!target) return;
    if (coreLayers.some(layer => layer.key === key) && activateCoreLayer) {
      activateCoreLayer(key, { instant: true, updateUrl: false });
      return;
    }
    const mode = $(`[data-learning-mode="${target.mode}"]`);
    mode?.click();
    const element = $(target.selector);
    const panel = element?.closest("article, section");
    if (!panel) return;
    panel.dataset.coreFocus = key;
    window.requestAnimationFrame(() => panel.scrollIntoView({ block: "start" }));
  }

  installOwnershipLedger();
  installTransferBridge();
  installDiagnosticChallenge();
  installCoreFlow();
  focusRequestedLayer();
})();
