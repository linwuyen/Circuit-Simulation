(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitAssessment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RETENTION_MS = 24 * 60 * 60 * 1000;

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

  const variantOverrides = {
    "buck-ripple-inductance-transfer": {
      prompt: "Vin、Vout 與 L 不變，把開關頻率 fsw 加倍後，CCM 電流漣波 ΔI 約如何變化？"
    },
    "buck-dcm-boundary": {
      prompt: "理想 Buck 的 CCM 漣波估算得到 ΔI=1.6 A。負載平均電流降到 0.5 A 時，最合理的判斷是什麼？"
    },
    "buck-model-validity": {
      prompt: "控制器在輕載進入 pulse skipping，而且電感電流會降到 0。此時哪個判斷最合理？"
    },
    "adc-levels-vs-codes": {
      prompt: "10-bit ADC 的量化 levels 與最大 code 分別是多少？",
      options: [
        { id: "4096-4095", text: "1024 個 levels，最大 code 1023", correct: true, feedback: "N-bit ADC 有 2^N 個 levels，code 從 0 到 2^N−1。" },
        { id: "4095-4095", text: "1023 個 levels，最大 code 1023", misconception: "把 levels 與最大 code 混為一談", feedback: "0 也是一個 code，因此共有 1024 個 levels。" },
        { id: "4096-4096", text: "1024 個 levels，最大 code 1024", misconception: "忽略 code 從 0 開始", feedback: "最大 code 是 1023。" },
        { id: "4095-4096", text: "1023 個 levels，最大 code 1024", misconception: "兩個定義同時錯置", feedback: "levels=1024，max code=1023。" }
      ]
    },
    "adc-divider-power": {
      prompt: "高壓分壓器的 Rtop 改值後，要重新評估 Rtop 功耗，正確步驟仍是什麼？"
    },
    "adc-offset-purpose": {
      prompt: "單電源 0–5 V ADC 要量測雙向電流，把 0 A 放在約 2.5 V 的根本目的為何？"
    },
    "spi-clock-throughput": {
      prompt: "SPI 傳輸一個 32-bit frame 的最低線上時間，主要由哪個量決定？"
    },
    "spi-rx-overrun": {
      prompt: "RX FIFO 深度有限，Master 連續送資料時偶爾少 word，而 SCLK/MOSI 正常。最優先驗證什麼？"
    },
    "spi-cpol-cpha": {
      prompt: "SPI 每個 word 都固定錯一個 bit 邊界，頻率與電壓準位正常。最可能先檢查什麼？"
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function expandQuestions(baseQuestions) {
    return (baseQuestions || []).flatMap(base => {
      const a = { ...clone(base), familyId: base.id, variantId: "A", baseId: base.id };
      const override = variantOverrides[base.id];
      if (!override) return [a];
      const b = {
        ...clone(base),
        ...clone(override),
        id: base.id + "-variant-b",
        familyId: base.id,
        variantId: "B",
        baseId: base.id,
        options: clone(override.options || base.options)
      };
      return [a, b];
    });
  }

  function familyQuestions(questions, familyId) {
    return questions.filter(q => q.familyId === familyId);
  }

  function families(questions) {
    const map = new Map();
    (questions || []).forEach(q => {
      if (!map.has(q.familyId)) map.set(q.familyId, []);
      map.get(q.familyId).push(q);
    });
    return [...map.entries()].map(([familyId, items]) => ({ familyId, questions: items }));
  }

  function normalizeFamilyState(state, questions) {
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    families(questions).forEach(({ familyId }) => {
      const legacy = state.questions[familyId];
      if (!legacy) return;
      const history = Array.isArray(legacy.history) ? legacy.history : [];
      history.forEach((entry, index) => {
        if (!entry.questionId) entry.questionId = familyId;
        if (!entry.variantId) entry.variantId = "A";
        if (entry.firstAttemptForVariant == null) entry.firstAttemptForVariant = index === 0;
      });
      legacy.history = history;
    });
    return state;
  }

  function recordAttempt(state, question, option, at) {
    const familyId = question.familyId || question.id;
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    const family = state.questions[familyId] || { history: [] };
    const history = Array.isArray(family.history) ? family.history : [];
    const firstAttemptForVariant = !history.some(entry => entry.variantId === question.variantId);
    const firstAttemptForFamily = history.length === 0;
    const entry = {
      at: at || new Date().toISOString(),
      familyId,
      questionId: question.id,
      variantId: question.variantId || "A",
      competency: question.competency,
      choiceId: option.id,
      correct: !!option.correct,
      firstAttemptForVariant,
      firstAttemptForFamily
    };
    history.push(entry);
    state.questions[familyId] = {
      history,
      choiceId: option.id,
      correct: !!option.correct,
      attempts: history.length,
      updatedAt: entry.at
    };
    return entry;
  }

  function metrics(answer, nowMs, retentionMs) {
    const history = answer && Array.isArray(answer.history) ? answer.history : [];
    const first = history[0] || null;
    const variantsSeen = [...new Set(history.map(x => x.variantId))];
    const correctVariants = [...new Set(history.filter(x => x.correct).map(x => x.variantId))];
    const firstAttempts = history.filter(x => x.firstAttemptForVariant);
    const baseline = first ? !!first.correct : null;
    const secondVariantFirst = firstAttempts.find(x => x.variantId !== (first && first.variantId));
    const transferFirstAttempt = secondVariantFirst ? !!secondVariantFirst.correct : null;
    const transfer = correctVariants.length >= 2;
    const firstCorrect = history.find(x => x.correct);
    const delay = retentionMs == null ? RETENTION_MS : retentionMs;
    const clock = nowMs == null ? Date.now() : nowMs;
    const retainedEntry = firstCorrect && history.find(x => x.correct && Date.parse(x.at) - Date.parse(firstCorrect.at) >= delay);
    const retained = !!(transfer && retainedEntry);
    const dueAt = transfer && firstCorrect && !retained ? new Date(Date.parse(firstCorrect.at) + delay).toISOString() : null;
    const due = !!(dueAt && clock >= Date.parse(dueAt));
    const recovery = !!(first && !first.correct && history.some((x, index) => index > 0 && x.correct));
    return {
      attempts: history.length,
      variantsSeen,
      correctVariants,
      baseline,
      transferFirstAttempt,
      transfer,
      recovery,
      retained,
      due,
      dueAt
    };
  }

  function mastery(questionOrFamily, state, questions, nowMs, retentionMs) {
    const familyId = typeof questionOrFamily === "string" ? questionOrFamily : questionOrFamily.familyId || questionOrFamily.id;
    const answer = state && state.questions && state.questions[familyId];
    return metrics(answer, nowMs, retentionMs);
  }

  function nextQuestion(items, answer, nowMs) {
    const list = items || [];
    if (!list.length) return null;
    const m = metrics(answer, nowMs);
    const history = answer && Array.isArray(answer.history) ? answer.history : [];
    const unseen = list.find(q => !history.some(h => h.variantId === q.variantId));
    if (unseen) return unseen;
    if (m.due) {
      const lastVariant = history.length ? history[history.length - 1].variantId : null;
      return list.find(q => q.variantId !== lastVariant) || list[0];
    }
    return list[list.length - 1];
  }

  function competencyMetrics(competency, state, questions, nowMs) {
    const family = (questions || []).find(q => q.competency === competency);
    if (!family) return { transfer: false, retained: false, due: false, missing: true };
    return mastery(family.familyId, state, questions, nowMs);
  }

  function prerequisitesFor(competency) {
    return (competencyPrerequisites[competency] || []).slice();
  }

  function competencyUnlocked(competency, state, questions, nowMs) {
    return prerequisitesFor(competency).every(dep => competencyMetrics(dep, state, questions, nowMs).transfer);
  }

  function requirementsForModule(moduleId) {
    return (moduleRequirements[moduleId] || []).slice();
  }

  function moduleUnlocked(moduleId, state, questions, nowMs) {
    return requirementsForModule(moduleId).every(dep => competencyMetrics(dep, state, questions, nowMs).transfer);
  }

  function benchmarkSummary(state, questions, nowMs) {
    const rows = families(questions).map(({ familyId, questions: items }) => {
      const question = items[0];
      const m = mastery(familyId, state, questions, nowMs);
      return { familyId, competency: question.competency, moduleId: question.moduleId, ...m };
    });
    const baselineAnswered = rows.filter(r => r.baseline != null);
    const transferAnswered = rows.filter(r => r.transferFirstAttempt != null);
    const baselineCorrect = baselineAnswered.filter(r => r.baseline).length;
    const transferCorrect = transferAnswered.filter(r => r.transferFirstAttempt).length;
    const pct = (n, d) => d ? Math.round(n / d * 100) : null;
    const baselineAccuracy = pct(baselineCorrect, baselineAnswered.length);
    const transferAccuracy = pct(transferCorrect, transferAnswered.length);
    return {
      families: rows.length,
      baselineAnswered: baselineAnswered.length,
      transferAnswered: transferAnswered.length,
      baselineAccuracy,
      transferAccuracy,
      deltaPoints: baselineAccuracy != null && transferAccuracy != null ? transferAccuracy - baselineAccuracy : null,
      transferPassed: rows.filter(r => r.transfer).length,
      retained: rows.filter(r => r.retained).length,
      due: rows.filter(r => r.due && !r.retained).length,
      rows
    };
  }

  return {
    RETENTION_MS,
    competencyPrerequisites,
    moduleRequirements,
    expandQuestions,
    familyQuestions,
    families,
    normalizeFamilyState,
    recordAttempt,
    metrics,
    mastery,
    nextQuestion,
    competencyMetrics,
    prerequisitesFor,
    competencyUnlocked,
    requirementsForModule,
    moduleUnlocked,
    benchmarkSummary
  };
});