(function (root, factory) {
  "use strict";
  const api = factory(root.CircuitModels || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitModelRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Models) {
  "use strict";

  const cards = [
    {
      id: "buck-ripple-ccm",
      moduleId: "buck",
      version: "2.0.0",
      title: "Buck CCM 電感漣波",
      type: "Physical approximation",
      executable: true,
      calculate: Models.calculateBuckRipple,
      inputs: { vin: "V", vout: "V", inductanceH: "H", switchingHz: "Hz", outputCurrentA: "A" },
      outputs: { duty: "ratio", deltaIA: "A", peakA: "A", valleyA: "A", boundaryCurrentA: "A", mode: "enum" },
      assumptions: ["理想 Buck", "固定頻率", "CCM 公式只在谷值大於 0 時有效", "忽略開關壓降與電感 DCR"],
      invalidWhen: ["電感電流進入 DCM", "Vout≥Vin", "控制器進入 pulse skipping 或 burst mode"],
      references: ["電感伏秒平衡", "di/dt=vL/L"],
      testIds: ["buck-ripple-invariants", "buck-boundary"]
    },
    {
      id: "adc-quantization",
      moduleId: "adc",
      version: "2.0.0",
      title: "ADC 量化與飽和",
      type: "Physical calculation",
      executable: true,
      calculate: Models.quantizeAdc,
      inputs: { voltageV: "V", vrefV: "V", bits: "bit" },
      outputs: { count: "count", lsbV: "V/count", maxCount: "count", saturated: "bool" },
      assumptions: ["理想單調 ADC", "理想 Vref", "未計入 INL/DNL、offset/gain tolerance"],
      invalidWhen: ["輸入超出 0–Vref", "source impedance 未滿足 acquisition settling", "保護元件導通"],
      references: ["N-bit quantization definition"],
      testIds: ["adc-monotonic", "adc-lsb"]
    },
    {
      id: "adc-divider",
      moduleId: "adc",
      version: "2.0.0",
      title: "ADC 高壓分壓器",
      type: "Physical calculation",
      executable: true,
      calculate: Models.calculateDivider,
      inputs: { busV: "V", topOhm: "ohm", bottomOhm: "ohm", vrefV: "V", bits: "bit" },
      outputs: { adcInputV: "V", topPowerW: "W", bottomPowerW: "W", maxBusV: "V" },
      assumptions: ["ADC 輸入負載相對分壓電流可忽略", "電阻為線性元件"],
      invalidWhen: ["ADC sampling network 明顯載入分壓器", "保護箝位導通", "電阻工作電壓或功率超規"],
      references: ["Ohm's law", "resistive divider"],
      testIds: ["divider-power-conservation"]
    },
    {
      id: "spi-frame-timing",
      moduleId: "spi",
      version: "2.0.0",
      title: "SPI frame、FIFO 與服務期限",
      type: "Timing model",
      executable: true,
      calculate: Models.calculateSpiTiming,
      inputs: { sclkHz: "Hz", bits: "bit", fifoDepthWords: "word", serviceLatencyS: "s" },
      outputs: { frameTimeS: "s", wordRateHz: "word/s", fifoDeadlineS: "s", serviceMarginS: "s", overrunRisk: "bool" },
      assumptions: ["固定 word length", "連續 frame", "SCLK 穩定"],
      invalidWhen: ["frame 間有不固定 gap", "DMA/ISR 會批次服務且 queue model 不同", "CPOL/CPHA 或 bit order 不一致"],
      references: ["SCLK bit timing", "FIFO queue deadline"],
      testIds: ["spi-frame-time", "spi-fifo-deadline"]
    },
    {
      id: "pwm-average",
      moduleId: "inverter",
      version: "1.0.0",
      title: "PWM 平均電壓",
      type: "Averaged switching model",
      executable: true,
      calculate: Models.calculatePwmAverage,
      inputs: { busV: "V", duty: "ratio", topology: "enum" },
      outputs: { averageV: "V" },
      assumptions: ["觀察時間遠大於 switching period", "忽略 dead-time 與壓降"],
      invalidWhen: ["要求瞬時 switching waveform", "dead-time distortion 主導", "調變進入過調變或飽和"],
      references: ["PWM duty-cycle averaging"],
      testIds: ["pwm-average"]
    },
    {
      id: "pi-discrete-step",
      moduleId: "pi",
      version: "1.0.0",
      title: "離散 PI 單步更新",
      type: "Discrete control model",
      executable: true,
      calculate: Models.piControllerStep,
      inputs: { error: "engineering unit", kp: "gain", ki: "1/s", dtS: "s", previousIntegral: "output unit", minOutput: "output unit", maxOutput: "output unit" },
      outputs: { integral: "output unit", rawOutput: "output unit", output: "output unit", saturated: "bool" },
      assumptions: ["固定取樣時間", "位置式 PI", "簡化 anti-windup clamp"],
      invalidWhen: ["控制器使用不同離散化形式", "取樣 jitter 顯著", "plant dynamics 未被考慮"],
      references: ["u=Kp e + Ki ∫e dt", "forward-Euler integral"],
      testIds: ["pi-step", "pi-anti-windup"]
    },
    {
      id: "dac-code-map",
      moduleId: "dac",
      version: "1.0.0",
      title: "DAC 目標電壓到 code",
      type: "Code mapping",
      executable: true,
      calculate: Models.calculateDacCode,
      inputs: { targetV: "V", fullScaleV: "V", bits: "bit", bipolar: "bool" },
      outputs: { code: "count", clampedV: "V", maxCode: "count" },
      assumptions: ["理想線性 DAC", "full-scale 定義已確認", "不含外部 op-amp gain/offset"],
      invalidWhen: ["資料格式不是 straight binary", "外部放大器飽和", "reference 或 gain 誤差不可忽略"],
      references: ["ideal DAC transfer"],
      testIds: ["dac-code-map"]
    },
    {
      id: "dds-phase-increment",
      moduleId: "dds",
      version: "1.0.0",
      title: "DDS phase increment",
      type: "Discrete-time frequency model",
      executable: true,
      calculate: Models.calculateDdsPhaseIncrement,
      inputs: { outputHz: "Hz", sampleHz: "Hz", phaseBits: "bit" },
      outputs: { increment: "count/sample", realizedHz: "Hz", frequencyErrorHz: "Hz", nyquistViolation: "bool" },
      assumptions: ["固定 sample clock", "phase accumulator 為 modulo 2^N"],
      invalidWhen: ["output 接近或超過 Nyquist", "sample clock jitter 主導", "lookup table/quantization spur 需要精確分析"],
      references: ["DDS phase accumulator relation"],
      testIds: ["dds-frequency"]
    },
    {
      id: "foc-transform-chain",
      moduleId: "foc",
      version: "0.1.0",
      title: "FOC Clarke/Park 控制鏈",
      type: "Heuristic architecture card",
      executable: false,
      assumptions: ["三相量測與電角度定義一致", "座標轉換符號慣例固定"],
      invalidWhen: ["相序、角度方向或 scaling 定義不一致", "current sensing 飽和或同步失效"],
      references: ["Clarke/Park transform definitions"],
      testIds: []
    },
    {
      id: "bms-state-flow",
      moduleId: "bms",
      version: "0.1.0",
      title: "BMS 狀態與量測鏈",
      type: "Heuristic architecture card",
      executable: false,
      assumptions: ["量測、保護與通訊狀態可分離驗證"],
      invalidWhen: ["cell monitor protocol 或硬體拓撲不同於教材假設"],
      references: ["state-machine and measurement-chain reasoning"],
      testIds: []
    },
    {
      id: "afe-signal-chain",
      moduleId: "afe",
      version: "0.1.0",
      title: "AFE 類比前端鏈",
      type: "Heuristic architecture card",
      executable: false,
      assumptions: ["線性小訊號區", "頻寬與 slew-rate 尚未限制"],
      invalidWhen: ["op-amp 飽和", "共模超規", "settling time 不足"],
      references: ["linear signal-chain analysis"],
      testIds: []
    },
    {
      id: "acmc-energy-flow",
      moduleId: "acmc",
      version: "0.1.0",
      title: "ACMC 能量流與保護鏈",
      type: "Heuristic system model",
      executable: false,
      assumptions: ["PFC、隔離級、逆變級可分層分析"],
      invalidWhen: ["跨級耦合或保護交互作用主導"],
      references: ["energy-flow and protection-path reasoning"],
      testIds: []
    }
  ];

  function forModule(moduleId) {
    return cards.filter(card => card.moduleId === moduleId);
  }

  function get(id) {
    return cards.find(card => card.id === id) || null;
  }

  function run(id, input) {
    const card = get(id);
    if (!card) throw new Error("unknown model: " + id);
    if (!card.executable || typeof card.calculate !== "function") throw new Error("model is descriptive only: " + id);
    return card.calculate(input || {});
  }

  function validate() {
    const errors = [];
    cards.forEach(card => {
      if (!card.id || !card.moduleId || !card.title || !card.version) errors.push("incomplete model card: " + (card.id || "unknown"));
      if (card.executable && typeof card.calculate !== "function") errors.push("missing calculate function: " + card.id);
      if (card.executable && (!card.inputs || !card.outputs)) errors.push("missing IO units: " + card.id);
      if (!Array.isArray(card.assumptions) || !card.assumptions.length) errors.push("missing assumptions: " + card.id);
      if (!Array.isArray(card.invalidWhen) || !card.invalidWhen.length) errors.push("missing invalid conditions: " + card.id);
      if (!Array.isArray(card.references) || !card.references.length) errors.push("missing references: " + card.id);
    });
    return errors;
  }

  return { cards, forModule, get, run, validate };
});