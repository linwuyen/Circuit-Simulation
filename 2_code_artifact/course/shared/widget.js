/* =========================================================================
   PE — 可設定的電力電子互動模擬器元件
   物理求解器 / 示波器 / 調變邏輯忠實移植自 code_artifact.html（已驗證），
   重構為可由各課用一個 config 掛載的元件，並新增「快照比較」實用功能。

   用法：
     PE.mount('#sim', {
       topology: 'half',            // 'half' | 'full' | 'three'
       allowTopology: false,        // 是否顯示拓撲切換鈕
       loads: ['R','RL','LC'],      // 可選負載（第一個為預設）
       modulations: ['spwm'],       // 可選調變（限該拓撲；空=用全部）
       controls: { ma:true, freq:true, fc:true, manual:true },
       channels: { ch1:true, ch2:true, ch3:true, ch4:false },
       defaults: { ma:0.8, freq:50, fc:1000, load:'R', autoMode:true },
       metrics: true,               // 顯示 Vrms / V1 / THD
       snapshot: false              // 顯示「凍結快照」比較表
     });
   ========================================================================= */
window.PE = (function () {
  'use strict';

  // ---------- 物理常數（與原檔一致）----------
  const Vdc = 100.0, V_half = Vdc / 2.0;
  const R_val = 10, L_val = 0.04, L_f = 0.012, C_f = 0.000033;
  const dt = 0.00002, steps_per_frame = 40, decimation = 4;
  const bufLen = 4096, sampleInterval = dt * decimation;

  const modulationOptions = {
    half: [
      { val: 'spwm',   text: '正弦波 SPWM 控制' },
      { val: 'square', text: '對稱方波調變 (Square Wave)' }
    ],
    full: [
      { val: 'spwm_uni', text: '單極性正弦 SPWM (推薦-3電平)' },
      { val: 'spwm_bi',  text: '雙極性正弦 SPWM (Bipolar)' },
      { val: 'square',   text: '全橋對稱方波' }
    ],
    three: [
      { val: 'svpwm',   text: '三相空間向量 SVPWM (注入馬鞍波)' },
      { val: 'spwm',    text: '三相標準正弦 SPWM' },
      { val: 'sixstep', text: '六步 180度導通方波' }
    ]
  };

  const shortcuts = {
    half: [
      { name: '上管 Q1 導通 (+Vdc/2)', state: [true, false, false, false, false, false] },
      { name: '下管 Q2 導通 (-Vdc/2)', state: [false, true, false, false, false, false] },
      { name: '全關斷 (電感強迫 D1 續流)', state: [false, false, false, false, false, false] }
    ],
    full: [
      { name: '對角導通 +Vdc (Q1, Q4)', state: [true, false, false, true, false, false] },
      { name: '對角導通 -Vdc (Q2, Q3)', state: [false, true, true, false, false, false] },
      { name: '同側 0V 自由續流 (Q1, Q3)', state: [true, false, true, false, false, false] },
      { name: '全關斷狀態', state: [false, false, false, false, false, false] }
    ],
    three: [
      { name: '狀態向量 V1 (100)', state: [true, false, false, true, false, true] },
      { name: '狀態向量 V2 (110)', state: [true, false, true, false, false, true] },
      { name: '狀態向量 V3 (010)', state: [false, true, true, false, false, true] },
      { name: '零向量 V7 (111)', state: [true, false, true, false, true, false] }
    ]
  };

  // ---------- 模擬器 SVG + 控制面板樣板 ----------
  function template() {
    return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- 左：電路圖 -->
      <section class="lg:col-span-7 sim-shell relative overflow-hidden">
        <div class="absolute top-3 left-3 z-10 flex gap-2">
          <span id="topology-badge" class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">半橋模式</span>
          <span id="mode-status-badge" class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">阻性負載 (R)</span>
        </div>

        <!-- 拓撲切換 -->
        <div id="topo-switch" class="absolute top-3 right-3 z-10 flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button data-topo="half"  class="topo-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all">半橋</button>
          <button data-topo="full"  class="topo-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all">全橋</button>
          <button data-topo="three" class="topo-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all">三相</button>
        </div>

        <!-- 直通短路警告 -->
        <div id="short-circuit-warning" class="hidden absolute inset-0 bg-red-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <div class="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-3xl animate-bounce shadow-lg shadow-red-500/50">⚠️</div>
          <h3 class="text-xl font-bold text-red-400">直通短路 (Shoot-through!)</h3>
          <p class="text-xs text-slate-300 max-w-md leading-relaxed">同一橋臂的<span class="text-red-400 font-bold">上管與下管同時導通</span>，直流母線被金屬性短路！真實電路中將湧入數千安培、開關瞬間熱擊穿炸毀。這就是為什麼必須留「死區時間 (dead-time)」。</p>
          <button id="btn-clear-short" class="mt-1 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition">立即清除</button>
        </div>

        <div class="flex items-center justify-center min-h-[320px] py-6">
          <svg id="circuit-svg" viewBox="0 0 800 450" class="w-full max-w-2xl h-auto">
            <defs>
              <filter id="glow-heavy" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <circle cx="80" cy="225" r="22" fill="none" stroke="#475569" stroke-width="2.5" />
            <text x="80" y="219" fill="#94a3b8" font-size="14" font-weight="bold" text-anchor="middle">+</text>
            <text x="80" y="237" fill="#94a3b8" font-size="14" font-weight="bold" text-anchor="middle">-</text>
            <text x="80" y="185" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">Vdc</text>
            <path d="M 80 380 L 80 400 M 65 400 L 95 400 M 72 405 L 88 405 M 77 410 L 83 410" stroke="#475569" stroke-width="2" />
            <path id="pos-bus" d="M 80 203 L 80 70 L 650 70" fill="none" stroke="#475569" stroke-width="2.5" />
            <path id="neg-bus" d="M 80 247 L 80 380 L 650 380" fill="none" stroke="#475569" stroke-width="2.5" />
            <path id="active-pos-bus" d="" fill="none" stroke="#10b981" stroke-width="3.5" class="glowing-path glow-green hidden" />
            <path id="active-neg-bus" d="" fill="none" stroke="#10b981" stroke-width="3.5" class="glowing-path glow-green hidden" />

            <g id="half-cap-group">
              <path d="M 200 70 L 200 130 M 180 130 L 220 130 M 180 140 L 220 140 M 200 140 L 200 225" stroke="#475569" stroke-width="2.5" fill="none"/>
              <text x="165" y="140" fill="#64748b" font-size="11">C1</text>
              <path d="M 200 225 L 200 310 M 180 310 L 220 310 M 180 320 L 220 320 M 200 320 L 200 380" stroke="#475569" stroke-width="2.5" fill="none"/>
              <text x="165" y="320" fill="#64748b" font-size="11">C2</text>
              <circle cx="200" cy="225" r="4" fill="#64748b" />
              <text x="212" y="218" fill="#38bdf8" font-size="11" font-weight="bold">N (中性點)</text>
            </g>

            <g id="leg-a-label">
              <rect x="305" y="25" width="90" height="22" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1" />
              <text x="350" y="40" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">A相橋臂 (左)</text>
            </g>
            <path d="M 350 70 L 350 110 M 350 170 L 350 280 M 350 340 L 350 380" stroke="#475569" stroke-width="2.5" fill="none" />
            <circle cx="350" cy="70" r="4" fill="#475569" />
            <circle cx="350" cy="225" r="5" fill="#475569" id="node-a" />
            <text x="330" y="221" fill="#f8fafc" font-size="13" font-weight="bold">A</text>
            <circle cx="350" cy="380" r="4" fill="#475569" />
            <g id="sw-q1" class="cursor-pointer" data-sw="0">
              <rect x="325" y="110" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q1" />
              <text x="350" y="132" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q1</text>
              <text x="350" y="152" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q1">OFF</text>
              <line x1="350" y1="120" x2="335" y2="150" stroke="#ef4444" stroke-width="2.5" id="line-q1" />
            </g>
            <g id="diode-d1-group">
              <path d="M 350 90 L 385 90 L 385 118" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 350 190 L 385 190 L 385 162" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 385 130 L 377 145 L 393 145 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d1" />
              <line x1="375" y1="130" x2="395" y2="130" stroke="#475569" stroke-width="2" id="bar-d1" />
              <text x="403" y="142" fill="#64748b" font-size="10">D1</text>
            </g>
            <g id="sw-q2" class="cursor-pointer" data-sw="1">
              <rect x="325" y="280" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q2" />
              <text x="350" y="302" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q2</text>
              <text x="350" y="322" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q2">OFF</text>
              <line x1="350" y1="290" x2="335" y2="320" stroke="#ef4444" stroke-width="2.5" id="line-q2" />
            </g>
            <g id="diode-d2-group">
              <path d="M 350 260 L 385 260 L 385 288" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 350 360 L 385 360 L 385 332" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 385 300 L 377 315 L 393 315 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d2" />
              <line x1="375" y1="300" x2="395" y2="300" stroke="#475569" stroke-width="2" id="bar-d2" />
              <text x="403" y="312" fill="#64748b" font-size="10">D2</text>
            </g>

            <g id="leg-b-label" class="hidden">
              <rect x="455" y="25" width="90" height="22" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1" />
              <text x="500" y="40" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">B相橋臂 (右)</text>
            </g>
            <path id="line-leg-b" d="M 500 70 L 500 110 M 500 170 L 500 280 M 500 340 L 500 380" stroke="#475569" stroke-width="2.5" fill="none" class="hidden" />
            <circle cx="500" cy="70" r="4" fill="#475569" id="node-b-top" class="hidden" />
            <circle cx="500" cy="225" r="5" fill="#475569" id="node-b" class="hidden" />
            <text x="515" y="221" fill="#f8fafc" font-size="13" font-weight="bold" id="lbl-b-node" class="hidden">B</text>
            <circle cx="500" cy="380" r="4" fill="#475569" id="node-b-bot" class="hidden" />
            <g id="sw-q3" class="cursor-pointer hidden" data-sw="2">
              <rect x="475" y="110" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q3" />
              <text x="500" y="132" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q3</text>
              <text x="500" y="152" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q3">OFF</text>
              <line x1="500" y1="120" x2="485" y2="150" stroke="#ef4444" stroke-width="2.5" id="line-q3" />
            </g>
            <g id="diode-d3-group" class="hidden">
              <path d="M 500 90 L 535 90 L 535 118" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 500 190 L 535 190 L 535 162" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 535 130 L 527 145 L 543 145 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d3" />
              <line x1="525" y1="130" x2="545" y2="130" stroke="#475569" stroke-width="2" id="bar-d3" />
              <text x="553" y="142" fill="#64748b" font-size="10">D3</text>
            </g>
            <g id="sw-q4" class="cursor-pointer hidden" data-sw="3">
              <rect x="475" y="280" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q4" />
              <text x="500" y="302" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q4</text>
              <text x="500" y="322" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q4">OFF</text>
              <line x1="500" y1="290" x2="485" y2="320" stroke="#ef4444" stroke-width="2.5" id="line-q4" />
            </g>
            <g id="diode-d4-group" class="hidden">
              <path d="M 500 260 L 535 260 L 535 288" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 500 360 L 535 360 L 535 332" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 535 300 L 527 315 L 543 315 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d4" />
              <line x1="525" y1="300" x2="545" y2="300" stroke="#475569" stroke-width="2" id="bar-d4" />
              <text x="553" y="312" fill="#64748b" font-size="10">D4</text>
            </g>

            <g id="leg-c-label" class="hidden">
              <rect x="605" y="25" width="90" height="22" rx="4" fill="#1e293b" stroke="#334155" stroke-width="1" />
              <text x="650" y="40" fill="#94a3b8" font-size="10" font-weight="bold" text-anchor="middle">C相橋臂 (右)</text>
            </g>
            <path id="line-leg-c" d="M 650 70 L 650 110 M 650 170 L 650 280 M 650 340 L 650 380" stroke="#475569" stroke-width="2.5" fill="none" class="hidden" />
            <circle cx="650" cy="70" r="4" fill="#475569" id="node-c-top" class="hidden" />
            <circle cx="650" cy="225" r="5" fill="#475569" id="node-c" class="hidden" />
            <text x="665" y="221" fill="#f8fafc" font-size="13" font-weight="bold" id="lbl-c-node" class="hidden">C</text>
            <circle cx="650" cy="380" r="4" fill="#475569" id="node-c-bot" class="hidden" />
            <g id="sw-q5" class="cursor-pointer hidden" data-sw="4">
              <rect x="625" y="110" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q5" />
              <text x="650" y="132" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q5</text>
              <text x="650" y="152" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q5">OFF</text>
              <line x1="650" y1="120" x2="635" y2="150" stroke="#ef4444" stroke-width="2.5" id="line-q5" />
            </g>
            <g id="diode-d5-group" class="hidden">
              <path d="M 650 90 L 685 90 L 685 118" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 650 190 L 685 190 L 685 162" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 685 130 L 677 145 L 693 145 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d5" />
              <line x1="675" y1="130" x2="695" y2="130" stroke="#475569" stroke-width="2" id="bar-d5" />
              <text x="703" y="142" fill="#64748b" font-size="10">D5</text>
            </g>
            <g id="sw-q6" class="cursor-pointer hidden" data-sw="5">
              <rect x="625" y="280" width="50" height="60" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2" id="box-q6" />
              <text x="650" y="302" fill="#f1f5f9" font-size="11" font-weight="bold" text-anchor="middle">Q6</text>
              <text x="650" y="322" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" id="status-q6">OFF</text>
              <line x1="650" y1="290" x2="635" y2="320" stroke="#ef4444" stroke-width="2.5" id="line-q6" />
            </g>
            <g id="diode-d6-group" class="hidden">
              <path d="M 650 260 L 685 260 L 685 288" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 650 360 L 685 360 L 685 332" stroke="#475569" stroke-width="1.5" fill="none" />
              <path d="M 685 300 L 677 315 L 693 315 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" id="tri-d6" />
              <line x1="675" y1="300" x2="695" y2="300" stroke="#475569" stroke-width="2" id="bar-d6" />
              <text x="703" y="312" fill="#64748b" font-size="10">D6</text>
            </g>

            <g id="load-half-group">
              <path d="M 350 225 L 290 225 M 200 225 L 210 225" stroke="#475569" stroke-width="2.5" fill="none" />
              <rect x="210" y="210" width="80" height="30" rx="3" fill="#1a2238" stroke="#38bdf8" stroke-width="2" />
              <text x="250" y="229" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" id="lbl-load-half">負載 (R-L)</text>
            </g>
            <g id="load-full-group" class="hidden">
              <path d="M 350 225 L 400 225 M 450 225 L 500 225" stroke="#475569" stroke-width="2.5" fill="none" />
              <rect x="390" y="210" width="70" height="30" rx="3" fill="#1a2238" stroke="#38bdf8" stroke-width="2" />
              <text x="425" y="229" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" id="lbl-load-full">負載 (R-L)</text>
            </g>
            <g id="load-three-group" class="hidden">
              <path d="M 350 225 L 350 205 L 460 205" stroke="#475569" stroke-width="2" fill="none" />
              <path d="M 500 225 L 500 205" stroke="#475569" stroke-width="2" fill="none" />
              <path d="M 650 225 L 650 205 L 540 205" stroke="#475569" stroke-width="2" fill="none" />
              <rect x="460" y="185" width="80" height="40" rx="4" fill="#1a2238" stroke="#38bdf8" stroke-width="2" />
              <text x="500" y="202" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">平衡三相</text>
              <text x="500" y="216" fill="#38bdf8" font-size="9" text-anchor="middle">負載 (Y)</text>
            </g>

            <path id="active-flow-line"   d="" fill="none" stroke="#10b981" stroke-width="3.5" class="glowing-path glow-green hidden" />
            <path id="active-return-line" d="" fill="none" stroke="#60a5fa" stroke-width="3.5" class="glowing-path glowing-path-diode glow-blue hidden" />
            <path id="active-diode-flow"  d="" fill="none" stroke="#f59e0b" stroke-width="3.5" class="glowing-path glow-amber hidden" />
          </svg>
        </div>

        <!-- 手動柵極控制 -->
        <div id="manual-panel" class="mt-1 p-3 bg-slate-950/90 rounded-xl border border-slate-800">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h4 class="text-xs font-bold text-slate-300">🎮 手動柵極控制（也可直接點電路圖開關）</h4>
              <p class="text-[10px] text-slate-500 mt-0.5">自動模式關閉時有效。小心同臂直通短路！</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button id="btn-auto" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-slate-500" id="led-auto"></span> 自動 PWM 控制
              </button>
              <button id="btn-reset" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">柵極全關</button>
            </div>
          </div>
          <div class="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5" id="shortcut-group"></div>
        </div>
      </section>

      <!-- 右：示波器 + 參數 -->
      <section class="lg:col-span-5 flex flex-col gap-3">
        <div class="sim-shell">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> 多通道示波器
            </span>
            <span id="scope-voltage-text" class="font-mono text-[10px] text-slate-400">Vout = 0.0 V</span>
          </div>
          <div class="oscilloscope-screen h-44 rounded-xl border border-emerald-950/80 overflow-hidden relative">
            <canvas id="scope-canvas" class="w-full h-full"></canvas>
          </div>

          <div id="scope-metrics" class="flex justify-around items-center mt-2 pt-2 border-t border-slate-800/40 font-mono text-[10px] text-slate-400">
            <span title="輸出電壓有效值（含所有成分）">V<sub>rms</sub>: <span id="m-vrms" class="text-emerald-400">0.0</span> V</span>
            <span title="基波（你設定的正弦）有效值">V<sub>1,rms</sub>: <span id="m-v1" class="text-cyan-400">0.0</span> V</span>
            <span title="總諧波失真，越低波形越乾淨">THD: <span id="m-thd" class="text-amber-400">0.0</span> %</span>
          </div>

          <div id="snapshot-panel" class="hidden mt-2 pt-2 border-t border-slate-800/40">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-400">📸 凍結波形＋數據，切換設定後<b class="text-slate-300">疊圖比較</b>：</span>
              <div class="flex gap-1.5">
                <button id="btn-snap" class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-600/80 hover:bg-emerald-500 text-white transition">凍結快照</button>
                <button id="btn-snap-clear" class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">清空</button>
              </div>
            </div>
            <div id="snap-list" class="mt-1.5 space-y-1 font-mono text-[10px]"></div>
          </div>

          <div id="channel-toggles" class="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-slate-800/40 text-[10px]">
            <label data-ch="1" class="ch-label flex items-center gap-1.5 cursor-pointer text-emerald-400">
              <input type="checkbox" id="chk-ch1" class="rounded accent-emerald-500 bg-slate-950"> CH1: 橋臂輸出 (PWM)</label>
            <label data-ch="2" class="ch-label flex items-center gap-1.5 cursor-pointer text-cyan-400">
              <input type="checkbox" id="chk-ch2" class="rounded accent-cyan-500 bg-slate-950"> CH2: 濾波電壓 (LC)</label>
            <label data-ch="3" class="ch-label flex items-center gap-1.5 cursor-pointer text-amber-500">
              <input type="checkbox" id="chk-ch3" class="rounded accent-amber-500 bg-slate-950"> CH3: 負載電流</label>
            <label data-ch="4" class="ch-label flex items-center gap-1.5 cursor-pointer text-red-400">
              <input type="checkbox" id="chk-ch4" class="rounded accent-red-500 bg-slate-950"> CH4: 調變對照波</label>
          </div>
        </div>

        <div class="sim-shell flex flex-col gap-3">
          <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5">⚙️ 模擬參數</h3>
          <div class="grid grid-cols-2 gap-3">
            <div id="wrap-load">
              <label class="block text-[10px] text-slate-400 font-medium mb-1">負載類型</label>
              <select id="sel-load-type" class="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none focus:border-emerald-500">
                <option value="R">阻性 (Pure R)</option>
                <option value="RL">感性 (RL) — 支援續流</option>
                <option value="LC">LC 濾波器 — 平滑正弦</option>
              </select>
            </div>
            <div id="wrap-mod">
              <label class="block text-[10px] text-slate-400 font-medium mb-1">調變策略</label>
              <select id="sel-modulation" class="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none focus:border-emerald-500"></select>
            </div>
          </div>
          <div class="space-y-2.5 pt-1">
            <div id="wrap-ma">
              <div class="flex justify-between text-[10px] mb-1"><span class="text-slate-400">調變比 / 占空比 (m<sub>a</sub>)</span><span class="text-emerald-400 font-mono" id="val-ma">0.8</span></div>
              <input type="range" id="sld-ma" min="0" max="1.1" step="0.05" value="0.8" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500">
            </div>
            <div id="wrap-freq">
              <div class="flex justify-between text-[10px] mb-1"><span class="text-slate-400">基波頻率 (f)</span><span class="text-emerald-400 font-mono" id="val-freq">50 Hz</span></div>
              <input type="range" id="sld-freq" min="10" max="100" step="1" value="50" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500">
            </div>
            <div id="wrap-fc">
              <div class="flex justify-between text-[10px] mb-1"><span class="text-slate-400">開關載波頻率 (f<sub>c</sub>)</span><span class="text-emerald-400 font-mono" id="val-fc">1000 Hz</span></div>
              <input type="range" id="sld-fc" min="200" max="3000" step="50" value="1000" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500">
            </div>
          </div>
        </div>
      </section>
    </div>`;
  }

  // ---------- 掛載 ----------
  function mount(selector, userCfg) {
    const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!root) { console.error('PE.mount: 找不到容器', selector); return; }

    const cfg = Object.assign({
      topology: 'half', allowTopology: false,
      loads: ['R', 'RL', 'LC'], modulations: [],
      controls: { ma: true, freq: true, fc: true, manual: true },
      channels: { ch1: true, ch2: true, ch3: true, ch4: false },
      defaults: {}, metrics: true, snapshot: false
    }, userCfg || {});
    const d = Object.assign({ ma: 0.8, freq: 50, fc: 1000, load: cfg.loads[0], autoMode: true }, cfg.defaults);

    root.innerHTML = template();
    const $ = (id) => root.querySelector('#' + id);

    // ---- 狀態 ----
    let currentTopology = cfg.topology;
    let loadType = d.load;
    let modulationScheme = 'spwm';
    let switchStates = [false, false, false, false, false, false];
    let diodeStates = [false, false, false, false, false, false];
    let autoMode = d.autoMode;
    let param_ma = d.ma, param_freq = d.freq, param_fc = d.fc;

    let t_time = 0;
    let current_L = 0, current_L_b = 0, current_L_c = 0;
    let vc_filter = 0, il_filter = 0;
    let vc_filter_b = 0, il_filter_b = 0, vc_filter_c = 0, il_filter_c = 0;

    let bufHead = 0, voltRange = 100, currRange = 10;
    let acc_n = 0, acc_v2 = 0, acc_a1 = 0, acc_b1 = 0;
    let metricVrms = 0, metricV1rms = 0, metricThd = 0;

    // 快照疊圖：凍結當下的顯示波形，疊在即時波形上比較
    let snapshots = [];
    let lastDisp = null;
    const snapPalette = ['#a78bfa', '#f472b6', '#facc15', '#38bdf8', '#fb923c', '#4ade80'];

    const mkBuf = () => new Array(bufLen).fill(0);
    let ch1_buf = mkBuf(), ch2_buf = mkBuf(), ch3_buf = mkBuf(), ch4_buf = mkBuf(), carrier_buf = mkBuf();
    let ch1_b_buf = mkBuf(), ch1_c_buf = mkBuf(), ch3_b_buf = mkBuf(), ch3_c_buf = mkBuf();

    const canvas = $('scope-canvas');
    const ctx = canvas.getContext('2d');

    // 快取 DOM
    const dom = { chk: [], box: [], status: [], line: [], tri: [], bar: [] };
    for (let i = 1; i <= 4; i++) dom.chk[i - 1] = $('chk-ch' + i);
    for (let i = 1; i <= 6; i++) {
      dom.box[i - 1] = $('box-q' + i); dom.status[i - 1] = $('status-q' + i); dom.line[i - 1] = $('line-q' + i);
      dom.tri[i - 1] = $('tri-d' + i); dom.bar[i - 1] = $('bar-d' + i);
    }
    dom.scopeText = $('scope-voltage-text');
    dom.actPos = $('active-pos-bus'); dom.actNeg = $('active-neg-bus');
    dom.actFlow = $('active-flow-line'); dom.actRet = $('active-return-line'); dom.actDio = $('active-diode-flow');
    dom.mVrms = $('m-vrms'); dom.mV1 = $('m-v1'); dom.mThd = $('m-thd');

    function resizeCanvas() {
      const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
      if (w > 0) canvas.width = w;
      if (h > 0) canvas.height = h;
    }
    window.addEventListener('resize', resizeCanvas);
    // 若分頁在隱藏狀態下載入（clientWidth=0），等版面有尺寸或重新顯示時再校正一次。
    if (typeof ResizeObserver !== 'undefined') { try { new ResizeObserver(resizeCanvas).observe(canvas.parentElement); } catch (e) {} }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resizeCanvas(); });

    // ---- 參數 ----
    function updateParameters() {
      param_ma = parseFloat($('sld-ma').value);
      param_freq = parseInt($('sld-freq').value);
      param_fc = parseInt($('sld-fc').value);
      $('val-ma').innerText = param_ma.toFixed(2);
      $('val-freq').innerText = param_freq + ' Hz';
      $('val-fc').innerText = param_fc + ' Hz';
    }
    function changeLoadType() {
      loadType = $('sel-load-type').value;
      $('mode-status-badge').innerText = loadType === 'R' ? '阻性負載 (R)' : (loadType === 'RL' ? '阻感負載 (RL)' : 'LC 濾波模式');
      ['lbl-load-half', 'lbl-load-full'].forEach(id => {
        const el = $(id); if (el) el.innerText = loadType === 'R' ? '負載 (R)' : (loadType === 'RL' ? '負載 (R-L)' : 'LC 濾波器');
      });
      current_L = current_L_b = current_L_c = 0;
      vc_filter = il_filter = vc_filter_b = il_filter_b = vc_filter_c = il_filter_c = 0;
      checkSafetyAndFlow();
    }
    function changeModulation() { modulationScheme = $('sel-modulation').value; checkSafetyAndFlow(); }

    function updateModulationDropdown() {
      const sel = $('sel-modulation');
      sel.innerHTML = '';
      let opts = modulationOptions[currentTopology];
      if (cfg.modulations && cfg.modulations.length) opts = opts.filter(o => cfg.modulations.includes(o.val));
      opts.forEach(o => { const e = document.createElement('option'); e.value = o.val; e.innerText = o.text; sel.appendChild(e); });
      modulationScheme = sel.value;
    }

    function setTopology(topo) {
      currentTopology = topo;
      root.querySelectorAll('.topo-btn').forEach(btn => {
        const on = btn.dataset.topo === topo;
        btn.classList.toggle('bg-emerald-500', on); btn.classList.toggle('text-slate-950', on);
        btn.classList.toggle('font-black', on);
        btn.classList.toggle('text-slate-400', !on);
      });
      $('topology-badge').innerText = topo === 'half' ? '半橋模式' : (topo === 'full' ? '全橋模式' : '三相模式');
      updateModulationDropdown();
      resetSwitches();
      updateSVGLayout();
      buildShortcuts();
    }

    function updateSVGLayout() {
      const show = el => el && el.classList.remove('hidden');
      const hide = el => el && el.classList.add('hidden');
      const ids = ['half-cap-group', 'leg-b-label', 'leg-c-label', 'sw-q3', 'sw-q4', 'sw-q5', 'sw-q6',
        'line-leg-b', 'line-leg-c', 'node-b-top', 'node-b-bot', 'node-b', 'lbl-b-node',
        'node-c-top', 'node-c-bot', 'node-c', 'lbl-c-node',
        'diode-d3-group', 'diode-d4-group', 'diode-d5-group', 'diode-d6-group',
        'load-half-group', 'load-full-group', 'load-three-group'];
      ids.forEach(id => hide($(id)));

      if (currentTopology === 'half') { show($('half-cap-group')); show($('load-half-group')); }
      else if (currentTopology === 'full') {
        ['leg-b-label', 'line-leg-b', 'node-b-top', 'node-b-bot', 'node-b', 'lbl-b-node', 'sw-q3', 'sw-q4', 'diode-d3-group', 'diode-d4-group', 'load-full-group'].forEach(id => show($(id)));
      } else if (currentTopology === 'three') {
        ['leg-b-label', 'line-leg-b', 'node-b-top', 'node-b-bot', 'node-b', 'lbl-b-node', 'sw-q3', 'sw-q4', 'diode-d3-group', 'diode-d4-group',
          'leg-c-label', 'line-leg-c', 'node-c-top', 'node-c-bot', 'node-c', 'lbl-c-node', 'sw-q5', 'sw-q6', 'diode-d5-group', 'diode-d6-group', 'load-three-group'].forEach(id => show($(id)));
      }
      const posBus = $('pos-bus'), negBus = $('neg-bus');
      const end = currentTopology === 'half' ? 350 : (currentTopology === 'full' ? 500 : 650);
      posBus.setAttribute('d', `M 80 70 L ${end} 70`);
      negBus.setAttribute('d', `M 80 380 L ${end} 380`);
    }

    function buildShortcuts() {
      const c = $('shortcut-group'); c.innerHTML = '';
      shortcuts[currentTopology].forEach(sc => {
        const b = document.createElement('button');
        b.className = 'px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-bold rounded-lg transition-all';
        b.innerText = sc.name;
        b.onclick = () => { if (autoMode) toggleAutoMode(); setPresetSwitches(sc.state); };
        c.appendChild(b);
      });
    }

    function toggleSwitch(i) { if (autoMode) return; switchStates[i] = !switchStates[i]; checkSafetyAndFlow(); }
    function setPresetSwitches(s) { switchStates = [...s]; checkSafetyAndFlow(); }
    function resetSwitches() {
      switchStates = [false, false, false, false, false, false];
      diodeStates = [false, false, false, false, false, false];
      $('short-circuit-warning').classList.add('hidden');
      checkSafetyAndFlow();
    }
    function toggleAutoMode() {
      autoMode = !autoMode;
      const led = $('led-auto'), btn = $('btn-auto');
      if (autoMode) { led.classList.remove('bg-slate-500'); led.classList.add('bg-emerald-500', 'animate-pulse'); btn.classList.add('border-emerald-500/50', 'text-emerald-400'); }
      else { led.classList.remove('bg-emerald-500', 'animate-pulse'); led.classList.add('bg-slate-500'); btn.classList.remove('border-emerald-500/50', 'text-emerald-400'); resetSwitches(); }
    }

    function checkSafetyAndFlow() {
      let shoot = false;
      if (switchStates[0] && switchStates[1]) shoot = true;
      if (currentTopology !== 'half' && switchStates[2] && switchStates[3]) shoot = true;
      if (currentTopology === 'three' && switchStates[4] && switchStates[5]) shoot = true;
      const w = $('short-circuit-warning');
      if (shoot) {
        w.classList.remove('hidden'); autoMode = false;
        $('led-auto').classList.remove('bg-emerald-500', 'animate-pulse'); $('led-auto').classList.add('bg-slate-500');
      } else w.classList.add('hidden');
      renderSwitchesUI(); renderDiodesUI();
    }

    function renderSwitchesUI() {
      for (let i = 0; i < 6; i++) {
        const box = dom.box[i], st = dom.status[i], line = dom.line[i];
        if (!box) continue;
        const legX = i < 2 ? 350 : (i < 4 ? 500 : 650);
        if (switchStates[i]) {
          box.setAttribute('stroke', '#10b981'); box.setAttribute('fill', '#064e3b');
          st.innerText = 'ON'; st.setAttribute('fill', '#10b981');
          line.setAttribute('x1', legX); line.setAttribute('x2', legX);
          if (i % 2 === 0) { line.setAttribute('y1', '110'); line.setAttribute('y2', '170'); }
          else { line.setAttribute('y1', '280'); line.setAttribute('y2', '340'); }
          line.setAttribute('stroke', '#10b981');
        } else {
          box.setAttribute('stroke', '#475569'); box.setAttribute('fill', '#111827');
          st.innerText = 'OFF'; st.setAttribute('fill', '#ef4444');
          line.setAttribute('x1', legX); line.setAttribute('x2', legX - 12);
          if (i % 2 === 0) { line.setAttribute('y1', '120'); line.setAttribute('y2', '150'); }
          else { line.setAttribute('y1', '290'); line.setAttribute('y2', '320'); }
          line.setAttribute('stroke', '#ef4444');
        }
      }
    }
    function renderDiodesUI() {
      for (let i = 0; i < 6; i++) {
        const tri = dom.tri[i], bar = dom.bar[i];
        if (!tri) continue;
        if (diodeStates[i]) {
          tri.setAttribute('stroke', '#f59e0b'); tri.setAttribute('fill', '#78350f'); tri.setAttribute('filter', 'url(#glow-heavy)');
          bar.setAttribute('stroke', '#f59e0b'); bar.setAttribute('filter', 'url(#glow-heavy)');
        } else {
          tri.setAttribute('stroke', '#475569'); tri.setAttribute('fill', '#1e293b'); tri.removeAttribute('filter');
          bar.setAttribute('stroke', '#475569'); bar.removeAttribute('filter');
        }
      }
    }

    // ---- 物理求解（忠實移植）----
    function stepPhysicsNumerical() {
      let v_applied = 0, v_applied_b = 0, v_applied_c = 0;
      const v_ref = param_ma * Math.sin(2 * Math.PI * param_freq * t_time);
      const v_ref_b = param_ma * Math.sin(2 * Math.PI * param_freq * t_time - 2 * Math.PI / 3);
      const v_ref_c = param_ma * Math.sin(2 * Math.PI * param_freq * t_time + 2 * Math.PI / 3);
      const tri_p = (t_time * param_fc) % 1.0;
      const v_tri = tri_p < 0.5 ? (tri_p * 4.0 - 1.0) : (3.0 - tri_p * 4.0);
      let active_ref_for_ch4 = v_ref;

      if (autoMode) {
        if (currentTopology === 'half') {
          if (modulationScheme === 'square') { switchStates[0] = v_ref > 0; switchStates[1] = !switchStates[0]; }
          else { switchStates[0] = v_ref > v_tri; switchStates[1] = !switchStates[0]; }
        } else if (currentTopology === 'full') {
          if (modulationScheme === 'square') { switchStates[0] = v_ref > 0; switchStates[1] = !switchStates[0]; switchStates[2] = !switchStates[0]; switchStates[3] = switchStates[0]; }
          else if (modulationScheme === 'spwm_bi') { switchStates[0] = v_ref > v_tri; switchStates[1] = !switchStates[0]; switchStates[2] = !switchStates[0]; switchStates[3] = switchStates[0]; }
          else if (modulationScheme === 'spwm_uni') { switchStates[0] = v_ref > v_tri; switchStates[1] = !switchStates[0]; switchStates[2] = (-v_ref) > v_tri; switchStates[3] = !switchStates[2]; }
        } else if (currentTopology === 'three') {
          if (modulationScheme === 'sixstep') {
            const sector = Math.floor((t_time * param_freq * 360) % 360 / 60);
            const steps = [[true, false, false, true, true, false], [true, false, false, true, false, true], [true, false, true, false, false, true], [false, true, true, false, false, true], [false, true, true, false, true, false], [false, true, false, true, true, false]];
            switchStates = [...steps[sector]];
          } else if (modulationScheme === 'spwm') {
            switchStates[0] = v_ref > v_tri; switchStates[1] = !switchStates[0];
            switchStates[2] = v_ref_b > v_tri; switchStates[3] = !switchStates[2];
            switchStates[4] = v_ref_c > v_tri; switchStates[5] = !switchStates[4];
          } else if (modulationScheme === 'svpwm') {
            const max_v = Math.max(v_ref, v_ref_b, v_ref_c), min_v = Math.min(v_ref, v_ref_b, v_ref_c);
            const v_off = -0.5 * (max_v + min_v);
            const a = v_ref + v_off, b = v_ref_b + v_off, c = v_ref_c + v_off;
            switchStates[0] = a > v_tri; switchStates[1] = !switchStates[0];
            switchStates[2] = b > v_tri; switchStates[3] = !switchStates[2];
            switchStates[4] = c > v_tri; switchStates[5] = !switchStates[4];
            active_ref_for_ch4 = a;
          }
        }
      }

      diodeStates = [false, false, false, false, false, false];

      if (currentTopology === 'half') {
        const q1 = switchStates[0], q2 = switchStates[1];
        if (q1) v_applied = V_half;
        else if (q2) v_applied = -V_half;
        else {
          if (loadType === 'RL') {
            if (current_L > 0.05) { diodeStates[1] = true; v_applied = -V_half; }
            else if (current_L < -0.05) { diodeStates[0] = true; v_applied = V_half; }
            else v_applied = 0;
          } else v_applied = 0;
        }
        if (loadType === 'R') { current_L = v_applied / R_val; vc_filter = 0; }
        else if (loadType === 'RL') { current_L += ((v_applied - current_L * R_val) / L_val) * dt; }
        else if (loadType === 'LC') {
          il_filter += ((v_applied - vc_filter) / L_f) * dt;
          vc_filter += ((il_filter - vc_filter / R_val) / C_f) * dt;
          current_L = vc_filter / R_val;
        }
      } else if (currentTopology === 'full') {
        const q1 = switchStates[0], q2 = switchStates[1], q3 = switchStates[2], q4 = switchStates[3];
        let va = q1 ? V_half : (q2 ? -V_half : 0);
        let vb = q3 ? V_half : (q4 ? -V_half : 0);
        if (!q1 && !q2) { if (current_L > 0.05) { diodeStates[1] = true; va = -V_half; } else if (current_L < -0.05) { diodeStates[0] = true; va = V_half; } }
        if (!q3 && !q4) { if (current_L > 0.05) { diodeStates[2] = true; vb = V_half; } else if (current_L < -0.05) { diodeStates[3] = true; vb = -V_half; } }
        v_applied = va - vb;
        if (loadType === 'R') current_L = v_applied / R_val;
        else if (loadType === 'RL') current_L += ((v_applied - current_L * R_val) / L_val) * dt;
        else if (loadType === 'LC') {
          il_filter += ((v_applied - vc_filter) / L_f) * dt;
          vc_filter += ((il_filter - vc_filter / R_val) / C_f) * dt;
          current_L = vc_filter / R_val;
        }
      } else if (currentTopology === 'three') {
        const legV = (qUp, qLow, iP, dUp, dLow) => {
          if (qUp) return V_half; if (qLow) return -V_half;
          if (iP > 0.05) { diodeStates[dLow] = true; return -V_half; }
          if (iP < -0.05) { diodeStates[dUp] = true; return V_half; }
          return 0;
        };
        const va = legV(switchStates[0], switchStates[1], current_L, 0, 1);
        const vb = legV(switchStates[2], switchStates[3], current_L_b, 2, 3);
        const vc = legV(switchStates[4], switchStates[5], current_L_c, 4, 5);
        const vn = (va + vb + vc) / 3.0;
        const van = va - vn, vbn = vb - vn, vcn = vc - vn;
        v_applied = va - vb; v_applied_b = vb - vc; v_applied_c = vc - va;
        if (loadType === 'R') { current_L = van / R_val; current_L_b = vbn / R_val; current_L_c = vcn / R_val; }
        else if (loadType === 'RL') {
          current_L += ((van - current_L * R_val) / L_val) * dt;
          current_L_b += ((vbn - current_L_b * R_val) / L_val) * dt;
          current_L_c += ((vcn - current_L_c * R_val) / L_val) * dt;
        } else if (loadType === 'LC') {
          il_filter += ((van - vc_filter) / L_f) * dt; vc_filter += ((il_filter - vc_filter / R_val) / C_f) * dt;
          il_filter_b += ((vbn - vc_filter_b) / L_f) * dt; vc_filter_b += ((il_filter_b - vc_filter_b / R_val) / C_f) * dt;
          il_filter_c += ((vcn - vc_filter_c) / L_f) * dt; vc_filter_c += ((il_filter_c - vc_filter_c / R_val) / C_f) * dt;
          current_L = vc_filter / R_val; current_L_b = vc_filter_b / R_val; current_L_c = vc_filter_c / R_val;
        }
      }

      const w1 = 2 * Math.PI * param_freq;
      acc_n++; acc_v2 += v_applied * v_applied;
      acc_a1 += v_applied * Math.cos(w1 * t_time); acc_b1 += v_applied * Math.sin(w1 * t_time);

      if (t_time % 0.001 < dt) { updateVisualFlowPaths(v_applied); renderSwitchesUI(); renderDiodesUI(); }

      t_time += dt;
      const T = 1.0 / param_freq;
      if (t_time >= T) {
        t_time -= T;
        if (acc_n > 0) {
          metricVrms = Math.sqrt(acc_v2 / acc_n);
          const a1 = (2 / acc_n) * acc_a1, b1 = (2 / acc_n) * acc_b1;
          metricV1rms = Math.sqrt(a1 * a1 + b1 * b1) / Math.SQRT2;
          const hsq = Math.max(0, metricVrms * metricVrms - metricV1rms * metricV1rms);
          metricThd = metricV1rms > 1e-6 ? Math.sqrt(hsq) / metricV1rms * 100 : 0;
        }
        acc_n = acc_v2 = acc_a1 = acc_b1 = 0;
      }
      return { v1: v_applied, v2: vc_filter, i1: current_L, ref: active_ref_for_ch4, tri: v_tri, v1_b: v_applied_b, v1_c: v_applied_c, i1_b: current_L_b, i1_c: current_L_c };
    }

    function updateVisualFlowPaths() {
      const { actPos, actNeg, actFlow, actDio } = dom;
      [actPos, actNeg, actFlow, dom.actRet, actDio].forEach(e => e.classList.add('hidden'));
      if (currentTopology === 'half') {
        if (switchStates[0]) { actPos.setAttribute('d', 'M 80 200 L 80 70 L 350 70'); actPos.classList.remove('hidden'); actFlow.setAttribute('d', 'M 350 70 L 350 225 L 200 225'); actFlow.classList.remove('hidden'); }
        else if (switchStates[1]) { actNeg.setAttribute('d', 'M 350 380 L 80 380 L 80 250'); actNeg.classList.remove('hidden'); actFlow.setAttribute('d', 'M 200 225 L 350 225 L 350 380'); actFlow.classList.remove('hidden'); }
        else if (diodeStates[1]) { actNeg.setAttribute('d', 'M 350 380 L 80 380 L 80 250'); actNeg.classList.remove('hidden'); actDio.setAttribute('d', 'M 200 225 L 350 225 L 350 360 L 385 360 L 385 300 L 350 260'); actDio.classList.remove('hidden'); }
        else if (diodeStates[0]) { actPos.setAttribute('d', 'M 80 200 L 80 70 L 350 70'); actPos.classList.remove('hidden'); actDio.setAttribute('d', 'M 350 190 L 385 190 L 385 130 L 350 90 M 350 225 L 200 225'); actDio.classList.remove('hidden'); }
      } else if (currentTopology === 'full') {
        if (switchStates[0] && switchStates[3]) { actPos.setAttribute('d', 'M 80 70 L 350 70'); actPos.classList.remove('hidden'); actFlow.setAttribute('d', 'M 350 70 L 350 225 L 500 225 L 500 380'); actFlow.classList.remove('hidden'); actNeg.setAttribute('d', 'M 500 380 L 80 380'); actNeg.classList.remove('hidden'); }
        else if (switchStates[1] && switchStates[2]) { actPos.setAttribute('d', 'M 80 70 L 500 70'); actPos.classList.remove('hidden'); actFlow.setAttribute('d', 'M 500 70 L 500 225 L 350 225 L 350 380'); actFlow.classList.remove('hidden'); actNeg.setAttribute('d', 'M 350 380 L 80 380'); actNeg.classList.remove('hidden'); }
        else if (diodeStates[1] && diodeStates[2]) { actDio.setAttribute('d', 'M 385 300 L 350 260 M 350 225 L 500 225 M 500 190 L 535 190 L 535 130'); actDio.classList.remove('hidden'); }
        else if (diodeStates[0] && diodeStates[3]) { actDio.setAttribute('d', 'M 385 130 L 350 90 M 350 225 L 500 225 M 500 260 L 535 260 L 535 300'); actDio.classList.remove('hidden'); }
      } else if (currentTopology === 'three') {
        const legX = [350, 500, 650]; let posD = '', negD = '';
        for (let leg = 0; leg < 3; leg++) { const x = legX[leg]; if (switchStates[leg * 2]) posD += `M 80 70 L ${x} 70 L ${x} 225 `; else if (switchStates[leg * 2 + 1]) negD += `M ${x} 225 L ${x} 380 L 80 380 `; }
        if (posD) { actPos.setAttribute('d', posD); actPos.classList.remove('hidden'); }
        if (negD) { actNeg.setAttribute('d', negD); actNeg.classList.remove('hidden'); }
        if (posD || negD) { actFlow.setAttribute('d', 'M 350 225 L 350 205 L 460 205 M 500 225 L 500 205 M 650 225 L 650 205 L 540 205'); actFlow.classList.remove('hidden'); }
      }
    }

    // ---- 示波器繪圖（忠實移植）----
    function drawOscilloscope() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(16,185,129,0.08)'; ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) { const x = canvas.width / 10 * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let i = 1; i < 6; i++) { const y = canvas.height / 6 * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(16,185,129,0.22)'; ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();

      const centerY = canvas.height / 2, maxAmp = canvas.height * 0.42;
      const periodSamples = (1.0 / param_freq) / sampleInterval;
      let dispLen = Math.round(2.0 * periodSamples);
      dispLen = Math.max(120, Math.min(dispLen, bufLen - Math.ceil(periodSamples) - 64));
      const ord = (buf, p) => buf[(bufHead + p) % bufLen];
      let triggerIdx = bufLen - dispLen;
      for (let i = bufLen - dispLen - 1; i >= 1; i--) { if (ord(ch4_buf, i) < 0 && ord(ch4_buf, i + 1) >= 0) { triggerIdx = i; break; } }
      const slice = (buf) => { const out = new Array(dispLen); let idx = (bufHead + triggerIdx) % bufLen; for (let i = 0; i < dispLen; i++) { out[i] = buf[idx]; if (++idx === bufLen) idx = 0; } return out; };

      const ch1 = slice(ch1_buf), ch2 = slice(ch2_buf), ch3 = slice(ch3_buf), ch4 = slice(ch4_buf), carr = slice(carrier_buf);
      const ch1b = slice(ch1_b_buf), ch1c = slice(ch1_c_buf), ch3b = slice(ch3_b_buf), ch3c = slice(ch3_c_buf);

      const peakOf = (arrs) => { let p = 0; for (const a of arrs) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; } return p; };
      const is3 = currentTopology === 'three';
      const vChans = [ch1]; if (loadType === 'LC') vChans.push(ch2); if (is3) vChans.push(ch1b, ch1c);
      const iChans = is3 ? [ch3, ch3b, ch3c] : [ch3];
      const vTarget = Math.max(10, peakOf(vChans) * 1.18), iTarget = Math.max(1, peakOf(iChans) * 1.18);
      voltRange += (vTarget - voltRange) * 0.05; currRange += (iTarget - currRange) * 0.05;
      const voltScale = maxAmp / voltRange, currScale = maxAmp / currRange, refScale = maxAmp / 1.0;

      const drawCh = (data, color, scale, glow = false, lw = 2) => {
        ctx.strokeStyle = color; ctx.shadowBlur = glow ? 6 : 0; if (glow) ctx.shadowColor = color; ctx.lineWidth = lw; ctx.beginPath();
        const step = canvas.width / dispLen;
        for (let i = 0; i < dispLen; i++) { const y = centerY - data[i] * scale; if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * step, y); }
        ctx.stroke(); ctx.shadowBlur = 0;
      };

      if (dom.chk[3].checked) { drawCh(carr, '#334155', refScale, false, 1.5); drawCh(ch4, '#ef4444', refScale, true, 2); }
      if (dom.chk[0].checked) { drawCh(ch1, '#10b981', voltScale, true, 2); if (is3) { drawCh(ch1b, '#eab308', voltScale, false, 1.5); drawCh(ch1c, '#06b6d4', voltScale, false, 1.5); } }
      if (dom.chk[1].checked && loadType === 'LC') drawCh(ch2, '#22d3ee', voltScale, true, 2.5);
      if (dom.chk[2].checked) { drawCh(ch3, '#f59e0b', currScale, true, 2); if (is3) { drawCh(ch3b, '#e2e8f0', currScale, false, 1.5); drawCh(ch3c, '#ec4899', currScale, false, 1.5); } }

      // 保留本幀波形供「凍結快照」使用（電壓 CH1 + 電流 CH3）
      lastDisp = { ch1: ch1, ch3: ch3 };

      // 疊上已凍結的快照（虛線、半透明、各一色）
      if (snapshots.length) {
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.shadowBlur = 0;
        const ghost = (data, scale, color) => {
          if (!data || !data.length) return;
          ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.6; ctx.beginPath();
          const step = canvas.width / data.length;
          for (let i = 0; i < data.length; i++) { const y = centerY - data[i] * scale; if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * step, y); }
          ctx.stroke();
        };
        snapshots.forEach(s => { if (dom.chk[0].checked) ghost(s.ch1, voltScale, s.color); if (dom.chk[2].checked) ghost(s.ch3, currScale, s.color); });
        ctx.restore(); ctx.globalAlpha = 1; ctx.setLineDash([]);
      }
    }

    function simulationLoop() {
      let mnA, mxA, mnB, mxB, mnC, mxC;
      for (let i = 0; i < steps_per_frame; i++) {
        const s = stepPhysicsNumerical();
        if (i % decimation === 0) { mnA = mxA = s.v1; mnB = mxB = s.v1_b; mnC = mxC = s.v1_c; }
        else { if (s.v1 < mnA) mnA = s.v1; if (s.v1 > mxA) mxA = s.v1; if (s.v1_b < mnB) mnB = s.v1_b; if (s.v1_b > mxB) mxB = s.v1_b; if (s.v1_c < mnC) mnC = s.v1_c; if (s.v1_c > mxC) mxC = s.v1_c; }
        if (i % decimation === decimation - 1) {
          const useMax = (bufHead & 1) === 0;
          ch1_buf[bufHead] = useMax ? mxA : mnA; ch1_b_buf[bufHead] = useMax ? mxB : mnB; ch1_c_buf[bufHead] = useMax ? mxC : mnC;
          ch2_buf[bufHead] = s.v2; ch3_buf[bufHead] = s.i1; ch4_buf[bufHead] = s.ref; carrier_buf[bufHead] = s.tri;
          ch3_b_buf[bufHead] = s.i1_b; ch3_c_buf[bufHead] = s.i1_c;
          bufHead = (bufHead + 1) % bufLen;
        }
      }
      const newest = (bufHead - 1 + bufLen) % bufLen;
      const vout = (loadType === 'LC') ? ch2_buf[newest] : ch1_buf[newest];
      dom.scopeText.innerText = `Vout = ${vout.toFixed(1)} V | Iout = ${ch3_buf[newest].toFixed(2)} A`;
      dom.mVrms.innerText = metricVrms.toFixed(1); dom.mV1.innerText = metricV1rms.toFixed(1); dom.mThd.innerText = metricThd.toFixed(1);
      drawOscilloscope();
      requestAnimationFrame(simulationLoop);
    }

    // ---- 快照比較 ----
    function modText() { const o = (modulationOptions[currentTopology].find(m => m.val === modulationScheme) || {}); return o.text || modulationScheme; }
    function addSnapshot() {
      if (!lastDisp) return;
      const color = snapPalette[snapshots.length % snapPalette.length];
      snapshots.push({ ch1: lastDisp.ch1.slice(), ch3: lastDisp.ch3.slice(), color });
      const list = $('snap-list');
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between bg-slate-950/60 rounded px-2 py-1';
      row.innerHTML = `<span class="text-slate-400 truncate mr-2 flex items-center gap-1"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color}"></span>${currentTopology} · ${loadType} · m<sub>a</sub>=${param_ma.toFixed(2)} · ${modText()}</span>
        <span class="whitespace-nowrap"><span class="text-cyan-400">V₁=${metricV1rms.toFixed(1)}</span> · <span class="text-amber-400">THD=${metricThd.toFixed(1)}%</span></span>`;
      list.appendChild(row);
    }
    function clearSnapshots() { snapshots = []; $('snap-list').innerHTML = ''; }

    // ================= 套用 config 的可見性 =================
    if (!cfg.allowTopology) $('topo-switch').classList.add('hidden');
    if (!cfg.controls.manual) $('manual-panel').classList.add('hidden');
    if (!cfg.controls.ma) $('wrap-ma').classList.add('hidden');
    if (!cfg.controls.freq) $('wrap-freq').classList.add('hidden');
    if (!cfg.controls.fc) $('wrap-fc').classList.add('hidden');
    if (!cfg.metrics) $('scope-metrics').classList.add('hidden');
    if (cfg.snapshot) $('snapshot-panel').classList.remove('hidden');

    // 負載選單：只放允許的；若僅 1 種則隱藏選單
    const loadSel = $('sel-load-type');
    Array.from(loadSel.options).forEach(o => { if (!cfg.loads.includes(o.value)) o.remove(); });
    loadSel.value = d.load;
    if (cfg.loads.length <= 1) $('wrap-load').classList.add('hidden');

    // 調變選單：若僅 1 種則隱藏
    // （updateModulationDropdown 會在 setTopology 內依 cfg.modulations 過濾）

    // 通道顯示
    root.querySelectorAll('.ch-label').forEach(lab => {
      const n = lab.dataset.ch, key = 'ch' + n;
      if (!(key in cfg.channels)) { lab.classList.add('hidden'); dom.chk[n - 1].checked = false; }
      else { dom.chk[n - 1].checked = !!cfg.channels[key]; }
    });

    // ---- 事件 ----
    $('sld-ma').addEventListener('input', updateParameters);
    $('sld-freq').addEventListener('input', updateParameters);
    $('sld-fc').addEventListener('input', updateParameters);
    loadSel.addEventListener('change', changeLoadType);
    $('sel-modulation').addEventListener('change', changeModulation);
    $('btn-auto').addEventListener('click', toggleAutoMode);
    $('btn-reset').addEventListener('click', resetSwitches);
    $('btn-clear-short').addEventListener('click', resetSwitches);
    root.querySelectorAll('[data-sw]').forEach(g => g.addEventListener('click', () => toggleSwitch(parseInt(g.dataset.sw))));
    root.querySelectorAll('.topo-btn').forEach(b => b.addEventListener('click', () => setTopology(b.dataset.topo)));
    if (cfg.snapshot) { $('btn-snap').addEventListener('click', addSnapshot); $('btn-snap-clear').addEventListener('click', clearSnapshots); }

    // 調變選單套用過濾後，設定預設值
    function applyModulationDefault() { if (d.modulation) { const sel = $('sel-modulation'); if (Array.from(sel.options).some(o => o.value === d.modulation)) { sel.value = d.modulation; modulationScheme = d.modulation; } } if (cfg.modulations && cfg.modulations.length <= 1) $('wrap-mod').classList.add('hidden'); }

    // ---- 啟動 ----
    $('sld-ma').value = d.ma; $('sld-freq').value = d.freq; $('sld-fc').value = d.fc;
    resizeCanvas();
    // 設定自動模式 LED 初值
    if (autoMode) { $('led-auto').classList.add('bg-emerald-500', 'animate-pulse'); $('led-auto').classList.remove('bg-slate-500'); $('btn-auto').classList.add('border-emerald-500/50', 'text-emerald-400'); }
    setTopology(cfg.topology);
    applyModulationDefault();
    updateParameters();
    changeLoadType();
    simulationLoop();

    return { setTopology, root };
  }

  return { mount };
})();
