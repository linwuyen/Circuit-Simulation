(function () {
  "use strict";
  const Core = globalThis.CircuitTrainingExperiments, Records = globalThis.CircuitTrainingRecords;
  if (!Core || !Records || !document.getElementById("training-workbench")) return;
  const $ = id => document.getElementById(id), text = (id, value) => { $(id).textContent = value; };
  let experiment = Core.createExperiment({}, {}), started = Date.now();
  let question, transfer, first = null, miniDone = false, transferred = false, remediationId;
  const fmt = (value, digits = 3) => Number(value).toFixed(digits);
  function safe(action, target = "tr-replay-status") {
    try { action(); } catch (error) { text(target, error.message); }
  }
  function svgNode(name, attributes = {}, content) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function plot(id, series) {
    const svg = $(id); svg.replaceChildren();
    if (!series.length) return;
    const all = series.flatMap(row => row.points), maxT = Math.max(1, ...all.map(p => p.tUs));
    const minY = Math.min(0, ...all.map(p => p.value)), maxY = Math.max(.1, ...all.map(p => p.value)) * 1.12;
    const x = t => 65 + t / maxT * 750, y = value => 230 - (value - minY) / (maxY - minY) * 185;
    for (let i = 0; i <= 4; i++) {
      const value = minY + (maxY - minY) * i / 4, time = maxT * i / 4;
      svg.append(svgNode("line", { x1: 65, x2: 815, y1: y(value), y2: y(value), stroke: "#334155" }));
      svg.append(svgNode("text", { x: 59, y: y(value) + 4, fill: "#e2e8f0", "text-anchor": "end", "font-size": 13 }, fmt(value, 2)));
      svg.append(svgNode("text", { x: x(time), y: 249, fill: "#e2e8f0", "text-anchor": "middle", "font-size": 13 }, fmt(time, 1)));
    }
    svg.append(svgNode("text", { x: 18, y: 24, fill: "#e2e8f0", "font-size": 14 }, "A"));
    svg.append(svgNode("text", { x: 425, y: 272, fill: "#e2e8f0", "font-size": 14 }, "時間 (µs)"));
    const colors = ["#38bdf8", "#fbbf24", "#a7f3d0"];
    series.forEach((row, index) => {
      const color = colors[index % colors.length];
      svg.append(svgNode("polyline", { fill: "none", stroke: color, "stroke-width": 2, points: row.points.map(p => `${x(p.tUs)},${y(p.value)}`).join(" ") }));
      svg.append(svgNode("text", { x: 70 + index * 235, y: 24, fill: color, "font-size": 14 }, row.label));
    });
  }
  function controls(frame) {
    document.querySelectorAll('[data-model]').forEach(input => { input.value = frame.model[input.dataset.model]; });
    document.querySelectorAll('[data-instrument]').forEach(input => { input.value = frame.instrument[input.dataset.instrument]; });
  }
  function compact(record) {
    return { ...record, snapshots: record.snapshots.map(row => ({ label: row.label, atAction: row.atAction || 0 })) };
  }
  function save() {
    Records.saveSession({ id: experiment.id, kind: "experiment", record: compact(experiment) });
  }
  function render() {
    const frame = Core.replay(experiment), model = Core.buck(frame.model), scope = Core.acquire(model, frame.instrument);
    controls(frame);
    text("tr-regime", model.regime);
    text("tr-voltage", `${fmt(model.vout, 2)} / ${fmt(model.idealCcmVout, 2)} V`);
    text("tr-critical", `${fmt(model.boundaryOhm, 2)} Ω`);
    text("tr-zero", `${fmt(model.zeroFraction * 100, 1)}% / ${fmt(model.vRipple)} Vpp`);
    text("tr-boundary", `${model.regime === "DCM" ? "已跨入 DCM：D·Vin 不再代表固定 duty 的實際輸出。" : "目前可用 CCM 比例；提高負載電阻，觀察何時出現零電流區間。"} ${model.boundary}${model.validSmallRipple ? "" : " 注意：漣波已超過 10%，小漣波假設不成立，數字僅供越界觀察。"}`);
    const issues = [];
    if (!scope.triggered) issues.push("未觸發：準位沒有上升沿交越，目前為自由運行顯示");
    if (scope.clipped) issues.push("輸入削波，先修正量程或探棒");
    if (scope.probeRatio !== 1) issues.push(`探棒倍率不符：顯示為真值的 ${scope.probeRatio} 倍`);
    if (scope.undersampled) issues.push(`取樣不足，基頻可能混疊至 ${fmt(scope.aliasKhz, 1)} kHz`);
    else if (scope.pointsPerPeriod < 10) issues.push("每週期取樣點少，雖能區分基頻仍可能失去波形細節");
    if (scope.bandwidthLimited) issues.push("頻寬限制正在衰減漣波");
    text("tr-scope-status", issues.join("；") || "已觸發，倍率一致；取樣與頻寬足以觀察本例基頻，仍應核對波形細節。");
    $("tr-scope-status").className = "sandbox-status " + (issues.length ? "warn" : "pass");
    text("tr-metrics", `電路真實 ΔIL=${fmt(model.ripple)} A；畫面峰對峰=${fmt(scope.peakToPeak)} A；每週期 ${fmt(scope.pointsPerPeriod, 1)} 點。`);
    plot("tr-physical-plot", [{ label: "模型電感電流", points: model.rows.map(row => ({ tUs: row.tUs, value: row.iL })) }]);
    plot("tr-scope-plot", [{ label: "示波器取樣值", points: scope.samples }]);
    $("tr-comparison").replaceChildren();
    experiment.snapshots.forEach(row => {
      const tr = document.createElement("tr");
      [row.label, row.metrics.regime, fmt(row.metrics.vout), fmt(row.metrics.ripple), fmt(row.metrics.measuredRipple), row.atAction || 0].forEach(value => {
        const td = document.createElement("td"); td.textContent = value; tr.append(td);
      });
      $("tr-comparison").append(tr);
    });
    plot("tr-compare-plot", experiment.snapshots.map(row => ({ label: row.label, points: row.waveform })));
    $("tr-actions").replaceChildren();
    experiment.actions.forEach(action => {
      const li = document.createElement("li"); li.textContent = `${action.target === "model" ? "電路" : "量測"}：${action.key} → ${action.value}`; $("tr-actions").append(li);
    });
    $("tr-capture").disabled = experiment.snapshots.length >= 3;
  }
  document.querySelectorAll('[data-model], [data-instrument]').forEach(input => input.addEventListener("change", () => safe(() => {
    if (input.value === "") throw new Error("參數不能留白");
    const target = input.dataset.model ? "model" : "instrument", key = input.dataset.model || input.dataset.instrument;
    experiment = Core.changeExperiment(experiment, target, key, Number(input.value)); render(); save();
    text("tr-replay-status", "已保存參數操作。");
  })));
  $("tr-new").onclick = () => safe(() => { const frame = Core.replay(experiment); experiment = Core.createExperiment(frame.model, frame.instrument); render(); save(); text("tr-replay-status", "目前設定已保存為原始組。"); });
  $("tr-capture").onclick = () => safe(() => {
    const frame = Core.replay(experiment), changed = ["model", "instrument"].flatMap(type => Object.keys(frame[type]).filter(key => frame[type][key] !== experiment.initial[type][key]));
    const label = experiment.snapshots.length === 1 ? changed.length === 1 ? "單一變因" : "多變因對照" : "修正後對照";
    experiment = Core.capture(experiment, label); render(); save();
    text("tr-replay-status", changed.length > 1 ? "此組改了多個變因，不能把差異只歸因於其中一項。" : "已保存對照波形與設定。");
  });
  $("tr-export").onclick = () => Records.download("circuit-experiment.json", experiment);
  $("tr-replay").onclick = () => safe(() => { experiment = Core.validateExperiment(experiment).record; render(); text("tr-replay-status", `已依序重播 ${experiment.actions.length} 個操作，重新計算三組波形。`); });
  $("tr-import").onchange = async event => {
    try { experiment = Core.validateExperiment(await Records.readFile(event.target.files[0])).record; experiment.id = `import-${Date.now()}`; render(); save(); text("tr-replay-status", "匯入完成；波形與數值已重新計算。"); }
    catch (error) { text("tr-replay-status", error.message); }
    event.target.value = "";
  };
  function answerControls(id, q) {
    const target = $(id); target.replaceChildren();
    if (q.choices) {
      const select = document.createElement("select"); select.setAttribute("aria-label", id === "tr-answer-controls" ? "首次答案" : "新條件答案");
      select.append(new Option("請選擇", "")); q.choices.forEach(([value, label]) => select.append(new Option(label, value))); target.append(select);
    } else {
      const label = document.createElement("label"); label.textContent = `數值 (${q.unit}) `;
      const input = document.createElement("input"); input.type = "number"; input.step = "any"; label.append(input); target.append(label);
    }
  }
  const getAnswer = id => $(id).querySelector("input, select").value;
  function storeRemediation(extra = {}) {
    Records.saveSession({ id: remediationId, kind: "remediation", category: question.kind, first,
      transferPassed: transferred, elapsedSeconds: Math.round((Date.now() - started) / 1000), ...extra });
    document.dispatchEvent(new Event("training:updated"));
  }
  function newQuestion() {
    const seed = Math.floor(Math.random() * 1000000) + 1;
    started = Date.now(); remediationId = `remediation-${started}-${seed}`;
    question = Core.question($("tr-remediation-kind").value, seed); transfer = Core.question(question.kind, seed + 7, true);
    first = null; miniDone = false; transferred = false;
    text("tr-question", question.prompt); answerControls("tr-answer-controls", question);
    ["tr-feedback", "tr-mini-result", "tr-transfer-question", "tr-transfer-result"].forEach(id => text(id, ""));
    $("tr-transfer-controls").replaceChildren(); $("tr-answer").disabled = false; $("tr-mini").disabled = true; $("tr-transfer-answer").disabled = true;
  }
  $("tr-question-new").onclick = newQuestion;
  $("tr-answer").onclick = () => safe(() => {
    if (first) return;
    const answer = getAnswer("tr-answer-controls"); if (!answer) throw new Error("請先作答");
    first = { ...Core.checkAnswer(question, answer), answer, seed: question.seed };
    $("tr-answer").disabled = true; $("tr-mini").disabled = false;
    text("tr-feedback", first.correct ? "首次判斷正確。仍要用短實驗與另一個條件驗證。" : `這次錯在「${first.mistake}」。${question.explanation}`);
    storeRemediation();
  }, "tr-feedback");
  $("tr-mini").onclick = () => safe(() => {
    if (!first) return;
    text("tr-mini-result", Core.miniExperiment(question.kind).text); miniDone = true;
    text("tr-transfer-question", transfer.prompt); answerControls("tr-transfer-controls", transfer); $("tr-transfer-answer").disabled = false;
    storeRemediation({ miniCompleted: true });
  }, "tr-feedback");
  $("tr-transfer-answer").onclick = () => safe(() => {
    if (!miniDone || transferred) return;
    const answer = getAnswer("tr-transfer-controls"); if (!answer) throw new Error("請先作答");
    const result = Core.checkAnswer(transfer, answer); transferred = result.correct;
    if (transferred) { $("tr-transfer-answer").disabled = true; text("tr-transfer-result", "新條件驗證通過；首次判斷紀錄仍保留。"); }
    else {
      text("tr-transfer-result", `尚未通過：${transfer.explanation} 下一次使用新的條件。`);
      transfer = Core.question(question.kind, transfer.seed + 1, true); text("tr-transfer-question", transfer.prompt); answerControls("tr-transfer-controls", transfer);
    }
    storeRemediation();
  }, "tr-transfer-result");
  const requested = new URLSearchParams(location.search).get("remediation");
  if (["physics", "unit", "timing", "model"].includes(requested)) { $("tr-remediation-kind").value = requested; $("training-remediation").open = true; }
  try {
    const saved = Records.read().sessions.filter(row => row.kind === "experiment").at(-1);
    if (saved?.record) experiment = Core.validateExperiment(saved.record).record;
  } catch (_) { /* A damaged optional experiment must not hide the lesson. */ }
  render(); newQuestion();
})();
