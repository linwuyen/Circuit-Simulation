(function (global) {
  "use strict";
  const Models = global.CircuitPowerTeachingModelsV2;
  if (!Models) return;
  const I = global.CircuitPowerTeachingV2Internal = global.CircuitPowerTeachingV2Internal || {};
  function contractMarkup() {
    return `<section class="power-contract-v2" data-v2-contract>
      <div class="power-v2-head"><div><span class="power-v2-kicker">SYSTEM CONTRACT · BEFORE THE CONTROL LOOP</span><h3>先定義「什麼叫成功」，才有 error、deadline 與 protection threshold</h3><p>規格不是文件尾頁；它是每一層模型、控制與驗證的共同 boundary condition。</p></div><span class="power-v2-badge">PRODUCT VIEW</span></div>
      <div class="power-contract-grid" data-v2-contract-grid></div>
      <div class="power-plane-grid">
        <article><span>ENERGY PLANE</span><b>Vin → switch → L/C → load</b><small>能量實際往哪裡流？</small></article>
        <article><span>INFORMATION PLANE</span><b>physical → sensor → ADC → controller</b><small>MCU 到底相信什麼？</small></article>
        <article><span>AUTHORITY PLANE</span><b>state / limiter / trip → PWM enable or veto</b><small>現在誰有控制權？</small></article>
        <article><span>TIME & OWNERSHIP</span><b>sample age · writer · reader · commit time</b><small>這個值是誰的、多久以前的？</small></article>
      </div>
    </section>`;
  }

  function stage0Markup() {
    return `<section class="power-v2-card" data-v2-region-card>
      <div class="power-v2-card-head"><div><span>OPERATING REGION</span><strong>先問模型現在還成立嗎？</strong></div><b data-v2-region></b></div>
      <label class="power-v2-slider"><span>Load resistance <output data-v2-load-readout></output></span><input data-v2-load type="range" min="2" max="120" step="1"></label>
      <div class="power-v2-region-map" data-v2-region-map><span data-region="DCM">DCM</span><span data-region="CCM">CCM</span><span data-region="CURRENT_LIMIT">CURRENT LIMIT</span><span data-region="SATURATION">DUTY SATURATION</span></div>
      <div class="power-v2-metrics"><div><span>Iavg</span><b data-v2-region-iavg></b></div><div><span>CCM boundary</span><b data-v2-region-boundary></b></div><div><span>ΔIL</span><b data-v2-region-ripple></b></div><div><span>Equation validity</span><b data-v2-region-valid></b></div></div>
      <p data-v2-region-reason></p>
    </section>`;
  }

  function stage1Markup() {
    return `<section class="power-v2-card" data-v2-resolution>
      <div class="power-v2-card-head"><div><span>RESOLUTION BUDGET</span><strong>不是所有 regulation error 都能靠 PI 消掉</strong></div><b>ADC ↔ PWM</b></div>
      <label class="power-v2-slider"><span>ePWM TBPRD <output data-v2-tbprd-readout></output></span><input data-v2-tbprd type="range" min="500" max="5000" step="100"></label>
      <div class="power-v2-metrics"><div><span>ADC LSB @ output</span><b data-v2-adc-lsb></b></div><div><span>PWM duty LSB</span><b data-v2-pwm-lsb></b></div><div><span>PWM equivalent Vout step</span><b data-v2-pwm-vstep></b></div><div><span>Ideal single-step scale</span><b data-v2-resolution-floor></b></div></div>
      <p>這裡比較的是 ideal ADC observation step 與 ideal PWM actuator step，只能當解析度尺度，不是 absolute regulation floor。Calibration、noise、INL/DNL、dither、HRPWM 與 plant gain 都會改變實際可達精度。</p>
    </section>`;
  }

  function stage2Markup() {
    return `<section class="power-v2-card" data-v2-sampling>
      <div class="power-v2-card-head"><div><span>SAMPLING PHYSICS</span><strong>ADC 讀到的是某個 switching phase 的 sample，不是抽象「真值」</strong></div><b data-v2-sample-phase></b></div>
      <label class="power-v2-slider"><span>Sampling jitter <output data-v2-jitter-readout></output></span><input data-v2-jitter type="range" min="0" max="200" step="5"></label>
      <label class="power-v2-slider"><span>PWM-synchronous SOC <output data-v2-alias-readout></output></span><input data-v2-sync type="checkbox"></label>
      <div class="power-v2-metrics"><div><span>Sampled iL</span><b data-v2-sampled-il></b></div><div><span>Average iL</span><b data-v2-average-il></b></div><div><span>Ripple sampling error</span><b data-v2-ripple-error></b></div><div><span>Jitter uncertainty</span><b data-v2-jitter-band></b></div></div>
      <div class="power-v2-causal"><b>switch ripple</b><i>→</i><b>SOC phase</b><i>→</i><b>S/H aperture</b><i>→</i><b>ADC sample</b><i>→</i><b>controller belief</b></div>
      <p data-v2-settling></p>
    </section>`;
  }

  function stage3Markup() {
    return `<section class="power-v2-card" data-v2-product-control>
      <div class="power-v2-card-head"><div><span>PRODUCT CONTROL REALITY</span><strong>C(z) 之外還有 authority、limiter、anti-windup 與 feed-forward</strong></div><b data-v2-control-mode></b></div>
      <div class="power-v2-control-chain"><span>Vref</span><i>→</i><span>Voltage loop</span><i>→</i><span>Iref limiter</span><i>→</i><span>Current authority</span><i>→</i><span>Duty limiter</span><i>→</i><span>Plant</span></div>
      <div class="power-v2-two-controls"><label><span>Load R <output data-v2-cccv-load-readout></output></span><input data-v2-cccv-load type="range" min="1" max="12" step="0.25"></label><label><span>Current limit <output data-v2-current-limit-readout></output></span><input data-v2-current-limit type="range" min="2" max="15" step="0.5"></label></div>
      <div class="power-v2-metrics"><div><span>Authority</span><b data-v2-cccv-mode></b></div><div><span>Physical target</span><b data-v2-cccv-v></b></div><div><span>Iout</span><b data-v2-cccv-i></b></div><div><span>Required duty</span><b data-v2-cccv-duty></b></div></div>
      <div class="power-v2-toggle-grid"><label><input data-v2-aw type="checkbox"> Anti-windup</label><div><span>Vin sag → recovery</span><b data-v2-aw-result></b><small data-v2-aw-compare></small></div><label><input data-v2-ff type="checkbox"> Vin feed-forward</label><div><span>Vin step response</span><b data-v2-ff-result></b><small data-v2-ff-compare></small></div><label><input data-v2-bumpless type="checkbox"> Bumpless CC↔CV</label><div><span>Authority handoff</span><b data-v2-bumpless-result></b><small>preload incoming controller state to outgoing command</small></div></div>
      <p>Feedback 修 residual error；feed-forward 預先補償已知 disturbance。CC/CV 切換不是「兩個 PI 同時搶 duty」，而是明確的 authority handoff。</p>
      <p><b>Fidelity：</b>anti-windup / feed-forward 的 overshoot、droop 數字來自 τ=1.2 ms 一階 plant surrogate；用來比較控制結構，不代表此 L/C/R Buck 的真實 transient。</p>
    </section>`;
  }

  function stage4Markup() {
    return `<section class="power-v2-card" data-v2-bandwidth>
      <div class="power-v2-card-head"><div><span>CASCADED-LOOP BANDWIDTH</span><strong>內環要先收斂，外環才看見近似受控的 plant</strong></div><b data-v2-separation></b></div>
      <div class="power-v2-metrics"><div><span>Heuristic inner start</span><b data-v2-inner-bw></b></div><div><span>Heuristic outer start</span><b data-v2-outer-bw></b></div><div><span>Sample→actuate delay</span><b data-v2-loop-delay></b></div><div><span>Delay phase @ inner</span><b data-v2-inner-phase></b></div></div>
      <p>這裡的 inner=min(fsw/20, 5 kHz)、outer=inner/5 只是教學起始值，不是由 P(s) 設計出的 crossover。真正 bandwidth 必須由 operating-point plant、delay、margin 與 SFRA/loop-gain 驗證。</p>
    </section>`;
  }

  function stage5Markup() {
    return `<section class="power-v2-card" data-v2-plant-regions>
      <div class="power-v2-card-head"><div><span>OPERATING-POINT DEPENDENT PLANT</span><strong>Topology 名稱不等於固定 P(s)</strong></div><b data-v2-plant-name></b></div>
      <div class="power-v2-metrics"><div><span>Operating axes</span><b data-v2-plant-axis></b></div><div class="wide"><span>Region library</span><b data-v2-plant-region-list></b></div></div>
      <p><b>Boundary：</b><span data-v2-plant-boundary></span></p>
      <p>換 operating point 時，先重新問「哪個 model 還有效？」再搬 controller coefficient。</p>
    </section>`;
  }

  function stage6Markup() {
    return `<section class="power-v2-card" data-v2-startup>
      <div class="power-v2-card-head"><div><span>STARTUP / SHUTDOWN STATE MACHINE</span><strong>PI 正確也不能讓一個尚未 qualified 的系統進 RUN</strong></div><b data-v2-startup-state></b></div>
      <div class="power-v2-metrics"><div><span>PWM permission</span><b data-v2-startup-pwm></b></div><div><span>Last guard</span><b data-v2-startup-guard></b></div><div class="wide"><span>State path</span><b>POWER_OFF → INIT → SELF_TEST → PRECHARGE → SOFT_START → RUN</b></div></div>
      <div class="power-v2-qualifiers">
        <label><input type="checkbox" data-v2-qualifier="adcValid"> ADC valid</label>
        <label><input type="checkbox" data-v2-qualifier="selfTestPass"> Self-test pass</label>
        <label><input type="checkbox" data-v2-qualifier="busReady"> Vbus ready</label>
        <label><input type="checkbox" data-v2-qualifier="prechargeDone"> Precharge done</label>
        <label><input type="checkbox" data-v2-qualifier="softStartComplete"> Soft-start done</label>
      </div>
      <div class="power-v2-actions"><button type="button" data-v2-startup-power>Power on</button><button type="button" data-v2-startup-advance>Advance state</button><button type="button" data-v2-startup-fault>Inject fault</button><button type="button" data-v2-startup-safe>Fault source clear</button><button type="button" data-v2-startup-clear>Qualified clear</button></div>
      <p data-v2-startup-status>先 Power on；沒有 qualifier 就嘗試 advance，觀察 state machine 拒絕原因。</p>
    </section>`;
  }

  function stage7Markup() {
    const instrumentChoices = Object.entries(Models.INSTRUMENTS).map(([id, item]) => `<label><input type="checkbox" data-v2-instrument="${id}"> ${item.label}</label>`).join("");
    return `<section class="power-v2-card" data-v2-observability>
      <div class="power-v2-card-head"><div><span>DATA OWNERSHIP + OBSERVABILITY ARCHITECTURE</span><strong>Debug 能力是在寫 firmware 時就設計進去的</strong></div><b>8 SLOT BUDGET</b></div>
      <div class="power-v2-ownership" data-v2-ownership-table></div>
      <div class="power-v2-actions"><button type="button" data-v2-age-host>Age host command +250 ms</button><button type="button" data-v2-refresh-host>Receive fresh host command</button></div>
      <div class="power-v2-instrumentation"><div><span>Choose diagnostic signals</span><b data-v2-instrument-score></b></div><div class="power-v2-instrument-grid">${instrumentChoices}</div><p data-v2-instrument-status></p></div>
      <div class="power-v2-causal"><b>writer</b><i>→</i><b>version / timestamp</b><i>→</i><b>owner</b><i>→</i><b>reader</b><i>→</i><b>physical consequence</b></div>
      <div class="power-v2-card-head power-v2-verify-head"><div><span>VERIFICATION LADDER</span><strong>每個 escaped fault 都應變成下一層 regression vector</strong></div><b>MODEL → SIL → HIL → BOARD</b></div>
      <div class="power-plane-grid power-v2-verification">${Models.verificationLadder().map(v=>`<article><span>${v.name}</span><b>${v.purpose}</b><small>${v.faults}</small></article>`).join("")}</div>
    </section>`;
  }

  function insertEnhancements(root) {
    const shell = root.querySelector(".journey-shell");
    if (shell && !shell.querySelector("[data-v2-contract]")) {
      const head = shell.querySelector(".journey-section-head");
      if (head) head.insertAdjacentHTML("afterend", contractMarkup());
    }
    const buck = root.querySelector("[data-buck-live]");
    if (buck && !buck.querySelector("[data-v2-region-card]")) buck.insertAdjacentHTML("beforeend", stage0Markup());
    const sensing = root.querySelector("[data-sensing-live]");
    if (sensing && !sensing.querySelector("[data-v2-resolution]")) sensing.insertAdjacentHTML("beforeend", stage1Markup());
    const stage2 = root.querySelector('[data-power-stage="2"]');
    if (stage2 && !stage2.querySelector("[data-v2-sampling]")) stage2.insertAdjacentHTML("beforeend", stage2Markup());
    const stage3 = root.querySelector('[data-power-stage="3"]');
    if (stage3 && !stage3.querySelector("[data-v2-product-control]")) stage3.insertAdjacentHTML("beforeend", stage3Markup());
    const stage4 = root.querySelector('[data-power-stage="4"]');
    if (stage4 && !stage4.querySelector("[data-v2-bandwidth]")) stage4.insertAdjacentHTML("beforeend", stage4Markup());
    const stage5 = root.querySelector('[data-power-stage="5"]');
    if (stage5 && !stage5.querySelector("[data-v2-plant-regions]")) stage5.insertAdjacentHTML("beforeend", stage5Markup());
    const stage6 = root.querySelector('[data-power-stage="6"]');
    if (stage6 && !stage6.querySelector("[data-v2-startup]")) stage6.insertAdjacentHTML("beforeend", stage6Markup());
    const stage7 = root.querySelector('[data-power-stage="7"]');
    if (stage7 && !stage7.querySelector("[data-v2-observability]")) stage7.insertAdjacentHTML("beforeend", stage7Markup());
  }

  Object.assign(I, { contractMarkup, stage0Markup, stage1Markup, stage2Markup, stage3Markup, stage4Markup, stage5Markup, stage6Markup, stage7Markup, insertEnhancements });
})(window);