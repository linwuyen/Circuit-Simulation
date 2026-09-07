(function () {
  "use strict";
  const Core = globalThis.CircuitRepairTraining, Records = globalThis.CircuitTrainingRecords;
  if (!Core || !Records || !document.getElementById("repair-training")) return;
  const $ = id => document.getElementById(id), text = (id, value) => { $(id).textContent = value; };
  const names = { sensorGain: "感測倍率錯誤", staleCommand: "舊 command", controlSign: "回授符號錯誤", dutyClamp: "錯誤 duty 限幅", missedCommit: "PWM 更新逾時" };
  let session = null, rehearsal = false, recordId, started = Date.now();
  function checked(id) { return [...$(id).querySelectorAll('input:checked')].map(input => input.value); }
  function checkbox(parent, value, title, selected = false) {
    const label = document.createElement("label"), input = document.createElement("input");
    input.type = "checkbox"; input.value = value; input.checked = selected;
    label.append(input, document.createTextNode(title)); $(parent).append(label);
  }
  function save() {
    if (!session) return;
    const view = session.view(), result = view.result;
    Records.saveSession({ id: recordId, kind: "repair", seed: view.seed, rehearsal,
      diagnosisCommitted: view.diagnosisCommitted, revealed: view.revealed,
      firstJudgmentCorrect: result ? result.firstJudgmentCorrect : null,
      measurementCost: view.measurementCost, passed: Boolean(result?.passed && !view.revealed && !rehearsal),
      transferPassed: Boolean(result && Object.values(result.transfer).every(Boolean)),
      elapsedSeconds: Math.round((Date.now() - started) / 1000), replay: session.exportRecord() });
    document.dispatchEvent(new Event("training:updated"));
  }
  function render() {
    if (!session) return;
    const view = session.view();
    text("repair-symptom", `${view.symptom} 原工況 Vin=${view.initialConditions.vin} V，最終命令 ${view.targetV} V，負載 ${view.initialConditions.finalLoadOhm} Ω。`);
    text("repair-mode", rehearsal ? "重播／重複案例：練習模式，不加入首次獨立成績。" : view.revealed ? "已看答案：練習模式，不計入獨立完成。" : "首次案例：答案在提交前不會回饋。若離開頁面，請先匯出維修重播。");
    text("repair-budget", `已用 ${view.measurementCost}/5 次量測；已執行 ${view.repairs.length} 項修正。`);
    $("repair-log").replaceChildren();
    view.measurements.forEach(row => { const li = document.createElement("li"); li.textContent = row.text; $("repair-log").append(li); });
    const selected = checked("repair-evidence"); $("repair-evidence").replaceChildren();
    view.measurements.forEach(row => checkbox("repair-evidence", row.id, Core.MEASUREMENTS[row.id], selected.includes(row.id)));
    $("repair-evidence").querySelectorAll("input").forEach(input => { input.disabled = view.diagnosisCommitted; });
    $("repair-guesses").querySelectorAll("input").forEach(input => { input.disabled = view.diagnosisCommitted; });
    $("repair-submit").disabled = view.diagnosisCommitted || view.measurementCost < 2;
    $("repair-measures").querySelectorAll("button").forEach(button => { button.disabled = view.diagnosisCommitted || view.measurements.some(x => x.id === button.dataset.measurement) || view.measurementCost >= 5; });
    $("repair-actions").querySelectorAll("button").forEach(button => { button.disabled = !view.diagnosisCommitted || view.repairs.includes(button.dataset.repair) || view.phase === "complete"; });
    $("repair-verify").disabled = !view.diagnosisCommitted || !view.repairs.length || view.attempts.length >= 3 || view.phase === "complete";
    $("repair-reveal").disabled = view.revealed || view.phase === "complete";
    $("repair-verdict").replaceChildren();
    const labels = { output: "輸出", timing: "時序", freshness: "資料新鮮度", protection: "保護狀態", peakCurrent: "峰值電流" };
    view.attempts.forEach((result, index) => {
      const block = document.createElement("div"), heading = document.createElement("h4"), list = document.createElement("ul");
      heading.textContent = `驗證 ${index + 1}：${result.passed && !rehearsal && !view.revealed ? "完成" : result.physicalPass ? "機器已修復；首判或獨立條件未通過" : "尚未修復"}`;
      for (const key of Object.keys(labels)) {
        const li = document.createElement("li"); li.textContent = `${labels[key]}：原工況 ${result.nominal[key] ? "通過" : "失敗"} ／ 新工況 ${result.transfer[key] ? "通過" : "失敗"}`; list.append(li);
      }
      const description = document.createElement("p");
      description.textContent = `新工況 Vin=${result.transferConditions.vin} V、負載 ${result.transferConditions.finalLoadOhm} Ω、命令 ${result.transferConditions.targetV} V。首判${result.firstJudgmentCorrect ? "正確" : "有誤"}；誤判 ${result.falsePositives}，多餘修正 ${result.unnecessaryRepairs}。${rehearsal || view.revealed ? "練習不計分。" : `分數 ${result.score}/100。`}`;
      block.append(heading, list, description); $("repair-verdict").append(block);
    });
  }
  function safe(action) {
    try { action(); render(); save(); } catch (error) { text("repair-status", error.message); }
  }
  for (const [id, title] of Object.entries(Core.MEASUREMENTS)) {
    const button = document.createElement("button"); button.type = "button"; button.dataset.measurement = id; button.textContent = title;
    button.onclick = () => safe(() => { session.measure(id); text("repair-status", "量測已記錄。請比較可能根因，再選下一個量測。"); });
    $("repair-measures").append(button);
  }
  for (const [id, title] of Object.entries(names)) checkbox("repair-guesses", id, title);
  for (const [id, title] of Object.entries(Core.FAULTS)) {
    const button = document.createElement("button"); button.type = "button"; button.dataset.repair = id; button.textContent = title;
    button.onclick = () => safe(() => {
      const view = session.repair(id);
      if (view.observation) text("repair-observation", `重新模擬：平均輸出 ${view.observation.avgV.toFixed(2)} V，峰值電流 ${view.observation.peakI.toFixed(2)} A，狀態 ${view.observation.state}。`);
      text("repair-status", "修正已作用到模型；請驗證，不能只看輸出恢復就結案。");
    });
    $("repair-actions").append(button);
  }
  function start() {
    const seed = Number($("repair-seed").value), next = Core.create(seed);
    rehearsal = !Records.claimSeed(seed); started = Date.now(); recordId = `${rehearsal ? "practice" : "repair"}-${seed}-${started}`;
    session = next;
    $("repair-guesses").querySelectorAll("input").forEach(input => { input.checked = false; });
    text("repair-observation", ""); text("repair-status", "請先選量測；至少引用兩項 evidence 才能提交首判。");
  }
  $("repair-new").onclick = () => safe(start);
  $("repair-submit").onclick = () => safe(() => { session.submit(checked("repair-guesses"), checked("repair-evidence")); text("repair-status", "首次判斷已鎖定。現在逐項修正；首判不會被後續修改覆蓋。"); });
  $("repair-verify").onclick = () => safe(() => {
    const view = session.verify(); text("repair-status", view.result.passed && !rehearsal ? "原工況與陌生工況均通過，完成本次盲測維修。" : "驗證結果已保存；請依失敗項目定位，不用重複猜首判。");
  });
  $("repair-reveal").onclick = () => safe(() => { const answer = session.reveal().answer; text("repair-status", `根因：${answer.map(id => names[id]).join("＋")}。此案例已改為練習，不計獨立完成。`); });
  $("repair-export").onclick = () => Records.download("circuit-repair-replay.json", session.exportRecord());
  $("repair-import").onchange = async event => {
    try {
      const restored = Core.replay(await Records.readFile(event.target.files[0]));
      session = restored; rehearsal = true; started = Date.now(); recordId = `replay-${started}`; $("repair-seed").value = session.view().seed;
      $("repair-guesses").querySelectorAll("input").forEach(input => { input.checked = false; });
      render(); save(); text("repair-status", "操作已依序重播，驗證重新計算；匯入案例不加入首次成績。");
    } catch (error) { text("repair-status", error.message); }
    event.target.value = "";
  };
  safe(start);
})();
