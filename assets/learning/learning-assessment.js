(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitAssessment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const RETENTION_INTERVALS_MS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS, 90 * DAY_MS];
  const MEASUREMENT_ORACLE_LABS = ["buck.lab.buck-ripple", "adc.lab.adc-divider"];

  const competencyPrerequisites = {
    "buck.ccm-dcm.boundary": ["buck.current-ripple.relationship"],
    "buck.model.validity": ["buck.ccm-dcm.boundary"],
    "adc.divider.power": ["adc.quantization.levels"],
    "adc.current.offset": ["adc.quantization.levels"],
    "spi.rx.overrun": ["spi.throughput.clock"],
    "spi.mode.cpol-cpha": ["spi.throughput.clock"]
  };

  const moduleRequirements = {
    inverter: ["buck.model.validity"],
    pi: ["adc.quantization.levels"],
    realtime: ["spi.throughput.clock"],
    bms: ["adc.current.offset"],
    dac: ["spi.mode.cpol-cpha"],
    afe: ["adc.divider.power"],
    acmc: ["buck.model.validity", "adc.divider.power"],
    dds: ["adc.quantization.levels"]
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const round = (value, digits) => Number(Number(value).toFixed(digits == null ? 3 : digits));
  const rotate = (items, shift) => {
    const list = clone(items || []);
    if (!list.length) return list;
    const n = ((shift % list.length) + list.length) % list.length;
    return list.slice(n).concat(list.slice(0, n));
  };

  function seedFrom(value) {
    let h = 2166136261 >>> 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randomFrom(seed) {
    let a = Number(seed) >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  const shuffled = (list, rng) => {
    const out = clone(list || []);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  function option(id, text, correct, misconception, feedback) {
    return { id, text, correct: !!correct, ...(misconception ? { misconception } : {}), feedback: feedback || "依模型重新檢查推理鏈。" };
  }

  function generated(base, variantId, role, depth, seed, prompt, options, representation) {
    return {
      ...clone(base),
      id: `${base.id}-${String(variantId).toLowerCase()}`,
      baseId: base.id,
      familyId: base.id,
      variantId,
      assessmentRole: role,
      transferDepth: depth,
      seed,
      representation: representation || "parameter",
      prompt,
      options
    };
  }

  function generateBuckRipple(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    if (depth % 3 === 2) {
      const low = pick([0.32, 0.4, 0.48, 0.6], rng);
      const high = round(low * 2, 2);
      return generated(base, variantId, role, depth, seed,
        `兩組 Buck 波形的 Vin、Vout、fsw 與 Iout 相同。波形 A 的 ΔI=${high} A，波形 B 的 ΔI=${low} A。若只改變 L，哪個判斷最合理？`,
        shuffled([
          option("b-larger", "波形 B 對應較大的 L", true, null, "同一電感電壓與時間下，L 越大，di/dt 越小，因此 ΔI 較小。"),
          option("a-larger", "波形 A 對應較大的 L", false, "把 L 與漣波誤認為正比"),
          option("same-l", "兩者 L 必定相同", false, "忽略 ΔI 對 L 的敏感度"),
          option("cannot", "只要 Vin 相同就完全無法判斷", false, "忽略題目已固定其他變數")
        ], rng), "waveform");
    }
    if (depth % 3 === 0) {
      const f1 = pick([80, 100, 125, 200], rng);
      const f2 = f1 * 2;
      return generated(base, variantId, role, depth, seed,
        `在另一個開關式電感應用中，電感兩端的週期性電壓條件與 L 不變，switching frequency 從 ${f1} kHz 提高到 ${f2} kHz。第一階近似下每週期電流漣波會如何變化？`,
        shuffled([
          option("half", "約減半", true, null, "固定電感電壓幅度時，每週期作用時間減半，ΔI 約減半。"),
          option("double", "約加倍", false, "把頻率與週期時間方向弄反"),
          option("same", "約不變", false, "忽略 switching period 改變"),
          option("quarter", "約變成四分之一", false, "誤套平方關係")
        ], rng), "context");
    }
    const l1 = pick([2.2, 3.3, 4.7, 6.8, 10], rng);
    const l2 = round(l1 * 2, 1);
    return generated(base, variantId, role, depth, seed,
      `Buck 的 Vin、Vout 與 fsw 固定，L 從 ${l1} µH 增加到 ${l2} µH。仍在 CCM 時，ΔI 最接近哪個變化？`,
      shuffled([
        option("half", "約減半", true, null, "CCM 漣波與 L 成一次反比。"),
        option("double", "約加倍", false, "把反比誤認為正比"),
        option("same", "近似不變", false, "忽略 L 對 di/dt 的限制"),
        option("quarter", "約變成四分之一", false, "誤套平方反比")
      ], rng), "parameter");
  }

  function generateBuckBoundary(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const delta = pick([0.8, 1.0, 1.2, 1.6, 2.0], rng);
    const boundary = delta / 2;
    const isDcm = rng() < 0.5;
    const iout = round(boundary * (isDcm ? pick([0.45, 0.65, 0.8], rng) : pick([1.2, 1.5, 1.8], rng)), 2);
    return generated(base, variantId, role, depth, seed,
      `某 Buck 以 CCM 公式估得 ΔI=${delta.toFixed(2)} A，現在 Iout=${iout.toFixed(2)} A。忽略非理想時，最合理的工作模式判斷是？`,
      shuffled([
        option("dcm", `DCM，因 Iout ${iout < boundary ? "低於" : "高於"} ΔI/2=${boundary.toFixed(2)} A`, isDcm, isDcm ? null : "把 CCM 邊界方向判反", "CCM 邊界由 Iout≈ΔI/2 判斷。"),
        option("ccm", `CCM，因 Iout ${iout > boundary ? "高於" : "低於"} ΔI/2=${boundary.toFixed(2)} A`, !isDcm, !isDcm ? null : "只看平均電流為正", "谷值 Iout−ΔI/2 是否大於 0 才是關鍵。"),
        option("saturation", "代表電感飽和", false, "把 DCM 與磁飽和混為一談"),
        option("always-boundary", "只要 ΔI 有數值就必定在臨界導通", false, "沒有比較平均電流與半漣波")
      ], rng), depth >= 2 ? "calculation" : "parameter");
  }

  function generateBuckValidity(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const valid = [
      "L 從 10 µH 改成 20 µH，但谷值電流仍明顯大於 0",
      "fsw 從 100 kHz 提高到 200 kHz，仍為固定頻率 CCM",
      "輸出電容 ESR 降低，平均工作點仍在 CCM"
    ];
    const invalid = [
      "輕載 pulse skipping，且每週期有一段電感電流為 0",
      "控制器進入 burst mode，開關週期不再固定",
      "電感谷值碰到 0，負載再繼續降低"
    ];
    const correctText = pick(invalid, rng);
    const choices = [option("invalid", correctText, true, null, "這個情境破壞固定頻率 CCM 的核心假設。")]
      .concat(shuffled(valid, rng).slice(0, 3).map((text, i) => option(`valid-${i}`, text, false, "把參數改變誤當成模型失效")));
    return generated(base, variantId, role, depth, seed,
      "以下哪個新情境最需要停止直接使用 Vout≈Vin×Duty 的理想固定頻率 CCM 直覺？",
      shuffled(choices, rng), "model-selection");
  }

  function generateAdcLevels(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const bits = pick([8, 10, 12, 14, 16], rng), levels = 2 ** bits, max = levels - 1;
    return generated(base, variantId, role, depth, seed,
      `${bits}-bit ideal ADC 的量化 levels 與最大 unsigned code 分別是多少？`,
      shuffled([
        option("correct", `${levels} 個 levels，最大 code ${max}`, true, null, "N-bit ADC 有 2^N 個 levels，code 為 0 到 2^N−1。"),
        option("minus-one", `${max} 個 levels，最大 code ${max}`, false, "把 levels 與最大 code 混為一談"),
        option("max-level", `${levels} 個 levels，最大 code ${levels}`, false, "忽略 code 從 0 開始"),
        option("both-shift", `${max} 個 levels，最大 code ${levels}`, false, "兩個定義同時錯置")
      ], rng), "parameter");
  }

  function generateDividerPower(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const bus = pick([300, 400, 600, 800], rng), topK = pick([330, 470, 680, 820], rng), bottomK = pick([3.3, 4.7, 8.2, 10], rng);
    const currentA = bus / ((topK + bottomK) * 1e3), powerW = currentA * currentA * topK * 1e3;
    const correct = round(powerW, 3), wrongFull = round(bus * bus / (topK * 1e3), 3);
    return generated(base, variantId, role, depth, seed,
      `Vbus=${bus} V、Rtop=${topK} kΩ、Rbottom=${bottomK} kΩ，忽略 ADC loading。Rtop 功耗約多少？`,
      shuffled([
        option("correct", `${correct} W`, true, null, "先用總串聯電阻求電流，再用 I²Rtop。"),
        option("full-bus", `${wrongFull} W`, false, "誤認全部 Vbus 都落在 Rtop"),
        option("half", `${round(correct / 2, 3)} W`, false, "任意把功耗除二"),
        option("double", `${round(correct * 2, 3)} W`, false, "任意把功耗乘二")
      ], rng), "calculation");
  }

  function generateAdcOffset(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const vref = pick([3.0, 3.3, 4.096, 5.0], rng), midpoint = round(vref / 2, 3);
    return generated(base, variantId, role, depth, seed,
      `單電源 0–${vref} V ADC 要量雙向電流，若希望正負量程近似對稱，0 A 最合理放在哪個電壓附近？`,
      shuffled([
        option("mid", `${midpoint} V`, true, null, "把 0 A 放在中點，正負電流才都有 headroom。"),
        option("zero", "0 V", false, "負方向沒有量測 headroom"),
        option("full", `${vref} V`, false, "正方向沒有量測 headroom"),
        option("quarter", `${round(vref / 4, 3)} V`, false, "沒有使用對稱量程的中點")
      ], rng), "parameter");
  }

  function generateSpiClock(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const mhz = pick([2, 5, 8, 10, 20, 25], rng), bits = pick([8, 12, 16, 24, 32], rng), us = round(bits / mhz, 3);
    return generated(base, variantId, role, depth, seed,
      `SPI SCLK=${mhz} MHz、frame=${bits} bit，忽略 frame gap。單一 frame 最低線上時間約多少？`,
      shuffled([
        option("correct", `${us} µs`, true, null, "frame time = bits / SCLK。"),
        option("half", `${round(us / 2, 3)} µs`, false, "多除了一次二"),
        option("double", `${round(us * 2, 3)} µs`, false, "多乘了一次二"),
        option("clock-period", `${round(1 / mhz, 3)} µs`, false, "只算了一個 SCLK period，忽略 frame bits")
      ], rng), "calculation");
  }

  function generateSpiOverrun(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const bits = pick([8, 16, 32], rng), mhz = pick([5, 10, 20], rng), depthWords = pick([4, 8, 16], rng);
    const frameUs = bits / mhz, deadlineUs = frameUs * depthWords;
    const risky = rng() < 0.5;
    const latencyUs = round(deadlineUs * (risky ? pick([1.2, 1.5, 2.0], rng) : pick([0.3, 0.5, 0.7], rng)), 1);
    return generated(base, variantId, role, depth, seed,
      `SPI ${mhz} MHz、${bits}-bit/word、RX FIFO 深度 ${depthWords} words，連續傳輸無 gap。ISR/DMA 最壞服務延遲約 ${latencyUs} µs。只看 queue deadline，哪個判斷較合理？`,
      shuffled([
        option("risk", `有 overrun 風險，FIFO deadline 約 ${round(deadlineUs, 1)} µs`, risky, risky ? null : "把安全服務延遲判成 overrun", "連續輸入時，服務延遲要小於 FIFO 可容納的線上時間。"),
        option("safe", `服務時間有餘裕，FIFO deadline 約 ${round(deadlineUs, 1)} µs`, !risky, !risky ? null : "忽略服務延遲已超過 FIFO deadline", "比較 service latency 與 FIFO deadline。"),
        option("cs", "只要 CS 保持 low 就一定不會 overrun", false, "把交易邊界與 FIFO 服務混為一談"),
        option("cpu", "只要 CPU 主頻高於 SCLK 就一定安全", false, "忽略 ISR/DMA queue latency")
      ], rng), "timing");
  }

  function generateSpiMode(base, variantId, role, depth, seed) {
    const rng = randomFrom(seed);
    const master = pick([0, 1, 2, 3], rng);
    let target = pick([0, 1, 2, 3], rng);
    if (target === master) target = (target + 1 + Math.floor(rng() * 3)) % 4;
    return generated(base, variantId, role, depth, seed,
      `Master 設 SPI mode ${master}，target datasheet 要求 mode ${target}。SCLK 頻率與電壓正常，但資料呈現固定 bit 邊界錯位。最先應驗證什麼？`,
      shuffled([
        option("mode", "把 CPOL/CPHA 調成雙方一致，再確認 bit order 與 word length", true, null, "規律性邊界錯位先查取樣/改變邊緣與 frame 定義。"),
        option("emi", "先假設隨機 EMI", false, "忽略錯誤高度規律"),
        option("heap", "先增加 heap", false, "把 serial framing 問題當記憶體配置"),
        option("pwm", "調整 PWM duty", false, "改了無關控制量")
      ], rng), "context");
  }

  const variantGenerators = {
    "buck-ripple-inductance-transfer": generateBuckRipple,
    "buck-dcm-boundary": generateBuckBoundary,
    "buck-model-validity": generateBuckValidity,
    "adc-levels-vs-codes": generateAdcLevels,
    "adc-divider-power": generateDividerPower,
    "adc-offset-purpose": generateAdcOffset,
    "spi-clock-throughput": generateSpiClock,
    "spi-rx-overrun": generateSpiOverrun,
    "spi-cpol-cpha": generateSpiMode
  };

  function generateVariant(base, variantId, role, depth) {
    const seed = seedFrom(`${base.id}:${role}:${variantId}:${depth}`);
    const generator = variantGenerators[base.id];
    if (!generator) return null;
    return generator(base, variantId, role, depth, seed);
  }

  function makeBaseline(base) {
    return { ...clone(base), baseId: base.id, familyId: base.id, variantId: "A", assessmentRole: "baseline", transferDepth: 0, seed: seedFrom(`${base.id}:baseline`) };
  }

  function expandQuestions(baseQuestions) {
    return (baseQuestions || []).flatMap(base => {
      const a = makeBaseline(base);
      const b = generateVariant(base, "B", "transfer", 1);
      const c = generateVariant(base, "C", "transfer", 2);
      const d = generateVariant(base, "D", "retention", 3);
      return [a, b, c, d].filter(Boolean);
    });
  }

  function familyQuestions(questions, familyId) { return (questions || []).filter(q => q.familyId === familyId); }
  function families(questions) {
    const map = new Map();
    (questions || []).forEach(q => { if (!map.has(q.familyId)) map.set(q.familyId, []); map.get(q.familyId).push(q); });
    return [...map.entries()].map(([familyId, items]) => ({ familyId, questions: items }));
  }

  function normalizeFamilyState(state, questions) {
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    families(questions).forEach(({ familyId }) => {
      const answer = state.questions[familyId]; if (!answer) return;
      const history = Array.isArray(answer.history) ? answer.history : [];
      history.forEach((entry, index) => {
        entry.familyId = entry.familyId || familyId;
        entry.questionId = entry.questionId || familyId;
        entry.variantId = entry.variantId || (index ? "B" : "A");
        entry.assessmentRole = entry.assessmentRole || (entry.variantId === "A" ? "baseline" : "transfer");
        if (entry.firstAttemptForVariant == null) entry.firstAttemptForVariant = !history.slice(0, index).some(previous => previous.variantId === entry.variantId);
        if (entry.firstAttemptForFamily == null) entry.firstAttemptForFamily = index === 0;
      });
      answer.history = history;
    });
    return state;
  }

  function normalizeConfidence(value) {
    const n = Number(value); if (!Number.isFinite(n)) return null;
    if (n > 1) return n === 2 ? 0.7 : n === 3 ? 0.9 : Math.min(1, n / 100);
    return Math.max(0, Math.min(1, n));
  }

  function recordAttempt(state, question, selectedOption, atOrMeta, maybeMeta) {
    const meta = typeof atOrMeta === "object" && atOrMeta !== null ? atOrMeta : (maybeMeta || {});
    const at = typeof atOrMeta === "string" ? atOrMeta : (meta.at || new Date().toISOString());
    const familyId = question.familyId || question.id;
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    const family = state.questions[familyId] || { history: [] }, history = Array.isArray(family.history) ? family.history : [];
    const firstAttemptForVariant = !history.some(entry => entry.variantId === question.variantId);
    const entry = {
      id: familyId + ":" + (question.variantId || "A") + ":" + at,
      at, familyId, questionId: question.id, variantId: question.variantId || "A",
      assessmentRole: question.assessmentRole || (question.variantId === "A" ? "baseline" : "transfer"),
      competency: question.competency, choiceId: selectedOption.id, correct: !!selectedOption.correct,
      firstAttemptForVariant, firstAttemptForFamily: history.length === 0,
      elapsedMs: Number(meta.elapsedMs || 0), hintsUsed: Number(meta.hintsUsed || 0), confidence: normalizeConfidence(meta.confidence),
      seed: question.seed == null ? null : question.seed, transferDepth: Number(question.transferDepth || 0), representation: question.representation || null
    };
    history.push(entry);
    state.questions[familyId] = { history, choiceId: selectedOption.id, correct: !!selectedOption.correct, attempts: history.length, updatedAt: at };
    return entry;
  }

  function retentionState(history, transferPassedAt, nowMs) {
    if (!transferPassedAt) return { stage: 0, retained: false, fullyRetained: false, due: false, nextReviewAt: null };
    let stage = 0, anchor = Date.parse(transferPassedAt), nextDue = anchor + RETENTION_INTERVALS_MS[0];
    const reviews = history.filter(entry => entry.assessmentRole === "retention" && Date.parse(entry.at) >= anchor).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    for (const entry of reviews) {
      const when = Date.parse(entry.at); if (when < nextDue) continue;
      stage = entry.correct && entry.firstAttemptForVariant ? Math.min(RETENTION_INTERVALS_MS.length, stage + 1) : Math.max(0, stage - 1);
      anchor = when; nextDue = stage >= RETENTION_INTERVALS_MS.length ? null : anchor + RETENTION_INTERVALS_MS[stage];
    }
    const clock = nowMs == null ? Date.now() : nowMs;
    return { stage, retained: stage >= 1, fullyRetained: stage >= RETENTION_INTERVALS_MS.length, due: nextDue != null && clock >= nextDue, nextReviewAt: nextDue == null ? null : new Date(nextDue).toISOString() };
  }

  function metrics(answer, nowMs) {
    const history = answer && Array.isArray(answer.history) ? answer.history : [];
    const baselineEntry = history.find(entry => entry.assessmentRole === "baseline" && entry.firstAttemptForVariant) || history[0] || null;
    const transferFirstAttempts = history.filter(entry => entry.assessmentRole === "transfer" && entry.firstAttemptForVariant);
    const firstTransferAttempt = transferFirstAttempts[0] || null, transferPassEntry = transferFirstAttempts.find(entry => entry.correct) || null;
    const transferPassedAt = transferPassEntry ? transferPassEntry.at : null, retention = retentionState(history, transferPassedAt, nowMs);
    const recovery = !!(baselineEntry && !baselineEntry.correct && history.some((entry,index)=>index>0&&entry.correct));
    return { attempts: history.length, baseline: baselineEntry ? !!baselineEntry.correct : null, transferFirstAttempt: firstTransferAttempt ? !!firstTransferAttempt.correct : null, transfer: !!transferPassEntry, transferPassedAt, recovery, retentionStage: retention.stage, retained: retention.retained, fullyRetained: retention.fullyRetained, due: retention.due, dueAt: retention.nextReviewAt, nextReviewAt: retention.nextReviewAt };
  }

  function mastery(questionOrFamily, state, questions, nowMs) {
    const familyId = typeof questionOrFamily === "string" ? questionOrFamily : questionOrFamily.familyId || questionOrFamily.id;
    return metrics(state && state.questions && state.questions[familyId], nowMs);
  }

  function nextQuestion(items, answer, nowMs) {
    const list = items || []; if (!list.length) return null;
    const history = answer && Array.isArray(answer.history) ? answer.history : [], m = metrics(answer, nowMs), baseline = list.find(q=>q.assessmentRole==="baseline") || list[0];
    if (!history.length) return baseline;
    if (!m.transfer) {
      const unseen = list.find(q=>q.assessmentRole==="transfer"&&!history.some(h=>h.variantId===q.variantId)); if (unseen) return unseen;
      const ordinal = history.filter(h=>h.assessmentRole==="transfer"&&h.firstAttemptForVariant).length + 1;
      return generateVariant(baseline, "T" + ordinal, "transfer", ordinal + 2);
    }
    if (!m.due) return null;
    const unseenRetention = list.find(q=>q.assessmentRole==="retention"&&!history.some(h=>h.variantId===q.variantId)); if (unseenRetention) return unseenRetention;
    const ordinal = history.filter(h=>h.assessmentRole==="retention"&&h.firstAttemptForVariant).length + 1;
    return generateVariant(baseline, "R" + (m.retentionStage + 1) + "-" + ordinal, "retention", ordinal + 3);
  }

  function competencyMetrics(competency, state, questions, nowMs) {
    const family = (questions || []).find(q=>q.competency===competency);
    return family ? mastery(family.familyId,state,questions,nowMs) : { transfer:false,retained:false,due:false,missing:true };
  }
  const prerequisitesFor = competency => (competencyPrerequisites[competency] || []).slice();
  const competencyUnlocked = (competency,state,questions,nowMs) => prerequisitesFor(competency).every(dep=>competencyMetrics(dep,state,questions,nowMs).transfer);
  const requirementsForModule = moduleId => (moduleRequirements[moduleId] || []).slice();
  const moduleUnlocked = (moduleId,state,questions,nowMs) => requirementsForModule(moduleId).every(dep=>competencyMetrics(dep,state,questions,nowMs).transfer);

  function calibrationSummary(history) {
    const rows=(history||[]).filter(entry=>entry.confidence!=null); if(!rows.length)return{n:0,brier:null,meanConfidence:null,accuracy:null,calibrationGap:null};
    const mean=values=>values.reduce((s,v)=>s+v,0)/values.length, confidence=mean(rows.map(e=>normalizeConfidence(e.confidence))), accuracy=mean(rows.map(e=>e.correct?1:0));
    const brier=mean(rows.map(e=>Math.pow(normalizeConfidence(e.confidence)-(e.correct?1:0),2)));
    return{n:rows.length,brier:round(brier,3),meanConfidence:Math.round(confidence*100),accuracy:Math.round(accuracy*100),calibrationGap:Math.round((confidence-accuracy)*100)};
  }

  function wilsonInterval(successes, n, z) {
    if (!n) return null;
    const zz = (z == null ? 1.96 : z), p = successes / n, z2 = zz * zz, denom = 1 + z2 / n;
    const center = (p + z2 / (2*n)) / denom;
    const half = zz * Math.sqrt((p*(1-p)+z2/(4*n))/n) / denom;
    return { low: Math.max(0, Math.round((center-half)*100)), high: Math.min(100, Math.round((center+half)*100)) };
  }

  function evidenceGrade(n) { return n >= 30 ? "HIGH" : n >= 10 ? "MODERATE" : n >= 5 ? "LOW" : "VERY LOW"; }

  function benchmarkSummary(state, questions, nowMs) {
    const rows=families(questions).map(({familyId,questions:items})=>{const q=items[0];return{familyId,competency:q.competency,moduleId:q.moduleId,...mastery(familyId,state,questions,nowMs)}});
    const paired=rows.filter(row=>row.baseline!=null&&row.transferFirstAttempt!=null), n=paired.length;
    const baselineCorrect=paired.filter(row=>row.baseline).length, transferCorrect=paired.filter(row=>row.transferFirstAttempt).length;
    const pct=(x,d)=>d?Math.round(x/d*100):null, baselineAccuracy=pct(baselineCorrect,n), transferAccuracy=pct(transferCorrect,n);
    const baselineInterval=wilsonInterval(baselineCorrect,n), transferInterval=wilsonInterval(transferCorrect,n);
    const deltaInterval=baselineInterval&&transferInterval?{low:transferInterval.low-baselineInterval.high,high:transferInterval.high-baselineInterval.low}:null;
    const allHistory=Object.values((state&&state.questions)||{}).flatMap(answer=>Array.isArray(answer.history)?answer.history:[]);
    return{families:rows.length,pairedN:n,baselineAccuracy,transferAccuracy,baselineInterval,transferInterval,deltaPoints:baselineAccuracy!=null&&transferAccuracy!=null?transferAccuracy-baselineAccuracy:null,deltaInterval,evidenceGrade:evidenceGrade(n),transferPassed:rows.filter(r=>r.transfer).length,retained:rows.filter(r=>r.retained).length,fullyRetained:rows.filter(r=>r.fullyRetained).length,due:rows.filter(r=>r.due).length,calibration:calibrationSummary(allHistory),rows};
  }

  function coverageSummary(curriculum, questions, oracleLabIds) {
    const oracleSet = new Set(oracleLabIds || MEASUREMENT_ORACLE_LABS), byCompetency = new Map();
    const touch = (competency, patch) => { if (!competency) return; const row=byCompetency.get(competency)||{competency,lesson:false,lab:false,oracle:false,transfer:false,retention:false,moduleId:null}; Object.assign(row,patch); byCompetency.set(competency,row); };
    ((curriculum&&curriculum.modules)||[]).forEach(module=>{
      (module.lessons||[]).forEach(item=>touch(item.competency,{lesson:true,moduleId:module.id}));
      (module.labs||[]).forEach(item=>touch(item.competency,{lab:true,oracle:oracleSet.has(item.id),moduleId:module.id}));
    });
    families(questions).forEach(({questions:items})=>{const q=items[0];touch(q.competency,{moduleId:q.moduleId,transfer:items.some(x=>x.assessmentRole==="transfer"&&x.seed!=null),retention:items.some(x=>x.assessmentRole==="retention"&&x.seed!=null)});});
    const rows=[...byCompetency.values()].map(row=>{const measured=row.transfer&&row.retention, verified=row.oracle&&measured;return{...row,status:verified?"verified":measured?"measured":row.lab?"practiced":row.lesson?"taught":"unmeasured"};});
    const moduleRows=((curriculum&&curriculum.modules)||[]).map(module=>{const items=rows.filter(r=>r.moduleId===module.id),measured=items.filter(r=>r.transfer&&r.retention).length,verified=items.filter(r=>r.oracle&&r.transfer&&r.retention).length;return{moduleId:module.id,title:module.title,total:items.length,measured,verified,coveragePct:items.length?Math.round(measured/items.length*100):0};});
    return{total:rows.length,measured:rows.filter(r=>r.transfer&&r.retention).length,verified:rows.filter(r=>r.oracle&&r.transfer&&r.retention).length,rows,moduleRows};
  }

  const txt = value => String(value || "").toLowerCase();
  const has = (value, words) => words.some(word => txt(value).includes(String(word).toLowerCase()));
  const hasNumber = value => /[-+]?\d+(?:\.\d+)?/.test(String(value || ""));
  const enough = (value, n) => String(value || "").replace(/\s+/g, "").length >= n;
  function genericReasoning(draft, verification) {
    const claim = enough(draft.prediction,8) && has(draft.prediction,["增","減","升","降","不變","提高","降低"]) ? 2 : enough(draft.prediction,5) ? 1 : 0;
    const evidence = hasNumber(draft.observation) && verification && verification.passed ? 2 : hasNumber(draft.observation) ? 1 : 0;
    const mechanism = enough(draft.explanation,12) && has(draft.explanation,["因為","因此","所以","反比","正比","電流","電壓","時序","能量","斜率","增益"]) ? 2 : enough(draft.explanation,12) ? 1 : 0;
    const boundary = enough(draft.limitations,8) && has(draft.limitations,["忽略","失效","飽和","dcm","noise","雜訊","容差","dcr","頻寬","延遲","loading","箝位","pulse","burst"]) ? 2 : enough(draft.limitations,8) ? 1 : 0;
    const transfer = enough(draft.transfer,8) && (hasNumber(draft.transfer)||has(draft.transfer,["加倍","減半","換","改","提高","降低","增加","減少"])) ? 2 : enough(draft.transfer,8) ? 1 : 0;
    return{claim,evidence,mechanism,boundary,transfer};
  }

  function evaluateReasoning(labId, draft, context) {
    const verification=context&&context.verification||null, scores=genericReasoning(draft||{},verification);
    if(labId==="buck.lab.buck-ripple"){
      scores.claim=has(draft.prediction,["l","電感","fsw","頻率"])&&has(draft.prediction,["減","降","反比","小"])?2:scores.claim;
      const measured=verification&&verification.acceptance&&verification.acceptance.measured;
      scores.evidence=verification&&verification.passed&&hasNumber(draft.observation)&&(has(draft.observation,["20%","0.2","δi","漣波"])||Number.isFinite(measured))?2:scores.evidence;
      scores.mechanism=has(draft.explanation,["di/dt","伏秒","反比"])&&has(draft.explanation,["l","電感","fsw","頻率"])?2:scores.mechanism;
      scores.boundary=has(draft.limitations,["dcm","pulse","burst","dcr","壓降","非理想"])?2:scores.boundary;
      scores.transfer=has(draft.transfer,["fsw","頻率","l","電感"])&&has(draft.transfer,["加倍","減半","提高","降低","增加","減少"])?2:scores.transfer;
    } else if(labId==="adc.lab.adc-divider"){
      scores.claim=has(draft.prediction,["rtop","rbot","分壓","adc","母線"])&&has(draft.prediction,["增","減","升","降","高","低"])?2:scores.claim;
      scores.evidence=verification&&verification.passed&&hasNumber(draft.observation)&&has(draft.observation,["v","電壓","adc"])?2:scores.evidence;
      scores.mechanism=has(draft.explanation,["分壓","ohm","歐姆","串聯","電阻"])&&has(draft.explanation,["電流","電壓","比例"])?2:scores.mechanism;
      scores.boundary=has(draft.limitations,["loading","取樣","箝位","容差","功耗","工作電壓","vref"])?2:scores.boundary;
      scores.transfer=has(draft.transfer,["vbus","母線","rtop","rbot","電阻"])&&has(draft.transfer,["增加","減少","提高","降低","改"])?2:scores.transfer;
    }
    const total=Object.values(scores).reduce((s,v)=>s+v,0), essential=scores.claim>=1&&scores.evidence>=1&&scores.mechanism>=1;
    return{scores,total,max:10,passed:essential&&total>=8,essential};
  }

  return {
    DAY_MS, RETENTION_MS: RETENTION_INTERVALS_MS[0], RETENTION_INTERVALS_MS, MEASUREMENT_ORACLE_LABS,
    competencyPrerequisites, moduleRequirements, expandQuestions, generateVariant, familyQuestions, families, normalizeFamilyState,
    recordAttempt, metrics, mastery, nextQuestion, calibrationSummary, wilsonInterval, evidenceGrade, benchmarkSummary, coverageSummary, evaluateReasoning,
    competencyMetrics, prerequisitesFor, competencyUnlocked, requirementsForModule, moduleUnlocked, seedFrom
  };
});