(function (global) {
  "use strict";
  const Store = global.CircuitPowerSystemStateV1;
  const Models = global.CircuitPowerModelsV1;
  if (!Store || !Models) return;

  const fmt = Models.fmt;
  const markup = () => `<section class="power-live-stage" data-power-stage="2" hidden>
    <div class="power-live-head"><div><span class="power-live-kicker">STAGE 3 · REAL-TIME CONTROL</span><h4>PWM → ADC → ISR → PWM Load</h4><p>何時量、何時算完、何時新的 duty 才真正進入 power stage？</p></div><span class="power-live-same-machine">SAME HARDWARE · TIMING MODEL</span></div>
    <div class="power-predict"><strong>先猜：</strong><span>如果 CMP 寫入晚於本週期 PWM load deadline，新 duty 何時生效？</span><button type="button" data-timing-predict="same">同一週期</button><button type="button" data-timing-predict="next">下一週期</button><button class="power-action" type="button" data-timing-inject>注入重 ISR</button><small data-timing-predict-status>先鎖定答案，再注入重運算。</small></div>
    <div class="power-control-grid"><label><span><b>SOC / sample phase</b><output data-timing-sample-readout></output></span><input data-timing-sample type="range" min="0.5" max="8.0" step="0.1"><small>相對 10 µs PWM period 的取樣位置。</small></label><label><span><b>Control compute</b><output data-timing-compute-readout></output></span><input data-timing-compute type="range" min="0.2" max="12" step="0.1"><small>ISR/CLA 內 controller + limiter + command preparation。</small></label></div>
    <div class="timing-cycle"><div class="timing-cycle-head"><b>One PWM period</b><span>Ts = 10.0 µs</span></div><div class="timing-track"><i class="timing-deadline" style="left:100%"></i><span class="timing-event" data-event="soc"><b>SOC / S&H</b><small></small></span><span class="timing-event" data-event="eoc"><b>EOC</b><small></small></span><span class="timing-event" data-event="isr"><b>ISR</b><small></small></span><span class="timing-event" data-event="write"><b>CMP write</b><small></small></span></div><div class="timing-scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10 µs · LOAD</span></div></div>
    <div class="power-metric-grid"><div><span>ADC chain</span><strong data-timing-adc></strong></div><div><span>CMP write</span><strong data-timing-write></strong></div><div data-timing-deadline-card><span>Deadline</span><strong data-timing-deadline></strong></div><div><span>Sample → Actuate</span><strong data-timing-actuate></strong></div></div>
    <div class="power-causal"><span>CAUSAL TIMELINE</span><div><b>PWM SOC</b><i>→</i><b>S/H aperture</b><i>→</i><b>EOC</b><i>→</i><b>ADCINT</b><i>→</i><b>C(z)</b><i>→</i><b>CMP write</b><i>→</i><b>shadow load</b></div><p data-timing-summary></p></div>
    <div class="power-code-grid"><div><span>C code says</span><code>EPwm.CMPA = duty_cmd;</code></div><div><span>Hardware truth says</span><code data-timing-hardware></code></div><div><span>Discrete-time view</span><code data-timing-z></code></div></div>
    <p class="power-boundary"><b>模型邊界：</b>single-rate teaching budget；實機請以 TRM + GPIO timestamp + scope 量測替代 teaching numbers。</p>
  </section>`;

  function mount(root, panel) {
    const sample = panel.querySelector("[data-timing-sample]");
    const compute = panel.querySelector("[data-timing-compute]");
    const inject = panel.querySelector("[data-timing-inject]");
    const status = panel.querySelector("[data-timing-predict-status]");
    const buttons = Array.from(panel.querySelectorAll("[data-timing-predict]"));
    let prediction = null;
    function text(sel, value) { const n = panel.querySelector(sel); if (n) n.textContent = value; }
    function render() {
      const state = Store.snapshot();
      sample.value = state.timing.sampleUs;
      compute.value = state.timing.computeUs;
      const s = Models.timingState(state);
      text("[data-timing-sample-readout]", `${fmt(s.sampleUs,1)} µs`);
      text("[data-timing-compute-readout]", `${fmt(state.timing.computeUs,1)} µs`);
      text("[data-timing-adc]", `${fmt(state.timing.acquisitionUs + state.timing.conversionUs,2)} µs`);
      text("[data-timing-write]", `${fmt(s.write,2)} µs`);
      text("[data-timing-deadline]", s.missed ? "MISS → +1 cycle" : "PASS");
      text("[data-timing-actuate]", `${fmt(s.actuation,2)} µs`);
      text("[data-timing-hardware]", `write ${fmt(s.write)} µs → effective ${fmt(s.apply)} µs`);
      text("[data-timing-z]", `delay ≈ ${fmt(s.actuation / s.periodUs,2)} Ts`);
      text("[data-timing-summary]", s.missed ? `CMP write = ${fmt(s.write)} µs，越過 LOAD；plant 到 ${fmt(s.apply)} µs 才看到新 duty。` : `CMP write = ${fmt(s.write)} µs，在 deadline 前完成；新 duty 於 10.00 µs LOAD 生效。`);
      const card = panel.querySelector("[data-timing-deadline-card]"); if (card) card.classList.toggle("is-fault", s.missed);
      [["soc",s.sampleUs],["eoc",s.eoc],["isr",s.isr],["write",s.write]].forEach(([id,time]) => { const n=panel.querySelector(`[data-event="${id}"]`); if(!n)return; n.style.left=`${Models.clamp(time/s.periodUs*100,0,100)}%`; n.querySelector("small").textContent=`${fmt(time,2)} µs`; n.classList.toggle("is-late",time>s.periodUs); });
    }
    sample.addEventListener("input", () => Store.set("timing.sampleUs", Number(sample.value), { source:"stage3" }));
    compute.addEventListener("input", () => Store.set("timing.computeUs", Number(compute.value), { source:"stage3" }));
    buttons.forEach(b => b.addEventListener("click", () => { prediction=b.dataset.timingPredict; buttons.forEach(x=>x.classList.toggle("is-selected",x===b)); status.textContent="Prediction 已鎖定；按『注入重 ISR』。"; }));
    inject.addEventListener("click", () => { Store.set("timing.computeUs",8.8,{source:"stage3-fault"}); const actual=Models.timingState(Store.snapshot()).missed?"next":"same"; status.textContent=`${prediction?(prediction===actual?"✓":"✕"):"觀察"} CMP write 越過 load point → 下一個 LOAD 才生效。`; status.classList.toggle("is-pass",prediction===actual); status.classList.toggle("is-fail",!!prediction&&prediction!==actual); });
    const unsubscribe = Store.subscribe((_,change) => { if (change.path.startsWith("timing.")) render(); });
    render();
    return { render, destroy: unsubscribe };
  }
  global.CircuitPowerStagesV1 = global.CircuitPowerStagesV1 || {};
  global.CircuitPowerStagesV1.timing = { index:2, markup, mount };
})(window);
