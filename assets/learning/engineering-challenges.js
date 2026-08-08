(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitEngineeringChallenges = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const numericTasks = [
    {
      id: "buck-open-inductance",
      moduleId: "buck",
      competency: "buck.current-ripple.relationship",
      prompt: "Vin=48 V、Vout=12 V、fsw=100 kHz、Iout=5 A。希望 CCM 電感漣波 ΔI=20% Iout，理想模型下 L 約多少？",
      unit: "uH",
      tolerance: 0.05,
      expected() {
        const vin = 48, vout = 12, fsw = 100e3, iout = 5, target = 0.20 * iout;
        const duty = vout / vin;
        return (vin - vout) * duty / (fsw * target) * 1e6;
      },
      explanation: "先算 D=Vout/Vin，再由 ΔI=(Vin−Vout)D/(fsw·L) 反解 L。"
    },
    {
      id: "adc-open-divider",
      moduleId: "adc",
      competency: "adc.divider.power",
      prompt: "Vbus,max=800 V、Vref=3.3 V、Rbot=8.25 kΩ。忽略 ADC loading，要讓 Vadc≤3.3 V，Rtop 最小約多少？",
      unit: "kOhm",
      tolerance: 0.03,
      expected() { return 8.25 * (800 / 3.3 - 1); },
      explanation: "由 Vadc=Vbus·Rbot/(Rtop+Rbot) 反解 Rtop。"
    },
    {
      id: "spi-open-frame-time",
      moduleId: "spi",
      competency: "spi.throughput.clock",
      prompt: "SPI SCLK=10 MHz、frame=32 bit，忽略 frame gap。單一 frame 最低線上時間是多少？",
      unit: "us",
      tolerance: 0.02,
      expected() { return 32 / 10e6 * 1e6; },
      explanation: "frame time = bits / SCLK。"
    }
  ];

  function evaluateNumeric(taskId, answer, unit) {
    const task = numericTasks.find(item => item.id === taskId);
    if (!task) throw new Error("unknown numeric task");
    const value = Number(answer);
    if (!Number.isFinite(value)) return { correct: false, reason: "not-a-number", expected: task.expected(), unit: task.unit };
    let normalized = value;
    const entered = String(unit || task.unit).toLowerCase();
    if (task.unit === "uH" && entered === "h") normalized *= 1e6;
    if (task.unit === "uH" && entered === "mh") normalized *= 1e3;
    if (task.unit === "kOhm" && (entered === "ohm" || entered === "ω")) normalized /= 1e3;
    if (task.unit === "us" && entered === "s") normalized *= 1e6;
    if (task.unit === "us" && entered === "ms") normalized *= 1e3;
    const expected = task.expected();
    const relativeError = expected ? Math.abs(normalized - expected) / Math.abs(expected) : Math.abs(normalized - expected);
    return { correct: relativeError <= task.tolerance, expected, normalized, unit: task.unit, relativeError, explanation: task.explanation };
  }

  const diagnosticGames = [
    {
      id: "spi-overrun-game",
      moduleId: "spi",
      title: "SPI 偶發漏 word",
      symptom: "Master 連續送 frame；示波器看 SCLK/MOSI 正常，但 Slave 偶爾少一個 word。",
      rootCauseId: "fifo-service",
      causes: [
        { id: "fifo-service", text: "RX FIFO 服務延遲超過 deadline" },
        { id: "cpol", text: "CPOL 固定錯誤" },
        { id: "mosi-level", text: "MOSI 邏輯準位不足" }
      ],
      tests: [
        { id: "fifo-level", text: "量 RX FIFO level / overflow flag 與 ISR/DMA 時序", cost: 1, informationGain: 5, result: "漏字前 FIFO level 到頂，overflow flag 置位；MOSI/SCLK 無異常。" },
        { id: "scope-mosi", text: "再量一次 MOSI 波形", cost: 2, informationGain: 1, result: "MOSI 邊緣與邏輯準位正常，無法解釋偶發漏字。" },
        { id: "change-cpol", text: "切換 CPOL/CPHA", cost: 3, informationGain: 1, result: "錯誤型態變成每個 word 固定錯位，不符合原症狀。" },
        { id: "slow-sclk", text: "SCLK 降半", cost: 2, informationGain: 3, result: "漏字明顯減少，支持服務 deadline 假設，但仍需看 FIFO/ISR 才能定因。" }
      ]
    },
    {
      id: "buck-dcm-game",
      moduleId: "buck",
      title: "Buck 輕載輸出偏離",
      symptom: "重載時 Vout≈Vin·D；負載變輕後同一 Duty 下 Vout 開始偏離。",
      rootCauseId: "dcm",
      causes: [
        { id: "dcm", text: "電感電流進入 DCM，CCM 轉移關係失效" },
        { id: "adc", text: "ADC 量化不足" },
        { id: "esr", text: "輸出電容 ESR 單獨造成 DC gain 改變" }
      ],
      tests: [
        { id: "inductor-current", text: "量電感電流谷值是否碰到 0", cost: 1, informationGain: 5, result: "輕載時每週期都有一段電感電流為 0。" },
        { id: "swap-cap", text: "換低 ESR 電容", cost: 3, informationGain: 1, result: "高頻 ripple 改善，但 DC 偏離仍在。" },
        { id: "adc-bits", text: "提高 ADC oversampling", cost: 2, informationGain: 1, result: "讀值更平滑，但轉移關係偏離不變。" }
      ]
    }
  ];

  function scoreDiagnostic(gameId, selectedTests, causeId) {
    const game = diagnosticGames.find(item => item.id === gameId);
    if (!game) throw new Error("unknown diagnostic game");
    const tests = (selectedTests || []).map(id => game.tests.find(test => test.id === id)).filter(Boolean);
    const cost = tests.reduce((sum, test) => sum + test.cost, 0);
    const informationGain = tests.reduce((sum, test) => sum + test.informationGain, 0);
    const solved = causeId === game.rootCauseId;
    const efficiency = solved ? Math.max(0, Math.round(100 - cost * 8 + informationGain * 4)) : 0;
    return { solved, cost, informationGain, efficiency, rootCauseId: game.rootCauseId };
  }

  return { numericTasks, evaluateNumeric, diagnosticGames, scoreDiagnostic };
});