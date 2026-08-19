(() => {
  "use strict";

  const topologies = {
    buck: {
      label: "Buck",
      reference: "Vout*",
      controller: "PI / 2P2Z",
      control: "Duty D",
      plant: "Buck LC power stage",
      output: "Vout",
      sensor: "Vout ADC",
      personality: "LC double pole + ESR zero",
      boundary: "LC resonance / delay / ESR",
      laplaceTitle: "先把 Buck 變成 P(s)，找 pole / zero",
      laplaceBody: "Buck 的 LC 儲能元件形成二階 dynamics，capacitor ESR 再帶來 zero。這一層先問 plant 天生怎麼動，不急著調 PI。",
      bodeTitle: "沿 s=jω 看 Buck 的 loop shape",
      bodeBody: "先定位 LC double pole 與 ESR zero，再決定 crossover、phase margin 與 compensator pole/zero。若模型與 SFRA 高頻開始分岔，要把 sensor、ZOH 與 delay 加回來。",
      zTitle: "把 controller 離散化，不是把 plant 名字改成 z",
      zBody: "C2000 執行的是 C(z) / difference equation。Plant 仍來自真實 power stage；sampling 把連續 dynamics 映射到每一拍，z⁻¹ 表示 one-sample memory/delay。",
      firmwareTitle: "Buck 的 actuator semantics：把 u 寫成 PWM duty",
      firmwareBody: "ADC 讀 Vout/IL，ISR 或 CLA 算 controller，最後把 duty 寫進 CMPA shadow；真正生效要等 load event，所以 sample-to-actuation latency 必須量。",
      sfraTitle: "Buck 的 model ↔ SFRA：先對 fLC / fESR，再看多出的 phase",
      sfraBody: "如果 magnitude 形狀與 LC/ESR 模型接近，但 phase 整段更多落後，優先量 ADC/ISR/PWM timing；若共振位置錯，先查 L/C/R 與 operating point。",
      delayHint: "Buck 的 plant 先受 LC/ESR 形狀限制；當模型與 SFRA magnitude 大致對得上、phase 卻少一截，ADC/ISR/PWM latency 就應該先被量出來。"
    },
    boost: {
      label: "Boost",
      reference: "Vout*",
      controller: "PI / 2P2Z",
      control: "Duty D",
      plant: "Boost CCM power stage",
      output: "Vout",
      sensor: "Vout / IL ADC",
      personality: "LC dynamics + RHP zero",
      boundary: "fc 必須遠低於 fRHPZ",
      laplaceTitle: "Boost 的 P(s) 多了一顆 RHP zero",
      laplaceBody: "Duty 增加時，電感先多充能、短時間反而少送能量到 output；small-signal control-to-output 因此可能出現 non-minimum-phase RHP zero。",
      bodeTitle: "RHP zero：magnitude 像 zero，phase 卻往壞方向走",
      bodeBody: "它會抬高 magnitude 卻額外拉低 phase，所以不能用一顆 LHP zero『互消』。crossover 必須對 fRHPZ 留明顯距離，而且 fRHPZ 會隨 duty/load 改變。",
      zTitle: "離散化不會消失 RHPZ 的物理限制",
      zBody: "C(z) 可以改變 loop shape，但不能把 power-flow 造成的 non-minimum-phase behavior 變不見；sampling/delay 只會再吃掉更多 phase budget。",
      firmwareTitle: "Boost 仍是 ADC → controller → duty，只是 plant 更難搞",
      firmwareBody: "韌體骨架與 Buck 很像，但每次調 bandwidth 都要把 operating-point-dependent RHPZ ceiling 帶回設計，而不是只盯 Kp/Ki。",
      sfraTitle: "Boost 要在多個 duty / load 點量 SFRA",
      sfraBody: "單一 operating point 的漂亮 Bode 不代表全域安全。若負載或 duty 改變後 crossover 逼近 RHPZ，phase margin 會快速惡化。",
      delayHint: "Boost 已經有 RHP zero 在吃 phase；digital delay 是額外扣分。先保證 crossover 對最低 fRHPZ 有距離，再算 sample-to-PWM delay 的 phase loss。"
    },
    pfc: {
      label: "PFC",
      reference: "Iin* / Vbus*",
      controller: "Current PI + Voltage PI",
      control: "Duty / current-ref amplitude",
      plant: "Boost PFC + line dynamics",
      output: "Iin / Vbus",
      sensor: "Iin + Vbus ADC + PLL",
      personality: "Nested loops + 2ω energy ripple",
      boundary: "Current loop 快；voltage loop 慢",
      laplaceTitle: "PFC 不是一個 P(s)，而是至少兩個不同時間尺度的 loop",
      laplaceBody: "Inner current loop 看 inductor/current plant；outer voltage loop 看 bus energy dynamics。兩個 loop 的 plant、reference 與 bandwidth 目的不同。",
      bodeTitle: "先排 bandwidth hierarchy，再談每一環的 phase margin",
      bodeBody: "Current loop 要能塑形 line current；outer voltage loop 必須夠慢，避免追著 2ω bus ripple 跑而把 current amplitude reference 污染。",
      zTitle: "兩個 loop 可能不同 rate，但都要明確定義 Ts / latency",
      zBody: "Current loop 通常跟 PWM/ADC 快速同步；outer loop 可以降頻執行。每個 rate 都要知道 sample age、filter delay 與 command update semantics。",
      firmwareTitle: "PFC 的 C2000 骨架多了 PLL / normalization / nested-loop scheduling",
      firmwareBody: "ADC Iin/Vbus + line phase → inner current control + slower outer voltage control → PWM duty。核心仍是 r→e→C→u→P→y，但 loop 被巢狀化。",
      sfraTitle: "PFC SFRA 要說清楚你在量哪一個 loop",
      sfraBody: "Inner current loop、outer voltage loop 不能混成一條 Bode 解讀。注入點、閉合條件與 operating point 都必須記錄。",
      delayHint: "PFC 要分 loop 算 delay budget：快速 current loop 對微秒級 latency 很敏感；慢速 voltage loop 更常受 2ω ripple、filter 與 bandwidth hierarchy 限制。"
    },
    psfb: {
      label: "PSFB",
      reference: "Vout*",
      controller: "PI / 2P2Z",
      control: "Bridge phase shift",
      plant: "PSFB + transformer + output LC",
      output: "Vout",
      sensor: "Vout / current ADC",
      personality: "Phase control + duty-loss + ZVS window",
      boundary: "Output LC + commutation / delay",
      laplaceTitle: "PSFB 的 u 不是 duty，而是 phase shift",
      laplaceBody: "先把 phase command 到 effective duty / output voltage 的 small-signal path 建起來，再把 transformer、output filter 與 operating-point-dependent duty loss 加進 plant。",
      bodeTitle: "同樣看 crossover / PM，但 plant gain 會被 commutation behavior 改寫",
      bodeBody: "Output LC 仍會形成主要 dynamics；leakage、dead-time、effective duty loss 與 light-load behavior 會讓實際 gain/phase 偏離理想模型。",
      zTitle: "C(z) 一樣存在，但 command 的單位換成 phase",
      zBody: "Difference equation 不在乎 actuator 叫 duty 還是 phase；真正要確認的是 command scaling、limit、更新時刻與 phase-register semantics。",
      firmwareTitle: "PSFB 的 actuator_commit() 是 phase update",
      firmwareBody: "ADC → controller → phase command → ePWM phase/register update。ZVS 是 power-stage operating condition，不能由閉迴路穩定本身保證。",
      sfraTitle: "PSFB 用 SFRA 看 loop，用 scope 看 ZVS",
      sfraBody: "SFRA 能驗證 small-signal loop；ZVS 還要看 Vds turn-on、primary current 與 dead-time。兩個驗證層不能互相取代。",
      delayHint: "PSFB 的 controller loop 仍會受 digital delay 扣 phase；但若問題是輕載 ZVS 消失，先查 commutation energy/dead-time，而不是把所有症狀都歸咎於 PM。"
    },
    llc: {
      label: "LLC",
      reference: "Vout*",
      controller: "PI / gain-scheduled control",
      control: "Switching frequency fs",
      plant: "LLC resonant tank",
      output: "Vout",
      sensor: "Vout / resonant current ADC",
      personality: "Resonant gain strongly depends on operating point",
      boundary: "fn / Q / Ln / load-dependent slope",
      laplaceTitle: "LLC 的 plant 必須在 operating point 附近線性化",
      laplaceBody: "控制量是 switching frequency；frequency-to-gain slope 會隨 fn、Q、Ln、Vin/load 改變，所以『一張固定 P(s)』通常只代表局部。",
      bodeTitle: "同樣做 loop shaping，但先問 plant slope 在這個點是多少",
      bodeBody: "不同 load / Vin 下，gain 與 phase 可能顯著改變。crossover 與 compensator 若只在單一點設計，其他 operating region 可能變慢或失去 margin。",
      zTitle: "數位 controller 一樣是 C(z)，但 fs command 常有 rate / limit / range 邊界",
      zBody: "離散控制要處理 switching-frequency command 的上下限、更新節奏與 operating-region transition；這些都是 actuator semantics，不是另一套控制理論。",
      firmwareTitle: "LLC 的 actuator_commit() 可能是改 TBPRD / switching period",
      firmwareBody: "ADC Vout/current → controller → frequency command → PWM period update。loop 骨架沒變，但 command-to-power-stage gain 與 update timing 跟 duty-based converter 不同。",
      sfraTitle: "LLC SFRA 要跨 operating points 建 plant family",
      sfraBody: "在不同 load / Vin / fn 量 response，才能知道單一 compensator 是否夠，或需要 gain scheduling / mode strategy。",
      delayHint: "LLC 的 digital delay 仍按 −360·fc·Td 扣相位；但更大的風險常是 operating point 讓 plant gain/phase 本身改變，所以要把兩者分開辨識。"
    },
    inverter: {
      label: "Inverter",
      reference: "Iac* / Vac*",
      controller: "PI / PR / dq current control",
      control: "Modulation command m",
      plant: "L / LC / LCL + grid/load",
      output: "Iac / Vac",
      sensor: "Vac/Iac ADC + PLL",
      personality: "AC control + LC/LCL resonance + PLL/grid interaction",
      boundary: "Resonance / current-loop / PLL hierarchy",
      laplaceTitle: "Inverter 的 P(s) 取決於你在控制 voltage 還是 current",
      laplaceBody: "Standalone voltage loop、grid-current loop、LCL plant 不是同一個 transfer path；先定義 u→y 再建模，不能只說『Inverter plant』。",
      bodeTitle: "LCL resonance 與 PLL/grid interaction 會決定可用 bandwidth",
      bodeBody: "Current loop 通常要避開/阻尼 resonance；PLL bandwidth 又要與 current loop 分層，grid impedance 變動也可能改 plant。",
      zTitle: "AC control 仍落到 sample-by-sample C(z) / dq / PR 差分方程",
      zBody: "abc/dq 轉換或 PR controller 增加了座標與結構，但 sample、delay、z⁻¹、PWM update 的離散問題仍完全存在。",
      firmwareTitle: "Inverter 的 actuator_commit() 是 modulation compare / vector command",
      firmwareBody: "ADC Vac/Iac + PLL angle → dq/PR controller → modulation → PWM compare。控制語言沒變，只是 reference/sensor/actuator 多了 AC phase semantics。",
      sfraTitle: "Inverter 的 SFRA 要把 PLL / grid state 一起記錄",
      sfraBody: "同一組 current controller 在不同 grid impedance 或 PLL bandwidth 下可能有不同 loop response；量測條件必須跟模型 operating state 對齊。",
      delayHint: "Inverter current loop常有較高 crossover，微秒級 delay 的 phase cost 很快變大；若又靠近 LCL resonance，margin budget 會更緊。"
    }
  };

  const lensMeta = {
    laplace: { number: "01", eyebrow: "LAPLACE · NATURAL DYNAMICS", title: "laplaceTitle", body: "laplaceBody", question: "問：pole / zero 在哪？哪個 operating point 會改它？" },
    bode: { number: "02", eyebrow: "FOURIER / BODE · LOOP SHAPE", title: "bodeTitle", body: "bodeBody", question: "問：crossover 放哪？phase margin 還剩多少？哪個頻段不能硬闖？" },
    z: { number: "03", eyebrow: "Z-DOMAIN · SAMPLE-BY-SAMPLE", title: "zTitle", body: "zBody", question: "問：Ts 是多少？z⁻¹ 代表什麼 memory / delay？離散化方法與邊界是什麼？" },
    firmware: { number: "04", eyebrow: "C2000 · TIMING & ACTUATOR", title: "firmwareTitle", body: "firmwareBody", question: "問：sample 何時發生？command 何時真正作用到 power stage？" },
    sfra: { number: "05", eyebrow: "SFRA · MODEL ↔ HARDWARE", title: "sfraTitle", body: "sfraBody", question: "問：實測與模型從哪個頻段開始分岔？下一個最有資訊量的量測是什麼？" }
  };

  const debugCases = {
    phase: {
      suspect: "Digital / sampling delay",
      measure: "GPIO timing + ADC SOC → PWM load latency",
      reason: "Pure delay 幾乎不改 magnitude，但會以 −ωTd 直接拉低 phase；這正是「形狀差不多、phase 整段少一截」的典型 signature。"
    },
    rolloff: {
      suspect: "Sensor / analog filter / unmodeled pole",
      measure: "AFE transfer + ADC digital filter + model-vs-SFRA corner",
      reason: "高頻 magnitude 比模型更早 roll off，通常代表多了一顆 pole 或 filter。先找 corner frequency，再決定它來自 analog front-end、digital filter、ZOH 或 plant parasitic。"
    },
    resonance: {
      suspect: "LC / LCL / resonant tank / parasitic mode",
      measure: "共振頻率 + L/C/load + scope ring frequency",
      reason: "局部凸起或 phase 快速旋轉通常是二階 dynamics 的味道。先把實測共振頻率對回儲能元件與 operating point，不要先用 controller 把未知 plant 壓住。"
    },
    operating: {
      suspect: "Operating-point-dependent plant",
      measure: "同一 injection 在不同 Vin / load / duty / fn 重量一次",
      reason: "Boost RHPZ、LLC resonant slope、PSFB duty-loss、grid impedance 都會讓 P(s) 隨工作點移動。若只在某一點正常，先建立 plant family。"
    },
    pfc: {
      suspect: "Outer voltage loop 追到 2ω ripple",
      measure: "Vbus 2ω ripple ↔ current amplitude reference modulation",
      reason: "Bus regulation 看起來更緊不代表 PFC 更好；outer loop 太快時會把 2ω energy ripple調進 current reference，讓輸入電流失真、THD 反而變差。"
    }
  };

  const challenges = {
    dab: {
      title: "DAB：先定義 control variable，再談補償器",
      body: "第一個候選控制量通常是 bridge phase shift；但你仍要先確定 operating mode、power direction、transformer/leakage model 與你真正想閉迴路的 y。",
      u: "phase shift / modulation variant",
      y: "Vout / power / current",
      p: "先 small-signal linearize around operating point"
    },
    totem: {
      title: "Totem-Pole PFC：拓撲換了，PFC 的雙迴路問題沒有消失",
      body: "先問 current loop 的 actuator、line polarity / commutation、zero-cross behavior 與 outer Vbus loop；不要因為 power stage 換成 bridgeless 就把 bandwidth hierarchy忘掉。",
      u: "PWM duty / leg command",
      y: "Iin + Vbus",
      p: "line-dependent current plant + bus energy outer plant"
    },
    bidir: {
      title: "Bidirectional Buck-Boost：先把兩個 power direction 分清楚",
      body: "同一組硬體在 charge / discharge 方向下，effective plant、sign、saturation 與 mode transition 都可能改變。先定義 u→y 的方向與 operating region，再談共用 controller。",
      u: "duty / phase-leg command",
      y: "battery/DC-bus V or I",
      p: "direction- and mode-dependent small-signal plant"
    }
  };

  const ids = id => document.getElementById(id);
  let currentTopology = "buck";
  let currentLens = "laplace";

  function renderMatrix() {
    const tbody = ids("topologyMatrix");
    tbody.innerHTML = Object.values(topologies).map(t => `
      <tr>
        <td><strong>${t.label}</strong></td>
        <td>${t.control}</td>
        <td>${t.output}</td>
        <td>${t.personality}</td>
        <td>${t.boundary}</td>
      </tr>`).join("");
  }

  function renderTopology(key) {
    currentTopology = key;
    const t = topologies[key];
    document.querySelectorAll(".topology-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.topology === key));
    ids("selectedTopology").textContent = t.label.toUpperCase();
    ids("referenceName").textContent = t.reference;
    ids("controllerName").textContent = t.controller;
    ids("controlName").textContent = t.control;
    ids("plantName").textContent = t.plant;
    ids("outputName").textContent = t.output;
    ids("sensorName").textContent = t.sensor;
    ids("passportControl").textContent = t.control;
    ids("passportOutput").textContent = t.output;
    ids("passportPlant").textContent = t.personality;
    ids("passportBoundary").textContent = t.boundary;
    ids("sensorTimeline").textContent = t.sensor;
    ids("controllerTimeline").textContent = t.controller;
    ids("actuatorTimeline").textContent = t.control;
    ids("plantTimeline").textContent = t.plant;
    ids("delayTopologyTitle").textContent = `${t.label} · 為什麼這個 budget 有用？`;
    ids("delayTopologyHint").textContent = t.delayHint;
    renderLens(currentLens);
  }

  function renderLens(key) {
    currentLens = key;
    const meta = lensMeta[key];
    const t = topologies[currentTopology];
    document.querySelectorAll(".lens-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.lens === key));
    ids("lensNumber").textContent = meta.number;
    ids("lensEyebrow").textContent = meta.eyebrow;
    ids("lensTitle").textContent = t[meta.title];
    ids("lensBody").textContent = t[meta.body];
    ids("lensQuestion").textContent = meta.question;
  }

  function formatKhz(hz) {
    return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 ? 1 : 0)} kHz` : `${hz} Hz`;
  }

  function renderDelay() {
    const fc = Number(ids("fc").value);
    const delayUs = Number(ids("delayUs").value);
    const sampleUs = Number(ids("sampleUs").value);
    const basePm = Number(ids("basePm").value);
    const phase = -360 * fc * delayUs * 1e-6;
    const pm = basePm + phase;
    const samples = sampleUs > 0 ? delayUs / sampleUs : 0;
    const cycleRatio = fc * delayUs * 1e-6 * 100;

    ids("fcOut").textContent = formatKhz(fc);
    ids("delayOut").textContent = `${delayUs} µs`;
    ids("sampleOut").textContent = `${sampleUs} µs`;
    ids("basePmOut").textContent = `${basePm}°`;
    ids("phaseLoss").textContent = `−${Math.abs(phase).toFixed(1)}°`;
    ids("estimatedPm").textContent = `${pm.toFixed(1)}°`;
    ids("delaySamples").textContent = `${samples.toFixed(2)} sample`;
    ids("delayCycleRatio").textContent = `${cycleRatio.toFixed(1)}% cycle`;

    const status = ids("delayStatus");
    status.classList.remove("danger", "tight", "good");
    if (pm >= 45) {
      status.textContent = "HEALTHY";
      status.classList.add("good");
    } else if (pm >= 30) {
      status.textContent = "TIGHT";
      status.classList.add("tight");
    } else {
      status.textContent = "RISK";
      status.classList.add("danger");
    }

    const pct = Math.max(0, Math.min(100, pm / 90 * 100));
    ids("phaseFill").style.width = `${pct}%`;
    ids("phaseMarker").style.left = `${pct}%`;
  }

  function renderDebug(key) {
    const d = debugCases[key];
    document.querySelectorAll(".debug-button").forEach(btn => btn.classList.toggle("active", btn.dataset.debug === key));
    ids("debugSuspect").textContent = d.suspect;
    ids("debugMeasure").textContent = d.measure;
    ids("debugReason").textContent = d.reason;
  }

  function renderChallenge(key) {
    const c = challenges[key];
    document.querySelectorAll(".new-card").forEach(btn => btn.classList.toggle("active", btn.dataset.new === key));
    ids("challengeTitle").textContent = c.title;
    ids("challengeBody").textContent = c.body;
    ids("challengeU").textContent = c.u;
    ids("challengeY").textContent = c.y;
    ids("challengeP").textContent = c.p;
  }

  document.querySelectorAll(".topology-tab").forEach(btn => btn.addEventListener("click", () => renderTopology(btn.dataset.topology)));
  document.querySelectorAll(".lens-tab").forEach(btn => btn.addEventListener("click", () => renderLens(btn.dataset.lens)));
  document.querySelectorAll("#fc,#delayUs,#sampleUs,#basePm").forEach(input => input.addEventListener("input", renderDelay));
  document.querySelectorAll(".debug-button").forEach(btn => btn.addEventListener("click", () => renderDebug(btn.dataset.debug)));
  document.querySelectorAll(".new-card").forEach(btn => btn.addEventListener("click", () => renderChallenge(btn.dataset.new)));

  renderMatrix();
  renderTopology("buck");
  renderDelay();
  renderDebug("phase");
  renderChallenge("dab");
})();
