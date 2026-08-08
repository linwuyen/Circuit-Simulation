(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitAssessment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const RETENTION_INTERVALS_MS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS, 90 * DAY_MS];

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
    "buck-ripple-inductance-transfer": { prompt: "Vin、Vout 與 L 不變，把開關頻率 fsw 加倍後，CCM 電流漣波 ΔI 約如何變化？" },
    "buck-dcm-boundary": { prompt: "理想 Buck 的 CCM 漣波估算得到 ΔI=1.6 A。負載平均電流降到 0.5 A 時，最合理的判斷是什麼？" },
    "buck-model-validity": { prompt: "控制器在輕載進入 pulse skipping，而且電感電流會降到 0。此時哪個判斷最合理？" },
    "adc-levels-vs-codes": {
      prompt: "10-bit ADC 的量化 levels 與最大 code 分別是多少？",
      options: [
        { id: "1024-1023", text: "1024 個 levels，最大 code 1023", correct: true, feedback: "N-bit ADC 有 2^N 個 levels，code 從 0 到 2^N−1。" },
        { id: "1023-1023", text: "1023 個 levels，最大 code 1023", misconception: "把 levels 與最大 code 混為一談", feedback: "0 也是一個 code，因此共有 1024 個 levels。" },
        { id: "1024-1024", text: "1024 個 levels，最大 code 1024", misconception: "忽略 code 從 0 開始", feedback: "最大 code 是 1023。" },
        { id: "1023-1024", text: "1023 個 levels，最大 code 1024", misconception: "兩個定義同時錯置", feedback: "levels=1024，max code=1023。" }
      ]
    },
    "adc-divider-power": { prompt: "高壓分壓器的 Rtop 改值後，要重新評估 Rtop 功耗，正確步驟仍是什麼？" },
    "adc-offset-purpose": { prompt: "單電源 0–5 V ADC 要量測雙向電流，把 0 A 放在約 2.5 V 的根本目的為何？" },
    "spi-clock-throughput": { prompt: "SPI 傳輸一個 32-bit frame 的最低線上時間，主要由哪個量決定？" },
    "spi-rx-overrun": { prompt: "RX FIFO 深度有限，Master 連續送資料時偶爾少 word，而 SCLK/MOSI 正常。最優先驗證什麼？" },
    "spi-cpol-cpha": { prompt: "SPI 每個 word 都固定錯一個 bit 邊界，頻率與電壓準位正常。最可能先檢查什麼？" }
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const rotate = (items, shift) => {
    const list = clone(items || []);
    if (!list.length) return list;
    const n = ((shift % list.length) + list.length) % list.length;
    return list.slice(n).concat(list.slice(0, n));
  };

  function makeVariant(base, id, variantId, role, prompt, options, shift) {
    return {
      ...clone(base),
      id,
      baseId: base.id,
      familyId: base.id,
      variantId,
      assessmentRole: role,
      prompt: prompt || base.prompt,
      options: rotate(options || base.options, shift || 0)
    };
  }

  function expandQuestions(baseQuestions) {
    return (baseQuestions || []).flatMap(base => {
      const override = variantOverrides[base.id] || {};
      const transferPrompt = override.prompt || ("換一組條件重新判斷：" + base.prompt);
      const transferOptions = override.options || base.options;
      return [
        makeVariant(base, base.id, "A", "baseline", base.prompt, base.options, 0),
        makeVariant(base, base.id + "-variant-b", "B", "transfer", transferPrompt, transferOptions, 1),
        makeVariant(base, base.id + "-variant-c", "C", "transfer", "另一個未見情境：" + transferPrompt, transferOptions, 2),
        makeVariant(base, base.id + "-variant-d", "D", "retention", "延遲取回：" + transferPrompt, transferOptions, 3)
      ];
    });
  }

  function familyQuestions(questions, familyId) {
    return (questions || []).filter(q => q.familyId === familyId);
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
      const answer = state.questions[familyId];
      if (!answer) return;
      const history = Array.isArray(answer.history) ? answer.history : [];
      history.forEach((entry, index) => {
        entry.familyId = entry.familyId || familyId;
        entry.questionId = entry.questionId || familyId;
        entry.variantId = entry.variantId || (index ? "B" : "A");
        entry.assessmentRole = entry.assessmentRole || (entry.variantId === "A" ? "baseline" : "transfer");
        if (entry.firstAttemptForVariant == null) {
          entry.firstAttemptForVariant = !history.slice(0, index).some(previous => previous.variantId === entry.variantId);
        }
        if (entry.firstAttemptForFamily == null) entry.firstAttemptForFamily = index === 0;
      });
      answer.history = history;
    });
    return state;
  }

  function normalizeConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n > 1) return n === 1 ? 0.5 : n === 2 ? 0.7 : n === 3 ? 0.9 : Math.min(1, n / 100);
    return Math.max(0, Math.min(1, n));
  }

  function recordAttempt(state, question, option, atOrMeta, maybeMeta) {
    const meta = typeof atOrMeta === "object" && atOrMeta !== null ? atOrMeta : (maybeMeta || {});
    const at = typeof atOrMeta === "string" ? atOrMeta : (meta.at || new Date().toISOString());
    const familyId = question.familyId || question.id;
    state.questions = state.questions && typeof state.questions === "object" ? state.questions : {};
    const family = state.questions[familyId] || { history: [] };
    const history = Array.isArray(family.history) ? family.history : [];
    const firstAttemptForVariant = !history.some(entry => entry.variantId === question.variantId);
    const entry = {
      id: familyId + ":" + (question.variantId || "A") + ":" + at,
      at,
      familyId,
      questionId: question.id,
      variantId: question.variantId || "A",
      assessmentRole: question.assessmentRole || (question.variantId === "A" ? "baseline" : "transfer"),
      competency: question.competency,
      choiceId: option.id,
      correct: !!option.correct,
      firstAttemptForVariant,
      firstAttemptForFamily: history.length === 0,
      elapsedMs: Number(meta.elapsedMs || 0),
      hintsUsed: Number(meta.hintsUsed || 0),
      confidence: normalizeConfidence(meta.confidence)
    };
    history.push(entry);
    state.questions[familyId] = {
      history,
      choiceId: option.id,
      correct: !!option.correct,
      attempts: history.length,
      updatedAt: at
    };
    return entry;
  }

  function retentionState(history, transferPassedAt, nowMs) {
    if (!transferPassedAt) return { stage: 0, retained: false, due: false, nextReviewAt: null };
    let stage = 0;
    let anchor = Date.parse(transferPassedAt);
    let nextDue = anchor + RETENTION_INTERVALS_MS[0];
    const reviews = history
      .filter(entry => entry.assessmentRole === "retention" && Date.parse(entry.at) >= anchor)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    for (const entry of reviews) {
      const when = Date.parse(entry.at);
      if (when < nextDue) continue;
      if (entry.correct && entry.firstAttemptForVariant) {
        stage = Math.min(RETENTION_INTERVALS_MS.length, stage + 1);
      } else {
        stage = Math.max(0, stage - 1);
      }
      anchor = when;
      nextDue = stage >= RETENTION_INTERVALS_MS.length ? null : anchor + RETENTION_INTERVALS_MS[stage];
    }

    const clock = nowMs == null ? Date.now() : nowMs;
    return {
      stage,
      retained: stage >= 1,
      fullyRetained: stage >= RETENTION_INTERVALS_MS.length,
      due: nextDue != null && clock >= nextDue,
      nextReviewAt: nextDue == null ? null : new Date(nextDue).toISOString()
    };
  }

  function metrics(answer, nowMs) {
    const history = answer && Array.isArray(answer.history) ? answer.history : [];
    const baselineEntry = history.find(entry => entry.assessmentRole === "baseline" && entry.firstAttemptForVariant) || history[0] || null;
    const transferFirstAttempts = history.filter(entry => entry.assessmentRole === "transfer" && entry.firstAttemptForVariant);
    const firstTransferAttempt = transferFirstAttempts[0] || null;
    const transferPassEntry = transferFirstAttempts.find(entry => entry.correct) || null;
    const transferPassedAt = transferPassEntry ? transferPassEntry.at : null;
    const retention = retentionState(history, transferPassedAt, nowMs);
    const recovery = !!(baselineEntry && !baselineEntry.correct && history.some((entry, index) => index > 0 && entry.correct));
    return {
      attempts: history.length,
      baseline: baselineEntry ? !!baselineEntry.correct : null,
      transferFirstAttempt: firstTransferAttempt ? !!firstTransferAttempt.correct : null,
      transfer: !!transferPassEntry,
      transferPassedAt,
      recovery,
      retentionStage: retention.stage,
      retained: retention.retained,
      fullyRetained: retention.fullyRetained,
      due: retention.due,
      dueAt: retention.nextReviewAt,
      nextReviewAt: retention.nextReviewAt
    };
  }

  function mastery(questionOrFamily, state, questions, nowMs) {
    const familyId = typeof questionOrFamily === "string" ? questionOrFamily : questionOrFamily.familyId || questionOrFamily.id;
    const answer = state && state.questions && state.questions[familyId];
    return metrics(answer, nowMs);
  }

  function syntheticVariant(template, variantId, role, ordinal) {
    return {
      ...clone(template),
      id: template.familyId + "-" + variantId.toLowerCase(),
      variantId,
      assessmentRole: role,
      prompt: (role === "retention" ? "延遲取回新變體 " : "未見遷移變體 ") + ordinal + "：" + template.prompt,
      options: rotate(template.options, ordinal)
    };
  }

  function nextQuestion(items, answer, nowMs) {
    const list = items || [];
    if (!list.length) return null;
    const history = answer && Array.isArray(answer.history) ? answer.history : [];
    const m = metrics(answer, nowMs);
    const baseline = list.find(q => q.assessmentRole === "baseline") || list[0];
    if (!history.length) return baseline;

    if (!m.transfer) {
      const unseen = list.find(q => q.assessmentRole === "transfer" && !history.some(h => h.variantId === q.variantId));
      if (unseen) return unseen;
      const template = list.find(q => q.assessmentRole === "transfer") || baseline;
      const n = history.filter(h => h.assessmentRole === "transfer" && h.firstAttemptForVariant).length + 1;
      return syntheticVariant(template, "T" + n, "transfer", n);
    }

    if (!m.due) return null;
    const unseenRetention = list.find(q => q.assessmentRole === "retention" && !history.some(h => h.variantId === q.variantId));
    if (unseenRetention) return unseenRetention;
    const template = list.find(q => q.assessmentRole === "retention") || baseline;
    const n = history.filter(h => h.assessmentRole === "retention" && h.firstAttemptForVariant).length + 1;
    return syntheticVariant(template, "R" + (m.retentionStage + 1) + "-" + n, "retention", n);
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

  function calibrationSummary(history) {
    const rows = (history || []).filter(entry => entry.confidence != null);
    if (!rows.length) return { n: 0, brier: null, meanConfidence: null, accuracy: null, calibrationGap: null };
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const confidence = mean(rows.map(entry => normalizeConfidence(entry.confidence)));
    const accuracy = mean(rows.map(entry => entry.correct ? 1 : 0));
    const brier = mean(rows.map(entry => Math.pow(normalizeConfidence(entry.confidence) - (entry.correct ? 1 : 0), 2)));
    return {
      n: rows.length,
      brier: Math.round(brier * 1000) / 1000,
      meanConfidence: Math.round(confidence * 100),
      accuracy: Math.round(accuracy * 100),
      calibrationGap: Math.round((confidence - accuracy) * 100)
    };
  }

  function benchmarkSummary(state, questions, nowMs) {
    const rows = families(questions).map(({ familyId, questions: items }) => {
      const question = items[0];
      return { familyId, competency: question.competency, moduleId: question.moduleId, ...mastery(familyId, state, questions, nowMs) };
    });
    const paired = rows.filter(row => row.baseline != null && row.transferFirstAttempt != null);
    const pct = (n, d) => d ? Math.round(n / d * 100) : null;
    const baselineAccuracy = pct(paired.filter(row => row.baseline).length, paired.length);
    const transferAccuracy = pct(paired.filter(row => row.transferFirstAttempt).length, paired.length);
    const allHistory = Object.values((state && state.questions) || {}).flatMap(answer => Array.isArray(answer.history) ? answer.history : []);
    return {
      families: rows.length,
      pairedN: paired.length,
      baselineAccuracy,
      transferAccuracy,
      deltaPoints: baselineAccuracy != null && transferAccuracy != null ? transferAccuracy - baselineAccuracy : null,
      transferPassed: rows.filter(row => row.transfer).length,
      retained: rows.filter(row => row.retained).length,
      fullyRetained: rows.filter(row => row.fullyRetained).length,
      due: rows.filter(row => row.due).length,
      calibration: calibrationSummary(allHistory),
      rows
    };
  }

  return {
    DAY_MS,
    RETENTION_MS: RETENTION_INTERVALS_MS[0],
    RETENTION_INTERVALS_MS,
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
    calibrationSummary,
    competencyMetrics,
    prerequisitesFor,
    competencyUnlocked,
    requirementsForModule,
    moduleUnlocked,
    benchmarkSummary
  };
});