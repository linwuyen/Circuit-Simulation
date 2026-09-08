(function () {
  "use strict";
  const Records = globalThis.CircuitTrainingRecords, Pilot = globalThis.CircuitTrainingPilot, Evidence = globalThis.CircuitEvidence;
  if (!Records || !Pilot || !Evidence || !document.getElementById("training-pilot")) return;
  const $ = id => document.getElementById(id);
  const random = new Uint32Array(2); crypto.getRandomValues(random);
  const stored = Records.read().pilot;
  $("pilot-id").value = stored?.participantId || `p-${random[0].toString(36)}${random[1].toString(36)}`;
  $("pilot-level").value = stored?.experience || "beginner";
  function options() { return { participantId: $("pilot-id").value.trim(), experience: $("pilot-level").value, consent: $("pilot-consent").checked }; }
  function refresh() {
    const rows = Records.read().studySessions || Records.read().sessions;
    const repairs = rows.filter(x => x.kind === "repair" && x.diagnosisCommitted && !x.rehearsal);
    const remediation = rows.filter(x => x.kind === "remediation" && x.first && !x.rehearsal);
    $("pilot-summary").textContent = repairs.length || remediation.length ? `本機已提交 ${repairs.length} 個維修案例、${remediation.length} 個補救練習。未驗證案例會單獨列為未評分，不當成零分。` : "尚無學員操作資料；不產生示範成績。";
  }
  $("pilot-export").onclick = () => {
    try {
      const data = Records.read(), bundle = Pilot.exportParticipant(data.studySessions || data.sessions, options());
      const state = Evidence.load(); data.pilot = { participantId: bundle.participantId, experience: bundle.experience }; state.benchmark.trainingPractice = data; Evidence.save(state);
      Records.download(`${bundle.participantId}.training-pilot.json`, bundle); $("pilot-status").textContent = "已匯出匿名統計，沒有自動上傳。實驗操作與答案不在此檔案內。";
    } catch (error) { $("pilot-status").textContent = error.message; }
  };
  $("training-backup").onclick = () => { Records.download("circuit-learning-backup.json", Evidence.exportBackup()); $("pilot-status").textContent = "完整備份含個人作答、實驗與八層進度；與匿名試用統計分開保存。"; };
  $("training-restore").onchange = async event => {
    try {
      const restored = Evidence.merge(await Records.readFile(event.target.files[0]));
      refresh(); $("pilot-status").textContent = "已合併學習紀錄與主線進度，保留本機首次作答。重新整理可載入最近的實驗。" +
        (restored.benchmark.outcomeImportPreservedLocal ? " 此裝置已有正式測驗首答，因此保留本機測驗；外來測驗已保存在完整備份的 outcomeBackupArchives，未混合成績。" : "");
    } catch (error) { $("pilot-status").textContent = error.message; }
    event.target.value = "";
  };
  document.addEventListener("training:updated", refresh);
  refresh();
})();
