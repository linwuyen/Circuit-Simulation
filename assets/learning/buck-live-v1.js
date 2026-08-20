(function (global) {
  "use strict";

  const Learning = global.CircuitLearning;
  if (!Learning || typeof Learning.renderHome !== "function") return;

  const previousRenderHome = Learning.renderHome;
  const MODEL = Object.freeze({
    vin: 48,
    inductance: 200e-6,
    fsw: 100000,
    rload: 6,
    visualPeriodMs: 1200
  });

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const format = (value, digits) => Number(value).toFixed(digits == null ? 1 : digits);

  function buckState(dutyPercent) {
    const duty = clamp(Number(dutyPercent) / 100, 0.1, 0.9);
    const period = 1 / MODEL.fsw;
    const vout = MODEL.vin * duty;
    const iavg = vout / MODEL.rload;
    const deltaI = ((MODEL.vin - vout) / MODEL.inductance) * duty * period;
    const imin = Math.max(0, iavg - deltaI / 2);
    const imax = iavg + deltaI / 2;
    return { duty, dutyPercent: duty * 100, period, vout, iavg, deltaI, imin, imax };
  }

  function pwmPath(duty) {
    const width = 400;
    const cycles = 4;
    const period = width / cycles;
    const highY = 18;
    const lowY = 60;
    const on = period * duty;
    let d = `M 0 ${lowY}`;
    for (let i = 0; i < cycles; i += 1) {
      const x0 = i * period;
      d += ` L ${x0} ${highY} L ${x0 + on} ${highY} L ${x0 + on} ${lowY} L ${x0 + period} ${lowY}`;
    }
    return d;
  }

  function currentPath(state) {
    const width = 400;
    const cycles = 4;
    const period = width / cycles;
    const on = period * state.duty;
    const top = 16;
    const bottom = 70;
    let d = `M 0 ${bottom}`;
    for (let i = 0; i < cycles; i += 1) {
      const x0 = i * period;
      d += ` L ${x0 + on} ${top} L ${x0 + period} ${bottom}`;
    }
    return d;
  }

  function markup() {
    return `<section class="buck-live" data-buck-live aria-labelledby="buckLiveTitle">
      <div class="buck-live-head">
        <div>
          <span class="buck-live-kicker">STAGE 1 · SAME MACHINE · POWER PHYSICS</span>
          <h4 id="buckLiveTitle">Buck Live System</h4>
          <p>只動 Duty，觀察同一件事如何同時出現在 PWM、能量流、電感電流與輸出平均值。</p>
        </div>
        <button class="buck-live-reset" type="button" data-buck-reset>Reset 50%</button>
      </div>

      <div class="buck-live-predict" aria-label="prediction before interaction">
        <strong>先猜：</strong><span>Duty 增加，Vout 會？</span>
        <button type="button" data-buck-predict="up">上升</button>
        <button type="button" data-buck-predict="down">下降</button>
        <button type="button" data-buck-predict="same">不變</button>
        <small data-buck-predict-status>先鎖一個方向，再把 Duty 往右拉高。</small>
      </div>

      <label class="buck-live-control">
        <span><b>Duty</b><output data-buck-duty>50%</output></span>
        <input data-buck-slider type="range" min="10" max="90" step="1" value="50" aria-label="Buck duty cycle">
        <small>Vin 固定 48 V · fsw 100 kHz · L 200 µH · Rload 6 Ω</small>
      </label>

      <div class="buck-live-metrics" aria-live="polite">
        <div><span>Ideal Vout</span><strong data-buck-vout>24.0 V</strong></div>
        <div><span>Iout avg</span><strong data-buck-iavg>4.00 A</strong></div>
        <div><span>ΔIL p-p</span><strong data-buck-ripple>0.60 A</strong></div>
        <div><span>Visual state</span><strong data-buck-state>ON</strong></div>
      </div>

      <div class="buck-live-schematic-wrap">
        <svg class="buck-live-schematic" viewBox="0 0 560 210" role="img" aria-label="Buck converter energy flow schematic">
          <defs>
            <marker id="buckArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" class="buck-arrow-head"/></marker>
          </defs>
          <text x="18" y="58" class="buck-label">48 V</text>
          <text x="18" y="78" class="buck-small">Vin</text>
          <path d="M55 70 H115" class="buck-wire buck-main-flow" marker-end="url(#buckArrow)"/>
          <rect x="118" y="45" width="72" height="50" rx="10" class="buck-switch-box"/>
          <text x="137" y="66" class="buck-label">SW</text>
          <text x="130" y="84" class="buck-small" data-buck-switch-label>ON</text>
          <path d="M190 70 H245" class="buck-wire buck-main-flow" marker-end="url(#buckArrow)"/>
          <path d="M250 70 q12 -30 24 0 q12 -30 24 0 q12 -30 24 0" class="buck-wire buck-inductor"/>
          <text x="276" y="35" class="buck-label">L</text>
          <path d="M322 70 H430" class="buck-wire buck-output-flow" marker-end="url(#buckArrow)"/>
          <circle cx="430" cy="70" r="4" class="buck-node"/>
          <text x="448" y="60" class="buck-label">Vout</text>
          <text x="448" y="80" class="buck-small" data-buck-vout-svg>24.0 V</text>
          <path d="M390 70 V120" class="buck-wire"/>
          <path d="M374 120 H406 M374 132 H406" class="buck-wire"/>
          <text x="414" y="132" class="buck-small">C</text>
          <path d="M430 70 V152 H55" class="buck-wire buck-return"/>
          <path d="M55 152 V70" class="buck-wire buck-return"/>
          <path d="M205 70 V152" class="buck-wire buck-freewheel" marker-end="url(#buckArrow)"/>
          <path d="M193 118 H217 L205 138 Z" class="buck-diode"/>
          <path d="M193 142 H217" class="buck-wire buck-freewheel"/>
          <text x="224" y="132" class="buck-small">freewheel</text>
          <rect x="454" y="100" width="54" height="52" rx="8" class="buck-load"/>
          <text x="472" y="121" class="buck-label">R</text>
          <text x="464" y="140" class="buck-small">6 Ω</text>
          <path d="M430 102 H454" class="buck-wire"/>
          <path d="M508 126 H530 V152 H430" class="buck-wire"/>
        </svg>
        <div class="buck-live-energy-copy">
          <span data-buck-energy-tag>ON interval</span>
          <strong data-buck-energy-title>電感充能，iL 上升</strong>
          <p data-buck-energy-body>Switch ON：VL = Vin − Vout 為正，所以 di/dt &gt; 0；Vin 同時供應負載並增加電感儲能。</p>
          <code data-buck-energy-equation>VL = +24.0 V</code>
          <small>動畫為慢放示意；實際 teaching model 的 switching frequency 仍是 100 kHz。</small>
        </div>
      </div>

      <div class="buck-live-wave-grid">
        <article>
          <div class="buck-wave-head"><b>PWM</b><span data-buck-ton>Ton = 5.0 µs</span></div>
          <svg viewBox="0 0 400 78" role="img" aria-label="PWM duty waveform"><path data-buck-pwm d="" class="buck-wave buck-wave-pwm"/></svg>
        </article>
        <article>
          <div class="buck-wave-head"><b>Inductor current</b><span data-buck-current-range>3.70 → 4.30 A</span></div>
          <svg viewBox="0 0 400 86" role="img" aria-label="Inductor current triangle waveform"><path data-buck-current d="" class="buck-wave buck-wave-current"/></svg>
        </article>
      </div>

      <div class="buck-live-first-principles">
        <span>FIRST-PRINCIPLES CHAIN</span>
        <div><b>Duty ↑</b><i>→</i><b>ON time ↑</b><i>→</i><b>平均 switch-node voltage ↑</b><i>→</i><b>Vout ↑</b></div>
        <p data-buck-change>目前：D = 50% → Vout ≈ 24.0 V。</p>
      </div>

      <div class="buck-live-formula">
        <div><span>現象</span><strong>電感電流不能瞬間跳變，所以 ON/OFF 形成三角波。</strong></div>
        <div><span>穩態條件</span><strong>一個週期的平均電感電壓 = 0。</strong></div>
        <div><span>結果</span><code>Vout ≈ D · Vin</code></div>
      </div>
      <p class="buck-live-boundary"><b>模型邊界：</b>ideal switch、CCM、steady state。DCM、dead-time、MOSFET/diode drop、DCR/ESR 與 control dynamics 要在後續 Stage 再逐層加回來。</p>
    </section>`;
  }

  function mount(root) {
    if (!root || root.querySelector("[data-buck-live]")) return;
    const anchor = root.querySelector(".journey-system-explain");
    if (!anchor) return;
    anchor.insertAdjacentHTML("afterend", markup());

    const live = root.querySelector("[data-buck-live]");
    const slider = live.querySelector("[data-buck-slider]");
    const reset = live.querySelector("[data-buck-reset]");
    const predictionButtons = Array.from(live.querySelectorAll("[data-buck-predict]"));
    const predictionStatus = live.querySelector("[data-buck-predict-status]");
    let prediction = null;
    let baselineDuty = Number(slider.value);
    let baselineVout = buckState(baselineDuty).vout;
    let lastEnergyOn = null;

    function setText(selector, value) {
      const node = live.querySelector(selector);
      if (node) node.textContent = value;
    }

    function updatePrediction(current) {
      if (!prediction) return;
      const deltaDuty = current.dutyPercent - baselineDuty;
      if (Math.abs(deltaDuty) < 1) {
        predictionStatus.textContent = "Prediction 已鎖定；現在把 Duty 往右拉高。";
        predictionStatus.classList.remove("is-pass", "is-fail");
        return;
      }
      if (deltaDuty < 0) {
        predictionStatus.textContent = `你目前把 Duty 降到 ${Math.round(current.dutyPercent)}%；請拉高到基準 ${Math.round(baselineDuty)}% 以上，才能驗證「Duty 增加」。`;
        predictionStatus.classList.remove("is-pass", "is-fail");
        return;
      }
      const actual = current.vout > baselineVout ? "up" : current.vout < baselineVout ? "down" : "same";
      predictionStatus.textContent = `${prediction === actual ? "✓" : "✕"} Duty ${Math.round(baselineDuty)} → ${Math.round(current.dutyPercent)}%，Vout ${format(baselineVout)} → ${format(current.vout)} V。`;
      predictionStatus.classList.toggle("is-pass", prediction === actual);
      predictionStatus.classList.toggle("is-fail", prediction !== actual);
    }

    function render() {
      const state = buckState(slider.value);
      setText("[data-buck-duty]", `${Math.round(state.dutyPercent)}%`);
      setText("[data-buck-vout]", `${format(state.vout)} V`);
      setText("[data-buck-iavg]", `${format(state.iavg, 2)} A`);
      setText("[data-buck-ripple]", `${format(state.deltaI, 2)} A`);
      setText("[data-buck-vout-svg]", `${format(state.vout)} V`);
      setText("[data-buck-ton]", `Ton = ${format(state.duty * state.period * 1e6)} µs`);
      setText("[data-buck-current-range]", `${format(state.imin, 2)} → ${format(state.imax, 2)} A`);
      setText("[data-buck-change]", `目前：D = ${Math.round(state.dutyPercent)}% → Vout ≈ ${format(state.vout)} V；Duty 每增加 10%，理想平均輸出增加 ${format(MODEL.vin * 0.1)} V。`);
      const pwm = live.querySelector("[data-buck-pwm]");
      const current = live.querySelector("[data-buck-current]");
      if (pwm) pwm.setAttribute("d", pwmPath(state.duty));
      if (current) current.setAttribute("d", currentPath(state));
      updatePrediction(state);
      live.style.setProperty("--buck-duty", `${state.dutyPercent}%`);
    }

    function setEnergyState(isOn) {
      if (lastEnergyOn === isOn) return;
      lastEnergyOn = isOn;
      live.classList.toggle("is-switch-on", isOn);
      live.classList.toggle("is-switch-off", !isOn);
      setText("[data-buck-state]", isOn ? "ON" : "OFF");
      setText("[data-buck-switch-label]", isOn ? "ON" : "OFF");
      const state = buckState(slider.value);
      if (isOn) {
        setText("[data-buck-energy-tag]", "ON interval");
        setText("[data-buck-energy-title]", "電感充能，iL 上升");
        setText("[data-buck-energy-body]", "Switch ON：VL = Vin − Vout 為正，所以 di/dt > 0；Vin 同時供應負載並增加電感儲能。");
        setText("[data-buck-energy-equation]", `VL = +${format(MODEL.vin - state.vout)} V`);
      } else {
        setText("[data-buck-energy-tag]", "OFF interval");
        setText("[data-buck-energy-title]", "電感續流，iL 下降");
        setText("[data-buck-energy-body]", "Switch OFF：電感電流不能瞬間歸零，會沿 freewheel path 繼續供應負載；VL = −Vout，所以 di/dt < 0。");
        setText("[data-buck-energy-equation]", `VL = −${format(state.vout)} V`);
      }
    }

    function syncVisibility() {
      const first = root.querySelector('[data-journey-stage="0"]');
      live.hidden = !first || !first.classList.contains("is-active");
    }

    predictionButtons.forEach(button => {
      button.addEventListener("click", () => {
        prediction = button.getAttribute("data-buck-predict");
        baselineDuty = Number(slider.value);
        baselineVout = buckState(baselineDuty).vout;
        predictionButtons.forEach(item => item.classList.toggle("is-selected", item === button));
        predictionStatus.classList.remove("is-pass", "is-fail");
        predictionStatus.textContent = "Prediction 已鎖定；現在把 Duty 往右拉高。";
      });
    });

    slider.addEventListener("input", render);
    reset.addEventListener("click", () => {
      slider.value = "50";
      baselineDuty = 50;
      baselineVout = buckState(50).vout;
      render();
    });

    const stageCards = Array.from(root.querySelectorAll("[data-journey-stage]"));
    const observer = new MutationObserver(syncVisibility);
    stageCards.forEach(card => observer.observe(card, { attributes: true, attributeFilter: ["class"] }));

    function animate(now) {
      const duty = buckState(slider.value).duty;
      const phase = (now % MODEL.visualPeriodMs) / MODEL.visualPeriodMs;
      setEnergyState(phase < duty);
      global.requestAnimationFrame(animate);
    }

    render();
    syncVisibility();
    global.requestAnimationFrame(animate);
  }

  Learning.renderHome = function renderHomeWithBuckLive(rootId) {
    previousRenderHome(rootId);
    mount(document.getElementById(rootId));
  };
})(window);
