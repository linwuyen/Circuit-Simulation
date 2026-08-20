(function (global) {
  "use strict";

  const Learning = global.CircuitLearning;
  if (!Learning || typeof Learning.renderHome !== "function") return;

  const previousRenderHome = Learning.renderHome;
  const MODEL = Object.freeze({
    vin: 48,
    fsw: 100000,
    ts: 10e-6,
    divider: 15,
    adcVref: 3.3,
    adcMax: 4095,
    inductance: 200e-6,
    capacitance: 470e-6,
    load: 6,
    esr: 0.05
  });

  const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value)));
  const fmt = (value, digits) => Number(value).toFixed(digits == null ? 2 : digits);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);

  function sharedDuty(root) {
    const slider = root.querySelector("[data-buck-slider]");
    return clamp(slider ? slider.value : 50, 10, 90);
  }

  function sensingParams(root) {
    const gain = root.querySelector("[data-gain-error]");
    const offset = root.querySelector("[data-offset-counts]");
    return {
      gainError: Number(gain ? gain.value : 0),
      offsetCounts: Number(offset ? offset.value : 0)
    };
  }

  function measureVout(vout, gainError, offsetCounts) {
    const dividerV = vout / MODEL.divider;
    const afeV = dividerV * (1 + Number(gainError) / 100);
    const raw = Math.round(afeV / MODEL.adcVref * MODEL.adcMax) + Number(offsetCounts);
    const count = clamp(raw, 0, MODEL.adcMax);
    return {
      count,
      firmwareVout: count / MODEL.adcMax * MODEL.adcVref * MODEL.divider
    };
  }

  function linePath(values, width, height, minY, maxY) {
    if (!values.length) return "";
    const span = Math.max(1e-9, maxY - minY);
    return values.map((value, index) => {
      const x = index / Math.max(1, values.length - 1) * width;
      const y = height - (value - minY) / span * height;
      return `${index ? "L" : "M"} ${fmt(x, 2)} ${fmt(clamp(y, 0, height), 2)}`;
    }).join(" ");
  }

  function logspace(minExp, maxExp, count) {
    return Array.from({ length: count }, (_, i) => Math.pow(10, minExp + (maxExp - minExp) * i / (count - 1)));
  }

  function complex(re, im) { return { re, im }; }
  function cadd(a, b) { return complex(a.re + b.re, a.im + b.im); }
  function cmul(a, b) { return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cdiv(a, b) {
    const d = b.re * b.re + b.im * b.im || 1e-20;
    return complex((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }
  function cabs(a) { return Math.hypot(a.re, a.im); }
  function cphase(a) { return Math.atan2(a.im, a.re) * 180 / Math.PI; }

  function stageShell(stage, tag, title, intro, body) {
    return `<section class="power-live-stage" data-power-stage="${stage}" hidden>
      <div class="power-live-head">
        <div>
          <span class="power-live-kicker">${esc(tag)}</span>
          <h4>${esc(title)}</h4>
          <p>${esc(intro)}</p>
        </div>
        <span class="power-live-same-machine">SAME 48 V BUCK</span>
      </div>
      ${body}
    </section>`;
  }

  function timingMarkup() {
    return stageShell(2, "STAGE 3 · REAL-TIME CONTROL", "PWM → ADC → ISR → PWM Load",
      "現在不只問『量到多少』，而是問：何時量、何時算完、何時新的 duty 才真的進入 power stage？",
      `<div class="power-predict" data-timing-predict-box>
        <strong>先猜：</strong>
        <span>如果 CMP 寫入晚於本週期 PWM load deadline，新 duty 何時生效？</span>
        <button type="button" data-timing-predict="same">同一週期</button>
        <button type="button" data-timing-predict="next">下一週期</button>
        <button class="power-action" type="button" data-timing-inject>注入重 ISR</button>
        <small data-timing-predict-status>先鎖定答案，再注入重運算。</small>
      </div>

      <div class="power-control-grid">
        <label>
          <span><b>SOC / sample phase</b><output data-timing-sample-readout>2.5 µs</output></span>
          <input data-timing-sample type="range" min="0.5" max="8.0" step="0.1" value="2.5">
          <small>相對於 10 µs PWM period 的取樣位置。</small>
        </label>
        <label>
          <span><b>Control compute</b><output data-timing-compute-readout>1.2 µs</output></span>
          <input data-timing-compute type="range" min="0.2" max="12" step="0.1" value="1.2">
          <small>ISR/CLA 內 controller + limiter + command preparation。</small>
        </label>
      </div>

      <div class="timing-cycle">
        <div class="timing-cycle-head"><b>One PWM period</b><span>Ts = 10.0 µs</span></div>
        <div class="timing-track" data-timing-track>
          <i class="timing-deadline" style="left:100%"></i>
          <span class="timing-event" data-event="soc"><b>SOC / S&H</b><small></small></span>
          <span class="timing-event" data-event="eoc"><b>EOC</b><small></small></span>
          <span class="timing-event" data-event="isr"><b>ISR</b><small></small></span>
          <span class="timing-event" data-event="write"><b>CMP write</b><small></small></span>
        </div>
        <div class="timing-scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10 µs · LOAD</span></div>
      </div>

      <div class="power-metric-grid">
        <div><span>ADC chain</span><strong data-timing-adc>0.70 µs</strong></div>
        <div><span>CMP write</span><strong data-timing-write>4.75 µs</strong></div>
        <div data-timing-deadline-card><span>Deadline</span><strong data-timing-deadline>PASS</strong></div>
        <div><span>Sample → Actuate</span><strong data-timing-actuate>7.50 µs</strong></div>
      </div>

      <div class="power-causal">
        <span>CAUSAL TIMELINE</span>
        <div><b>PWM SOC</b><i>→</i><b>S/H aperture</b><i>→</i><b>EOC</b><i>→</i><b>ADCINT</b><i>→</i><b>C(z)</b><i>→</i><b>CMP write</b><i>→</i><b>shadow load</b></div>
        <p data-timing-summary></p>
      </div>

      <div class="power-code-grid">
        <div><span>C code says</span><code>EPwm.CMPA = duty_cmd;</code></div>
        <div><span>Hardware truth says</span><code data-timing-hardware>effective duty changes at next LOAD event</code></div>
        <div><span>Discrete-time view</span><code data-timing-z>delay ≈ 0.75 Ts</code></div>
      </div>
      <p class="power-boundary"><b>模型邊界：</b>固定 100 kHz、single-rate loop、ADC acquisition 0.25 µs、conversion 0.45 µs、interrupt entry 0.35 µs。真正器件請用 TRM / timing measurement 取代這些 teaching numbers。</p>`
    );
  }

  function controlMarkup() {
    return stageShell(3, "STAGE 4 · FEEDBACK", "PI：讓 firmware belief 去推動真實 plant",
      "同一台 Buck 現在關閉手動 Duty，改成 Vref → error → PI → duty；若 Stage 2 的 sensing 有偏差，PI 會很認真地把真實輸出控制錯。",
      `<div class="power-predict">
        <strong>先猜：</strong>
        <span>閉迴路穩定後，如果 ADC 突然 +100 count，physical Vout 會？</span>
        <button type="button" data-loop-predict="up">升高</button>
        <button type="button" data-loop-predict="down">降低</button>
        <button type="button" data-loop-predict="same">不變</button>
        <button class="power-action" type="button" data-loop-inject>注入 +100 count</button>
        <small data-loop-predict-status>PI 控的是 measurement，不是宇宙真相。</small>
      </div>

      <div class="power-control-grid three">
        <label>
          <span><b>Vref step</b><output data-loop-ref-readout>30.0 V</output></span>
          <input data-loop-ref type="range" min="12" max="40" step="0.5" value="30">
        </label>
        <label>
          <span><b>Kp</b><output data-loop-kp-readout>0.40</output></span>
          <input data-loop-kp type="range" min="0" max="2.0" step="0.02" value="0.40">
          <small>normalized duty / normalized error</small>
        </label>
        <label>
          <span><b>Ki</b><output data-loop-ki-readout>120 /s</output></span>
          <input data-loop-ki type="range" min="0" max="800" step="10" value="120">
        </label>
      </div>

      <div class="loop-blocks">
        <div><span>r</span><b data-loop-r>30.0 V</b></div><i>− ŷ →</i>
        <div><span>e</span><b>Error</b></div><i>→</i>
        <div><span>C(z)</span><b>PI</b></div><i>→</i>
        <div><span>u</span><b>Duty</b></div><i>→</i>
        <div><span>P</span><b>Buck</b></div><i>→</i>
        <div><span>y</span><b>Vout</b></div>
      </div>

      <div class="loop-chart-card">
        <div class="power-chart-head"><b>Step response · 0 → 30 ms</b><span>step at 5 ms</span></div>
        <svg class="power-chart" viewBox="0 0 520 190" role="img" aria-label="PI closed-loop step response">
          <path class="chart-grid" d="M0 38 H520 M0 76 H520 M0 114 H520 M0 152 H520"/>
          <path data-loop-ref-path class="chart-line chart-ref" d=""></path>
          <path data-loop-physical-path class="chart-line chart-physical" d=""></path>
          <path data-loop-measured-path class="chart-line chart-measured" d=""></path>
        </svg>
        <div class="chart-legend"><span class="legend-ref">Vref</span><span class="legend-physical">Physical Vout</span><span class="legend-measured">Measured / firmware</span></div>
      </div>

      <div class="power-metric-grid">
        <div><span>Final physical</span><strong data-loop-final>—</strong></div>
        <div><span>Firmware sees</span><strong data-loop-final-meas>—</strong></div>
        <div><span>Final duty</span><strong data-loop-duty>—</strong></div>
        <div><span>Overshoot</span><strong data-loop-overshoot>—</strong></div>
      </div>

      <div class="power-code-grid">
        <div><span>Sample</span><code>vfb = adc_to_volts(ADCRESULT);</code></div>
        <div><span>Error</span><code>e = (vref - vfb) / VIN_NOM;</code></div>
        <div><span>PI</span><code>u = clamp(Kp*e + integrator, 0, 0.90);</code></div>
      </div>
      <p class="power-boundary"><b>模型邊界：</b>Stage 4 用一階 plant 教 feedback 因果，不拿它冒充 Buck 的完整 LC dynamics；Stage 5 才把 resonance、pole/zero 與 delay 加回。</p>`
    );
  }

  function dynamicsMarkup() {
    return stageShell(4, "STAGE 5 · DYNAMICS / SFRA", "同一個 loop，改用頻率鏡頭看",
      "先把『某個頻率的正弦擾動』想成一次實驗，再把很多個頻率排成 Bode；digital delay 主要先吃掉 phase。",
      `<div class="power-predict">
        <strong>先猜：</strong>
        <span>plant magnitude 幾乎不變，但額外增加 5 µs digital delay，phase margin 會？</span>
        <button type="button" data-bode-predict="up">增加</button>
        <button type="button" data-bode-predict="down">減少</button>
        <button type="button" data-bode-predict="same">不變</button>
        <button class="power-action" type="button" data-bode-inject>+5 µs delay</button>
        <small data-bode-predict-status>純 delay 的 signature 是 magnitude 近似不變、phase 更落後。</small>
      </div>

      <div class="power-control-grid">
        <label>
          <span><b>Digital delay</b><output data-bode-delay-readout>7.5 µs</output></span>
          <input data-bode-delay type="range" min="0" max="25" step="0.5" value="7.5">
          <small>包含 sample age、compute 與 PWM load 等效延遲。</small>
        </label>
        <label>
          <span><b>SFRA probe frequency</b><output data-bode-probe-readout>1.0 kHz</output></span>
          <input data-bode-probe type="range" min="0" max="100" step="1" value="50">
          <small>100 Hz → 50 kHz logarithmic sweep。</small>
        </label>
      </div>

      <div class="bode-probe">
        <div><span>Injection</span><b>small sine</b></div><i>→</i>
        <div><span>C(z)</span><b>PI</b></div><i>→</i>
        <div><span>P(s)</span><b>Buck LC</b></div><i>→</i>
        <div><span>Response</span><b>gain / phase</b></div>
      </div>

      <div class="bode-grid">
        <article>
          <div class="power-chart-head"><b>Loop magnitude</b><span>0 dB = crossover</span></div>
          <svg class="power-chart" viewBox="0 0 520 170"><path class="chart-grid" d="M0 42 H520 M0 85 H520 M0 128 H520"/><path data-bode-mag-path class="chart-line chart-mag" d=""></path><line data-bode-mag-probe class="chart-probe" x1="0" x2="0" y1="0" y2="170"/></svg>
        </article>
        <article>
          <div class="power-chart-head"><b>Loop phase</b><span>delay → −360 f Td</span></div>
          <svg class="power-chart" viewBox="0 0 520 170"><path class="chart-grid" d="M0 42 H520 M0 85 H520 M0 128 H520"/><path data-bode-phase-path class="chart-line chart-phase" d=""></path><line data-bode-phase-probe class="chart-probe" x1="0" x2="0" y1="0" y2="170"/></svg>
        </article>
      </div>

      <div class="power-metric-grid">
        <div><span>Probe gain</span><strong data-bode-probe-gain>—</strong></div>
        <div><span>Probe phase</span><strong data-bode-probe-phase>—</strong></div>
        <div><span>Nearest crossover</span><strong data-bode-cross>—</strong></div>
        <div><span>Phase margin</span><strong data-bode-pm>—</strong></div>
      </div>

      <div class="sfra-diagnosis" data-sfra-diagnosis>
        <span>SFRA DEBUG SIGNATURE</span>
        <strong>Magnitude 接近模型、phase 額外往下掉 → 先查 timing / delay。</strong>
        <p data-sfra-summary></p>
      </div>

      <div class="power-causal">
        <span>CONTROL LANGUAGE</span>
        <div><b>differential equation</b><i>→</i><b>G(s)</b><i>→</i><b>Bode</b><i>→</i><b>C(z)</b><i>→</i><b>code</b><i>→</i><b>SFRA</b></div>
      </div>
      <p class="power-boundary"><b>模型邊界：</b>Buck duty-to-output 使用 CCM small-signal teaching model，含 LC 與 ESR zero；PI 是教學補償器。若 loop 在 LC resonance 附近出現多重 crossover，畫面會直接視為設計警訊，而不是硬算一個漂亮 PM。</p>`
    );
  }

  const TOPOLOGIES = [
    { id:"buck", name:"Buck", u:"Duty", y:"Vout", plant:"LC double pole + ESR zero", threat:"LC resonance / digital delay", c2000:"CMPA / duty", response:"mono" },
    { id:"boost", name:"Boost", u:"Duty", y:"Vout", plant:"LC + RHP zero", threat:"RHP zero limits bandwidth", c2000:"CMPA / duty", response:"rhp" },
    { id:"pfc", name:"PFC", u:"Current command + duty", y:"IL + Vbus", plant:"inner current + outer voltage", threat:"2ω ripple / line feed-forward", c2000:"current loop PWM", response:"ripple" },
    { id:"psfb", name:"PSFB", u:"Phase shift", y:"Vout / Iout", plant:"LC + commutation", threat:"duty loss / ZVS boundary", c2000:"phase compare", response:"deadzone" },
    { id:"llc", name:"LLC", u:"Switching frequency", y:"Vout", plant:"resonant gain vs operating point", threat:"gain slope changes sign / mode", c2000:"TBPRD / frequency", response:"resonant" },
    { id:"inverter", name:"Inverter", u:"Modulation / current cmd", y:"Vac / Iac", plant:"LC/LCL + grid", threat:"PLL / grid impedance interaction", c2000:"SPWM / SVPWM", response:"sine" }
  ];

  function topologyMarkup() {
    return stageShell(5, "STAGE 6 · TOPOLOGY PERSONALITY", "同一個控制骨架，只替換 plant personality",
      "每換一個拓撲，不准先問 Kp/Ki；先固定問 u 是什麼、y 是什麼、P(s) 有什麼麻煩、actuator 在 C2000 寫哪裡。",
      `<div class="topology-tabs">
        ${TOPOLOGIES.map((t, i) => `<button type="button" data-topology="${t.id}" class="${i === 0 ? "is-selected" : ""}">${t.name}</button>`).join("")}
      </div>

      <div class="topology-core">
        <div><span>Reference</span><b>r</b></div><i>→</i>
        <div><span>Controller</span><b>C(z)</b></div><i>→</i>
        <div class="topology-variable"><span>Actuator u</span><b data-topology-u>Duty</b></div><i>→</i>
        <div class="topology-variable"><span>Plant P(s)</span><b data-topology-plant>LC double pole + ESR zero</b></div><i>→</i>
        <div class="topology-variable"><span>Output y</span><b data-topology-y>Vout</b></div>
      </div>

      <div class="topology-detail-grid">
        <article>
          <span>CONTROL VARIABLE</span>
          <strong data-topology-u-card>Duty</strong>
          <p>真正能被 firmware 改變的硬體 knob。</p>
        </article>
        <article>
          <span>BANDWIDTH THREAT</span>
          <strong data-topology-threat>LC resonance / digital delay</strong>
          <p>決定「不能把 bandwidth 無限往上推」的原因。</p>
        </article>
        <article>
          <span>C2000 ACTUATOR</span>
          <strong data-topology-c2000>CMPA / duty</strong>
          <p>最後一定要落到 register / shadow-load semantics。</p>
        </article>
      </div>

      <div class="topology-response">
        <div class="power-chart-head"><b data-topology-response-title>Buck · +u small step</b><span>normalized teaching response</span></div>
        <svg class="power-chart" viewBox="0 0 520 160"><path class="chart-grid" d="M0 40 H520 M0 80 H520 M0 120 H520"/><path data-topology-response class="chart-line chart-topology" d=""></path></svg>
        <p data-topology-explain></p>
      </div>

      <div class="power-predict" data-boost-predict-box>
        <strong>Transfer challenge：</strong>
        <span>Boost 在 CCM 中 Duty 突然增加，Vout 的最初瞬間可能先？</span>
        <button type="button" data-boost-predict="up">上升</button>
        <button type="button" data-boost-predict="down">下降</button>
        <small data-boost-status>RHP zero 來自「先把更多能量留在電感，再晚一點送到輸出」。</small>
      </div>
      <p class="power-boundary"><b>核心規則：</b>same skeleton ≠ same PI。Buck、Boost、PFC、PSFB、LLC、Inverter 可以共用 debug grammar，但 actuator、plant、operating point 與 bandwidth boundary 必須重新辨識。</p>`
    );
  }

  function protectionMarkup() {
    return stageShell(6, "STAGE 7 · SAFETY / STATE", "Protection 不是普通 control block，而是 PWM 的 veto plane",
      "Command 可以還想輸出 60% duty，但 hardware fault path 必須能在 CPU 還沒反應前直接把 PWM 拉到安全狀態。",
      `<div class="power-predict">
        <strong>先猜：</strong>
        <span>OCP 突然發生，哪條路徑應該先把 PWM 關掉？</span>
        <button type="button" data-protect-predict="hw">CMPSS → Trip Zone</button>
        <button type="button" data-protect-predict="sw">ADC → ISR → if()</button>
        <button class="power-action danger" type="button" data-protect-inject>Inject OCP</button>
        <small data-protect-predict-status>Safety path 要最短、可證明、fail-closed。</small>
      </div>

      <div class="protection-command">
        <div><span>Controller command</span><strong data-protect-command>50% duty</strong></div>
        <div class="protection-veto"><span>SAFETY VETO</span><strong data-protect-veto>ALLOW</strong></div>
        <div><span>Physical PWM</span><strong data-protect-physical>50% duty</strong></div>
      </div>

      <div class="power-control-grid">
        <label>
          <span><b>CMPSS digital filter</b><output data-protect-filter-readout>3 samples</output></span>
          <input data-protect-filter type="range" min="1" max="12" step="1" value="3">
          <small>濾波越重，false trip 越少，但 fault → trip latency 越長。</small>
        </label>
        <label>
          <span><b>Fault current</b><output data-protect-current-readout>18 A</output></span>
          <input data-protect-current type="range" min="8" max="30" step="1" value="18">
          <small>OCP threshold = 12 A。</small>
        </label>
      </div>

      <div class="protection-race">
        <div class="race-path hardware">
          <span>HARDWARE PATH</span>
          <b>Comparator → filter → Trip Zone → PWM OFF</b>
          <strong data-protect-hw-time>0.35 µs</strong>
        </div>
        <div class="race-path software">
          <span>SOFTWARE PATH</span>
          <b>ADC sample → EOC → ISR → decision → PWM load</b>
          <strong data-protect-sw-time>7.50 µs+</strong>
        </div>
      </div>

      <div class="protection-state" data-protection-state>
        <div><span>RUN</span></div><i>fault →</i><div><span>FAULT_LATCHED</span></div><i>qualified clear →</i><div><span>RE-ARM</span></div>
      </div>

      <div class="protection-actions">
        <button type="button" data-protect-clear>Clear latch</button>
        <button type="button" data-protect-safe-current>Drop current below threshold</button>
        <small data-protect-status>System is RUN.</small>
      </div>

      <div class="power-causal">
        <span>SAFETY QUESTIONS</span>
        <div><b>detect how fast?</b><i>→</i><b>remove energy how fast?</b><i>→</i><b>what state after?</b><i>→</i><b>who may re-enable?</b></div>
      </div>
      <p class="power-boundary"><b>模型邊界：</b>latency 是 teaching budget，不代表特定 CMPSS/TZ 器件規格；實機要以 datasheet/TRM、scope fault injection 與 gate waveform 證明。</p>`
    );
  }

  const DEBUG_SCENARIOS = [
    {
      id: "sense",
      symptom: "Physical Vout 比設定值低約 1 V，但 telemetry 顯示剛好 24 V。",
      root: "Sensing offset / gain",
      explanation: "Controller 已把錯誤 measurement 調到 24 V；physical truth 因 measurement bias 被拉低。",
      evidence: {
        scope: "Scope：physical Vout = 22.9 V → 先確認 plant truth 與 telemetry 分裂。",
        adc: "ADC count 對應約 24.0 V，但 divider pin 只對應 22.9 V → sensing chain 有 bias。",
        pwm: "PWM duty 穩定且閉迴路有反應 → actuator 不是第一嫌疑。",
        timing: "SOC / ISR / LOAD 都在 deadline 內 → timing 不是主要 root cause。",
        trip: "Trip flag clear → protection 沒有 veto。",
        host: "Vref command = 24.0 V 且 age 正常 → command path 正常。"
      },
      best: ["scope", "adc"]
    },
    {
      id: "timing",
      symptom: "同一組 PI 在 code 變重後開始 oscillate；DC gain 幾乎沒變，SFRA phase 明顯變差。",
      root: "Missed PWM load / extra digital delay",
      explanation: "計算完成太晚，多一個 sample-to-actuate cycle；magnitude 可接近原模型，但 phase 被延遲吃掉。",
      evidence: {
        scope: "Vout oscillation 存在，但只看 output 還分不出 plant resonance 或 digital delay。",
        adc: "ADC scaling 正常、count 與 scope 一致 → sensing 可降權。",
        pwm: "PWM command 會更新，但實際 edge 晚一拍 → actuator timing 可疑。",
        timing: "GPIO timestamp：CMP write 晚於 shadow load，實際 +1 cycle → 高資訊量。",
        trip: "Trip flag clear → protection 沒介入。",
        host: "Reference 沒變、command age 正常。"
      },
      best: ["timing", "pwm"]
    },
    {
      id: "protect",
      symptom: "Command 與 PI 都要求輸出，但 gate PWM 完全為 0；重新寫 CMPA 也沒用。",
      root: "Protection latch / Trip Zone",
      explanation: "Control command 存在，但 safety plane 正在 veto PWM；一直改 PI 不會讓 gate 恢復。",
      evidence: {
        scope: "Gate PWM = 0，先證明 physical actuator 沒輸出。",
        adc: "Vout/feedback 很低只是結果，不是 root cause。",
        pwm: "CMPA command 非零但 pin 仍低 → command 與 physical actuator 分裂。",
        timing: "CMP write timing 正常 → 不是 missed load。",
        trip: "TZ/CMPSS latch = SET → 直接命中 safety root cause。",
        host: "Host enable 與 Vref 都有效。"
      },
      best: ["pwm", "trip"]
    },
    {
      id: "data",
      symptom: "Host 已改 Vref，但 converter 長時間仍跑舊設定；local control loop 看起來很穩。",
      root: "Stale command / DMA data ownership",
      explanation: "Plant、sensing、PI 都可能完全正常；錯的是 controller 正在追一個 stale reference。",
      evidence: {
        scope: "Physical Vout 很穩，只能證明 local loop 正常。",
        adc: "ADC 與 scope 一致 → sensing 正常。",
        pwm: "PWM duty 穩定且符合舊 Vref。",
        timing: "Control ISR deadline 正常。",
        trip: "Trip clear。",
        host: "Host packet = new Vref，但 control-owned shadow still old / age stale → data ownership root cause。"
      },
      best: ["host"]
    }
  ];

  function capstoneMarkup() {
    const measurementButtons = [
      ["scope", "Scope physical Vout"],
      ["adc", "ADC count / AFE pin"],
      ["pwm", "PWM command vs pin"],
      ["timing", "SOC / ISR / LOAD timestamps"],
      ["trip", "CMPSS / Trip flags"],
      ["host", "Host command + age"]
    ];
    return stageShell(7, "STAGE 8 · CAPSTONE DEBUG", "Unknown system：下一個 measurement 要最大化資訊量",
      "最後不再告訴你是哪一層壞了。症狀只是一個 output；你的工作是用 measurement 一層層把 sensing、timing、control、safety、data ownership 證偽。",
      `<div class="debug-case-head">
        <div>
          <span>UNKNOWN FAULT</span>
          <strong data-debug-symptom></strong>
        </div>
        <button type="button" data-debug-new>下一個 fault</button>
      </div>

      <div class="debug-hypotheses">
        <span>HYPOTHESIS SPACE</span>
        <div>
          <b data-hypothesis="sense">Sensing</b>
          <b data-hypothesis="timing">Timing</b>
          <b data-hypothesis="control">Control/Plant</b>
          <b data-hypothesis="protect">Protection</b>
          <b data-hypothesis="data">Data ownership</b>
        </div>
      </div>

      <div class="debug-measurements">
        <strong>你下一個要量什麼？</strong>
        <div>${measurementButtons.map(([id, label]) => `<button type="button" data-debug-measure="${id}">${label}</button>`).join("")}</div>
      </div>

      <div class="debug-evidence" data-debug-evidence>
        <span>EVIDENCE LOG</span>
        <p>尚未量測。先選一個能切開最多 hypothesis 的 observation。</p>
      </div>

      <div class="debug-score">
        <div><span>Measurements</span><strong data-debug-count>0</strong></div>
        <div><span>Information quality</span><strong data-debug-quality>—</strong></div>
        <button type="button" data-debug-reveal>Reveal root cause</button>
      </div>

      <div class="debug-root" data-debug-root hidden>
        <span>ROOT CAUSE</span>
        <strong></strong>
        <p></p>
      </div>

      <div class="debug-checklist">
        <span>TRANSFER CHECKLIST · 遇到 DAB / Totem-pole / bidirectional buck-boost 也照問</span>
        <ol>
          <li>能量怎麼流？</li>
          <li>u 是什麼、y 是什麼？</li>
          <li>y 怎麼變成 MCU 看見的數？</li>
          <li>何時 sample、何時 actuate？</li>
          <li>P(s) 有什麼 pole / zero / resonance？</li>
          <li>Fault 怎麼最快停止能量？</li>
          <li>下一個 measurement 哪個資訊量最大？</li>
        </ol>
      </div>`
    );
  }

  function markup() {
    return `<div class="power-system-live" data-power-system-live>
      ${timingMarkup()}
      ${controlMarkup()}
      ${dynamicsMarkup()}
      ${topologyMarkup()}
      ${protectionMarkup()}
      ${capstoneMarkup()}
    </div>`;
  }

  function setText(scope, selector, value) {
    const node = scope.querySelector(selector);
    if (node) node.textContent = value;
  }

  function bindTiming(root, panel, api) {
    const sample = panel.querySelector("[data-timing-sample]");
    const compute = panel.querySelector("[data-timing-compute]");
    const inject = panel.querySelector("[data-timing-inject]");
    const status = panel.querySelector("[data-timing-predict-status]");
    const predictionButtons = Array.from(panel.querySelectorAll("[data-timing-predict]"));
    let prediction = null;

    function state() {
      const periodUs = 10;
      const sampleUs = Number(sample.value);
      const acquisition = 0.25;
      const conversion = 0.45;
      const irq = 0.35;
      const eoc = sampleUs + acquisition + conversion;
      const isr = eoc + irq;
      const write = isr + Number(compute.value);
      const missed = write > periodUs;
      const apply = missed ? periodUs * Math.ceil(write / periodUs) : periodUs;
      const actuation = apply - sampleUs;
      return { periodUs, sampleUs, acquisition, conversion, irq, eoc, isr, write, missed, apply, actuation };
    }

    function render() {
      const s = state();
      setText(panel, "[data-timing-sample-readout]", `${fmt(s.sampleUs, 1)} µs`);
      setText(panel, "[data-timing-compute-readout]", `${fmt(compute.value, 1)} µs`);
      setText(panel, "[data-timing-adc]", `${fmt(s.acquisition + s.conversion, 2)} µs`);
      setText(panel, "[data-timing-write]", `${fmt(s.write, 2)} µs`);
      setText(panel, "[data-timing-deadline]", s.missed ? "MISS → +1 cycle" : "PASS");
      setText(panel, "[data-timing-actuate]", `${fmt(s.actuation, 2)} µs`);
      setText(panel, "[data-timing-hardware]", s.missed ? `write at ${fmt(s.write)} µs; effective at ${fmt(s.apply)} µs` : `write at ${fmt(s.write)} µs; effective at 10.00 µs LOAD`);
      setText(panel, "[data-timing-z]", `equivalent sample→actuate delay ≈ ${fmt(s.actuation / s.periodUs, 2)} Ts`);
      setText(panel, "[data-timing-summary]", s.missed
        ? `CMP write = ${fmt(s.write)} µs，已越過 10 µs load point；controller 算完了，但 plant 要到 ${fmt(s.apply)} µs 才看到新 duty。`
        : `CMP write = ${fmt(s.write)} µs，在 deadline 前完成；sample at ${fmt(s.sampleUs)} µs → duty effective at 10.00 µs。`);

      const deadlineCard = panel.querySelector("[data-timing-deadline-card]");
      if (deadlineCard) deadlineCard.classList.toggle("is-fault", s.missed);
      const events = [
        ["soc", s.sampleUs], ["eoc", s.eoc], ["isr", s.isr], ["write", s.write]
      ];
      events.forEach(([id, time]) => {
        const node = panel.querySelector(`[data-event="${id}"]`);
        if (!node) return;
        node.style.left = `${clamp(time / s.periodUs * 100, 0, 100)}%`;
        const small = node.querySelector("small");
        if (small) small.textContent = `${fmt(time, 2)} µs`;
        node.classList.toggle("is-late", time > s.periodUs);
      });
      api.timing = s;
      const bodeDelay = root.querySelector("[data-bode-delay]");
      if (bodeDelay && !bodeDelay.matches(":active")) {
        bodeDelay.value = String(clamp(s.actuation, 0, 25));
        bodeDelay.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    predictionButtons.forEach(button => button.addEventListener("click", () => {
      prediction = button.dataset.timingPredict;
      predictionButtons.forEach(x => x.classList.toggle("is-selected", x === button));
      status.textContent = "Prediction 已鎖定；按『注入重 ISR』。";
    }));
    inject.addEventListener("click", () => {
      compute.value = "8.8";
      render();
      const actual = state().missed ? "next" : "same";
      status.textContent = `${prediction ? (prediction === actual ? "✓" : "✕") : "觀察"} CMP write 越過 load point → new duty 下一個可用 LOAD 才生效。`;
      status.classList.toggle("is-pass", prediction === actual);
      status.classList.toggle("is-fail", !!prediction && prediction !== actual);
    });
    sample.addEventListener("input", render);
    compute.addEventListener("input", render);
    render();
    return { render, state };
  }

  function bindControl(root, panel, api) {
    const ref = panel.querySelector("[data-loop-ref]");
    const kp = panel.querySelector("[data-loop-kp]");
    const ki = panel.querySelector("[data-loop-ki]");
    const inject = panel.querySelector("[data-loop-inject]");
    const status = panel.querySelector("[data-loop-predict-status]");
    const predictionButtons = Array.from(panel.querySelectorAll("[data-loop-predict]"));
    let prediction = null;
    let internalFaultInjection = false;

    function simulate() {
      const initialDuty = sharedDuty(root) / 100;
      const initialVout = MODEL.vin * initialDuty;
      const target = Number(ref.value);
      const Kp = Number(kp.value);
      const Ki = Number(ki.value);
      const sensing = sensingParams(root);
      const steps = 3000;
      const stepIndex = 500;
      const tau = 1.2e-3;
      const delayCycles = api.timing && api.timing.missed ? 1 : 0;
      const queue = Array.from({ length: delayCycles + 1 }, () => initialDuty);
      let y = initialVout;
      let integrator = initialDuty;
      let duty = initialDuty;
      const phys = [];
      const meas = [];
      const refs = [];
      const duties = [];

      for (let k = 0; k < steps; k += 1) {
        const currentRef = k < stepIndex ? initialVout : target;
        const measured = measureVout(y, sensing.gainError, sensing.offsetCounts).firmwareVout;
        const eNorm = (currentRef - measured) / MODEL.vin;
        const nextI = integrator + Ki * eNorm * MODEL.ts;
        const raw = Kp * eNorm + nextI;
        const cmd = clamp(raw, 0.02, 0.90);
        if ((raw >= 0.02 && raw <= 0.90) || (raw > 0.90 && eNorm < 0) || (raw < 0.02 && eNorm > 0)) integrator = nextI;
        queue.push(cmd);
        duty = queue.shift();
        y += MODEL.ts / tau * (MODEL.vin * duty - y);

        if (k % 12 === 0) {
          phys.push(y);
          meas.push(measured);
          refs.push(currentRef);
          duties.push(duty);
        }
      }

      const finalPhysical = phys[phys.length - 1];
      const finalMeasured = measureVout(finalPhysical, sensing.gainError, sensing.offsetCounts).firmwareVout;
      const maxAfter = Math.max(...phys.slice(Math.floor(stepIndex / 12)));
      const overshoot = target > 0 ? Math.max(0, (maxAfter - target) / target * 100) : 0;
      return { initialVout, target, Kp, Ki, phys, meas, refs, duties, finalPhysical, finalMeasured, finalDuty: duties[duties.length - 1], overshoot };
    }

    function render() {
      const s = simulate();
      const maxV = Math.max(48, s.target * 1.25, ...s.phys, ...s.meas);
      setText(panel, "[data-loop-ref-readout]", `${fmt(s.target, 1)} V`);
      setText(panel, "[data-loop-kp-readout]", fmt(s.Kp, 2));
      setText(panel, "[data-loop-ki-readout]", `${Math.round(s.Ki)} /s`);
      setText(panel, "[data-loop-r]", `${fmt(s.target, 1)} V`);
      setText(panel, "[data-loop-final]", `${fmt(s.finalPhysical)} V`);
      setText(panel, "[data-loop-final-meas]", `${fmt(s.finalMeasured)} V`);
      setText(panel, "[data-loop-duty]", `${fmt(s.finalDuty * 100, 1)}%`);
      setText(panel, "[data-loop-overshoot]", `${fmt(s.overshoot, 1)}%`);
      const refPath = panel.querySelector("[data-loop-ref-path]");
      const physPath = panel.querySelector("[data-loop-physical-path]");
      const measPath = panel.querySelector("[data-loop-measured-path]");
      if (refPath) refPath.setAttribute("d", linePath(s.refs, 520, 190, 0, maxV));
      if (physPath) physPath.setAttribute("d", linePath(s.phys, 520, 190, 0, maxV));
      if (measPath) measPath.setAttribute("d", linePath(s.meas, 520, 190, 0, maxV));
      api.loop = s;
    }

    predictionButtons.forEach(button => button.addEventListener("click", () => {
      prediction = button.dataset.loopPredict;
      predictionButtons.forEach(x => x.classList.toggle("is-selected", x === button));
      status.textContent = "Prediction 已鎖定；按『注入 +100 count』。";
    }));
    inject.addEventListener("click", () => {
      const offset = root.querySelector("[data-offset-counts]");
      if (offset) {
        offset.value = "100";
        internalFaultInjection = true;
        offset.dispatchEvent(new Event("input", { bubbles: true }));
        internalFaultInjection = false;
      }
      render();
      const initialTarget = Number(ref.value);
      const actual = api.loop.finalPhysical < initialTarget - 0.2 ? "down" : api.loop.finalPhysical > initialTarget + 0.2 ? "up" : "same";
      status.textContent = `${prediction ? (prediction === actual ? "✓" : "✕") : "觀察"} firmware measurement 偏高後，PI 降低 duty；physical steady-state 被拉到 ${fmt(api.loop.finalPhysical)} V。`;
      status.classList.toggle("is-pass", prediction === actual);
      status.classList.toggle("is-fail", !!prediction && prediction !== actual);
    });
    [ref, kp, ki].forEach(node => node.addEventListener("input", render));
    ["[data-gain-error]", "[data-offset-counts]", "[data-buck-slider]"].forEach(selector => {
      const node = root.querySelector(selector);
      if (node) node.addEventListener("input", () => { if (!internalFaultInjection) render(); });
    });
    render();
    return { render, simulate };
  }

  function buckLoopPoint(freq, delayUs, kp, ki) {
    const w = 2 * Math.PI * freq;
    const s = complex(0, w);
    const numPlant = cadd(complex(1, 0), complex(0, w * MODEL.esr * MODEL.capacitance));
    const denPlant = cadd(
      cadd(complex(1, 0), complex(0, w * MODEL.inductance / MODEL.load)),
      complex(-w * w * MODEL.inductance * MODEL.capacitance, 0)
    );
    const plant = cdiv(numPlant, denPlant);
    const controller = complex(kp, -ki / Math.max(w, 1e-9));
    const theta = -w * delayUs * 1e-6;
    const delay = complex(Math.cos(theta), Math.sin(theta));
    const loop = cmul(cmul(controller, plant), delay);
    return { magDb: 20 * Math.log10(Math.max(cabs(loop), 1e-12)), phase: cphase(loop) };
  }

  function unwrap(phases) {
    const out = [];
    phases.forEach((p, i) => {
      let v = p;
      if (i) {
        while (v - out[i - 1] > 180) v -= 360;
        while (v - out[i - 1] < -180) v += 360;
      }
      out.push(v);
    });
    return out;
  }

  function bindDynamics(root, panel, api) {
    const delay = panel.querySelector("[data-bode-delay]");
    const probe = panel.querySelector("[data-bode-probe]");
    const inject = panel.querySelector("[data-bode-inject]");
    const status = panel.querySelector("[data-bode-predict-status]");
    const predictionButtons = Array.from(panel.querySelectorAll("[data-bode-predict]"));
    const freqs = logspace(2, Math.log10(50000), 160);
    let prediction = null;

    function controllerGains() {
      const kpNode = root.querySelector("[data-loop-kp]");
      const kiNode = root.querySelector("[data-loop-ki]");
      return { kp: Number(kpNode ? kpNode.value : 0.4), ki: Number(kiNode ? kiNode.value : 120) };
    }

    function render() {
      const d = Number(delay.value);
      const gains = controllerGains();
      const points = freqs.map(f => buckLoopPoint(f, d, gains.kp, gains.ki));
      const phases = unwrap(points.map(p => p.phase));
      const mags = points.map(p => p.magDb);
      const probeNorm = Number(probe.value) / 100;
      const probeFreq = 100 * Math.pow(500, probeNorm);
      const probePoint = buckLoopPoint(probeFreq, d, gains.kp, gains.ki);
      let probePhase = probePoint.phase;
      while (probePhase > 0) probePhase -= 360;

      let crossIndex = 0;
      let best = Infinity;
      mags.forEach((m, i) => {
        const score = Math.abs(m);
        if (score < best) { best = score; crossIndex = i; }
      });
      const crossingAmbiguous = best > 6;
      const crossFreq = freqs[crossIndex];
      const crossPhase = phases[crossIndex];
      const pm = 180 + crossPhase;

      setText(panel, "[data-bode-delay-readout]", `${fmt(d, 1)} µs`);
      setText(panel, "[data-bode-probe-readout]", probeFreq >= 1000 ? `${fmt(probeFreq / 1000, 2)} kHz` : `${Math.round(probeFreq)} Hz`);
      setText(panel, "[data-bode-probe-gain]", `${fmt(probePoint.magDb, 1)} dB`);
      setText(panel, "[data-bode-probe-phase]", `${fmt(probePhase, 1)}°`);
      setText(panel, "[data-bode-cross]", crossingAmbiguous ? "no clean 0 dB crossing" : `${fmt(crossFreq / 1000, 2)} kHz`);
      setText(panel, "[data-bode-pm]", crossingAmbiguous ? "—" : `${fmt(pm, 1)}°`);
      setText(panel, "[data-sfra-summary]", `At ${probeFreq >= 1000 ? fmt(probeFreq / 1000, 2) + " kHz" : Math.round(probeFreq) + " Hz"}，delay-only contribution ≈ ${fmt(-360 * probeFreq * d * 1e-6, 1)}°。若實測 magnitude 對、phase 差，先量 SOC/ISR/PWM-load latency。`);

      const magPath = panel.querySelector("[data-bode-mag-path]");
      const phasePath = panel.querySelector("[data-bode-phase-path]");
      if (magPath) magPath.setAttribute("d", linePath(mags, 520, 170, -50, 50));
      const phaseMin = Math.min(-90, ...phases) - 10;
      const phaseMax = Math.max(0, ...phases) + 10;
      if (phasePath) phasePath.setAttribute("d", linePath(phases, 520, 170, phaseMin, phaseMax));
      const x = probeNorm * 520;
      [panel.querySelector("[data-bode-mag-probe]"), panel.querySelector("[data-bode-phase-probe]")].forEach(line => {
        if (line) { line.setAttribute("x1", x); line.setAttribute("x2", x); }
      });
      api.bode = { d, gains, probeFreq, probePoint, crossFreq, pm, crossingAmbiguous };
    }

    predictionButtons.forEach(button => button.addEventListener("click", () => {
      prediction = button.dataset.bodePredict;
      predictionButtons.forEach(x => x.classList.toggle("is-selected", x === button));
      status.textContent = "Prediction 已鎖定；按『+5 µs delay』。";
    }));
    inject.addEventListener("click", () => {
      const before = api.bode && !api.bode.crossingAmbiguous ? api.bode.pm : null;
      delay.value = String(clamp(Number(delay.value) + 5, 0, 25));
      render();
      const after = api.bode && !api.bode.crossingAmbiguous ? api.bode.pm : null;
      const actual = before != null && after != null ? (after < before ? "down" : after > before ? "up" : "same") : "down";
      status.textContent = `${prediction ? (prediction === actual ? "✓" : "✕") : "觀察"} pure delay 不增加 plant energy gain，但會額外增加 phase lag。`;
      status.classList.toggle("is-pass", prediction === actual);
      status.classList.toggle("is-fail", !!prediction && prediction !== actual);
    });
    delay.addEventListener("input", render);
    probe.addEventListener("input", render);
    ["[data-loop-kp]", "[data-loop-ki]"].forEach(selector => {
      const node = root.querySelector(selector);
      if (node) node.addEventListener("input", render);
    });
    render();
    return { render };
  }

  function topologyResponse(type) {
    const n = 140;
    const arr = [];
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1) * 6;
      let y = 0;
      if (type === "mono") y = 1 - Math.exp(-t);
      if (type === "rhp") y = 1 - Math.exp(-t) - 0.48 * t * Math.exp(-2.8 * t);
      if (type === "ripple") y = (1 - Math.exp(-t)) + 0.12 * Math.sin(2 * Math.PI * t / 1.8);
      if (type === "deadzone") y = t < 0.8 ? 0 : 1 - Math.exp(-(t - 0.8));
      if (type === "resonant") y = 0.72 + 0.32 * Math.exp(-0.28 * t) * Math.sin(2.5 * t) + 0.28 * (1 - Math.exp(-t));
      if (type === "sine") y = 0.5 + 0.38 * Math.sin(2.2 * t) * (1 - Math.exp(-1.2 * t));
      arr.push(y);
    }
    return arr;
  }

  function bindTopology(panel, api) {
    const buttons = Array.from(panel.querySelectorAll("[data-topology]"));
    const boostButtons = Array.from(panel.querySelectorAll("[data-boost-predict]"));
    const boostStatus = panel.querySelector("[data-boost-status]");

    function select(id) {
      const top = TOPOLOGIES.find(x => x.id === id) || TOPOLOGIES[0];
      buttons.forEach(b => b.classList.toggle("is-selected", b.dataset.topology === top.id));
      setText(panel, "[data-topology-u]", top.u);
      setText(panel, "[data-topology-plant]", top.plant);
      setText(panel, "[data-topology-y]", top.y);
      setText(panel, "[data-topology-u-card]", top.u);
      setText(panel, "[data-topology-threat]", top.threat);
      setText(panel, "[data-topology-c2000]", top.c2000);
      setText(panel, "[data-topology-response-title]", `${top.name} · +u small step`);
      const path = panel.querySelector("[data-topology-response]");
      const values = topologyResponse(top.response);
      if (path) path.setAttribute("d", linePath(values, 520, 160, -0.2, 1.4));
      const explanations = {
        buck: "Buck：duty 增加通常先讓 switch-node average 上升，再由 LC 決定 transient。",
        boost: "Boost：RHP zero 讓『長期方向』與『最初瞬間』可能相反，因此 bandwidth 必須遠低於 RHP zero。",
        pfc: "PFC：不是只追 DC；current loop 同時承受 line waveform，outer voltage loop 又必須避開 2ω ripple。",
        psfb: "PSFB：phase shift 是命令，但 dead-time、commutation 與 ZVS boundary 會造成 effective duty loss。",
        llc: "LLC：控制 knob 是 switching frequency；gain 對 frequency/負載/輸入的斜率會隨 operating point 改變。",
        inverter: "Inverter：modulation command 進入 LC/LCL 與 grid；PLL / grid impedance 會成為額外 dynamics。"
      };
      setText(panel, "[data-topology-explain]", explanations[top.id]);
      api.topology = top;
    }

    buttons.forEach(button => button.addEventListener("click", () => select(button.dataset.topology)));
    boostButtons.forEach(button => button.addEventListener("click", () => {
      const answer = button.dataset.boostPredict;
      boostButtons.forEach(x => x.classList.toggle("is-selected", x === button));
      boostStatus.textContent = `${answer === "down" ? "✓" : "✕"} CCM Boost duty ↑ 的最初瞬間可先讓輸出能量下降；這就是 RHP zero 的非最小相位直覺。`;
      boostStatus.classList.toggle("is-pass", answer === "down");
      boostStatus.classList.toggle("is-fail", answer !== "down");
      select("boost");
    }));
    select("buck");
    return { select };
  }

  function bindProtection(root, panel, api) {
    const filter = panel.querySelector("[data-protect-filter]");
    const current = panel.querySelector("[data-protect-current]");
    const inject = panel.querySelector("[data-protect-inject]");
    const clear = panel.querySelector("[data-protect-clear]");
    const safeCurrent = panel.querySelector("[data-protect-safe-current]");
    const status = panel.querySelector("[data-protect-status]");
    const predictionStatus = panel.querySelector("[data-protect-predict-status]");
    const predictionButtons = Array.from(panel.querySelectorAll("[data-protect-predict]"));
    let prediction = null;
    let latched = false;

    function times() {
      const n = Number(filter.value);
      const hw = 0.10 + n * 0.08;
      const timing = api.timing || { actuation: 7.5 };
      const sw = Math.max(2.2, timing.actuation);
      return { hw, sw };
    }

    function render() {
      const t = times();
      const command = sharedDuty(root);
      const faultPresent = Number(current.value) >= 12;
      if (faultPresent && latched) {
        setText(panel, "[data-protect-veto]", "TRIP LATCHED");
        setText(panel, "[data-protect-physical]", "0% · FORCED SAFE");
      } else {
        setText(panel, "[data-protect-veto]", "ALLOW");
        setText(panel, "[data-protect-physical]", `${Math.round(command)}% duty`);
      }
      setText(panel, "[data-protect-command]", `${Math.round(command)}% duty`);
      setText(panel, "[data-protect-filter-readout]", `${Math.round(Number(filter.value))} samples`);
      setText(panel, "[data-protect-current-readout]", `${Math.round(Number(current.value))} A`);
      setText(panel, "[data-protect-hw-time]", `${fmt(t.hw, 2)} µs`);
      setText(panel, "[data-protect-sw-time]", `${fmt(t.sw, 2)} µs+`);
      panel.classList.toggle("is-tripped", latched);
    }

    predictionButtons.forEach(button => button.addEventListener("click", () => {
      prediction = button.dataset.protectPredict;
      predictionButtons.forEach(x => x.classList.toggle("is-selected", x === button));
      predictionStatus.textContent = "Prediction 已鎖定；Inject OCP。";
    }));

    inject.addEventListener("click", () => {
      if (Number(current.value) < 12) current.value = "18";
      latched = true;
      render();
      const t = times();
      predictionStatus.textContent = `${prediction ? (prediction === "hw" ? "✓" : "✕") : "觀察"} hardware trip ≈ ${fmt(t.hw)} µs；software path 至少 ${fmt(t.sw)} µs，且還受 scheduler / PWM load 影響。`;
      predictionStatus.classList.toggle("is-pass", prediction === "hw");
      predictionStatus.classList.toggle("is-fail", !!prediction && prediction !== "hw");
      status.textContent = "FAULT_LATCHED：即使 controller command 還存在，physical PWM 已被 safety veto。";
    });

    clear.addEventListener("click", () => {
      if (Number(current.value) >= 12) {
        status.textContent = "拒絕 re-arm：fault input 仍高於 12 A threshold。";
        return;
      }
      latched = false;
      status.textContent = "Latch cleared → RUN。重新使能前仍應走 qualified startup sequence。";
      render();
    });
    safeCurrent.addEventListener("click", () => {
      current.value = "8";
      status.textContent = latched ? "Fault source 已消失，但 latch 仍保留；現在才有資格 clear。" : "Current below threshold.";
      render();
    });
    filter.addEventListener("input", render);
    current.addEventListener("input", render);
    const buck = root.querySelector("[data-buck-slider]");
    if (buck) buck.addEventListener("input", render);
    render();
    return { render };
  }

  function bindCapstone(panel, api) {
    const symptom = panel.querySelector("[data-debug-symptom]");
    const evidence = panel.querySelector("[data-debug-evidence]");
    const count = panel.querySelector("[data-debug-count]");
    const quality = panel.querySelector("[data-debug-quality]");
    const rootCard = panel.querySelector("[data-debug-root]");
    const newButton = panel.querySelector("[data-debug-new]");
    const reveal = panel.querySelector("[data-debug-reveal]");
    const measureButtons = Array.from(panel.querySelectorAll("[data-debug-measure]"));
    let scenarioIndex = 0;
    let measured = [];

    function scenario() { return DEBUG_SCENARIOS[scenarioIndex % DEBUG_SCENARIOS.length]; }

    function renderHypotheses() {
      const s = scenario();
      panel.querySelectorAll("[data-hypothesis]").forEach(node => {
        const id = node.dataset.hypothesis;
        const mapped = s.id === "sense" ? "sense" : s.id === "timing" ? "timing" : s.id === "protect" ? "protect" : s.id === "data" ? "data" : "control";
        node.classList.toggle("is-hot", measured.some(m => s.best.includes(m)) && id === mapped);
        node.classList.toggle("is-dim", measured.some(m => s.best.includes(m)) && id !== mapped);
      });
    }

    function reset() {
      measured = [];
      const s = scenario();
      symptom.textContent = s.symptom;
      evidence.innerHTML = "<span>EVIDENCE LOG</span><p>尚未量測。先選一個能切開最多 hypothesis 的 observation。</p>";
      count.textContent = "0";
      quality.textContent = "—";
      rootCard.hidden = true;
      measureButtons.forEach(b => b.disabled = false);
      panel.querySelectorAll("[data-hypothesis]").forEach(n => n.classList.remove("is-hot", "is-dim"));
    }

    measureButtons.forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.debugMeasure;
      if (measured.includes(id)) return;
      measured.push(id);
      button.disabled = true;
      const s = scenario();
      const p = document.createElement("p");
      p.innerHTML = `<b>${esc(button.textContent)}：</b>${esc(s.evidence[id])}`;
      evidence.appendChild(p);
      count.textContent = String(measured.length);
      const hit = s.best.includes(id);
      quality.textContent = hit && measured.length === 1 ? "HIGH · root layer split" : hit ? "GOOD" : measured.length <= 2 ? "MEDIUM" : "LOW · broad probing";
      renderHypotheses();
    }));

    reveal.addEventListener("click", () => {
      const s = scenario();
      rootCard.hidden = false;
      rootCard.querySelector("strong").textContent = s.root;
      rootCard.querySelector("p").textContent = s.explanation;
    });
    newButton.addEventListener("click", () => {
      scenarioIndex = (scenarioIndex + 1) % DEBUG_SCENARIOS.length;
      reset();
    });
    reset();
    return { reset };
  }

  function mount(root) {
    if (!root || root.querySelector("[data-power-system-live]")) return;
    const anchor = root.querySelector(".journey-system-explain");
    if (!anchor) return;
    anchor.insertAdjacentHTML("afterend", markup());

    const live = root.querySelector("[data-power-system-live]");
    const panels = Array.from(live.querySelectorAll("[data-power-stage]"));
    const api = {};
    api.timingApi = bindTiming(root, live.querySelector('[data-power-stage="2"]'), api);
    api.controlApi = bindControl(root, live.querySelector('[data-power-stage="3"]'), api);
    api.dynamicsApi = bindDynamics(root, live.querySelector('[data-power-stage="4"]'), api);
    api.topologyApi = bindTopology(live.querySelector('[data-power-stage="5"]'), api);
    api.protectionApi = bindProtection(root, live.querySelector('[data-power-stage="6"]'), api);
    api.capstoneApi = bindCapstone(live.querySelector('[data-power-stage="7"]'), api);

    function activeStageIndex() {
      const cards = Array.from(root.querySelectorAll("[data-journey-stage]"));
      return cards.findIndex(card => card.classList.contains("is-active"));
    }

    function syncVisibility() {
      const index = activeStageIndex();
      panels.forEach(panel => {
        panel.hidden = Number(panel.dataset.powerStage) !== index;
      });
      if (index === 2) api.timingApi.render();
      if (index === 3) api.controlApi.render();
      if (index === 4) api.dynamicsApi.render();
      if (index === 6) api.protectionApi.render();
    }

    const stageCards = Array.from(root.querySelectorAll("[data-journey-stage]"));
    const observer = new MutationObserver(syncVisibility);
    stageCards.forEach(card => observer.observe(card, { attributes: true, attributeFilter: ["class"] }));
    syncVisibility();

    global.CircuitPowerSystemLiveV1 = { MODEL, api };
  }

  Learning.renderHome = function renderHomeWithCompletePowerSystem(rootId) {
    previousRenderHome(rootId);
    mount(document.getElementById(rootId));
  };
})(window);
