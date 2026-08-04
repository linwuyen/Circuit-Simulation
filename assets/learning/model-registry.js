(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitModelRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const cards = [
    {
      id: "buck-ripple-ccm",
      moduleId: "buck",
      title: "Buck CCM 電感漣波",
      type: "Physical approximation",
      assumptions: ["理想 Buck", "固定頻率", "CCM", "忽略開關壓降與電感 DCR"],
      invalidWhen: ["電感電流谷值碰到 0", "Vout≥Vin", "控制器進入 pulse skipping 或 burst mode"],
      outputs: ["Duty", "ΔI", "峰值／谷值", "CCM/DCM 邊界"],
      source: "電感伏秒平衡與 di/dt=vL/L"
    },
    {
      id: "adc-signal-chain",
      moduleId: "adc",
      title: "ADC 類比量測鏈",
      type: "Physical calculation",
      assumptions: ["理想線性增益", "理想 Vref", "未計入 INL/DNL、offset/gain tolerance"],
      invalidWhen: ["ADC 腳位超出 0–Vref", "source impedance 未滿足 acquisition settling", "保護元件導通"],
      outputs: ["ADC code", "LSB", "分壓功耗", "電流換算係數"],
      source: "量化定義、歐姆定律與線性訊號鏈"
    },
    {
      id: "spi-frame-timing",
      moduleId: "spi",
      title: "SPI frame 與接收路徑",
      type: "Timing model",
      assumptions: ["固定 word length", "SCLK 穩定", "Master/target mode 一致"],
      invalidWhen: ["FIFO overrun", "DMA/ISR latency 超過資料到達間隔", "CPOL/CPHA 或 bit order 不一致"],
      outputs: ["理想 frame 時間", "吞吐量上限", "FIFO 服務期限"],
      source: "SCLK bit timing 與 FIFO queueing"
    }
  ];

  function forModule(moduleId) {
    return cards.filter(card => card.moduleId === moduleId);
  }

  function get(id) {
    return cards.find(card => card.id === id) || null;
  }

  return { cards, forModule, get };
});
