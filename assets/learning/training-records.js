(function (root) {
  "use strict";
  const Evidence = root.CircuitEvidence;
  if (!Evidence) return;
  function read() {
    const saved = Evidence.load().benchmark.trainingPractice;
    return saved && Array.isArray(saved.sessions) ? saved : { sessions: [], seenRepairSeeds: [] };
  }
  function saveSession(session) {
    const state = Evidence.load(), data = read(), index = data.sessions.findIndex(x => x.id === session.id);
    if (index >= 0) {
      const old = data.sessions[index];
      data.sessions[index] = { ...old, ...session, first: old.first || session.first, at: old.at };
    } else data.sessions.push({ ...session, at: new Date().toISOString() });
    data.sessions = data.sessions.slice(-12);
    // Keep lightweight trial metrics after large replay records age out.
    if (session.kind !== "experiment") {
      data.studySessions ||= [];
      const allowed = ["id", "kind", "category", "rehearsal", "diagnosisCommitted", "revealed", "firstJudgmentCorrect", "measurementCost", "passed", "transferPassed", "elapsedSeconds"];
      const metric = Object.fromEntries(allowed.filter(key => session[key] !== undefined).map(key => [key, session[key]]));
      if (session.first) metric.first = { correct: session.first.correct };
      const prior = data.studySessions.findIndex(row => row.id === session.id);
      if (prior >= 0) data.studySessions[prior] = { ...data.studySessions[prior], ...metric, first: data.studySessions[prior].first || metric.first };
      else data.studySessions.push(metric);
    }
    state.benchmark.trainingPractice = data;
    Evidence.save(state);
    return data;
  }
  function claimSeed(seed) {
    const state = Evidence.load(), data = read();
    data.seenRepairSeeds ||= [];
    const fresh = !data.seenRepairSeeds.includes(seed);
    if (fresh) data.seenRepairSeeds.push(seed);
    state.benchmark.trainingPractice = data;
    Evidence.save(state);
    return fresh;
  }
  function download(name, value) {
    const url = URL.createObjectURL(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readFile(file) {
    if (!file || file.size > 1500000) throw new Error("請選擇小於 1.5 MB 的 JSON 檔案");
    return JSON.parse(await file.text());
  }
  root.CircuitTrainingRecords = { read, saveSession, claimSeed, download, readFile };
})(globalThis);
