(function (root, factory) {
  const Engine = root.CircuitEngineeringSandboxCore || (typeof require === "function" ? require("./engineering-sandbox-core.js") : null);
  const api = factory(Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitRepairTraining = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine) {
  "use strict";
  const VERSION = "1.0.0";
  const FAULTS = Object.freeze({ sensorGain: "校正感測倍率", staleCommand: "修復 command 消費索引", controlSign: "恢復負回授符號", dutyClamp: "修正錯誤 duty 限幅", missedCommit: "縮短計算路徑" });
  const MEASUREMENTS = Object.freeze({ dmm: "獨立輸出量測", raw: "ADC 原始值", scaled: "韌體工程值", duty: "算出／套用 duty", seq: "資料 sequence", timing: "sample→actuate 時序" });
  const clone = value => JSON.parse(JSON.stringify(value));
  function normalizeSeed(seed) {
    const n = Number(seed);
    if (!Number.isSafeInteger(n) || n < 1 || n > 1000000) throw new Error("案例編號必須為 1..1000000");
    return n;
  }
  function hidden(seed) {
    let n = seed >>> 0;
    const next = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
    const keys = Object.keys(FAULTS), a = Math.floor(next() * keys.length), b = (a + 1 + Math.floor(next() * (keys.length - 1))) % keys.length;
    return [keys[a], keys[b]];
  }
  function base(seed, transfer = false) {
    return {
      cycles: 2400, plantDtUs: .25, seed, vin: transfer ? 72 + seed % 7 : 80,
      commandProfile: [{ cycle: 0, vref: 24 }, { cycle: 120, vref: 48 }, { cycle: 1700, vref: transfer ? 32 : 36 }],
      loadProfile: [{ cycle: 0, ohm: 12 }, { cycle: 300, ohm: transfer ? 8 + seed % 3 : 6 }],
      computeUs: 1.7, samplePct: 50, jitterUs: 0, tripCurrent: 18
    };
  }
  function acceptance(result, reference) {
    return {
      output: Math.abs(result.summary.avgV - reference.summary.avgV) <= Math.max(.3, Math.abs(reference.summary.avgV) * .02),
      timing: result.summary.missedCommits === 0,
      freshness: result.communication.maxLag === 0 && result.communication.violations.length === 0,
      protection: result.state.state === "RUN" && !result.summary.tripSeen,
      peakCurrent: result.summary.peakI <= Math.max(.1, reference.summary.peakI * 1.1)
    };
  }
  function create(seed = 23) {
    seed = normalizeSeed(seed);
    const faults = hidden(seed), actions = [], measurements = [], repairs = [], attempts = [];
    let diagnosis = null, revealed = false, system;
    const startedAt = Date.now();
    function run(transfer = false) {
      const config = base(seed, transfer);
      for (const fault of faults) if (!repairs.includes(fault)) Engine.FAULT_PRESETS[fault](config);
      return Engine.simulateSystem(config);
    }
    system = run();
    const observed = () => ({ avgV: system.summary.avgV, peakI: system.summary.peakI, state: system.state.state });
    function view() {
      const last = attempts.at(-1);
      return clone({ seed, modelVersion: VERSION, engineVersion: Engine.version,
        symptom: "輸出與命令不一致或偶爾掉拍。系統有兩個根因；先量測，再修正，最後換工況驗證。",
        targetV: 36, initialConditions: { vin: 80, finalLoadOhm: 6 }, measurements, repairs,
        diagnosisCommitted: diagnosis !== null, diagnosis: diagnosis ? clone(diagnosis) : null, revealed, attempts,
        result: last || null, phase: last?.passed ? "complete" : diagnosis ? "repair" : "diagnose",
        measurementCost: measurements.length, elapsedSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) });
    }
    function measure(id) {
      if (!Object.hasOwn(MEASUREMENTS, id)) throw new Error("未知量測");
      if (diagnosis) throw new Error("首判已提交；請開始修正");
      if (measurements.some(x => x.id === id)) return view();
      if (measurements.length >= 5) throw new Error("五次量測預算已用完");
      const result = Engine.measureSystem(system, id);
      measurements.push({ id, ...result }); actions.push({ type: "measure", id });
      return view();
    }
    function submit(guesses, evidenceIds) {
      if (diagnosis) throw new Error("首判已保存，不能覆寫");
      if (!Array.isArray(guesses) || guesses.length !== 2 || new Set(guesses).size !== 2 || guesses.some(x => !Object.hasOwn(FAULTS, x))) throw new Error("請選兩個根因");
      if (!Array.isArray(evidenceIds) || new Set(evidenceIds).size < 2 || evidenceIds.some(id => !measurements.some(x => x.id === id))) throw new Error("請引用至少兩項已完成量測");
      diagnosis = { guesses: [...guesses], evidenceIds: [...new Set(evidenceIds)] };
      actions.push({ type: "diagnose", guesses: diagnosis.guesses, evidenceIds: diagnosis.evidenceIds });
      return view();
    }
    function repair(id) {
      if (!diagnosis) throw new Error("請先提交首判");
      if (!Object.hasOwn(FAULTS, id)) throw new Error("未知修正");
      if (attempts.at(-1)?.passed) throw new Error("此案例已完成");
      if (repairs.includes(id)) return view();
      repairs.push(id); actions.push({ type: "repair", id }); system = run();
      return { ...view(), observation: observed() };
    }
    function verify() {
      if (!diagnosis || repairs.length === 0) throw new Error("先提交判斷並執行修正");
      if (attempts.at(-1)?.passed) return view();
      if (attempts.length >= 3) throw new Error("本案例三次驗證已用完，請保留紀錄後換新案例");
      const nominal = acceptance(system, Engine.simulateSystem(base(seed)));
      const changed = run(true), transfer = acceptance(changed, Engine.simulateSystem(base(seed, true)));
      const falsePositives = diagnosis.guesses.filter(x => !faults.includes(x)).length;
      const unnecessaryRepairs = repairs.filter(x => !faults.includes(x)).length;
      const diagnosisCorrect = falsePositives === 0;
      const physicalPass = Object.values(nominal).every(Boolean) && Object.values(transfer).every(Boolean);
      const passed = physicalPass && diagnosisCorrect && !revealed;
      const score = Math.max(0, Math.round((diagnosisCorrect ? 35 : 0) + (physicalPass ? 45 : 0) + Math.max(0, 20 - (measurements.length - 2) * 3) - falsePositives * 10 - unnecessaryRepairs * 5));
      attempts.push({ passed, physicalPass, firstJudgmentCorrect: diagnosisCorrect, falsePositives, unnecessaryRepairs,
        score: revealed ? null : score, nominal, transfer, transferConditions: { vin: base(seed, true).vin, finalLoadOhm: base(seed, true).loadProfile.at(-1).ohm, targetV: 32 },
        evidenceCeiling: "practice-only", independentOracle: false });
      actions.push({ type: "verify" });
      return view();
    }
    function reveal() { revealed = true; actions.push({ type: "reveal" }); return { ...view(), answer: [...faults] }; }
    function exportRecord() { return { schema: "circuit-repair-replay", version: 1, modelVersion: VERSION, engineVersion: Engine.version, seed, actions: clone(actions) }; }
    return Object.freeze({ view, measure, submit, repair, verify, reveal, exportRecord });
  }
  function replay(record) {
    if (!record || record.schema !== "circuit-repair-replay" || record.version !== 1 || record.modelVersion !== VERSION || record.engineVersion !== Engine.version) throw new Error("維修案例版本不相容");
    if (!Array.isArray(record.actions) || record.actions.length > 20) throw new Error("維修操作紀錄過長");
    const session = create(record.seed);
    for (const a of record.actions) {
      if (a.type === "measure") session.measure(a.id);
      else if (a.type === "diagnose") session.submit(a.guesses, a.evidenceIds);
      else if (a.type === "repair") session.repair(a.id);
      else if (a.type === "verify") session.verify();
      else if (a.type === "reveal") session.reveal();
      else throw new Error("未知維修操作");
    }
    return session;
  }
  return { VERSION, FAULTS, MEASUREMENTS, create, replay, acceptance };
});
