/* =========================================================
   共用導覽 + 學習進度
   每頁只要設定:  <script>window.PAGE = '03';</script>
   再載入這支檔案,就會自動產生頂部導覽列、進度條與上/下一頁。
   進度用 localStorage 記錄「看過哪幾頁」。
   ========================================================= */
(function () {
  var LESSONS = [
    { id: 'index', file: 'index.html',        icon: '🏠', short: '總覽',     title: '課程總覽' },
    { id: '01',    file: '01-deadline.html',  icon: '⏱️', short: '截止線',   title: '10μs 截止線' },
    { id: '02',    file: '02-epwm.html',      icon: '⏰', short: 'EPWM',     title: 'EPWM 硬體鬧鐘' },
    { id: '03',    file: '03-adc.html',       icon: '🔌', short: 'ADC',      title: 'ADC 取樣保持' },
    { id: '04',    file: '04-cpu1.html',      icon: '🧮', short: 'CPU1',     title: 'CPU1 運算' },
    { id: '05',    file: '05-fsi.html',       icon: '🔗', short: 'FSI',      title: 'FSI 菊鏈通訊' },
    { id: '06',    file: '06-dac.html',       icon: '〰️', short: 'DAC',      title: 'DAC 輸出波形' },
    { id: '07',    file: '07-full.html',      icon: '🎛️', short: '完整版',   title: '完整時序模擬器' }
  ];

  var KEY = 'hfloop_progress';
  function getDone() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function markDone(id) {
    var d = getDone();
    if (d.indexOf(id) === -1) { d.push(id); localStorage.setItem(KEY, JSON.stringify(d)); }
  }

  var PAGE = window.PAGE || 'index';
  var done = getDone();
  markDone(PAGE);                 // 進到這頁就算「看過」
  done = getDone();
  var idx = LESSONS.findIndex(function (l) { return l.id === PAGE; });

  /* ---- 頂部導覽 ---- */
  var pills = LESSONS.map(function (l) {
    var isDone = done.indexOf(l.id) !== -1 && l.id !== PAGE;
    return '<a class="pill' + (l.id === PAGE ? ' active' : '') + '" href="' + l.file + '">' +
      l.icon + ' ' + l.short + (isDone ? ' <span class="done">✓</span>' : '') + '</a>';
  }).join('');

  // 進度 = 看過的「課程頁」數 / 7（不含總覽）
  var lessonDone = LESSONS.filter(function (l) { return l.id !== 'index' && done.indexOf(l.id) !== -1; }).length;
  var pct = Math.round(lessonDone / 7 * 100);

  var nav = document.createElement('div');
  nav.className = 'topnav';
  nav.innerHTML =
    '<div class="topnav-inner">' +
      '<a class="brand" href="index.html"><span class="zap">⚡</span> 10μs 控制迴路 · 教學版</a>' +
      '<div class="pills">' + pills + '</div>' +
    '</div>' +
    '<div class="progress-line"><div style="width:' + pct + '%"></div></div>';
  document.body.insertBefore(nav, document.body.firstChild);

  /* ---- 底部上/下一頁 ---- */
  var prev = LESSONS[idx - 1];
  var next = LESSONS[idx + 1];
  var pager = document.createElement('div');
  pager.className = 'wrap';
  pager.innerHTML = '<div class="pager">' +
    (prev
      ? '<a class="prev" href="' + prev.file + '"><div class="dir">← 上一頁</div><div class="ttl">' + prev.icon + ' ' + prev.title + '</div></a>'
      : '<a class="prev disabled"><div class="dir">←</div><div class="ttl">已是第一頁</div></a>') +
    (next
      ? '<a class="next" href="' + next.file + '"><div class="dir">下一頁 →</div><div class="ttl">' + next.icon + ' ' + next.title + '</div></a>'
      : '<a class="next disabled"><div class="dir">→</div><div class="ttl">已是最後一頁</div></a>') +
    '</div>';

  // 放在主要內容 .wrap 之後
  var main = document.querySelector('.wrap');
  if (main && main.parentNode) {
    if (main.nextSibling) main.parentNode.insertBefore(pager, main.nextSibling);
    else main.parentNode.appendChild(pager);
  } else {
    document.body.appendChild(pager);
  }

  // 給 index 頁用:把進度與「看過」狀態暴露出去
  window.LESSONS = LESSONS;
  window.getDone = getDone;
})();
