(function (global) {
  "use strict";

  const Learning = global.CircuitLearning;
  if (!Learning || typeof Learning.renderHome !== "function") return;

  const previousRenderHome = Learning.renderHome;
  const MODEL = Object.freeze({
    vin: 48,
    divider: 15,
    adcVref: 3.3,
    adcMax: 4095
  });

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const fmt = (value, digits) => Number(value).toFixed(digits == null ? 2 : digits);

  function truthFromDuty(dutyPercent) {
    const duty = clamp(Number(dutyPercent) / 100, 0.1, 0.9);
    return { dutyPercent: duty * 100, vout: MODEL.vin * duty };
  }

  function sensingState(dutyPercent, gainErrorPercent, offsetCounts) {
    const truth = truthFromDuty(dutyPercent);
    const dividerVoltage = truth.vout / MODEL.divider;
    const afeGain = 1 + Number(gainErrorPercent) / 100;
    const afeVoltage = dividerVoltage * afeGain;
    const unclipped = Math.round((afeVoltage / MODEL.adcVref) * MODEL.adcMax) + Number(offsetCounts);
    const adcCount = clamp(unclipped, 0, MODEL.adcMax);
    const firmwareVout = (adcCount / MODEL.adcMax) * MODEL.adcVref * MODEL.divider;
    const errorV = firmwareVout - truth.vout;
    const errorPercent = truth.vout ? (errorV / truth.vout) * 100 : 0;
    const lsbAtOutput = (MODEL.adcVref / MODEL.adcMax) * MODEL.divider;
    return {
      ...truth,
      dividerVoltage,
      afeGain,
      afeVoltage,
      adcCount,
      unclipped,
      firmwareVout,
      errorV,
      errorPercent,
      lsbAtOutput,
      clipped: adcCount !== unclipped
    };
  }

  function markup() {
    return `<section class="sensing-live" data-sensing-live hidden aria-labelledby="sensingLiveTitle">
      <div class="sensing-live-head">
        <div>
          <span class="sensing-live-kicker">STAGE 2 · SAME MACHINE · SENSING</span>
          <h4 id="sensingLiveTitle">Buck Sensing Chain</h4>
          <p>Stage 1 的同一個 Vout，現在一路穿過 divider、OPA/AFE、ADC，最後才變成 firmware 相信的工程單位。</p>
        </div>
        <button class="sensing-reset" type="button" data-sensing-reset>Zero sensing faults</button>
      </div>

      <div class="sensing-source">
        <div>
          <span>SOURCE · SAME BUCK</span>
          <strong><b data-sensing-duty-readout>50%</b> Duty → <b data-sensing-physical>24.00 V</b> physical Vout</strong>
        </div>
        <label>
          <span>沿用 Stage 1 Duty</span>
          <input data-sensing-duty type="range" min="10" max="90" step="1" value="50" aria-label="Same Buck duty source">
        </label>
      </div>

      <div class="sensing-predict">
        <strong>先猜：</strong>
        <span>如果 ADC 多 +100 count，但真實 Vout 完全沒變，firmware 看到的 Vout 會？</span>
        <button type="button" data-sensing-predict="high">變高</button>
        <button type="button" data-sensing-predict="low">變低</button>
        <button type="button" data-sensing-predict="same">不變</button>
        <button class="sensing-inject" type="button" data-sensing-inject>注入 +100 count</button>
        <small data-sensing-predict-status>先鎖定方向，再注入 fault。</small>
      </div>

      <div class="sensing-chain" aria-label="Vout to firmware sensing chain">
        <article data-sensing-block="physical"><span>PHYSICAL</span><b>Vout</b><strong data-chain-physical>24.00 V</strong><small>Power stage truth</small></article>
        <i>→</i>
        <article data-sensing-block="divider"><span>DIVIDER</span><b>÷ 15</b><strong data-chain-divider>1.600 V</strong><small>HV → ADC-safe voltage</small></article>
        <i>→</i>
        <article data-sensing-block="afe"><span>OPA / AFE</span><b data-chain-gain>× 1.000</b><strong data-chain-afe>1.600 V</strong><small>gain / offset lives here</small></article>
        <i>→</i>
        <article data-sensing-block="adc"><span>12-BIT ADC</span><b>3.3 V ref</b><strong data-chain-adc>1985 count</strong><small>volts → integer</small></article>
        <i>→</i>
        <article data-sensing-block="firmware"><span>FIRMWARE</span><b>scale back</b><strong data-chain-fw>24.00 V</strong><small>what control code believes</small></article>
      </div>

      <div class="sensing-truth-grid">
        <article class="sensing-truth-card">
          <span>PHYSICAL TRUTH</span>
          <strong data-truth-vout>24.00 V</strong>
          <div class="sensing-bar"><i data-truth-bar></i></div>
          <small>真正接在 load 上的輸出</small>
        </article>
        <article class="sensing-belief-card">
          <span>FIRMWARE BELIEF</span>
          <strong data-belief-vout>24.00 V</strong>
          <div class="sensing-bar"><i data-belief-bar></i></div>
          <small>PI / protection / telemetry 會使用這個數字</small>
        </article>
        <article class="sensing-error-card" data-sensing-error-card>
          <span>MEASUREMENT ERROR</span>
          <strong data-sensing-error>+0.00 V</strong>
          <small data-sensing-error-percent>+0.00%</small>
        </article>
      </div>

      <div class="sensing-controls">
        <label>
          <span><b>AFE gain error</b><output data-gain-readout>0.0%</output></span>
          <input data-gain-error type="range" min="-5" max="5" step="0.1" value="0" aria-label="AFE gain error percent">
          <small>模擬 divider tolerance、OPA gain error 或 calibration mismatch。</small>
        </label>
        <label>
          <span><b>ADC offset</b><output data-offset-readout>0 count</output></span>
          <input data-offset-counts type="range" min="-150" max="150" step="1" value="0" aria-label="ADC offset counts">
          <small>模擬 ADC / front-end offset；firmware scale 仍假設 nominal。</small>
        </label>
      </div>

      <div class="sensing-equations">
        <div><span>1 · Scale</span><code>Vdivider = Vout / 15</code></div>
        <div><span>2 · Quantize</span><code>count = round(Vafe / 3.3 × 4095) + offset</code></div>
        <div><span>3 · Reconstruct</span><code>Vfw = count × 3.3 / 4095 × 15</code></div>
      </div>

      <div class="sensing-consequence" data-sensing-consequence>
        <span>WHY FIRMWARE CARES</span>
        <strong>Sensor error 不是顯示誤差而已。</strong>
        <p>未來閉迴路若把錯誤 measurement 當成真相，controller 會用 duty 去補償一個根本不存在的 plant error。</p>
      </div>

      <div class="sensing-first-principles">
        <span>FIRST-PRINCIPLES CHAIN</span>
        <div><b>Physical Vout</b><i>→</i><b>Analog scaling</b><i>→</i><b>ADC count</b><i>→</i><b>Firmware belief</b><i>→</i><b>Control decision</b></div>
        <p data-sensing-summary>Nominal：24.00 V → 1.600 V → 1985 count → 24.00 V。</p>
      </div>

      <p class="sensing-boundary"><b>模型邊界：</b>理想 divider nominal ratio 15:1、buffer 型 AFE、12-bit ADC、3.3 V reference。未加入 ADC acquisition settling、source impedance、noise、INL/DNL、Vref drift、sampling instant；這些留給 Stage 3 timing 與後續 fault labs。</p>
    </section>`;
  }

  function mount(root) {
    if (!root || root.querySelector("[data-sensing-live]")) return;
    const anchor = root.querySelector(".journey-system-explain");
    if (!anchor) return;
    anchor.insertAdjacentHTML("afterend", markup());

    const live = root.querySelector("[data-sensing-live]");
    const buckSlider = root.querySelector("[data-buck-slider]");
    const duty = live.querySelector("[data-sensing-duty]");
    const gain = live.querySelector("[data-gain-error]");
    const offset = live.querySelector("[data-offset-counts]");
    const reset = live.querySelector("[data-sensing-reset]");
    const inject = live.querySelector("[data-sensing-inject]");
    const predictionStatus = live.querySelector("[data-sensing-predict-status]");
    const predictionButtons = Array.from(live.querySelectorAll("[data-sensing-predict]"));
    let prediction = null;

    function setText(selector, value) {
      const node = live.querySelector(selector);
      if (node) node.textContent = value;
    }

    function currentDuty() {
      return Number(buckSlider ? buckSlider.value : duty.value);
    }

    function render() {
      const d = currentDuty();
      duty.value = String(d);
      const state = sensingState(d, gain.value, offset.value);
      setText("[data-sensing-duty-readout]", `${Math.round(state.dutyPercent)}%`);
      setText("[data-sensing-physical]", `${fmt(state.vout)} V`);
      setText("[data-chain-physical]", `${fmt(state.vout)} V`);
      setText("[data-chain-divider]", `${fmt(state.dividerVoltage, 3)} V`);
      setText("[data-chain-gain]", `× ${fmt(state.afeGain, 3)}`);
      setText("[data-chain-afe]", `${fmt(state.afeVoltage, 3)} V`);
      setText("[data-chain-adc]", `${state.adcCount} count${state.clipped ? " · CLIPPED" : ""}`);
      setText("[data-chain-fw]", `${fmt(state.firmwareVout)} V`);
      setText("[data-truth-vout]", `${fmt(state.vout)} V`);
      setText("[data-belief-vout]", `${fmt(state.firmwareVout)} V`);
      setText("[data-sensing-error]", `${state.errorV >= 0 ? "+" : ""}${fmt(state.errorV)} V`);
      setText("[data-sensing-error-percent]", `${state.errorPercent >= 0 ? "+" : ""}${fmt(state.errorPercent)}%`);
      setText("[data-gain-readout]", `${Number(gain.value) >= 0 ? "+" : ""}${fmt(gain.value, 1)}%`);
      setText("[data-offset-readout]", `${Number(offset.value) >= 0 ? "+" : ""}${Math.round(Number(offset.value))} count`);
      setText("[data-sensing-summary]", `現在：${fmt(state.vout)} V physical → ${fmt(state.dividerVoltage, 3)} V divider → ${state.adcCount} count → ${fmt(state.firmwareVout)} V firmware。`);

      const truthBar = live.querySelector("[data-truth-bar]");
      const beliefBar = live.querySelector("[data-belief-bar]");
      if (truthBar) truthBar.style.width = `${clamp(state.vout / MODEL.vin * 100, 0, 100)}%`;
      if (beliefBar) beliefBar.style.width = `${clamp(state.firmwareVout / MODEL.vin * 100, 0, 100)}%`;

      const card = live.querySelector("[data-sensing-error-card]");
      if (card) {
        card.classList.toggle("is-fault", Math.abs(state.errorV) >= 0.25);
        card.classList.toggle("is-ok", Math.abs(state.errorV) < 0.25);
      }

      const consequence = live.querySelector("[data-sensing-consequence]");
      if (consequence) {
        const direction = state.errorV > 0.05 ? "偏高" : state.errorV < -0.05 ? "偏低" : "接近真值";
        const response = state.errorV > 0.05 ? "未來 PI 會傾向把真實 Vout 往下拉。" : state.errorV < -0.05 ? "未來 PI 會傾向把真實 Vout 往上推。" : "目前沒有足以驅動明顯錯誤補償的 measurement bias。";
        consequence.querySelector("strong").textContent = `Firmware measurement ${direction} ${fmt(Math.abs(state.errorV))} V。`;
        consequence.querySelector("p").textContent = `${response} 1 count 在輸出端約等於 ${fmt(state.lsbAtOutput, 3)} V。`;
      }
    }

    function syncVisibility() {
      const stage = root.querySelector('[data-journey-stage="1"]');
      live.hidden = !stage || !stage.classList.contains("is-active");
      if (!live.hidden) render();
    }

    duty.addEventListener("input", () => {
      if (buckSlider) {
        buckSlider.value = duty.value;
        buckSlider.dispatchEvent(new Event("input", { bubbles: true }));
      }
      render();
    });
    gain.addEventListener("input", render);
    offset.addEventListener("input", render);
    if (buckSlider) buckSlider.addEventListener("input", render);

    predictionButtons.forEach(button => button.addEventListener("click", () => {
      prediction = button.getAttribute("data-sensing-predict");
      predictionButtons.forEach(item => item.classList.toggle("is-selected", item === button));
      predictionStatus.textContent = "Prediction 已鎖定；按『注入 +100 count』。";
      predictionStatus.classList.remove("is-pass", "is-fail");
    }));

    inject.addEventListener("click", () => {
      const before = sensingState(currentDuty(), gain.value, 0).firmwareVout;
      offset.value = "100";
      render();
      const after = sensingState(currentDuty(), gain.value, offset.value).firmwareVout;
      const actual = after > before ? "high" : after < before ? "low" : "same";
      predictionStatus.textContent = `${prediction ? (prediction === actual ? "✓" : "✕") : "觀察"} +100 count：firmware Vout ${fmt(before)} → ${fmt(after)} V；physical Vout 不變。`;
      predictionStatus.classList.toggle("is-pass", !!prediction && prediction === actual);
      predictionStatus.classList.toggle("is-fail", !!prediction && prediction !== actual);
    });

    reset.addEventListener("click", () => {
      gain.value = "0";
      offset.value = "0";
      prediction = null;
      predictionButtons.forEach(item => item.classList.remove("is-selected"));
      predictionStatus.textContent = "先鎖定方向，再注入 fault。";
      predictionStatus.classList.remove("is-pass", "is-fail");
      render();
    });

    const stageCards = Array.from(root.querySelectorAll("[data-journey-stage]"));
    const observer = new MutationObserver(syncVisibility);
    stageCards.forEach(card => observer.observe(card, { attributes: true, attributeFilter: ["class"] }));
    render();
    syncVisibility();
  }

  Learning.renderHome = function renderHomeWithSensingLive(rootId) {
    previousRenderHome(rootId);
    mount(document.getElementById(rootId));
  };
})(window);
