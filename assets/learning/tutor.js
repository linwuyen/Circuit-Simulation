(function (global) {
  "use strict";

  const STORE_MODE = "circuit-tutor-mode-v1";
  const rootPrefix = global.CIRCUIT_ROOT_PREFIX || "";
  const modules = (global.CircuitCurriculum && global.CircuitCurriculum.modules) || [];
  const glossary = (global.CircuitCurriculum && global.CircuitCurriculum.glossary) || [];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slug(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function currentPath() {
    let p = decodeURIComponent(location.pathname).replace(/\\/g, "/");
    p = p.replace(/^\/[A-Za-z]:\//, "");
    return p.replace(/^\/+/, "");
  }

  function endsWithRef(ref) {
    return currentPath().toLowerCase().endsWith(String(ref || "").replace(/\\/g, "/").toLowerCase());
  }

  function baseOf(entry) {
    return entry.replace(/[^/]+$/, "");
  }

  function stableItemId(ctx) {
    if (ctx.kind === "lesson") return ctx.module.id + ".lesson." + slug(ctx.item[1]);
    if (ctx.kind === "lab") return ctx.module.id + ".lab." + slug(ctx.item[0] || ctx.item[1]);
    if (ctx.kind === "fault") return ctx.module.id + ".fault." + slug(ctx.item[0]);
    return ctx.module.id;
  }

  function fullLabId(module, lab) {
    return module.id + ".lab." + slug(lab[0] || lab[1]);
  }

  function findContext() {
    for (const module of modules) {
      const base = baseOf(module.entry);
      if (endsWithRef(module.entry)) return { module, kind: "module", ref: module.entry };
      for (let i = 0; i < module.lessons.length; i++) {
        const lesson = module.lessons[i];
        const ref = base + lesson[0];
        if (endsWithRef(ref)) return { module, kind: "lesson", item: lesson, index: i, ref };
      }
      for (const lab of module.labs) {
        if (endsWithRef(lab[2])) return { module, kind: "lab", item: lab, ref: lab[2] };
      }
      for (const fault of module.faults) {
        if (endsWithRef(fault[4])) return { module, kind: "fault", item: fault, ref: fault[4] };
      }
    }
    for (const module of modules) {
      const folder = module.entry.split("/")[0] + "/";
      if (currentPath().toLowerCase().includes(folder.toLowerCase())) return { module, kind: "module", ref: module.entry };
    }
    return null;
  }

  function rel(path) {
    return rootPrefix + path;
  }

  function ensureEvidence(done) {
    if (global.CircuitEvidence) return done(global.CircuitEvidence);
    const existing = document.querySelector('script[data-circuit-evidence]');
    if (existing) {
      existing.addEventListener("load", () => done(global.CircuitEvidence));
      existing.addEventListener("error", () => done(null));
      return;
    }
    const script = document.createElement("script");
    script.src = rel("assets/learning/learning-evidence.js");
    script.dataset.circuitEvidence = "1";
    script.onload = () => done(global.CircuitEvidence);
    script.onerror = () => done(null);
    document.head.appendChild(script);
  }

  function setMode(mode, root) {
    try { localStorage.setItem(STORE_MODE, mode); } catch (_) {}
    root.dataset.mode = mode;
    document.documentElement.classList.toggle("cl-mode-beginner", mode === "beginner");
    root.querySelectorAll("[data-clt-mode]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.cltMode === mode);
    });
  }

  function contextTitle(ctx) {
    if (ctx.kind === "lesson") return ctx.item[1];
    if (ctx.kind === "lab") return ctx.item[1];
    if (ctx.kind === "fault") return ctx.item[0];
    return ctx.module.title;
  }

  function labsForRef(module, ref) {
    return (module.labs || []).filter(lab => lab[2] === ref);
  }

  function nearestLab(module, ref) {
    const exact = labsForRef(module, ref)[0];
    return exact || module.labs[0] || null;
  }

  function contextMain(ctx) {
    if (ctx.kind === "lesson") {
      return {
        tag: "這頁任務",
        goal: ctx.item[2],
        action: ctx.item[3],
        result: ctx.item[4],
        reportLab: nearestLab(ctx.module, ctx.ref)
      };
    }
    if (ctx.kind === "lab") {
      return {
        tag: "實驗任務",
        goal: ctx.item[3],
        action: "依頁面控制項調整參數，直到達成成功條件。",
        result: ctx.item[4],
        reportLab: ctx.item
      };
    }
    if (ctx.kind === "fault") {
      return {
        tag: "故障判讀",
        goal: "先辨識症狀，再查原因與修法。",
        action: ctx.item[2],
        result: ctx.item[3],
        reportLab: nearestLab(ctx.module, ctx.ref)
      };
    }
    const first = ctx.module.lessons[0];
    return {
      tag: "主題總覽",
      goal: ctx.module.oneLine,
      action: first ? first[3] : "先選一個最小模擬頁操作。",
      result: first ? first[4] : ctx.module.whyUseful,
      reportLab: ctx.module.labs[0] || null
    };
  }

  function relatedFaults(module) {
    return module.faults.slice(0, 3).map(f => '<li><a href="' + rel(f[4]) + '">' + esc(f[0]) + '</a><span>' + esc(f[1]) + '</span></li>').join("");
  }

  function glossaryHits(module) {
    const haystack = [module.title, module.oneLine, module.whyUseful].join(" ").toLowerCase();
    const hits = glossary.filter(g => haystack.includes(String(g[0]).toLowerCase())).slice(0, 5);
    const fallback = glossary.slice(0, 5);
    return (hits.length ? hits : fallback).map(g => '<li><b>' + esc(g[0]) + '</b><span>' + esc(g[1]) + '</span></li>').join("");
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
    return {
      path: currentPath(),
      controls,
      metrics: metrics.slice(0, 20)
    };
  }

  function bindMachineEvidence(ctx, Evidence) {
    if (!Evidence) return;
    const itemId = stableItemId(ctx);
    const labIds = labsForRef(ctx.module, ctx.ref).map(lab => fullLabId(ctx.module, lab));
    let timer = null;
    const capture = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = snapshotPage();
        Evidence.recordMachine(itemId, "simulator", snapshot);
        labIds.forEach(id => Evidence.recordMachine(id, "simulator", snapshot));
      }, 180);
    };
    document.addEventListener("input", event => {
      if (!event.target.closest || event.target.closest(".clt-root")) return;
      capture();
    }, true);
    document.addEventListener("change", event => {
      if (!event.target.closest || event.target.closest(".clt-root")) return;
      capture();
    }, true);
  }

  function render(ctx, Evidence) {
    const main = contextMain(ctx);
    let mode = "beginner";
    try { mode = localStorage.getItem(STORE_MODE) || "beginner"; } catch (_) {}
    const itemId = stableItemId(ctx);
    const evidence = Evidence ? Evidence.getEvidence(itemId) : {};
    const checks = evidence.steps || {};
    const reportLabId = main.reportLab ? fullLabId(ctx.module, main.reportLab) : "";
    const steps = [
      ["read", "讀完「一句話先懂」與本頁目標。"],
      ["operate", main.action],
      ["interpret", "用判讀結果寫一句工程結論。"]
    ];
    const checkHtml = steps.map(step => '<label class="clt-check"><input type="checkbox" data-clt-check="' + esc(step[0]) + '"' + (checks[step[0]] ? " checked" : "") + '><span>' + esc(step[1]) + '</span></label>').join("");

    const root = document.createElement("div");
    root.className = "clt-root";
    root.dataset.mode = mode;
    root.innerHTML = '<button class="clt-button" type="button" aria-expanded="false">教學助手</button>'
      + '<aside class="clt-panel" aria-label="教學助手">'
      + '<div class="clt-head"><div><span class="clt-tag">' + esc(ctx.module.tag) + '</span><h2>' + esc(contextTitle(ctx)) + '</h2></div><button class="clt-close" type="button" aria-label="關閉">×</button></div>'
      + '<div class="clt-body">'
      + '<div class="clt-toggle"><button type="button" data-clt-mode="beginner">新手模式</button><button type="button" data-clt-mode="engineering">工程模式</button></div>'
      + '<section class="clt-section"><h3>一句話先懂</h3><p>' + esc(ctx.module.oneLine) + '</p></section>'
      + '<section class="clt-section"><h3>' + esc(main.tag) + '</h3><p><b>目標：</b>' + esc(main.goal) + '</p><p><b>操作：</b>' + esc(main.action) + '</p><p><b>判讀：</b>' + esc(main.result) + '</p></section>'
      + '<section class="clt-section"><h3>本頁驗收</h3><div class="clt-checks">' + checkHtml + '</div><p class="clt-muted">Evidence ID: ' + esc(itemId) + '</p><p class="clt-muted">Simulator snapshots: ' + Number(evidence.machineCount || 0) + '</p></section>'
      + '<section class="clt-section clt-engineering"><h3>相關故障</h3><ul class="clt-mini-list">' + relatedFaults(ctx.module) + '</ul></section>'
      + '<section class="clt-section clt-engineering"><h3>相關詞彙</h3><ul class="clt-mini-list">' + glossaryHits(ctx.module) + '</ul></section>'
      + '<div class="clt-grid">'
      + '<a class="clt-link primary" href="' + rel(ctx.module.entry) + '">主題入口</a>'
      + '<a class="clt-link" href="' + rel("labs.html") + '">實驗任務</a>'
      + '<a class="clt-link" href="' + rel("troubleshooting.html") + '">故障速查</a>'
      + '<a class="clt-link" href="' + rel("glossary.html") + '">詞彙表</a>'
      + '<a class="clt-link" href="' + rel("search.html") + '">搜尋</a>'
      + '<a class="clt-link" href="' + rel("report.html" + (reportLabId ? "?labId=" + encodeURIComponent(reportLabId) : "")) + '">寫工作單</a>'
      + '</div></div></aside>';
    document.body.appendChild(root);
    setMode(mode, root);

    if (Evidence) {
      Evidence.recordEvidence(itemId, 1, "tutor-view", { path: currentPath() });
      labsForRef(ctx.module, ctx.ref).forEach(lab => Evidence.recordEvidence(fullLabId(ctx.module, lab), 1, "lab-view", { path: currentPath() }));
    }

    const button = root.querySelector(".clt-button");
    const panel = root.querySelector(".clt-panel");
    const close = root.querySelector(".clt-close");
    button.addEventListener("click", () => {
      panel.classList.toggle("is-open");
      button.setAttribute("aria-expanded", panel.classList.contains("is-open") ? "true" : "false");
    });
    close.addEventListener("click", () => {
      panel.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
    root.querySelectorAll("[data-clt-mode]").forEach(modeButton => {
      modeButton.addEventListener("click", () => setMode(modeButton.dataset.cltMode, root));
    });
    root.querySelectorAll("[data-clt-check]").forEach(box => {
      box.addEventListener("change", () => {
        if (Evidence) Evidence.recordStep(itemId, box.dataset.cltCheck, box.checked);
      });
    });
    bindMachineEvidence(ctx, Evidence);
  }

  function addMiniListCSS() {
    if (document.getElementById("clt-list-css")) return;
    const style = document.createElement("style");
    style.id = "clt-list-css";
    style.textContent = ".clt-mini-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.clt-mini-list li{display:grid;gap:2px;padding-top:7px;border-top:1px solid #edf1f6}.clt-mini-list li:first-child{border-top:0;padding-top:0}.clt-mini-list a{color:#2f63d8;font-weight:900;text-decoration:none}.clt-mini-list span,.clt-muted{color:#667085;font-size:12px;line-height:1.45}";
    document.head.appendChild(style);
  }

  function init() {
    if (!modules.length || document.querySelector(".clt-root")) return;
    const ctx = findContext();
    if (!ctx) return;
    addMiniListCSS();
    ensureEvidence(Evidence => render(ctx, Evidence));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);