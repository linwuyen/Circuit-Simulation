/* =========================================================================
   EDU — 教學版型共用工具
   課程清單（單一真實來源）/ 進度記錄 (localStorage) / 導航列 / hub 進度
   ========================================================================= */
window.EDU = (function () {
  'use strict';

  // 課程清單：所有頁面共用這份資料
  const LESSONS = [
    { num: 1, file: '01_inductor_diode.html',     title: '電感與續流二極體',   sub: '為什麼電路一定要有「續流路徑」', icon: '🌀' },
    { num: 2, file: '02_half_bridge.html',        title: '半橋臂與直通短路',   sub: '一個橋臂、上下管、死區時間',     icon: '🪜' },
    { num: 3, file: '03_pwm_basics.html',         title: 'PWM 與平均電壓',     sub: '占空比 × Vdc = 平均輸出',        icon: '⏹️' },
    { num: 4, file: '04_spwm.html',               title: 'SPWM：畫出正弦',     sub: '正弦比三角載波，平均跟著跑',     icon: '〰️' },
    { num: 5, file: '05_full_bridge.html',        title: '全橋：單極 vs 雙極',  sub: '兩個橋臂、三電平、THD 砍半',     icon: '🌉' },
    { num: 6, file: '06_load_and_filter.html',    title: '負載與 LC 濾波',     sub: 'R / RL / LC 對波形的影響',       icon: '🧹' },
    { num: 7, file: '07_three_phase_svpwm.html',  title: '三相逆變與 SVPWM',   sub: '120° 相位、馬鞍波、母線利用率', icon: '🔺' },
    { num: 8, file: '08_harmonics_thd.html',      title: '諧波與 THD 量測實驗', sub: '結業：自由掃參數、快照比較',     icon: '📊' }
  ];

  const KEY = 'pe_course_progress_v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function isDone(num) { return !!load()[num]; }
  function markDone(num) { const o = load(); o[num] = true; save(o); }
  function reset() { save({}); }

  // 在頁面底部插入「上一課 / 完成本課 / 下一課」導航
  function renderNav(currentNum) {
    const el = document.getElementById('lesson-nav');
    if (!el) return;
    const prev = LESSONS.find(l => l.num === currentNum - 1);
    const next = LESSONS.find(l => l.num === currentNum + 1);
    const prevHtml = prev
      ? `<a href="${prev.file}"><small>← 上一課</small>${prev.icon} ${prev.title}</a>`
      : `<a href="index.html"><small>← 回到</small>📍 課程地圖</a>`;
    const doneHtml = `<button id="edu-done-btn" class="lesson-done-btn">✓ 標記本課完成</button>`;
    const nextHtml = next
      ? `<a class="next" href="${next.file}"><small>下一課 →</small>${next.icon} ${next.title}</a>`
      : `<a class="next" href="index.html"><small>全部完成 🎉 →</small>📍 回到課程地圖</a>`;
    el.innerHTML = prevHtml + doneHtml + nextHtml;

    const btn = document.getElementById('edu-done-btn');
    function refresh() {
      if (isDone(currentNum)) { btn.textContent = '✓ 已完成本課'; btn.classList.add('is-done'); }
      else { btn.textContent = '✓ 標記本課完成'; btn.classList.remove('is-done'); }
    }
    btn.addEventListener('click', () => { if (isDone(currentNum)) { const o = load(); delete o[currentNum]; save(o); } else markDone(currentNum); refresh(); });
    refresh();

    initPrint();
  }

  // 浮動「列印重點小卡」按鈕；列印時自動展開所有考考你答案，並隱藏模擬器與導航
  function initPrint() {
    if (document.getElementById('print-btn')) return;
    const pb = document.createElement('button');
    pb.id = 'print-btn';
    pb.className = 'print-btn no-print';
    pb.innerHTML = '🖨️ 列印重點小卡';
    pb.title = '列印或另存 PDF：自動整理本課重點（含考考你解答）';
    pb.addEventListener('click', () => window.print());
    document.body.appendChild(pb);

    window.addEventListener('beforeprint', () => {
      document.querySelectorAll('details').forEach(de => { if (!de.open) { de.dataset._wasClosed = '1'; de.open = true; } });
    });
    window.addEventListener('afterprint', () => {
      document.querySelectorAll('details').forEach(de => { if (de.dataset._wasClosed) { de.open = false; delete de.dataset._wasClosed; } });
    });
  }

  // 填入 hub 課程卡（含進度勾選）
  function renderHub() {
    const grid = document.getElementById('hub-grid');
    if (!grid) return;
    const done = load();
    grid.innerHTML = LESSONS.map(l => `
      <a class="lesson-card ${done[l.num] ? 'done' : ''}" href="${l.file}">
        <span class="done-badge">✓ 已完成</span>
        <div class="flex items-start gap-3">
          <span class="num">${String(l.num).padStart(2, '0')}</span>
          <div>
            <div class="text-sm font-bold text-slate-100">${l.icon} ${l.title}</div>
            <div class="text-xs text-slate-400 mt-0.5">${l.sub}</div>
          </div>
        </div>
      </a>`).join('');

    const bar = document.getElementById('hub-progress');
    if (bar) {
      const n = LESSONS.filter(l => done[l.num]).length;
      bar.textContent = `已完成 ${n} / ${LESSONS.length} 課`;
      const fill = document.getElementById('hub-progress-fill');
      if (fill) fill.style.width = (n / LESSONS.length * 100) + '%';
    }
  }

  return { LESSONS, isDone, markDone, reset, renderNav, renderHub };
})();
