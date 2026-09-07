(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitTrainingPilot = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "1.0.0";
  const LEVELS = ["beginner", "practiced", "experienced"];
  const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  function exportParticipant(sessions, options = {}) {
    if (options.consent !== true) throw new Error("請先同意匯出匿名統計");
    if (!/^p-[a-zA-Z0-9_-]{4,32}$/.test(options.participantId || "")) throw new Error("請使用 p- 開頭的匿名代碼");
    if (!LEVELS.includes(options.experience)) throw new Error("請選擇經驗程度");
    const eligible = sessions.filter(x => !x.rehearsal && x.kind !== "experiment");
    const repairs = eligible.filter(x => x.kind === "repair" && x.diagnosisCommitted);
    const scored = repairs.filter(x => !x.revealed && typeof x.firstJudgmentCorrect === "boolean");
    const remediations = eligible.filter(x => x.kind === "remediation" && x.first);
    const elapsed = eligible.map(x => x.elapsedSeconds).filter(x => Number.isFinite(x) && x >= 0);
    return {
      schema: "circuit-training-pilot", version: 1, instrumentVersion: VERSION,
      participantId: options.participantId, experience: options.experience,
      containsRawAnswers: false, containsPrompts: false, causalClaimAllowed: false,
      metrics: {
        repairAttempted: repairs.length, repairScored: scored.length,
        firstJudgmentCorrect: scored.filter(x => x.firstJudgmentCorrect).length,
        repairPassed: repairs.filter(x => x.passed && !x.revealed).length,
        transferPassed: repairs.filter(x => x.transferPassed && !x.revealed).length,
        measurementCostTotal: repairs.reduce((n, x) => n + (x.measurementCost || 0), 0),
        revealRequests: repairs.filter(x => x.revealed).length,
        remediationAttempted: remediations.length, remediationFirstCorrect: remediations.filter(x => x.first.correct).length,
        remediationTransferPassed: remediations.filter(x => x.transferPassed).length,
        elapsedN: elapsed.length, elapsedMeanSeconds: average(elapsed),
        wrongByCategory: Object.fromEntries(["physics", "unit", "timing", "model"].map(kind => [kind, remediations.filter(x => x.category === kind && !x.first.correct).length]))
      }
    };
  }
  function validate(value) {
    if (!value || value.schema !== "circuit-training-pilot" || value.version !== 1 || value.instrumentVersion !== VERSION ||
      value.causalClaimAllowed !== false || value.containsRawAnswers !== false || value.containsPrompts !== false ||
      !/^p-[a-zA-Z0-9_-]{4,32}$/.test(value.participantId || "") || !LEVELS.includes(value.experience)) throw new Error("不相容的匿名試用資料");
    const m = value.metrics;
    const keys = ["repairAttempted", "repairScored", "firstJudgmentCorrect", "repairPassed", "transferPassed", "measurementCostTotal", "revealRequests", "remediationAttempted", "remediationFirstCorrect", "remediationTransferPassed", "elapsedN"];
    if (!m || keys.some(key => !Number.isInteger(m[key]) || m[key] < 0)) throw new Error("統計計數格式錯誤");
    if (m.repairScored > m.repairAttempted || m.firstJudgmentCorrect > m.repairScored || m.repairPassed > m.repairScored || m.transferPassed > m.repairAttempted || m.revealRequests > m.repairAttempted || m.measurementCostTotal > m.repairAttempted * 5 || m.remediationFirstCorrect > m.remediationAttempted || m.remediationTransferPassed > m.remediationAttempted) throw new Error("統計分母不一致");
    if (m.elapsedN === 0 ? m.elapsedMeanSeconds !== null : !Number.isFinite(m.elapsedMeanSeconds) || m.elapsedMeanSeconds < 0) throw new Error("時間統計格式錯誤");
    if (!m.wrongByCategory || ["physics", "unit", "timing", "model"].some(key => !Number.isInteger(m.wrongByCategory[key]) || m.wrongByCategory[key] < 0) || Object.values(m.wrongByCategory).reduce((a, b) => a + b, 0) > m.remediationAttempted) throw new Error("錯題分類格式錯誤");
    return true;
  }
  function aggregate(bundles) {
    bundles.forEach(validate);
    if (new Set(bundles.map(x => x.participantId)).size !== bundles.length) throw new Error("匿名代碼重複，請勿重複計入同一學員");
    const sum = key => bundles.reduce((n, x) => n + x.metrics[key], 0);
    const scored = sum("repairScored"), attempted = sum("repairAttempted");
    return {
      schema: "circuit-training-pilot-summary", version: 1, instrumentVersion: VERSION,
      participants: bundles.length, participantsWithRepair: bundles.filter(x => x.metrics.repairAttempted > 0).length,
      repairAttempted: attempted, repairScored: scored, unscoredRepairs: attempted - scored,
      firstJudgmentAccuracy: scored ? sum("firstJudgmentCorrect") / scored : null,
      repairPassRate: attempted ? sum("repairPassed") / attempted : null,
      transferPassRate: attempted ? sum("transferPassed") / attempted : null,
      meanMeasurementCost: attempted ? sum("measurementCostTotal") / attempted : null,
      revealRequests: sum("revealRequests"),
      wrongByCategory: Object.fromEntries(["physics", "unit", "timing", "model"].map(key => [key, bundles.reduce((n, x) => n + x.metrics.wrongByCategory[key], 0)])),
      participantsByExperience: Object.fromEntries(LEVELS.map(level => [level, bundles.filter(x => x.experience === level).length])),
      causalClaimAllowed: false, interpretation: "描述性試用統計；未參與、未提交與未驗證分開計數，不代表課程造成能力提升。"
    };
  }
  return { VERSION, exportParticipant, validate, aggregate };
});
