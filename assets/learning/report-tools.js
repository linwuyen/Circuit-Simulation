(function () {
  "use strict";

  const PREFIX = "circuit-report-draft-v1:";
  let currentKey = "";

  function elements() {
    return {
      module: document.getElementById("moduleSelect"),
      lab: document.getElementById("labSelect"),
      goal: document.getElementById("goal"),
      params: document.getElementById("params"),
      obs: document.getElementById("obs"),
      conclusion: document.getElementById("conclusion")
    };
  }

  function key(fields) {
    return PREFIX + fields.module.value + ":" + fields.lab.value;
  }

  function readDraft(storageKey) {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); }
    catch (error) { return null; }
  }

  function saveDraft(fields) {
    if (!currentKey) return;
    const draft = {
      params: fields.params.value,
      obs: fields.obs.value,
      conclusion: fields.conclusion.value,
      updatedAt: new Date().toISOString()
    };
    try { localStorage.setItem(currentKey, JSON.stringify(draft)); }
    catch (error) {}
  }

  function dispatchPreview(fields) {
    fields.conclusion.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function loadSelection(fields) {
    currentKey = key(fields);
    const draft = readDraft(currentKey);
    fields.params.value = draft ? draft.params || "" : "";
    fields.obs.value = draft ? draft.obs || "" : "";
    fields.conclusion.value = draft ? draft.conclusion || "" : "";
    dispatchPreview(fields);
  }

  function install() {
    const fields = elements();
    if (Object.values(fields).some(value => !value)) return;

    fields.conclusion.placeholder = "請根據實際觀察自行寫出：改了什麼、看到什麼、原因、限制與下一步。";
    fields.conclusion.value = "";
    dispatchPreview(fields);
    currentKey = key(fields);
    loadSelection(fields);

    [fields.params, fields.obs, fields.conclusion].forEach(element => element.addEventListener("input", () => saveDraft(fields)));
    [fields.module, fields.lab].forEach(element => element.addEventListener("change", () => {
      setTimeout(() => loadSelection(fields), 0);
    }));

    const actions = document.querySelector("#reportForm .actions");
    if (actions) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "button";
      clear.textContent = "清除此任務草稿";
      clear.addEventListener("click", () => {
        if (!confirm("確定清除目前任務的參數、觀察與工程結論？")) return;
        localStorage.removeItem(currentKey);
        loadSelection(fields);
      });
      const note = document.createElement("span");
      note.className = "muted";
      note.textContent = "草稿只儲存在此瀏覽器；工程結論不再由教材預填。";
      actions.append(clear, note);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();