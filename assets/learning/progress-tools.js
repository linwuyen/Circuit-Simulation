(function () {
  "use strict";

  const VERSION = 1;
  const PREFIXES = ["circuit-", "micro-sim-"];

  function managedKeys() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && PREFIXES.some(prefix => key.startsWith(prefix))) keys.push(key);
    }
    return keys.sort();
  }

  function exportProgress() {
    const data = {};
    for (const key of managedKeys()) data[key] = localStorage.getItem(key);
    const payload = {
      schema: "circuit-learning-progress",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      location: location.pathname,
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "circuit-learning-progress-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importProgress(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload || payload.schema !== "circuit-learning-progress" || payload.version !== VERSION || typeof payload.data !== "object") {
      throw new Error("這不是可支援的學習進度備份檔。");
    }
    const entries = Object.entries(payload.data).filter(([key, value]) => PREFIXES.some(prefix => key.startsWith(prefix)) && typeof value === "string");
    if (!entries.length) throw new Error("備份中沒有可匯入的進度資料。");
    for (const [key, value] of entries) localStorage.setItem(key, value);
    location.reload();
  }

  function install() {
    const actions = document.querySelector(".progress-next .actions") || document.querySelector(".actions");
    if (!actions || document.getElementById("exportProgress")) return;

    const exportButton = document.createElement("button");
    exportButton.id = "exportProgress";
    exportButton.type = "button";
    exportButton.className = "button";
    exportButton.textContent = "匯出進度";
    exportButton.addEventListener("click", exportProgress);

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "button";
    importButton.textContent = "匯入進度";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try { await importProgress(file); }
      catch (error) { alert(error.message || "匯入失敗"); }
      finally { input.value = ""; }
    });
    importButton.addEventListener("click", () => input.click());

    const stamp = document.createElement("span");
    stamp.className = "muted";
    stamp.textContent = managedKeys().length ? "可備份本瀏覽器的課程、測驗與教學助手進度" : "目前尚無進度資料";

    actions.append(exportButton, importButton, input, stamp);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();