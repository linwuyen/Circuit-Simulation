(function (global) {
  "use strict";

  const STORE_MODE = "circuit-tutor-mode-v1";
  const STORE_CHECKS = "circuit-tutor-checks-v1";
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

  function currentPath() {
    let p = decodeURIComponent(location.pathname).replace(/\\/g, "/");
    p = p.replace(/^\/[A-Za-z]:\//, "");
    return p.replace(/^\/+/, "");
  }

  function endsWithRef(ref) {
    return currentPath().toLowerCase().endsWith(ref.replace(/\\/g, "/").toLowerCase());
  }

  function baseOf(entry) {
    return entry.replace(/[^/]+$/, "");
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

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); }
    catch (e) { return {}; }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {}
  }

  function setMode(mode, root) {
    localStorage.setItem(STORE_MODE, mode);
    root.dataset.mode = mode;
    document.documentElement.classList.toggle("cl-mode-beginner", mode === "beginner");
    root.querySelectorAll("[data-clt-mode]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.cltMode === mode);
    });
  }

  function checkId(ctx, step) {
    return (ctx.ref || ctx.module.id) + "::" + step;
  }

  function contextTitle(ctx) {
    if (ctx.kind === "lesson") return ctx.item[1];
    if (ctx.kind === "lab") return ctx.item[1];
    if (ctx.kind === "fault") return ctx.item[0];
    return ctx.module.title;
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
        reportLab: ctx.item[0]
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
      reportLab: ctx.module.labs[0] && ctx.module.labs[0][0]
    };
  }

  function nearestLab(module, ref) {
    const exact = module.labs.find(lab => lab[2] === ref);
    if (exact) return exact[0];
    return module.labs[0] && module.labs[0][0];
  }

  function relatedFaults(module) {
    return module.faults.slice(0, 3).map(f => '<li><a href="' + rel(f[4]) + '">' + esc(f[0]) + '</a><span>' + esc(f[1]) + '</span></li>').join("");
  }

  function glossaryHits(module) {
    const haystack = [module.title, module.oneLine, module.whyUseful].join(" ").toLowerCase();
    const hits = glossary.filter(g => haystack.includes(g[0].toLowerCase())).slice(0, 5);
    const fallback = glossary.slice(0, 5);
    return (hits.length ? hits : fallback).map(g => '<li><b>' + esc(g[0]) + '</b><span>' + esc(g[1]) + '</span></li>').join("");
  }

  function render(ctx) {
    const main = contextMain(ctx);
    const mode = localStorage.getItem(STORE_MODE) || "beginner";
    const checks = loadJSON(STORE_CHECKS);
    const steps = [
      ["read", "讀完「一句話先懂」與本頁目標。"],
      ["operate", main.action],
      ["interpret", "用判讀結果寫一句工程結論。"]
    ];
    const checkHtml = steps.map(step => {
      const id = checkId(ctx, step[0]);
      return '<label class="clt-check"><input type="checkbox" data-clt-check="' + esc(id) + '"' + (checks[id] ? " checked" : "") + '><span>' + esc(step[1]) + '</span></label>';
    }).join("");

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
      + '<section class="clt-section"><h3>本頁驗收</h3><div class="clt-checks">' + checkHtml + '</div></section>'
      + '<section class="clt-section clt-engineering"><h3>相關故障</h3><ul class="clt-mini-list">' + relatedFaults(ctx.module) + '</ul></section>'
      + '<section class="clt-section clt-engineering"><h3>相關詞彙</h3><ul class="clt-mini-list">' + glossaryHits(ctx.module) + '</ul></section>'
      + '<div class="clt-grid">'
      + '<a class="clt-link primary" href="' + rel(ctx.module.entry) + '">主題入口</a>'
      + '<a class="clt-link" href="' + rel("labs.html") + '">實驗任務</a>'
      + '<a class="clt-link" href="' + rel("troubleshooting.html") + '">故障速查</a>'
      + '<a class="clt-link" href="' + rel("glossary.html") + '">詞彙表</a>'
      + '<a class="clt-link" href="' + rel("search.html") + '">搜尋</a>'
      + '<a class="clt-link" href="' + rel("report.html" + (main.reportLab ? "?lab=" + encodeURIComponent(main.reportLab) : "")) + '">寫報告</a>'
      + '</div></div></aside>';
    document.body.appendChild(root);
    setMode(mode, root);
    bind(root, ctx);
  }

  function bind(root, ctx) {
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
        const checks = loadJSON(STORE_CHECKS);
        checks[box.dataset.cltCheck] = box.checked;
        saveJSON(STORE_CHECKS, checks);
      });
    });
  }

  function addMiniListCSS() {
    if (document.getElementById("clt-list-css")) return;
    const style = document.createElement("style");
    style.id = "clt-list-css";
    style.textContent = ".clt-mini-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.clt-mini-list li{display:grid;gap:2px;padding-top:7px;border-top:1px solid #edf1f6}.clt-mini-list li:first-child{border-top:0;padding-top:0}.clt-mini-list a{color:#2f63d8;font-weight:900;text-decoration:none}.clt-mini-list span{color:#667085;font-size:13px;line-height:1.45}";
    document.head.appendChild(style);
  }

  function init() {
    if (!modules.length || document.querySelector(".clt-root")) return;
    const ctx = findContext();
    if (!ctx) return;
    addMiniListCSS();
    render(ctx);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
