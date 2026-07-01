/* =====================================================================
   SPI 課程共用 JS：導覽列、上一課/下一課、自我檢查 quiz、程式碼分頁
   每頁只要在 <body data-lesson="03"> 標好編號即可。
   ===================================================================== */
(function () {
  "use strict";

  // 全課程順序（改這裡就能一次調整所有頁的導覽）
  var LESSONS = [
    { n: "00", file: "lesson_00_what.html",       title: "SPI 是什麼" },
    { n: "01", file: "lesson_01_wires.html",      title: "四條線" },
    { n: "02", file: "lesson_02_fullduplex.html", title: "全雙工交換" },
    { n: "03", file: "lesson_03_clock.html",      title: "Clock 與取樣" },
    { n: "04", file: "lesson_04_mode.html",       title: "CPOL / CPHA" },
    { n: "05", file: "lesson_05_fifo_why.html",   title: "為什麼要 FIFO" },
    { n: "06", file: "lesson_06_overrun.html",    title: "Overrun 壓測" },
    { n: "07", file: "lesson_07_wiring.html",     title: "接線與硬體錯誤" },
    { n: "08", file: "lesson_08_debug.html",      title: "症狀除錯表" }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function currentIndex() {
    var n = document.body.getAttribute("data-lesson");
    for (var i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].n === n) return i;
    }
    return -1;
  }

  // ---------- 頂部導覽 ----------
  function buildNav() {
    var nav = document.getElementById("lessonNav");
    if (!nav) return;
    var cur = currentIndex();
    var home = el("a", "", "課程入口");
    home.href = "index.html";
    nav.appendChild(home);
    LESSONS.forEach(function (l, i) {
      var a = el("a", i === cur ? "current" : "",
        '<span class="nn">' + l.n + "</span> " + l.title);
      a.href = l.file;
      nav.appendChild(a);
    });
  }

  // ---------- 上一課 / 下一課 ----------
  function buildPager() {
    var pager = document.getElementById("pager");
    if (!pager) return;
    var cur = currentIndex();
    var prev = cur > 0 ? LESSONS[cur - 1] : null;
    var next = cur >= 0 && cur < LESSONS.length - 1 ? LESSONS[cur + 1] : null;

    if (prev) {
      var pa = el("a", "prev",
        '<span class="dir">← 上一課 ' + prev.n + "</span><strong>" + prev.title + "</strong>");
      pa.href = prev.file;
      pager.appendChild(pa);
    } else {
      var ph = el("a", "empty"); pager.appendChild(ph);
    }

    if (next) {
      var na = el("a", "next",
        '<span class="dir">下一課 ' + next.n + " →</span><strong>" + next.title + "</strong>");
      na.href = next.file;
      pager.appendChild(na);
    } else {
      var nh = el("a", "next",
        '<span class="dir">完成 🎉</span><strong>回課程入口</strong>');
      nh.href = "index.html";
      pager.appendChild(nh);
    }
  }

  // ---------- 自我檢查 ----------
  function buildQuiz() {
    var quizzes = document.querySelectorAll(".quiz");
    quizzes.forEach(function (quiz) {
      var answer = parseInt(quiz.getAttribute("data-answer"), 10);
      var opts = quiz.querySelectorAll(".opt");
      opts.forEach(function (opt) {
        opt.addEventListener("click", function () {
          if (quiz.classList.contains("answered")) return;
          var i = parseInt(opt.getAttribute("data-i"), 10);
          quiz.classList.add("answered");
          opts[answer].classList.add("correct");
          if (i !== answer) opt.classList.add("wrong");
        });
      });
    });
  }

  // ---------- 程式碼分頁（Arduino / STM32 / C2000）----------
  function buildCodeTabs() {
    var groups = document.querySelectorAll(".codeblock-group");
    groups.forEach(function (group) {
      var tabs = group.querySelectorAll(".codetab");
      var panes = group.querySelectorAll(".code");
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var i = tab.getAttribute("data-i");
          tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
          panes.forEach(function (p) { p.hidden = p.getAttribute("data-i") !== i; });
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildNav();
    buildPager();
    buildQuiz();
    buildCodeTabs();
  });
})();
