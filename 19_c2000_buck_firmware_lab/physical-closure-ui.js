(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function appendWorkspace() {
    const main = document.querySelector("main");
    if (!main || $("#physicalClosureWorkspace")) return;
    const section = document.createElement("section");
    section.className = "lab-grid";
    section.id = "physicalClosureWorkspace";
    section.dataset.showModes = "firmware debug sandbox";
    section.innerHTML = `
      <article class="lab-panel">
        <div class="section-kicker">P4-A · REAL BOARD CLOSURE</div>
        <h2>Flash → 9 bindings → 8 physical artifacts</h2>
        <p>載入 <code>board-closure.template.json</code> 的真實副本。沒有 CCXML/probe/reset-boot、binding provenance、artifact SHA/instrument/timestamp 就不會升級。</p>
        <div class="actions"><label class="button">載入 closure package<input id="physicalClosureFile" type="file" accept="application/json,.json" hidden></label><a class="button" href="board/board-closure.template.json">closure template</a></div>
        <div class="metric-grid" id="physicalClosureMetrics"><div><span>CLAIM</span><b>UNCLAIMED</b></div><div><span>FLASH</span><b>MISSING</b></div><div><span>BINDINGS</span><b>0/9</b></div><div><span>EVIDENCE</span><b>0/8</b></div></div>
        <div class="truth-box" id="physicalClosureStatus">Fail-closed：尚未載入真實 physical closure package。</div>
        <div class="evidence-list" id="physicalClosureNext"></div>
      </article>
      <article class="lab-panel">
        <div class="section-kicker">P4-B · CONTROL VALIDATION</div>
        <h2>Measured response vs engineering limits/model</h2>
        <p>同一份 sanitized bundle 驗 load-step、sample→actuate timing、hardware trip latency、SFRA/model overlay。這個 PASS 仍不等於 BOARD_PASS。</p>
        <div class="actions"><label class="button">載入 control evidence<input id="controlValidationFile" type="file" accept="application/json,.json" hidden></label><a class="button" href="board/control-validation.template.json">validation template</a></div>
        <div class="metric-grid" id="controlValidationMetrics"><div><span>LOAD STEP</span><b>MISSING</b></div><div><span>TIMING</span><b>MISSING</b></div><div><span>TRIP</span><b>MISSING</b></div><div><span>SFRA</span><b>MISSING</b></div></div>
        <div class="truth-box" id="controlValidationStatus">INCOMPLETE：沒有 physical capture 就沒有 control-validation claim。</div>
      </article>`;
    main.appendChild(section);
  }

  function renderClosure(result) {
    $("#physicalClosureMetrics").innerHTML = `<div><span>CLAIM</span><b>${escapeHtml(result.computedClaim)}</b></div><div><span>FLASH</span><b>${result.flashPassed?"PASS":"MISSING"}</b></div><div><span>BINDINGS</span><b>${result.bindingRows.filter(row=>row.valid).length}/${result.bindingRows.length}</b></div><div><span>EVIDENCE</span><b>${result.evidenceRows.filter(row=>row.valid).length}/${result.evidenceRows.length}</b></div>`;
    $("#physicalClosureStatus").textContent = result.computedClaim === "BOARD_PASS" ? "BOARD_PASS gate satisfied by the loaded package. Keep source/artifact provenance with the package." : "UNCLAIMED：仍有 physical closure requirements 未完成。";
    $("#physicalClosureNext").innerHTML = result.remainingActions.length ? result.remainingActions.map(action=>`<article class="evidence-slot"><span><b>NEXT</b><small>${escapeHtml(action)}</small></span></article>`).join("") : `<article class="evidence-slot is-pass"><span><b>CLOSURE COMPLETE</b><small>All machine gates satisfied.</small></span></article>`;
  }

  function verdict(item) { return !item.ready ? "MISSING" : item.pass ? "PASS" : "FAIL"; }
  function renderControl(result) {
    $("#controlValidationMetrics").innerHTML = ["loadStep","timing","trip","sfra"].map(key=>`<div><span>${key.replace(/([A-Z])/g," $1").toUpperCase()}</span><b>${verdict(result[key])}</b></div>`).join("");
    $("#controlValidationStatus").textContent = `${result.status} · provenance ${result.captureRows.filter(row=>row.valid).length}/4 · BOARD_PASS implied: no`;
  }

  async function init() {
    appendWorkspace();
    try {
      if (!window.CircuitPhysicalBoardClosureV1) await load("../assets/learning/physical-board-closure-v1.js");
      if (!window.CircuitControlValidationV1) await load("../assets/learning/control-validation-v1.js");
    } catch (error) {
      $("#physicalClosureStatus").textContent = `Model load failed: ${error.message}`;
      return;
    }

    $("#physicalClosureFile")?.addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      try { renderClosure(window.CircuitPhysicalBoardClosureV1.assertPackage(JSON.parse(await file.text()))); }
      catch (error) { $("#physicalClosureStatus").textContent = `REJECTED: ${error.message}`; }
    });
    $("#controlValidationFile")?.addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      try { renderControl(window.CircuitControlValidationV1.validateBundle(JSON.parse(await file.text()))); }
      catch (error) { $("#controlValidationStatus").textContent = `REJECTED: ${error.message}`; }
    });
  }

  init();
})();
