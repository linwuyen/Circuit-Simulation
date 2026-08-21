(() => {
  "use strict";
  const Models = window.CircuitGuidedLayerModelsV1;
  if (!Models) return;
  const $ = selector => document.querySelector(selector);
  const number = (selector, fallback = 0) => Number($(selector)?.value ?? fallback);

  const layerCoaches = [
    {
      id: "sensing",
      anchor: "#senseRipple",
      why: "ADC 數字不是物理量本身；它只是感測鏈把真實 Vout 投影成 counts 的結果。",
      question: "只把 divider 比例調大，實際 Vout 不變，而且 ADC 還沒飽和：ADC count 會怎麼變？",
      correct: "increase",
      choices: [["increase", "變大"], ["same", "不變"], ["decrease", "變小"]],
      explain: "physical V 不變 → ADC pin voltage ↑ → ADC code ↑。如果韌體 scaling 沒同步，重建出的 Vout 就會錯。",
      measure: "先量：同時看實際 Vout、ADC pin，再對 ADCRESULT/count；不要先改 PI。"
    },
    {
      id: "feedback",
      anchor: "#feedbackInitial",
      why: "控制器只看得到 reference 與『重建後的 feedback』，看不到你心裡認為的真實 Vout。",
      question: "Vout 還來不及變時，只把 reference 調高；在正 Kp/Ki、未飽和的前提下，第一個 control step 的 error 與 duty 傾向？",
      correct: "both-up",
      choices: [["both-up", "error ↑、duty ↑"], ["error-down", "error ↓、duty ↑"], ["same", "都不變"]],
      explain: "r − ŷ ↑ → PI command ↑ → duty ↑。這是第一拍的因果方向，不代表最後穩態一定沒有 saturation 或其他限制。",
      measure: "先量：同步 trace reference、reconstructed feedback、error、duty command；不要一看到 Vout 不對就先調 Kp/Ki。"
    },
    {
      id: "dynamics",
      anchor: "#dynLoad",
      why: "同一組 PI，光是韌體晚一拍生效，就可能把原本夠用的 phase margin 吃掉。",
      question: "probe frequency 不變，只增加 sample-to-actuate pure delay；delay 對 phase 的貢獻會？",
      correct: "more-negative",
      choices: [["more-negative", "更負、lag 更多"], ["same", "不變"], ["less-negative", "更接近 0°"]],
      explain: "φdelay = −360°·f·Td；頻率固定時，Td ↑ → phase lag 線性增加。這還不是 total phase margin。",
      measure: "先量：SOCA → ADC/EOC → ISR/CLA → CMPA shadow write → active load 的實際時間，再談 crossover。"
    },
    {
      id: "safety",
      anchor: "#safeCmp",
      why: "保護的第一任務不是『讓 CPU 知道出錯』，而是『在能量繼續灌入前先把 PWM 否決掉』。",
      question: "同一個 OCP fault 同時能走 hardware trip 與 ADC ISR 軟體路徑；哪一條應負責最快關 PWM？",
      correct: "hardware",
      choices: [["hardware", "CMPSS / Trip hardware"], ["software", "ADC ISR / CPU"], ["either", "兩者等價"]],
      explain: "hardware veto 不必等 ADC、interrupt entry 與 control compute；software path 應負責 state、evidence 與受條件限制的 re-arm。",
      measure: "先量：scope 同時抓 fault/comparator 訊號與 gate/PWM output，直接量 fault-to-PWM-low latency。"
    },
    {
      id: "production",
      anchor: "#prodTimeout",
      why: "RUN 不是一個 bool；輸出權限必須持續由 state、fresh command、valid measurement、no fault 等條件共同成立。",
      question: "enable authority 仍為 1，但外部 command age 已嚴格超過 timeout budget；正確 production 行為是？",
      correct: "fail-closed",
      choices: [["fail-closed", "撤銷輸出 / fault"], ["keep-running", "維持最後 duty"], ["fake-heartbeat", "由 ISR 刷新 heartbeat"]],
      explain: "command freshness 屬於外部 producer ownership；consumer/ADC ISR 不能替 producer 製造『還活著』的證據。",
      measure: "先量：producer publish timestamp、command age、state 與 PWM authority；確認誰真正擁有 freshness。"
    },
    {
      id: "transfer",
      anchor: "#transferVin",
      why: "可遷移的是 feedback grammar，不是把 Buck 的 bandwidth 與補償參數原封不動貼到另一個 plant。",
      question: "Buck loop 在某個 crossover 很穩，換成 Boost CCM 後，可以先照抄同一 crossover 再說嗎？",
      correct: "no",
      choices: [["no", "不行，先看新 plant constraint"], ["yes", "可以，grammar 一樣"], ["gain-only", "只重算 gain 就好"]],
      explain: "Boost CCM 多了 RHP zero；先找 topology-specific constraint，再決定 crossover。『同一控制語法』不等於『同一 plant』。",
      measure: "先量/算：Vin、Vout、load、L 與 operating duty，得到 RHP-zero 尺度後再放 loop bandwidth。"
    }
  ];

  const mentalViews = {
    physical: {
      label: "PHYSICAL",
      title: "能量真的怎麼流",
      flow: ["PWM / switch state", "Switch node", "vL → di/dt", "L / C 儲能", "Load / Vout"],
      note: "先問電流路徑與儲能元件能不能瞬間改變，再談 controller。真板高價值量測：switch node、iL、Vout。"
    },
    signal: {
      label: "SIGNAL",
      title: "物理量怎麼變成韌體數字",
      flow: ["Vout physical", "Divider / AFE", "ADC pin", "Sample / count", "Scaling → ŷ"],
      note: "controller 控制的是重建後的 ŷ，不是你心裡認為的 Vout。先驗 scale / offset / sample point，再調 PI。"
    },
    control: {
      label: "CONTROL",
      title: "負回授每一拍做了什麼",
      flow: ["Reference r", "e = r − ŷ", "C(z) / PI", "Duty command", "Plant response"],
      note: "把 reference、feedback、error、command 分開看。數學正確不代表 measurement、timing 或 actuator authority 正確。"
    },
    time: {
      label: "TIME",
      title: "算完不代表已經作用到 power stage",
      flow: ["SOCA", "ADC ready", "ISR / CLA", "CMPA shadow write", "ZERO load → active PWM"],
      note: "量 end-to-end sample-to-actuate latency；miss shadow-load 就是額外一拍，不要把這個 phase lag 全怪給 PI。"
    },
    authority: {
      label: "AUTHORITY",
      title: "誰真的有資格讓 PWM 導通",
      flow: ["RUN state", "Fresh command", "Valid sensing", "No fault", "PWM grant"],
      note: "software grant 是多個 invariant 的 AND；CMPSS / Trip Zone 仍保有獨立 hardware veto。"
    }
  };

  function currentMode() {
    return document.querySelector('[data-learning-mode].selected')?.dataset.learningMode || "guided";
  }

  function setCoachLock(config, locked) {
    const anchor = $(config.anchor);
    const panel = anchor?.closest("article");
    if (!panel) return;
    panel.querySelectorAll(".input-grid input").forEach(input => {
      input.disabled = Boolean(locked);
    });
  }

  function syncCoachLocks() {
    const guided = currentMode() === "guided";
    layerCoaches.forEach(config => {
      const coach = document.querySelector(`[data-layer-coach="${config.id}"]`);
      setCoachLock(config, guided && coach?.dataset.answered !== "1");
    });
  }

  function installLayerCoach(config) {
    const anchor = $(config.anchor);
    const panel = anchor?.closest("article");
    const inputGrid = panel?.querySelector(".input-grid");
    if (!panel || !inputGrid || panel.querySelector(`[data-layer-coach="${config.id}"]`)) return;

    const coach = document.createElement("div");
    coach.className = "guided-example";
    coach.dataset.layerCoach = config.id;
    coach.dataset.answered = "0";
    coach.innerHTML = `
      <div class="section-kicker">白話先判斷 · WHY FIRMWARE CARES</div>
      <p>${config.why}</p>
      <p><b>${config.question}</b></p>
      <div class="prediction-row" aria-label="${config.id} 方向預測">
        ${config.choices.map(([value, label]) => `<button type="button" data-layer-coach-choice="${value}">${label}</button>`).join("")}
      </div>
      <p class="prediction-status" data-layer-coach-status aria-live="polite">先做方向預測，才解鎖參數；先建立因果，再看數字。</p>
    `;
    inputGrid.before(coach);

    const status = coach.querySelector("[data-layer-coach-status]");
    coach.querySelectorAll("[data-layer-coach-choice]").forEach(button => {
      button.addEventListener("click", () => {
        if (coach.dataset.answered === "1") return;
        const correct = button.dataset.layerCoachChoice === config.correct;
        coach.dataset.answered = "1";
        coach.dataset.firstAttempt = correct ? "pass" : "miss";
        coach.querySelectorAll("[data-layer-coach-choice]").forEach(choice => {
          choice.disabled = true;
          if (choice.dataset.layerCoachChoice === config.correct) choice.dataset.correct = "1";
        });
        button.dataset.selected = "1";
        status.textContent = `${correct ? "✓ 方向正確。" : "✗ 方向先修正。"} ${config.explain} ${config.measure}`;
        setCoachLock(config, false);
      });
    });
  }

  function renderMentalView(key) {
    const config = mentalViews[key] || mentalViews.physical;
    const stage = document.querySelector("[data-mental-view-stage]");
    if (!stage) return;
    stage.dataset.view = key;
    stage.innerHTML = `
      <div class="section-kicker">${config.label} VIEW</div>
      <h3>${config.title}</h3>
      <div class="mental-flow">${config.flow.map((item, index) => `<span>${item}</span>${index < config.flow.length - 1 ? "<i>→</i>" : ""}`).join("")}</div>
      <p>${config.note}</p>
    `;
    document.querySelectorAll("[data-mental-view-button]").forEach(button => {
      button.classList.toggle("selected", button.dataset.mentalViewButton === key);
    });
  }

  function installMentalModelViews() {
    const pipeline = document.querySelector("[data-pipeline]");
    const panel = pipeline?.closest("section");
    if (!panel || panel.querySelector("[data-mental-model-viewer]")) return;

    const viewer = document.createElement("div");
    viewer.className = "mental-model-viewer";
    viewer.dataset.mentalModelViewer = "1";
    viewer.innerHTML = `
      <div class="mental-view-tabs" aria-label="五個固定工程視圖">
        ${Object.entries(mentalViews).map(([key, config], index) => `<button type="button" class="${index === 0 ? "selected" : ""}" data-mental-view-button="${key}">${config.label}</button>`).join("")}
      </div>
      <div class="mental-view-stage" data-mental-view-stage></div>
      <p class="truth-box"><b>固定座標：</b>不管學哪一層，都回到 Physical / Signal / Control / Time / Authority 五個視圖；先定位哪個 contract 壞掉，再改 code。</p>
    `;
    panel.querySelector("h2")?.after(viewer);
    viewer.querySelectorAll("[data-mental-view-button]").forEach(button => {
      button.addEventListener("click", () => renderMentalView(button.dataset.mentalViewButton));
    });
    renderMentalView("physical");

    const role = document.createElement("p");
    role.className = "truth-box capstone-role-note";
    role.innerHTML = '<b>課程角色：</b>Module 19 是唯一 executable capstone；完成正常因果鏈後，再到 <a href="../15_power_capstone/index.html">Module 15 Debug Challenge Bank</a> 做未知故障隔離。';
    panel.append(role);
  }

  function installDynamicsStory() {
    const panel = $("#dynLoad")?.closest("article");
    if (!panel || panel.querySelector("[data-dynamics-story]")) return;
    const story = document.createElement("div");
    story.className = "causal-story";
    story.dataset.dynamicsStory = "1";
    story.innerHTML = `
      <div class="section-kicker">先看現象，再需要 Bode</div>
      <h3>負載突然增加，為什麼 Vout 不可能瞬間被救回來？</h3>
      <div class="causal-story-flow">
        <span>Load current ↑</span><i>→</i><span>C 先補電流、Vout sag</span><i>→</i><span>iL 不能跳變，只能 ramp</span><i>→</i><span>ADC 才看到 sag</span><i>→</i><span>PI 算新 duty</span><i>→</i><span>shadow load 後才生效</span>
      </div>
      <p><b>Bode 的用途：</b>把「不同速度的擾動，plant + delay 跟得上多少」壓縮成 magnitude / phase。先理解這條時間因果，再看 transfer function。</p>
      <p class="muted">真板先量：load-step edge、Vout、iL、SOCA/EOC、ISR/CLA marker、PWM active update。</p>
    `;
    const coach = panel.querySelector('[data-layer-coach="dynamics"]');
    (coach || panel.querySelector(".input-grid"))?.before(story);
  }

  function installProductionAuthority() {
    const panel = $("#prodTimeout")?.closest("article");
    const metricGrid = panel?.querySelector(".metric-grid");
    if (!panel || !metricGrid || panel.querySelector("[data-authority-model]")) return;
    const model = document.createElement("div");
    model.className = "authority-model";
    model.dataset.authorityModel = "1";
    model.innerHTML = `
      <div class="section-kicker">PRODUCTION AUTHORITY · AND, NOT A BOOL</div>
      <p class="authority-equation">PWM_AUTHORITY = RUN ∧ COMMAND_FRESH ∧ SENSING_VALID ∧ NO_FAULT ∧ PERIPHERALS_READY ∧ CALIBRATION_VALID</p>
      <div class="authority-conditions">
        <span data-authority-condition="run">RUN state</span>
        <span data-authority-condition="fresh">command fresh</span>
        <span data-authority-condition="sensing">sensing valid*</span>
        <span data-authority-condition="fault">no fault</span>
        <span data-authority-condition="peripherals">peripherals ready*</span>
        <span data-authority-condition="calibration">calibration valid*</span>
      </div>
      <p><b>Software grant：</b><span data-authority-result>—</span></p>
      <p class="muted">* 此 freshness teaching vector 固定假設 sensing / peripherals / calibration 已驗證；真正 target/board 必須各自有 evidence。Hardware CMPSS / Trip Zone 仍可獨立 veto。</p>
    `;
    metricGrid.after(model);
  }

  function updateAuthorityModel(result) {
    const root = document.querySelector("[data-authority-model]");
    if (!root) return;
    const conditions = {
      run: result.state === "RUN",
      fresh: !result.faulted,
      sensing: true,
      fault: !result.faulted,
      peripherals: true,
      calibration: true
    };
    Object.entries(conditions).forEach(([key, pass]) => {
      const node = root.querySelector(`[data-authority-condition="${key}"]`);
      if (!node) return;
      node.dataset.pass = pass ? "1" : "0";
      node.setAttribute("aria-label", `${node.textContent}: ${pass ? "pass" : "fail"}`);
    });
    const granted = Object.values(conditions).every(Boolean);
    const resultNode = root.querySelector("[data-authority-result]");
    if (resultNode) {
      resultNode.textContent = granted ? "GRANTED — software path may request PWM" : "DENIED — fail closed";
      resultNode.dataset.pass = granted ? "1" : "0";
    }
  }

  function lineSvg(points, xKey, yKey, label) {
    if (!points.length) return "";
    const width = 720, height = 250, left = 58, right = 20, top = 24, bottom = 42;
    const xs = points.map(point => point[xKey]);
    const ys = points.map(point => point[yKey]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
    const pad = Math.max(0.01, (yMaxRaw - yMinRaw) * 0.12);
    const yMin = yMinRaw - pad, yMax = yMaxRaw + pad;
    const x = value => left + ((value - xMin) / Math.max(1e-12, xMax - xMin)) * (width - left - right);
    const y = value => height - bottom - ((value - yMin) / Math.max(1e-12, yMax - yMin)) * (height - top - bottom);
    const path = points.map((point, index) => `${index ? "L" : "M"}${x(point[xKey]).toFixed(2)},${y(point[yKey]).toFixed(2)}`).join(" ");
    return `<line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"></line><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"></line><path class="current-wave" d="${path}"></path><text x="${left}" y="${height-10}">0</text><text x="${width-100}" y="${height-10}">${(xMax*1e3).toFixed(1)} ms</text><text x="8" y="${top+10}">${label}</text>`;
  }

  function renderSensing() {
    const result = Models.sensingSample({
      physicalV: 12,
      rippleVpp: number('#senseRipple', 0.2),
      phaseDeg: number('#sensePhase', 0),
      divider: number('#senseDivider', 0.2)
    });
    $('#sensePhaseOut').textContent = `${number('#sensePhase').toFixed(0)}°`;
    $('#sensePhysical').textContent = `${result.sampledPhysicalV.toFixed(4)} V`;
    $('#senseAdcV').textContent = `${result.adcInputV.toFixed(4)} V`;
    $('#senseCode').textContent = `${result.code}/${result.maxCode}`;
    $('#senseRecon').textContent = `${result.reconstructedV.toFixed(4)} V`;
    $('#senseError').textContent = `${(result.quantizationErrorV*1000).toFixed(2)} mV`;
    $('#senseBoundary').textContent = result.clipped ? 'ADC CLIPPED：此 scale 已失真，不能把 controller 調參當修復。' : 'Scale chain 未飽和；此誤差只包含 sample phase + ADC quantization。';
  }

  function renderFeedback() {
    const result = Models.feedbackResponse({ initialV: number('#feedbackInitial', 8), referenceV: number('#feedbackRef', 12), kp: number('#feedbackKp', 0.3), ki: number('#feedbackKi', 100) });
    $('#feedbackPlot').innerHTML = lineSvg(result.points, 'tS', 'voutV', 'Vout');
    $('#feedbackFinal').textContent = `${result.finalV.toFixed(3)} V`;
    $('#feedbackError').textContent = `${result.errorV.toFixed(3)} V`;
    $('#feedbackDuty').textContent = `${(result.finalDuty*100).toFixed(2)} %`;
    $('#feedbackBoundary').textContent = 'Averaged CCM teaching plant：保留 L/C/load dynamics 與離散 PI cadence；不含 switching ripple、dead-time 與 real sensor delay。';
  }

  function renderDynamics() {
    const result = Models.dynamicsAt({ loadOhm: number('#dynLoad', 6), frequencyHz: number('#dynFc', 10)*1000, delayS: number('#dynDelay', 10)*1e-6 });
    $('#dynRes').textContent = `${result.resonantHz.toFixed(1)} Hz`;
    $('#dynMag').textContent = `${result.magnitudeDb.toFixed(2)} dB`;
    $('#dynPlantPhase').textContent = `${result.plantPhaseDeg.toFixed(1)}°`;
    $('#dynDelayPhase').textContent = `${result.delayPhaseDeg.toFixed(1)}°`;
    $('#dynTotalPhase').textContent = `${result.totalPhaseDeg.toFixed(1)}°`;
    $('#dynBoundary').textContent = '先用 load-step 理解儲能與 sample-to-actuate 因果，再用 Gvd(s)+pure delay 壓縮成 frequency lens；這裡不把 controller phase 或完整 phase margin 混進來。';
  }

  function renderSafety() {
    const result = Models.safetyLatency({ comparatorNs:number('#safeCmp',80), xbarNs:number('#safeXbar',20), tripZoneNs:number('#safeTz',30), gateNs:number('#safeGate',100), adcUs:number('#safeAdc',1.2), isrUs:number('#safeIsr',0.3), computeUs:number('#safeCompute',4) });
    $('#safeHardware').textContent = `${result.hardwareNs.toFixed(0)} ns`;
    $('#safeSoftware').textContent = `${result.softwareUs.toFixed(2)} µs`;
    $('#safeSpeedup').textContent = `${result.speedup.toFixed(1)}×`;
    const hwX = Math.min(650, 70 + result.hardwareUs / Math.max(result.softwareUs, 0.001) * 560);
    $('#safetyPlot').innerHTML = `<line class="axis" x1="60" y1="130" x2="680" y2="130"></line><line class="timing-commit" x1="${hwX}" y1="70" x2="${hwX}" y2="185"></line><line class="timing-load" x1="650" y1="70" x2="650" y2="185"></line><text x="60" y="55">FAULT</text><text x="${Math.min(hwX+8,540)}" y="90">hardware veto ${result.hardwareUs.toFixed(3)} µs</text><text x="470" y="210">ISR path ${result.softwareUs.toFixed(2)} µs</text>`;
    $('#safeBoundary').textContent = '數值是 parameterized latency budget，不是假裝 datasheet/實板測量；BOARD claim 仍必須由 scope capture 替換。';
  }

  function renderProduction() {
    const result = Models.productionFreshness({ timeoutTicks: number('#prodTimeout',500), missedTicks: number('#prodMissed',0), enable: $('#prodEnable').checked });
    $('#prodAge').textContent = `${result.commandAgeTicks} ticks / ${result.commandAgeMs.toFixed(2)} ms`;
    $('#prodFaultAt').textContent = `${result.faultTick} ticks / ${result.faultAfterMs.toFixed(2)} ms`;
    $('#prodState').textContent = result.state;
    $('#prodState').dataset.risk = result.faulted ? '1' : '0';
    $('#prodBoundary').textContent = result.faulted ? 'FAIL-CLOSED：enable authority 存在且 freshness age 已嚴格大於 timeout budget；software PWM grant 必須撤銷。' : '尚未 timeout；PWM 仍需所有 authority invariant 同時成立。disabled authority 會保持 OFF，而不是靠假 heartbeat 維持正常。';
    updateAuthorityModel(result);
  }

  function renderTransfer() {
    try {
      const result = Models.boostTransfer({ vin:number('#transferVin',24), vout:number('#transferVout',48), L:number('#transferL',200)*1e-6, loadOhm:number('#transferLoad',12) });
      $('#transferDuty').textContent = `${(result.duty*100).toFixed(2)} %`;
      $('#transferRhp').textContent = `${(result.rhpZeroHz/1000).toFixed(2)} kHz`;
      $('#transferFcMax').textContent = `${(result.recommendedCrossoverMaxHz/1000).toFixed(2)} kHz`;
      $('#transferBoundary').textContent = 'Boost CCM 出現 Buck 沒有的 RHP zero；同一 feedback grammar 可遷移，但 plant constraint 不能照抄。';
    } catch (error) {
      $('#transferBoundary').textContent = `輸入超出 Boost CCM teaching boundary：${error.message}`;
    }
  }

  layerCoaches.forEach(installLayerCoach);
  installMentalModelViews();
  installDynamicsStory();
  installProductionAuthority();
  document.querySelectorAll('[data-learning-mode]').forEach(button => {
    button.addEventListener('click', () => requestAnimationFrame(syncCoachLocks));
  });
  syncCoachLocks();

  ['#senseRipple','#sensePhase','#senseDivider'].forEach(id => $(id)?.addEventListener('input', renderSensing));
  ['#feedbackInitial','#feedbackRef','#feedbackKp','#feedbackKi'].forEach(id => $(id)?.addEventListener('input', renderFeedback));
  ['#dynLoad','#dynFc','#dynDelay'].forEach(id => $(id)?.addEventListener('input', renderDynamics));
  ['#safeCmp','#safeXbar','#safeGate','#safeTz','#safeAdc','#safeIsr','#safeCompute'].forEach(id => $(id)?.addEventListener('input', renderSafety));
  ['#prodTimeout','#prodMissed','#prodEnable'].forEach(id => $(id)?.addEventListener('input', renderProduction));
  ['#transferVin','#transferVout','#transferL','#transferLoad'].forEach(id => $(id)?.addEventListener('input', renderTransfer));

  renderSensing(); renderFeedback(); renderDynamics(); renderSafety(); renderProduction(); renderTransfer();
})();