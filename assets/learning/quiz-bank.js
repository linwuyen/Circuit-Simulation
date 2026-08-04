(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitQuizBank = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const questions = [
    {
      id: "buck-ripple-inductance-transfer",
      moduleId: "buck",
      competency: "buck.current-ripple.relationship",
      kind: "遷移題",
      prompt: "Vin、Vout 與 fsw 不變，電感 L 加倍後，CCM 電流漣波 ΔI 約如何變化？",
      options: [
        { id: "half", text: "約減半", correct: true, feedback: "ΔI 與 L 成反比。" },
        { id: "double", text: "約加倍", misconception: "把反比誤認為正比", feedback: "電感越大，電流變化斜率越小。" },
        { id: "same", text: "不變", misconception: "忽略電感對 di/dt 的限制", feedback: "L 直接出現在漣波公式分母。" },
        { id: "quarter", text: "約變成四分之一", misconception: "誤套平方關係", feedback: "這裡是一次反比，不是平方反比。" }
      ],
      href: "0_buck_converter_/2_current_ripple.html"
    },
    {
      id: "buck-dcm-boundary",
      moduleId: "buck",
      competency: "buck.ccm-dcm.boundary",
      kind: "模型邊界",
      prompt: "理想 Buck 的 CCM 漣波估算得到 ΔI=2 A。負載平均電流降到 0.6 A 時，最合理的判斷是什麼？",
      options: [
        { id: "dcm", text: "已進入 DCM，不能再使用對稱於平均值的 CCM 三角波", correct: true, feedback: "CCM 邊界約為 ΔI/2=1 A。" },
        { id: "ccm", text: "仍是 CCM，因為平均電流仍大於 0", misconception: "只看平均值是否為正", feedback: "要看谷值 Iout−ΔI/2 是否大於 0。" },
        { id: "saturation", text: "代表電感已飽和", misconception: "把 DCM 與磁飽和混為一談", feedback: "DCM 是電流降到零；飽和是電感量因磁通過高而下降。" },
        { id: "duty", text: "只要提高 Duty 就必定回到 CCM", misconception: "忽略負載與電感斜率", feedback: "工作模式由負載、L、fsw、Vin/Vout 共同決定。" }
      ],
      href: "0_buck_converter_/4_ccm_vs_dcm.html"
    },
    {
      id: "buck-model-validity",
      moduleId: "buck",
      competency: "buck.model.validity",
      kind: "適用條件",
      prompt: "哪一種情況最需要停止使用 Vout≈Vin×Duty 的理想 CCM 直覺？",
      options: [
        { id: "dcm", text: "電感電流每週期降到 0", correct: true, feedback: "進入 DCM 後，轉移關係會依負載與元件參數改變。" },
        { id: "larger-l", text: "電感值變大", misconception: "把參數改變等同模型失效", feedback: "只要仍在 CCM，理想平均關係仍可作第一階近似。" },
        { id: "higher-f", text: "開關頻率提高", misconception: "把頻率改變等同拓撲改變", feedback: "提高 fsw 通常改變漣波，不會單獨使平均模型失效。" },
        { id: "lower-esr", text: "輸出電容 ESR 降低", misconception: "混淆輸出紋波與平均轉移關係", feedback: "ESR 主要影響紋波與瞬態。" }
      ],
      href: "0_buck_converter_/4_ccm_vs_dcm.html"
    },
    {
      id: "adc-levels-vs-codes",
      moduleId: "adc",
      competency: "adc.quantization.levels",
      kind: "核心概念",
      prompt: "12-bit ADC 的量化 levels 與最大 code 分別是多少？",
      options: [
        { id: "4096-4095", text: "4096 個 levels，最大 code 4095", correct: true, feedback: "N-bit ADC 有 2^N 個 levels，code 從 0 到 2^N−1。" },
        { id: "4095-4095", text: "4095 個 levels，最大 code 4095", misconception: "把 levels 與最大 code 混為一談", feedback: "0 也是一個 code，因此總共有 4096 個。" },
        { id: "4096-4096", text: "4096 個 levels，最大 code 4096", misconception: "忽略 code 從 0 開始", feedback: "最大 code 是 4095。" },
        { id: "4095-4096", text: "4095 個 levels，最大 code 4096", misconception: "兩個定義同時錯置", feedback: "levels=4096，max code=4095。" }
      ],
      href: "1_c2000_adc_calculator/1_adc_basics.html"
    },
    {
      id: "adc-divider-power",
      moduleId: "adc",
      competency: "adc.divider.power",
      kind: "工程計算",
      prompt: "高壓分壓器中，Rtop 的功耗應如何計算？",
      options: [
        { id: "i2r", text: "先用 Vbus/(Rtop+Rbottom) 求串聯電流，再算 I²Rtop", correct: true, feedback: "兩顆電阻流過相同分壓電流。" },
        { id: "v2rtop", text: "直接用 Vbus²/Rtop", misconception: "誤認全部母線電壓落在 Rtop", feedback: "Rbottom 也承受部分電壓，除非其阻值可完全忽略。" },
        { id: "adc-current", text: "用 ADC 輸入電壓除以 Rtop", misconception: "使用了錯誤電阻兩端電壓", feedback: "ADC 電壓主要落在 Rbottom。" },
        { id: "no-power", text: "ADC 輸入阻抗很高，所以分壓器沒有功耗", misconception: "混淆 ADC 負載電流與分壓器本身電流", feedback: "分壓電阻仍持續消耗 Vbus²/(Rtop+Rbottom)。" }
      ],
      href: "1_c2000_adc_calculator/4_voltage_divider.html"
    },
    {
      id: "adc-offset-purpose",
      moduleId: "adc",
      competency: "adc.current.offset",
      kind: "遷移題",
      prompt: "單電源 0–3.3 V ADC 要量測雙向電流，加入約 1.65 V offset 的根本目的為何？",
      options: [
        { id: "negative-range", text: "把 0 A 放在中點，讓正負電流都映射到 ADC 可量測範圍", correct: true, feedback: "負電流會落在中點以下，正電流落在中點以上。" },
        { id: "resolution", text: "把 ADC 解析度從 12-bit 提升到 14-bit", misconception: "把偏壓與解析度混為一談", feedback: "offset 不會增加 ADC bits。" },
        { id: "noise", text: "完全消除量化雜訊", misconception: "把位準平移誤當降噪", feedback: "offset 只改變工作點，量化與類比雜訊仍存在。" },
        { id: "gain", text: "自動提高放大器增益", misconception: "混淆 offset 與 gain", feedback: "增益與偏移是不同參數。" }
      ],
      href: "1_c2000_adc_calculator/3_why_offset.html"
    },
    {
      id: "spi-clock-throughput",
      moduleId: "spi",
      competency: "spi.throughput.clock",
      kind: "核心概念",
      prompt: "SPI 傳輸一個 16-bit word 的最低線上時間，主要由哪個量決定？",
      options: [
        { id: "sclk", text: "SCLK 頻率與每個 frame 的 bit 數", correct: true, feedback: "理想線上時間約為 bits/SCLK。" },
        { id: "cs-only", text: "只看 CS 拉低多久", misconception: "把 frame 邊界訊號當成位元時脈", feedback: "CS 定義交易邊界；實際位元推進由 SCLK 決定。" },
        { id: "cpu-only", text: "只看 CPU 主頻", misconception: "忽略 SPI 周邊時脈", feedback: "CPU 會影響供數與服務延遲，但線上 bit rate 由 SPI clock 決定。" },
        { id: "baud-name", text: "只看程式中變數名稱是否叫 baudRate", misconception: "把命名當成硬體事實", feedback: "必須追到 clock source、divider 與實際 SCLK。" }
      ]
    },
    {
      id: "spi-rx-overrun",
      moduleId: "spi",
      competency: "spi.rx.overrun",
      kind: "故障診斷",
      prompt: "示波器上 SCLK/MOSI 正常，但 MCU 偶爾少一個接收 word。最優先驗證什麼？",
      options: [
        { id: "fifo-service", text: "RX FIFO 是否在下一批資料到達前被 ISR/DMA 及時清空", correct: true, feedback: "線上波形正常不代表接收路徑沒有 overrun。" },
        { id: "raise-clock", text: "先把 SCLK 再提高", misconception: "用更高資料率處理服務不及", feedback: "這通常會讓 overrun 更嚴重。" },
        { id: "longer-cs", text: "只把 CS 拉得更久", misconception: "忽略 FIFO 與服務延遲", feedback: "若資料仍連續進入，單純延長 CS 不會清空 FIFO。" },
        { id: "change-color", text: "更換邏輯分析儀顯示顏色", misconception: "沒有驗證資料路徑", feedback: "應讀 FIFO level、overflow flag、ISR latency 或 DMA count。" }
      ]
    },
    {
      id: "spi-cpol-cpha",
      moduleId: "spi",
      competency: "spi.mode.cpol-cpha",
      kind: "故障診斷",
      prompt: "SPI 每個 byte 都有規律地錯位或高低位錯誤，而時脈頻率正確，最可能先檢查什麼？",
      options: [
        { id: "mode", text: "Master 與 target 的 CPOL/CPHA、bit order 與 word length 是否一致", correct: true, feedback: "規律性錯位通常是取樣邊緣或 frame 定義不一致。" },
        { id: "random-noise", text: "直接假設是隨機 EMI", misconception: "忽略高度規律的錯誤型態", feedback: "EMI 常較隨機；固定錯位先查 mode 與 bit order。" },
        { id: "heap", text: "先增加 heap 大小", misconception: "把通訊格式錯誤當成記憶體配置", feedback: "heap 通常不會造成每個 word 固定錯位。" },
        { id: "duty-only", text: "只調整 PWM duty", misconception: "混入無關控制參數", feedback: "應先對照 datasheet 的取樣與改變邊緣。" }
      ]
    }
  ];

  function validateQuestion(question) {
    const correct = question.options.filter(option => option.correct);
    if (correct.length !== 1) throw new Error(question.id + " must have exactly one correct option");
    if (new Set(question.options.map(option => option.id)).size !== question.options.length) {
      throw new Error(question.id + " has duplicate option ids");
    }
  }

  questions.forEach(validateQuestion);

  function getQuestions(curriculum) {
    const modules = curriculum && curriculum.moduleById ? curriculum.moduleById : {};
    return questions
      .filter(question => modules[question.moduleId])
      .map(question => ({
        ...question,
        module: modules[question.moduleId],
        href: question.href || modules[question.moduleId].entry
      }));
  }

  return { questions, getQuestions, validateQuestion };
});
