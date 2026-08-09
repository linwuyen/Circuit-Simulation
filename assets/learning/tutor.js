(function (global) {
  "use strict";

  const STORE_MODE = "circuit-tutor-mode-v1";
  const rootPrefix = global.CIRCUIT_ROOT_PREFIX || "";

  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function currentPath() {
    let path = decodeURIComponent(location.pathname).replace(/\\/g, "/");
    path = path.replace(/^\/[A-Za-z]:\//, "");
    return path.replace(/^\/+/, "");
  }

  function endsWithRef(ref) {
    return currentPath().toLowerCase().endsWith(String(ref || "").replace(/\\/g, "/").toLowerCase());
  }

  function rel(path) { return rootPrefix + path; }

  function loadScript(src, globalName) {
    return new Promise(resolve => {
      if (globalName && global[globalName]) return resolve(global[globalName]);
      const absolute = rel(src);
      const existing = [...document.scripts].find(script => String(script.src || "").endsWith(src));
      if (existing) {
        if (globalName && global[globalName]) return resolve(global[globalName]);
        existing.addEventListener("load", () => resolve(globalName ? global[globalName] : true), { once: true });
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = absolute;
      script.dataset.circuitTutorDependency = "1";
      script.onload = () => resolve(globalName ? global[globalName] : true);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  async function dependencies() {
    if (!global.CircuitCurriculum) await loadScript("assets/learning/curriculum.js", "CircuitCurriculum");
    await loadScript("assets/learning/curriculum-schema-v3.js", "CircuitSchema");
    await loadScript("assets/learning/engineering-models.js", "CircuitModels");
    await loadScript("assets/learning/model-registry.js", "CircuitModelRegistry");
    await loadScript("assets/learning/lab-oracles.js", "CircuitLabOracles");
    await loadScript("assets/learning/observables-v8.js", "CircuitTypedObservables");
    if (global.CircuitTypedObservables && global.CircuitLabOracles) global.CircuitTypedObservables.install(global.CircuitLabOracles);
    await loadScript("assets/learning/learning-evidence.js", "CircuitEvidence");
    return {
      Schema: global.CircuitSchema,
      raw: global.CircuitCurriculum,
      Evidence: global.CircuitEvidence,
      Registry: global.CircuitModelRegistry,
      Oracles: global.CircuitLabOracles
    };
  }

  function findContext(curriculum) {
    for (const module of curriculum.modules) {
      if (endsWithRef(module.entry)) return { module, kind: "module", item: module, ref: module.entry };
      for (const lesson of module.lessons) if (endsWithRef(lesson.href)) return { module, kind: "lesson", item: lesson, ref: lesson.href };
      for (const lab of module.labs) if (endsWithRef(lab.href)) return { module, kind: "lab", item: lab, ref: lab.href };
      for (const fault of module.faults) if (endsWithRef(fault.href)) return { module, kind: "fault", item: fault, ref: fault.href };
    }
    for (const module of curriculum.modules) {
      const folder = module.entry.split("/")[0] + "/";
      if (currentPath().toLowerCase().includes(folder.toLowerCase())) return { module, kind: "module", item: module, ref: module.entry };
    }
    return null;
  }

  function setMode(mode, root) {
    try { localStorage.setItem(STORE_MODE, mode); } catch (_) {}
    root.dataset.mode = mode;
    document.documentElement.classList.toggle("cl-mode-beginner", mode === "beginner");
    root.querySelectorAll("[data-clt-mode]").forEach(button => button.classList.toggle("is-active", button.dataset.cltMode === mode));
  }

  function contextTitle(ctx) {
    if (ctx.kind === "fault") return ctx.item.symptom;
    return ctx.item.title || ctx.module.title;
  }

  function labsForRef(module, ref) { return (module.labs || []).filter(lab => lab.href === ref); }
  function nearestLab(module, ref) { return labsForRef(module, ref)[0] || module.labs[0] || null; }

  function contextMain(ctx) {
    if (ctx.kind === "lesson") return { tag: "這頁任務", goal: ctx.item.objective, action: ctx.item.action, result: ctx.item.expectedObservation, reportLab: nearestLab(ctx.module, ctx.ref) };
    if (ctx.kind === "lab") return { tag: "實驗任務", goal: ctx.item.task, action: "依頁面控制項調整參數，直到達成成功條件。", result: ctx.item.success, reportLab: ctx.item };
    if (ctx.kind === "fault") return { tag: "故障判讀", goal: "先辨識症狀，再建立可否證原因。", action: ctx.item.verify, result: ctx.item.fix, reportLab: nearestLab(ctx.module, ctx.ref) };
    const first = ctx.module.lessons[0];
    return { tag: "主題總覽", goal: ctx.module.oneLine, action: first ? first.action : "先選一個最小模擬頁操作。", result: first ? first.expectedObservation : ctx.module.whyUseful, reportLab: ctx.module.labs[0] || null };
  }

  function relatedFaults(module) {
    return module.faults.slice(0, 3).map(fault => '<li><a href="' + rel(fault.href) + '">' + esc(fault.symptom) + '</a><span>' + esc(fault.cause) + '</span></li>').join("");
  }

  function glossaryHits(curriculum, module) {
    const glossary = curriculum.glossary || [];
    const haystack = [module.title, module.oneLine, module.whyUseful].join(" ").toLowerCase();
    const hits = glossary.filter(term => haystack.includes(String(term[0]).toLowerCase())).slice(0, 5);
    return (hits.length ? hits : glossary.slice(0, 5)).map(term => '<li><b>' + esc(term[0]) + '</b><span>' + esc(term[1]) + '</span></li>').join("");
  }

  function snapshotPage() {
    const controls = {};
    document.querySelectorAll("input, select, textarea").forEach(control => {
      if (control.closest(".clt-root")) return;
      if (control.type === "hidden" || control.type === "file") return;
      const key = control.id || control.name || control.getAttribute("aria-label");
      if (!key) return;
      controls[key] = control.type === "checkbox" || control.type === "radio" ? !!control.checked : control.value;
    });
    const metrics = [];
    document.querySelectorAll(".metric, .ms-metric, [data-metric], .status, .ms-status").forEach(node => {
      if (node.closest(".clt-root")) return;
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (text && !metrics.includes(text)) metrics.push(text.slice(0, 240));
    });
    return { path: currentPath(), controls, metrics: metrics.slice(0, 20) };
  }

  function bindMachineEvidence(ctx, Evidence, Registry, Oracles) {
    if (!Evidence) return;
    const itemId = ctx.item.id || ctx.module.id;
    const labs = labsForRef(ctx.module, ctx.ref);
    let timer = null;
    const capture = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = snapshotPage();
        Evidence.recordMachine(itemId, "simulator", snapshot, null);
        labs.forEach(lab => {
          const verification = Oracles && Registry ? Oracles.verify(lab.id, snapshot, Registry) : null;
          Evidence.recordMachine(lab.id, "simulator", snapshot, verification && verification.supported ? verification : null);
        });
      }, 160);
    };
    document.addEventListener("input", event => { if (!event.target.closest || !event.target.closest(".clt-root")) capture(); }, true);
    document.addEventListener("change", event => { if (!event.target.closest || !event.target.closest(".clt-root")) capture(); }, true);
  }

  function addCSS() {
    if (document.getElementById("clt-list-css")) return;
    const style = document.createElement("style");
    style.id = "clt-list-css";
    style.textContent = ".clt-mini-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.clt-mini-list li{display:grid;gap:2px;padding-top:7px;border-top:1px solid #edf1f6}.clt-mini-list li:first-child{border-top:0;padding-top:0}.clt-mini-list a{color:#2f63d8;font-weight:900;text-decoration:none}.clt-mini-list span,.clt-muted{color:#667085;font-size:12px;line-height:1.45}.clt-proof{padding:8px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0}.clt-proof b{display:block}";
    document.head.appendChild(style);
  }

  function render(ctx, curriculum, Evidence, Registry, Oracles) {
    const main = contextMain(ctx);
    const itemId = ctx.item.id || ctx.module.id;
    const evidence = Evidence ? Evidence.getEvidence(itemId) : {};
    const checks = evidence.steps || {};
    const reportLab = main.reportLab;
    const reportLabId = reportLab ? reportLab.id : "";
    let mode = "beginner";
    try { mode = localStorage.getItem(STORE_MODE) || "beginner"; } catch (_) {}
    const steps = [["read","讀完一句話先懂與本頁目標。"],["operate",main.action],["interpret","用判讀結果寫一句工程結論。"]];
    const root = document.createElement("div");
    root.className = "clt-root";
    root.dataset.mode = mode;
    root.innerHTML = '<button class="clt-button" type="button" aria-expanded="false">教學助手</button><aside class="clt-panel" aria-label="教學助手"><div class="clt-head"><div><span class="clt-tag">' + esc(ctx.module.tag) + '</span><h2>' + esc(contextTitle(ctx)) + '</h2></div><button class="clt-close" type="button" aria-label="關閉">×</button></div><div class="clt-body"><div class="clt-toggle"><button type="button" data-clt-mode="beginner">新手模式</button><button type="button" data-clt-mode="engineering">工程模式</button></div><section class="clt-section"><h3>一句話先懂</h3><p>' + esc(ctx.module.oneLine) + '</p></section><section class="clt-section"><h3>' + esc(main.tag) + '</h3><p><b>目標：</b>' + esc(main.goal) + '</p><p><b>操作：</b>' + esc(main.action) + '</p><p><b>判讀：</b>' + esc(main.result) + '</p></section><section class="clt-section"><h3>本頁驗收</h3><div class="clt-checks">' + steps.map(step => '<label class="clt-check"><input type="checkbox" data-clt-check="' + step[0] + '"' + (checks[step[0]] ? " checked" : "") + '><span>' + esc(step[1]) + '</span></label>').join("") + '</div><div class="clt-proof"><b>Canonical Evidence ID</b><code>' + esc(itemId) + '</code><span class="clt-muted">Simulator snapshots: ' + Number(evidence.machineCount || 0) + '</span></div></section><section class="clt-section clt-engineering"><h3>相關故障</h3><ul class="clt-mini-list">' + relatedFaults(ctx.module) + '</ul></section><section class="clt-section clt-engineering"><h3>相關詞彙</h3><ul class="clt-mini-list">' + glossaryHits(curriculum, ctx.module) + '</ul></section><div class="clt-grid"><a class="clt-link primary" href="' + rel(ctx.module.entry) + '">主題入口</a><a class="clt-link" href="' + rel("labs.html") + '">實驗任務</a><a class="clt-link" href="' + rel("troubleshooting.html") + '">故障速查</a><a class="clt-link" href="' + rel("glossary.html") + '">詞彙表</a><a class="clt-link" href="' + rel("search.html") + '">搜尋</a><a class="clt-link" href="' + rel("report.html" + (reportLabId ? "?labId=" + encodeURIComponent(reportLabId) : "")) + '">寫工作單</a></div></div></aside>';
    document.body.appendChild(root);
    setMode(mode, root);

    if (Evidence) {
      Evidence.recordEvidence(itemId, 1, "tutor-view", { path: currentPath() });
      labsForRef(ctx.module, ctx.ref).forEach(lab => Evidence.recordEvidence(lab.id, 1, "lab-view", { path: currentPath() }));
    }

    const button = root.querySelector(".clt-button"), panel = root.querySelector(".clt-panel");
    button.addEventListener("click", () => { panel.classList.toggle("is-open"); button.setAttribute("aria-expanded", panel.classList.contains("is-open") ? "true" : "false"); });
    root.querySelector(".clt-close").addEventListener("click", () => { panel.classList.remove("is-open"); button.setAttribute("aria-expanded", "false"); });
    root.querySelectorAll("[data-clt-mode]").forEach(modeButton => modeButton.addEventListener("click", () => setMode(modeButton.dataset.cltMode, root)));
    root.querySelectorAll("[data-clt-check]").forEach(box => box.addEventListener("change", () => { if (Evidence) Evidence.recordStep(itemId, box.dataset.cltCheck, box.checked); }));
    bindMachineEvidence(ctx, Evidence, Registry, Oracles);
  }

  async function init() {
    if (document.querySelector(".clt-root")) return;
    const deps = await dependencies();
    if (!deps.Schema || !deps.raw) return;
    const curriculum = deps.Schema.normalizeCurriculum(deps.raw);
    const ctx = findContext(curriculum);
    if (!ctx) return;
    addCSS();
    if (deps.Evidence) deps.Evidence.reconcileAliases(curriculum.modules.flatMap(module => [...module.lessons, ...module.labs, ...module.faults]));
    render(ctx, curriculum, deps.Evidence, deps.Registry, deps.Oracles);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);