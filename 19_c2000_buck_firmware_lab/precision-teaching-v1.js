(() => {
  "use strict";
  const Flow = window.CircuitCoreFlowV1;
  const Models = window.CircuitGuidedLayerModelsV1;
  if (!Flow || !Models) return;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const number = (selector, fallback = 0) => Number($(selector)?.value ?? fallback);

  const blueprints = {
    physics: {
      summary: "先看電感兩端電壓，再看電流斜率；controller 還沒出場。",
      chain: ["PWM / switch state", "vL", "di/dt = vL/L", "iL ripple", "C / load"],
      firmware: "ePWM/AQ 只決定開關狀態；這一層先證明 power-stage physics，不用 PI 解釋 switching ripple。",
      measure: "Scope 同時抓 switch node 與 iL；先核對 period、Ton/Toff、斜率與 ΔIL。",
      boundary: "目前是 ideal CCM：不含 DCR、MOSFET/diode drop、dead-time、ESR、DCM。"
    },
    sensing: {
      summary: "Controller 控制的是重建後的 feedback，不是你心裡認為的真實 Vout。",
      chain: ["Physical V/I", "Divider / AFE", "ADC pin", "Sample + count", "Scaling → engineering unit"],
      firmware: "先確認 SOC channel、acquisition window、raw count、scale/offset ownership，再看控制器。",
      measure: "DMM/Scope 的實際 Vout → ADC pin → ADCRESULT raw count → reconstructed value 四點同時對。",
      boundary: "量測鏈若 clipped、sample 在 ringing、scale/offset 錯，調 PI 只會把錯誤藏起來。"
    },
    feedback: {
      summary: "真實 Buck controller 是兩層：Voltage PI 先決定 Iref，Current PI 才決定 duty。",
      chain: ["Vref − Vout", "Voltage PI", "Iref", "Iref − iL", "Current PI + feed-forward", "Duty"],
      firmware: "對應 buck_control.c：voltage_error → current_reference → current_error → duty。",
      measure: "Trace Vref、Vout、voltage_error、Iref、iL、current_error、duty；不要把中間狀態省略。",
      boundary: "本頁是 averaged CCM + fixed reference；soft-start、ADC quantization、PWM delay 在後續層處理。"
    },
    timing: {
      summary: "CPU 算完只是『command ready』；等 shadow-load commit 後，plant 才真的看到新 duty。",
      chain: ["ePWM SOCA", "ADC ready", "ISR / CLA", "CMPA shadow write", "ZERO/PERIOD load", "Active PWM"],
      firmware: "deadline 判斷必須用 worst-case sample→actuate path，不是只量 ISR average execution time。",
      measure: "用 GPIO marker / scope 抓 SOCA、EOC、ISR entry/exit、shadow write marker、active PWM edge。",
      boundary: "本頁 phase 是 pure delay contribution；不能直接當 total loop phase margin。"
    },
    dynamics: {
      summary: "負載一跳，先由 C 扛；iL 不能瞬間跳，控制器又有 sample/compute/commit delay。",
      chain: ["Load ↑", "C 先補 deficit", "Vout sag", "iL ramp", "ADC 看見", "controller / PWM", "plant recover"],
      firmware: "先把 energy-storage dynamics 和 digital delay 分開，再用 Bode/SFRA 壓縮整條 response。",
      measure: "Load-step edge、Vout、iL，加上 sample-to-actuate timing；再與 model/SFRA 對照。",
      boundary: "目前 Gvd(s)+pure delay 不含 controller phase；SUM 也不是完整 phase margin。"
    },
    safety: {
      summary: "Catastrophic fault 的第一任務是停止能量，不是先讓 CPU 知道。",
      chain: ["Fault", "CMPSS", "XBAR / DCAEVT1", "Trip Zone", "PWM LOW", "software state/evidence"],
      firmware: "Hardware veto 與 software protection 是兩條不同 latency path；軟體負責 latch、logging、qualified re-arm。",
      measure: "Scope 同抓 comparator/fault edge 與 gate/PWM output，直接量 fault-to-PWM-low。",
      boundary: "頁面 ns/µs 是 parameterized budget，不是假裝 datasheet 或真板量測。"
    },
    production: {
      summary: "RUN 不是 enable bit；PWM 權限是多個 invariant 的 AND，而且 hardware trip 還能獨立否決。",
      chain: ["RUN", "command fresh", "sensing valid", "no fault", "peripherals/calibration valid", "PWM grant"],
      firmware: "Freshness 由 producer publication 擁有；consumer/ADC ISR 不得替 producer 製造 heartbeat。",
      measure: "記錄 sequence、publish timestamp、command age、state、fault latch、PWM authority。",
      boundary: "通信 framing/CRC 與 board calibration 必須由真正 owner 提供；此頁只教 authority contract。"
    },
    evidence: {
      summary: "每一個 PASS 只能支持它實際量到或編譯到的那一層，不能越級宣稱。",
      chain: ["Model", "Host SIL", "HIL", "TI linked image", "Board binding", "Physical captures", "BOARD_PASS"],
      firmware: "Compile/link 只能證明 target image contract；pinmux、polarity、scale、trip path 仍需 board binding。",
      measure: "用 scope/SFRA/flash session 與 provenance 把實板 claim 一項一項關閉。",
      boundary: "CI 永遠不能憑空製造 probe、schematic truth、scope capture 或 BOARD_PASS。"
    }
  };

  const remediation = {
    physics: {
      question: "修正題：Vin/Vout/L 都固定，只把 fsw 從 100 kHz 加倍到 200 kHz，理想 CCM 的 ΔIL 會？",
      correct: "half",
      choices: [["half", "約變成一半"], ["same", "不變"], ["double", "約變兩倍"]],
      explain: "一個 switching period 變成一半；同樣 di/dt 作用時間減半，所以 ΔIL 約減半。"
    },
    sensing: {
      question: "修正題：真實 Vout=12 V、ADC pin=2.4 V，但韌體誤把 divider 從 0.20 寫成 0.25。重建的 Vout 會？",
      correct: "low",
      choices: [["low", "偏低，約 9.6 V"], ["right", "仍是 12 V"], ["high", "偏高，約 15 V"]],
      explain: "reconstructed = ADC pin / divider；2.4/0.25=9.6 V。硬體沒變，軟體 scaling 錯就已足以讓 feedback 錯。"
    },
    feedback: {
      question: "修正題：在這個 cascaded controller 裡，Voltage PI 和 Current PI 中間傳遞的是什麼？",
      correct: "iref",
      choices: [["iref", "Current reference Iref"], ["duty", "Duty"], ["vout", "Vout"]],
      explain: "外電壓環把 voltage error 轉成 Iref；內電流環再把 Iref−iL 轉成 duty correction。"
    },
    timing: {
      question: "修正題：CMPA shadow load 只在 ZERO，ZERO 在 10 µs、20 µs；shadow write 在 10.1 µs 完成，新 duty 何時最早 active？",
      correct: "20",
      choices: [["10", "10 µs"], ["20", "20 µs"], ["10.1", "10.1 µs"]],
      explain: "10 µs load event 已經錯過；shadow value 只能等下一個 20 µs ZERO commit。"
    },
    dynamics: {
      question: "修正題：probe frequency 固定，pure delay 從 5 µs 加倍到 10 µs，delay phase lag 的大小會？",
      correct: "double",
      choices: [["double", "約加倍"], ["same", "不變"], ["half", "約減半"]],
      explain: "φdelay = −360°·f·Td；f 固定時，delay 與 phase lag 線性成正比。"
    },
    safety: {
      question: "修正題：CPU 暫時卡住，但 CMPSS→Trip Zone 是 asynchronous hardware path；catastrophic OCP 發生時應該？",
      correct: "trip",
      choices: [["trip", "仍直接把 PWM 拉 LOW"], ["wait", "等 CPU 恢復再關"], ["ignore", "維持最後 duty"]],
      explain: "真正 hardware veto 不應依賴 CPU critical path；這正是把 catastrophic protection 放進 Trip Zone 的理由。"
    },
    production: {
      question: "修正題：外部 producer 已停止更新 command，但 ADC ISR 仍正常跑。誰可以合法刷新 command freshness？",
      correct: "producer",
      choices: [["producer", "只有真正 producer publication"], ["isr", "ADC ISR 自己刷新"], ["either", "兩者都可以"]],
      explain: "consumer 不能替 producer 製造『還活著』的證據；否則斷線也可能永遠不 timeout。"
    },
    evidence: {
      question: "修正題：TI compile/link 與 .out/.map/.hex 全 PASS，最強可以宣稱什麼？",
      correct: "image",
      choices: [["image", "linked target image contract PASS"], ["board", "實板 BOARD_PASS"], ["cal", "實板 calibration 已驗證"]],
      explain: "Target image 只證明 source/compiler/link/image；board pinmux、polarity、scale 與 physical capture 還沒被量到。"
    }
  };

  function chainMarkup(items) {
    return `<div class="precision-chain">${items.map((item, index) => `<span>${item}</span>${index < items.length - 1 ? "<i>→</i>" : ""}`).join("")}</div>`;
  }

  function installPrecisionCards() {
    Object.entries(blueprints).forEach(([key, info]) => {
      const panel = document.querySelector(`[data-core-layer-panel="${key}"]`);
      if (!panel || panel.querySelector('[data-precision-card]')) return;
      const card = document.createElement('section');
      card.className = 'precision-card';
      card.dataset.precisionCard = key;
      card.innerHTML = `
        <div class="section-kicker">FIRST-PRINCIPLES MAP · 先知道這層在證明什麼</div>
        <p class="precision-summary"><b>${info.summary}</b></p>
        ${chainMarkup(info.chain)}
        <div class="precision-grid">
          <article><small>Firmware cares</small><p>${info.firmware}</p></article>
          <article><small>真板先量</small><p>${info.measure}</p></article>
          <article><small>不能越界</small><p>${info.boundary}</p></article>
          <article><small>Debug rule</small><p>先證明這一層的 observable / invariant，再往下一層；不要跨層猜 root cause。</p></article>
        </div>`;
      const heading = panel.querySelector('h2');
      heading?.after(card);
    });
  }

  function feedbackSvg(points) {
    if (!points.length) return '';
    const width = 720, height = 250, left = 58, right = 20, top = 24, bottom = 42;
    const xs = points.map(point => point.tS);
    const ys = points.map(point => point.voutV);
    const xMax = Math.max(...xs);
    const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
    const pad = Math.max(0.05, (yMaxRaw - yMinRaw) * 0.12);
    const yMin = yMinRaw - pad, yMax = yMaxRaw + pad;
    const x = value => left + (value / Math.max(1e-12, xMax)) * (width - left - right);
    const y = value => height - bottom - ((value - yMin) / Math.max(1e-12, yMax - yMin)) * (height - top - bottom);
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.tS).toFixed(2)},${y(point.voutV).toFixed(2)}`).join(' ');
    return `<line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"></line><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"></line><path class="current-wave" d="${path}"></path><text x="8" y="${top+10}">Vout</text><text x="${width-110}" y="${height-10}">${(xMax*1e3).toFixed(1)} ms</text>`;
  }

  function installFeedbackArchitecture() {
    const panel = document.querySelector('[data-core-layer-panel="feedback"]');
    if (!panel || panel.dataset.precisionFeedback === '1') return;
    panel.dataset.precisionFeedback = '1';
    const heading = panel.querySelector('h2');
    if (heading) heading.textContent = 'Voltage loop 先產生 Iref，Current loop 才產生 duty';

    const coach = panel.querySelector('[data-layer-coach="feedback"]');
    let syncInnerLock = () => {};
    if (coach) {
      const paragraphs = coach.querySelectorAll('p');
      if (paragraphs[0]) paragraphs[0].textContent = '負回授不是「V error 直接變 duty」：在這份 target controller 中，外電壓環先決定允許多少電流，內電流環再決定 duty。';
      if (paragraphs[1]) paragraphs[1].innerHTML = '<b>Vout 還來不及變時，只把 Vref 調高；第一拍 voltage error、Iref 與 duty 的合理方向？</b>';
      const correctButton = coach.querySelector('[data-layer-coach-choice="both-up"]');
      if (correctButton) correctButton.textContent = 'error ↑、Iref ↑、duty 傾向 ↑';
      coach.querySelectorAll('[data-layer-coach-choice]').forEach(button => button.addEventListener('click', () => {
        requestAnimationFrame(() => {
          syncInnerLock();
          const status = coach.querySelector('[data-layer-coach-status]');
          if (!status) return;
          const correct = button.dataset.layerCoachChoice === 'both-up';
          status.dataset.result = correct ? 'pass' : 'fail';
          status.textContent = correct
            ? '✓ 方向正確。r − ŷ 形成 V error；V error ↑ → Voltage PI 使 Iref ↑ → current error 傾向 ↑ → Current PI 讓 duty correction ↑。這條資料路徑與 buck_control.c 對齊。真板先 trace Vref / Vout / Iref / iL / duty。'
            : '✗ 先修正資料路徑：r − ŷ 先進 Voltage PI，而外電壓環的輸出是 Iref，不是 duty；duty 是內電流環的輸出。先 trace Vref / Vout / Iref / iL / duty，再談 gain。';
        });
      }));
    }

    const inputGrid = panel.querySelector('.input-grid');
    if (inputGrid && !$('#feedbackCurrentKp')) {
      const kpLabel = $('#feedbackKp')?.closest('label');
      const kiLabel = $('#feedbackKi')?.closest('label');
      if (kpLabel) kpLabel.childNodes[0].textContent = 'Voltage Kp ';
      if (kiLabel) kiLabel.childNodes[0].textContent = 'Voltage Ki ';
      inputGrid.insertAdjacentHTML('beforeend', '<label>Current Kp<input id="feedbackCurrentKp" type="number" step="0.005" value="0.02"></label><label>Current Ki<input id="feedbackCurrentKi" type="number" step="50" value="500"></label>');
    }

    syncInnerLock = () => {
      const guided = document.body.dataset.activeLearningMode === 'guided';
      const answered = coach?.dataset.answered === '1';
      ['#feedbackCurrentKp', '#feedbackCurrentKi'].forEach(selector => {
        const input = $(selector);
        if (input) input.disabled = Boolean(guided && !answered);
      });
    };
    document.addEventListener('buck:mode-change', syncInnerLock);
    syncInnerLock();

    const architecture = document.createElement('div');
    architecture.className = 'feedback-architecture';
    architecture.innerHTML = `
      <h3>和 target code 用同一條 controller architecture</h3>
      <div class="feedback-loop-chain"><span>Vref − Vout</span><i>→</i><span>Voltage PI</span><i>→</i><span>Iref</span><i>→</i><span>Iref − iL</span><i>→</i><span>Current PI + Vref/Vin</span><i>→</i><span>Duty</span></div>
      <p class="feedback-code-map">buck_control.c: voltage_error → voltage_u → current_reference → current_error → current_u → duty_unsat → duty</p>
      <p class="precision-legend">這一層故意不加入 soft-start、ADC quantization 與 PWM commit delay；它們分別在 Production / Sensing / Timing 層處理。</p>`;
    const precisionCard = panel.querySelector('[data-precision-card="feedback"]');
    (precisionCard || heading)?.after(architecture);

    const metrics = panel.querySelector('.metric-grid');
    if (metrics && !$('#feedbackIRef')) {
      metrics.insertAdjacentHTML('beforeend', '<div><span>IREF</span><b id="feedbackIRef"></b></div><div><span>iL</span><b id="feedbackIL"></b></div>');
    }

    const render = () => {
      const result = Models.feedbackResponse({
        initialV: number('#feedbackInitial', 8),
        referenceV: number('#feedbackRef', 12),
        kp: number('#feedbackKp', 0.3),
        ki: number('#feedbackKi', 100),
        currentKp: number('#feedbackCurrentKp', 0.02),
        currentKi: number('#feedbackCurrentKi', 500)
      });
      $('#feedbackPlot').innerHTML = feedbackSvg(result.points);
      $('#feedbackFinal').textContent = `${result.finalV.toFixed(3)} V`;
      $('#feedbackError').textContent = `${result.errorV.toFixed(3)} V`;
      $('#feedbackDuty').textContent = `${(result.finalDuty*100).toFixed(2)} %`;
      $('#feedbackIRef').textContent = `${result.finalCurrentReference.toFixed(3)} A`;
      $('#feedbackIL').textContent = `${result.finalIL.toFixed(3)} A`;
      $('#feedbackBoundary').textContent = 'Averaged CCM teaching plant；controller topology 與 buck_control.c 對齊：Voltage PI → Iref → Current PI + Vref/Vin feed-forward → duty。此層刻意不含 switching ripple、ADC quantization、soft-start、dead-time 與 sample-to-actuate delay。';
    };

    ['#feedbackInitial','#feedbackRef','#feedbackKp','#feedbackKi','#feedbackCurrentKp','#feedbackCurrentKi'].forEach(selector => {
      $(selector)?.addEventListener('input', () => {
        Flow.recordInteraction('feedback');
        render();
      });
    });
    render();
  }

  function findRemediationAnchor(layer, panel) {
    if (layer === 'physics') return panel.querySelector('[data-physics-predict-status]');
    if (layer === 'timing') return panel.querySelector('[data-timing-predict-status]');
    if (layer === 'evidence') return panel.querySelector('[data-evidence-predict-status]');
    return panel.querySelector(`[data-layer-coach="${layer}"] [data-layer-coach-status]`);
  }

  function installRemediation(layer) {
    const state = Flow.snapshot();
    const prediction = state.predictions[layer];
    if (!prediction || prediction.correct || state.remediations?.[layer]) return;
    const panel = document.querySelector(`[data-core-layer-panel="${layer}"]`);
    const config = remediation[layer];
    if (!panel || !config || panel.querySelector(`[data-remediation="${layer}"]`)) return;

    const box = document.createElement('section');
    box.className = 'precision-remediation';
    box.dataset.remediation = layer;
    box.innerHTML = `
      <div class="section-kicker">修正理解 · FIRST ATTEMPT 保留，不直接放行</div>
      <h3>${config.question}</h3>
      <div class="prediction-row">${config.choices.map(([value, label]) => `<button type="button" data-remediation-choice="${value}">${label}</button>`).join('')}</div>
      <p class="precision-remediation-status" data-remediation-status>答對這個不同情境後，才視為概念已修正；原本第一次答錯的紀錄仍保留。</p>`;
    const anchor = findRemediationAnchor(layer, panel);
    (anchor || panel.lastElementChild)?.after(box);

    box.querySelectorAll('[data-remediation-choice]').forEach(button => button.addEventListener('click', () => {
      const pass = button.dataset.remediationChoice === config.correct;
      const status = box.querySelector('[data-remediation-status]');
      box.querySelectorAll('[data-remediation-choice]').forEach(item => {
        item.dataset.selected = item === button ? '1' : '0';
        if (item.dataset.remediationChoice === config.correct) item.dataset.correct = '1';
      });
      status.dataset.result = pass ? 'pass' : 'fail';
      status.textContent = `${pass ? '✓ 修正通過。' : '✗ 還沒通過。'} ${config.explain}`;
      if (!pass) return;
      box.dataset.pass = '1';
      box.querySelectorAll('button').forEach(item => { item.disabled = true; });
      Flow.recordRemediation(layer, true);
    }));
  }

  function syncRemediations() {
    Flow.layerKeys.forEach(installRemediation);
  }

  function bindEvidenceInteraction() {
    $$('[data-evidence-predict]').forEach(button => button.addEventListener('click', () => Flow.recordInteraction('evidence')));
  }

  installPrecisionCards();
  installFeedbackArchitecture();
  bindEvidenceInteraction();
  syncRemediations();
  window.addEventListener('circuit:core-flow-change', () => requestAnimationFrame(syncRemediations));
})();