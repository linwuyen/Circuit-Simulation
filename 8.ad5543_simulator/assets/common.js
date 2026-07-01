/* ===================================================================== */
/* AD5543 教學課程 — 共用引擎 (common.js)                                 */
/* 包含:數學模型、SVG 圖形產生器、導覽列、進度、小測驗。                 */
/* 每一課只引入這支,再渲染自己需要的部分。全部離線、無外部相依。         */
/* ===================================================================== */
(function (global) {
  'use strict';

  const MAX = 65536;            // 2^16
  const R_DAC = 5000;           // AD5543 階梯標稱等效電阻 (Ω)

  const presets = [
    { label: '零刻度', hex: '0x0000', value: 0 },
    { label: '¼ 刻度', hex: '0x4000', value: 16384 },
    { label: '中刻度', hex: '0x8000', value: 32768 },
    { label: '滿刻度', hex: '0xFFFF', value: 65535 },
    { label: '1 LSB', hex: '0x0001', value: 1 },
  ];

  /* ---- 核心計算 (純函式) ------------------------------------------- */
  function compute(st) {
    const vref = st.vref, code = st.code, mode = st.mode || 'standard';
    const enableErrors = !!st.enableErrors, offsetMv = st.offsetMv || 0, gainPct = st.gainPct || 0;
    const ratio = code / MAX;
    const stage1 = -1 * vref * ratio;                       // 內建 RFB 一定反相
    const finalV = mode === 'positive' ? -stage1 : stage1;  // 第二級反相器把它翻正
    const ideal = finalV;
    const real = enableErrors ? ideal * (1 + gainPct / 100) + offsetMv / 1000 : ideal;
    const ioutmA = (vref / R_DAC) * ratio * 1000;
    const lsbuV = Math.abs(vref) / MAX * 1e6;
    const pct = ratio * 100;
    const bits = code.toString(2).padStart(16, '0').split('').map(Number);
    return { ratio, stage1, finalV, ideal, real, ioutmA, lsbuV, pct, bits };
  }

  /* ---- 內建 SVG 圖示 ----------------------------------------------- */
  const P = {
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="18"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="16" y1="14" x2="16" y2="18"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    binary: '<rect x="6" y="4" width="4" height="6" rx="1"/><rect x="14" y="14" width="4" height="6" rx="1"/><line x1="6" y1="20" x2="10" y2="20"/><line x1="14" y1="10" x2="18" y2="10"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    chart: '<path d="M3 3v18h18"/><polyline points="19 9 14 14 10 10 7 13"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.4 2 5 2 2.4-2 5-2"/><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11s2.4 2 5 2 2.4-2 5-2"/><path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17s2.4 2 5 2 2.4-2 5-2"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  };
  function ico(name, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.15em">'
      + (P[name] || '') + '</svg>';
  }

  /* ---- 預設碼按鈕 (需頁面定義 window.setCode) ---------------------- */
  function buildPresets(code) {
    return presets.map(p =>
      '<button class="preset' + (code === p.value ? ' on' : '') + '" title="' + p.hex +
      '" onclick="setCode(' + p.value + ')">' + p.label + '</button>'
    ).join('');
  }

  /* ---- 數學模型 (一步一步) ----------------------------------------- */
  function buildMath(st, c) {
    let s = '<div class="sec-label">' + ico('calc', 12) + ' 數學模型 (一步一步)</div>';
    s += '<p style="color:var(--slate-500);font-size:12px">① 把數位碼正規化成比例:</p>';
    s += '<p>D / 2¹⁶ = ' + st.code + ' / 65536</p>';
    s += '<p style="color:var(--green-400);text-align:right">= ' + c.ratio.toFixed(5) + '</p>';
    s += '<p style="color:var(--slate-500);font-size:12px;margin-top:8px">② Stage 1 (內建 RFB,永遠反相):</p>';
    s += '<p>V1 = −VREF × (D / 2¹⁶)</p>';
    s += '<p>&nbsp;&nbsp;&nbsp;= −(' + Number(st.vref).toFixed(1) + ') × ' + c.ratio.toFixed(5) + '</p>';
    s += '<p style="color:var(--red-400);text-align:right">= ' + c.stage1.toFixed(4) + ' V</p>';
    if (st.mode === 'positive')
      s += '<p style="color:var(--slate-500);font-size:12px;margin-top:8px">③ Stage 2 (反相器, 增益 = −1):</p><p>VOUT = V1 × (−1)</p>';
    s += '<p class="bigout" style="color:' + (st.mode === 'positive' ? 'var(--green-400)' : 'var(--yellow-400)') +
      '">VOUT(理想) = ' + c.finalV.toFixed(4) + ' V</p>';
    return s;
  }

  /* ---- 統計磚 ------------------------------------------------------ */
  function statTile(name, color, lab, val, h) {
    return '<div class="stat"><div class="lab"><span style="color:' + color + '">' + ico(name, 14) + '</span>' + lab + '</div>'
      + '<div class="val" style="color:' + color + '">' + val + '</div><div class="h">' + h + '</div></div>';
  }
  function buildStats(st, c) {
    return statTile('zap', 'var(--red-400)', 'IOUT 輸出電流', c.ioutmA.toFixed(4) + ' mA', 'VREF / 5kΩ × D/2¹⁶')
      + statTile('activity', st.mode === 'positive' ? 'var(--green-400)' : 'var(--yellow-400)', 'VOUT 輸出電壓', c.real.toFixed(4) + ' V',
        st.enableErrors ? ('理想 ' + c.ideal.toFixed(4) + ' V (已含誤差)') : (st.mode === 'standard' ? '單級反相輸出' : '雙級正輸出'))
      + statTile('binary', 'var(--blue-400)', '1 LSB 階距', c.lsbuV.toFixed(1) + ' µV', '= |VREF| / 2¹⁶')
      + statTile('calc', 'var(--purple-400)', '佔滿刻度', c.pct.toFixed(2) + ' %', 'D / 2¹⁶ 的百分比');
  }

  /* ---- 16-bit 暫存器 (需頁面定義 window.toggleBit) ----------------- */
  function buildBitReg(c) {
    return c.bits.map((b, i) => {
      const w = Math.pow(2, 15 - i);
      const wl = w >= 1024 ? (w / 1024) + 'k' : w;
      return '<button class="bit' + (b === 1 ? ' on' : '') + '" title="bit ' + (15 - i) + ' 權重 = ' + w + '" onclick="toggleBit(' + i + ')">'
        + '<span class="idx">' + (15 - i) + '</span><span class="v">' + b + '</span>'
        + '<span class="w" style="color:' + (b === 1 ? '#bfdbfe' : '#475569') + '">' + wl + '</span></button>';
    }).join('');
  }

  /* ---- 誤差數值 ---------------------------------------------------- */
  function buildErrValues(c) {
    return '<div class="errvals">'
      + '<div class="box"><div style="font-size:10px;color:var(--slate-500)">理想 VOUT</div><div style="font-size:.95rem;font-weight:700;color:var(--yellow-400)">' + c.ideal.toFixed(4) + ' V</div></div>'
      + '<div class="box"><div style="font-size:10px;color:var(--slate-500)">實測 VOUT</div><div style="font-size:.95rem;font-weight:700;color:var(--orange-400)">' + c.real.toFixed(4) + ' V</div></div>'
      + '</div>';
  }

  /* ---- 電路示意圖 -------------------------------------------------- */
  function buildSchematic(st, c, animate) {
    const dur = Math.max(0.15, 0.9 - c.ratio * 0.7).toFixed(2);
    const iout = (animate && c.ratio > 0)
      ? '<line x1="130" y1="180" x2="280" y2="180" stroke="#ef4444" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="6 5" class="flow" style="animation-duration:' + dur + 's"/>'
      : '<line x1="130" y1="180" x2="280" y2="180" stroke="#ef4444" stroke-width="2" marker-end="url(#arrow)"/>';
    let stage;
    if (st.mode === 'standard') {
      stage = (animate ? '<circle cx="420" cy="180" r="9" fill="#fbbf24" class="glow"/>' : '')
        + '<circle cx="420" cy="180" r="4" fill="#fbbf24"/>'
        + '<text x="430" y="185" font-size="17" font-weight="700" fill="#ca8a04">' + c.stage1.toFixed(3) + 'V</text>'
        + '<text x="340" y="220" font-size="11" fill="#64748b">單級 (已反相)</text>';
    } else {
      stage = '<rect x="380" y="170" width="40" height="20" fill="#fff" stroke="#000" stroke-width="2"/>'
        + '<text x="400" y="165" text-anchor="middle" font-size="11">R1 (10k)</text>'
        + '<line x1="420" y1="180" x2="460" y2="180" stroke="#000" stroke-width="2"/>'
        + '<path d="M 460 150 L 460 210 L 520 180 Z" fill="#fff" stroke="#000" stroke-width="2"/>'
        + '<text x="470" y="170" font-size="11" font-weight="700">-</text>'
        + '<text x="470" y="200" font-size="11" font-weight="700">+</text>'
        + '<path d="M 460 180 L 460 120 L 520 120 L 520 180" fill="none" stroke="#000" stroke-width="2"/>'
        + '<rect x="470" y="110" width="40" height="20" fill="#fff" stroke="#000" stroke-width="2"/>'
        + '<text x="490" y="105" text-anchor="middle" font-size="11">R2 (10k)</text>'
        + '<line x1="460" y1="200" x2="460" y2="230" stroke="#000" stroke-width="2"/>'
        + '<line x1="450" y1="230" x2="470" y2="230" stroke="#000" stroke-width="2"/>'
        + '<line x1="520" y1="180" x2="580" y2="180" stroke="#000" stroke-width="2"/>'
        + (animate ? '<circle cx="580" cy="180" r="9" fill="#22c55e" class="glow"/>' : '')
        + '<circle cx="580" cy="180" r="4" fill="#22c55e"/>'
        + '<text x="590" y="185" font-size="17" font-weight="700" fill="#16a34a">' + c.finalV.toFixed(3) + 'V</text>'
        + '<text x="520" y="220" font-size="11" fill="#64748b">Stage 2:反相器 (增益 = −1)</text>';
    }
    const outX = st.mode === 'standard' ? 420 : 380;
    return '<svg viewBox="0 0 700 350" style="width:100%">'
      + '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#ef4444"/></marker></defs>'
      + '<rect x="20" y="50" width="220" height="250" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5" rx="10"/>'
      + '<text x="30" y="70" font-size="13" font-weight="700" fill="#64748b">AD5543</text>'
      + '<line x1="0" y1="100" x2="20" y2="100" stroke="#000" stroke-width="2"/>'
      + '<circle cx="0" cy="100" r="3" fill="#3b82f6"/>'
      + '<text x="0" y="90" font-size="11" font-weight="700" fill="#2563eb">VREF</text>'
      + '<rect x="50" y="80" width="80" height="190" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>'
      + '<text x="90" y="170" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">R-2R</text>'
      + '<line x1="20" y1="100" x2="50" y2="100" stroke="#000" stroke-width="2"/>'
      + '<path d="M 50 120 L 30 120 L 30 40 L 320 40 L 320 130" fill="none" stroke="#d97706" stroke-width="2"/>'
      + '<rect x="150" y="30" width="40" height="20" fill="#fff" stroke="#d97706" stroke-width="2"/>'
      + '<text x="170" y="25" text-anchor="middle" font-size="11" font-weight="700" fill="#b45309">RFB</text>'
      + iout
      + '<text x="200" y="170" font-size="11" font-weight="700" fill="#dc2626">IOUT</text>'
      + '<path d="M 280 150 L 280 210 L 340 180 Z" fill="#fff" stroke="#000" stroke-width="2"/>'
      + '<text x="290" y="170" font-size="11" font-weight="700">-</text>'
      + '<text x="290" y="200" font-size="11" font-weight="700">+</text>'
      + '<line x1="280" y1="200" x2="280" y2="230" stroke="#000" stroke-width="2"/>'
      + '<line x1="270" y1="230" x2="290" y2="230" stroke="#000" stroke-width="2"/>'
      + '<line x1="320" y1="130" x2="320" y2="180" stroke="#d97706" stroke-width="2"/>'
      + '<circle cx="320" cy="180" r="3" fill="#d97706"/>'
      + '<line x1="340" y1="180" x2="' + outX + '" y2="180" stroke="#000" stroke-width="2"/>'
      + stage
      + '<rect x="50" y="230" width="80" height="40" fill="#1e293b" stroke="#000"/>'
      + '<text x="90" y="255" text-anchor="middle" font-size="11" fill="#fff">Shift Reg</text>'
      + '</svg>';
  }

  /* ---- 轉移函數圖 -------------------------------------------------- */
  function buildChart(st, c) {
    const X0 = 55, X1 = 390, Y0 = 200, Y1 = 20, yC = 110, span = 90;
    const vref = st.vref, mode = st.mode || 'standard';
    const vfs = Math.max(Math.abs(vref), 0.001);
    const dToX = d => X0 + (d / MAX) * (X1 - X0);
    const clampY = y => Math.max(Y1, Math.min(Y0, y));
    const vToY = v => clampY(yC - (v / vfs) * span);
    const idealAt = d => { const s = -vref * (d / MAX); return mode === 'positive' ? -s : s; };
    const realAt = d => st.enableErrors ? idealAt(d) * (1 + st.gainPct / 100) + st.offsetMv / 1000 : idealAt(d);
    const mx = dToX(st.code), my = vToY(realAt(st.code));
    let s = '<svg viewBox="0 0 420 230" style="width:100%">';
    s += '<line x1="' + X0 + '" y1="' + Y1 + '" x2="' + X0 + '" y2="' + Y0 + '" stroke="#475569" stroke-width="1"/>';
    s += '<line x1="' + X0 + '" y1="' + yC + '" x2="' + X1 + '" y2="' + yC + '" stroke="#475569" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X1 + '" y2="' + Y0 + '" stroke="#475569" stroke-width="1"/>';
    s += '<text x="' + (X0 - 6) + '" y="' + (Y1 + 4) + '" text-anchor="end" fill="#94a3b8" font-size="9">+' + vfs.toFixed(1) + 'V</text>';
    s += '<text x="' + (X0 - 6) + '" y="' + (yC + 3) + '" text-anchor="end" fill="#94a3b8" font-size="9">0V</text>';
    s += '<text x="' + (X0 - 6) + '" y="' + (Y0 + 2) + '" text-anchor="end" fill="#94a3b8" font-size="9">−' + vfs.toFixed(1) + 'V</text>';
    s += '<text x="' + X0 + '" y="' + (Y0 + 14) + '" text-anchor="middle" fill="#64748b" font-size="9">0</text>';
    s += '<text x="' + ((X0 + X1) / 2) + '" y="' + (Y0 + 14) + '" text-anchor="middle" fill="#64748b" font-size="9">0x8000</text>';
    s += '<text x="' + X1 + '" y="' + (Y0 + 14) + '" text-anchor="middle" fill="#64748b" font-size="9">0xFFFF</text>';
    s += '<line x1="' + dToX(0) + '" y1="' + vToY(idealAt(0)) + '" x2="' + dToX(MAX) + '" y2="' + vToY(idealAt(MAX)) + '" stroke="#facc15" stroke-width="2"/>';
    if (st.enableErrors) s += '<line x1="' + dToX(0) + '" y1="' + vToY(realAt(0)) + '" x2="' + dToX(MAX) + '" y2="' + vToY(realAt(MAX)) + '" stroke="#fb923c" stroke-width="2" stroke-dasharray="5 4"/>';
    s += '<line x1="' + mx + '" y1="' + Y1 + '" x2="' + mx + '" y2="' + Y0 + '" stroke="#22c55e" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>';
    s += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>';
    s += '<rect x="' + (X1 - 90) + '" y="' + Y1 + '" width="92" height="' + (st.enableErrors ? 32 : 18) + '" fill="#0f172a" opacity="0.7" rx="3"/>';
    s += '<line x1="' + (X1 - 84) + '" y1="' + (Y1 + 8) + '" x2="' + (X1 - 70) + '" y2="' + (Y1 + 8) + '" stroke="#facc15" stroke-width="2"/>';
    s += '<text x="' + (X1 - 66) + '" y="' + (Y1 + 11) + '" fill="#cbd5e1" font-size="8">理想</text>';
    if (st.enableErrors) s += '<line x1="' + (X1 - 84) + '" y1="' + (Y1 + 22) + '" x2="' + (X1 - 70) + '" y2="' + (Y1 + 22) + '" stroke="#fb923c" stroke-width="2" stroke-dasharray="3 2"/><text x="' + (X1 - 66) + '" y="' + (Y1 + 25) + '" fill="#cbd5e1" font-size="8">實測</text>';
    s += '</svg>';
    return s;
  }

  /* ---- SPI 時序 ---------------------------------------------------- */
  function buildSpi(c) {
    const W = 700, x0 = 50, cell = 38, end = x0 + 16 * cell;
    const CS_H = 28, CS_L = 50, CLK_H = 88, CLK_L = 110, SDI_H = 150, SDI_L = 172;
    const b = c.bits;
    let cs = 'M 20 ' + CS_H + ' L ' + x0 + ' ' + CS_H + ' L ' + x0 + ' ' + CS_L + ' L ' + end + ' ' + CS_L + ' L ' + end + ' ' + CS_H + ' L ' + (W - 10) + ' ' + CS_H;
    let clk = 'M 20 ' + CLK_L + ' L ' + x0 + ' ' + CLK_L;
    for (let i = 0; i < 16; i++) { const xi = x0 + i * cell, mid = xi + cell / 2, xe = xi + cell; clk += ' L ' + mid + ' ' + CLK_L + ' L ' + mid + ' ' + CLK_H + ' L ' + xe + ' ' + CLK_H + ' L ' + xe + ' ' + CLK_L; }
    let sdi = 'M 20 ' + (b[0] === 1 ? SDI_H : SDI_L);
    for (let i = 0; i < 16; i++) { const xi = x0 + i * cell, xe = xi + cell, y = b[i] === 1 ? SDI_H : SDI_L; sdi += ' L ' + xi + ' ' + y + ' L ' + xe + ' ' + y; }
    let s = '<svg viewBox="0 0 700 200" style="width:100%">';
    s += '<text x="12" y="' + CS_L + '" fill="#cbd5e1" font-size="11">CS</text>';
    s += '<text x="10" y="' + CLK_L + '" fill="#cbd5e1" font-size="11">CLK</text>';
    s += '<text x="12" y="' + SDI_L + '" fill="#cbd5e1" font-size="11">SDI</text>';
    for (let i = 0; i < 16; i++) {
      const xi = x0 + i * cell, cx = xi + cell / 2;
      s += '<line x1="' + xi + '" y1="' + (CS_H - 4) + '" x2="' + xi + '" y2="' + (SDI_L + 6) + '" stroke="#1e293b" stroke-width="1"/>';
      s += '<text x="' + cx + '" y="132" text-anchor="middle" fill="#64748b" font-size="8">' + (15 - i) + '</text>';
      s += '<text x="' + cx + '" y="' + (SDI_L + 16) + '" text-anchor="middle" fill="' + (b[i] === 1 ? '#4ade80' : '#475569') + '" font-size="10" font-weight="700">' + b[i] + '</text>';
    }
    s += '<line x1="' + end + '" y1="' + (CS_H - 4) + '" x2="' + end + '" y2="' + (SDI_L + 6) + '" stroke="#1e293b" stroke-width="1"/>';
    s += '<path d="' + cs + '" fill="none" stroke="#f472b6" stroke-width="2"/>';
    s += '<path d="' + clk + '" fill="none" stroke="#38bdf8" stroke-width="2"/>';
    s += '<path d="' + sdi + '" fill="none" stroke="#4ade80" stroke-width="2"/>';
    s += '<text x="' + (x0 + cell / 2) + '" y="18" text-anchor="middle" fill="#fbbf24" font-size="9">MSB</text>';
    s += '<text x="' + (end - cell / 2) + '" y="18" text-anchor="middle" fill="#fbbf24" font-size="9">LSB</text>';
    s += '</svg>';
    return s;
  }

  /* ---- 概念卡 ------------------------------------------------------ */
  function concept(t, h) {
    return '<div class="concept"><div class="t">' + t + '</div><p>' + h + '</p></div>';
  }

  /* ===================================================================== */
  /* 課程導覽 + 進度 (localStorage)                                        */
  /* ===================================================================== */
  const LESSONS = [
    { f: '01-ratio.html', t: '比例旋鈕', d: 'DAC 的一句話核心' },
    { f: '02-binary.html', t: '數位碼與位元', d: '二進位 / MSB·LSB / 權重' },
    { f: '03-r2r-iout.html', t: 'R-2R 與電流輸出', d: '晶片內部結構與 IOUT' },
    { f: '04-tia-rfb.html', t: 'TIA + RFB', d: '電流變電壓、為何準' },
    { f: '05-polarity.html', t: '輸出極性與拓樸', d: '單級反相 vs 雙級正輸出' },
    { f: '06-transfer.html', t: '轉移函數與線性', d: 'D → VOUT 的直線' },
    { f: '07-errors.html', t: '真實誤差與校正', d: 'Offset / Gain / 校正' },
    { f: '08-spi-design.html', t: 'SPI 與設計計算機', d: '送資料 + 反向算碼' },
    { f: '09-applications.html', t: '應用情境(進階)', d: '可程式增益 / 波形縮放 / 衰減器' },
  ];
  const PKEY = 'ad5543_progress';
  function getDone() {
    try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { return []; }
  }
  function markDone(f) {
    const d = getDone();
    if (f && d.indexOf(f) === -1) { d.push(f); localStorage.setItem(PKEY, JSON.stringify(d)); }
    renderNav(global.__curLesson);
  }
  function resetProgress() { localStorage.removeItem(PKEY); renderNav(global.__curLesson); }

  function renderNav(cur) {
    global.__curLesson = cur;
    const i = LESSONS.findIndex(l => l.f === cur);
    const prev = i > 0 ? LESSONS[i - 1] : null;
    const next = i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : null;
    const done = getDone();
    const pct = Math.round(done.length / LESSONS.length * 100);
    const bar = '<div class="navbar">'
      + '<a class="navbtn" href="index.html">▦ 課程地圖</a>'
      + '<div class="navprog"><div class="navprogbar" style="width:' + pct + '%"></div></div>'
      + '<span class="navpct">' + done.length + ' / ' + LESSONS.length + ' 完成</span></div>';
    const pn = '<div class="pnrow">'
      + (prev ? '<a class="pnbtn" href="' + prev.f + '">⬅ ' + prev.t + '</a>' : '<span></span>')
      + (next ? '<a class="pnbtn next" href="' + next.f + '">下一課:' + next.t + ' ➡</a>'
        : '<a class="pnbtn next" href="index.html">回地圖 ✓</a>')
      + '</div>';
    const top = document.getElementById('nav-top'); if (top) top.innerHTML = bar;
    const bot = document.getElementById('nav-bottom'); if (bot) bot.innerHTML = pn;
  }

  /* ===================================================================== */
  /* 小測驗引擎 (可重抽題)                                                  */
  /* pool = [{ q, options:[...], answer:idx, explain }]                      */
  /* opts = { pick:N }  從題庫隨機抽 N 題,選項順序也會打亂                  */
  /* ===================================================================== */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function quiz(elId, pool, lessonFile, opts) {
    const el = document.getElementById(elId);
    if (!el) return;
    opts = opts || {};
    const pick = Math.min(opts.pick || pool.length, pool.length);
    let round = [];     // 本回合題目 (選項已打亂)
    let picked = [];    // 使用者每題的選擇 (對應打亂後索引)

    function roll() {
      round = shuffle(pool).slice(0, pick).map(q => {
        const opt = shuffle(q.options.map((text, idx) => ({ text, correct: idx === q.answer })));
        return { q: q.q, options: opt, answerIndex: opt.findIndex(o => o.correct), explain: q.explain };
      });
      picked = new Array(round.length).fill(-1);
      draw();
    }
    function draw() {
      let s = '<div class="qh">' + ico('target', 18) + ' 小測驗 (全對即解鎖完成)'
        + '<button class="btn reroll" onclick="__quizRoll()">🔄 重新抽題</button></div>';
      round.forEach((q, qi) => {
        s += '<div class="qitem"><p class="qq">' + (qi + 1) + '. ' + q.q + '</p><div class="qopts">';
        q.options.forEach((op, oi) => {
          let cls = 'qopt';
          if (picked[qi] > -1) {
            if (oi === q.answerIndex) cls += ' correct';
            else if (oi === picked[qi]) cls += ' wrong';
          }
          s += '<button class="' + cls + '" onclick="__quizPick(' + qi + ',' + oi + ')">' + op.text + '</button>';
        });
        s += '</div>';
        if (picked[qi] > -1)
          s += '<p class="qexp">' + (picked[qi] === q.answerIndex ? '✅ 答對了!' : '❌ 再想想。') + ' ' + q.explain + '</p>';
        s += '</div>';
      });
      const allRight = round.length > 0 && round.every((q, i) => picked[i] === q.answerIndex);
      if (allRight) { s += '<p class="qdone">🎉 全部答對,這一課完成!(可按「重新抽題」換一批)</p>'; markDone(lessonFile); }
      el.innerHTML = s;
    }
    global.__quizPick = (qi, oi) => { picked[qi] = oi; draw(); };
    global.__quizRoll = () => { roll(); };
    roll();
  }

  /* ---- 延伸閱讀 / datasheet 對照 ----------------------------------- */
  function readMore(rows) {
    let s = '<div class="readmore"><div class="sec-label">📖 延伸閱讀 / datasheet 對照</div><dl class="reflist">';
    rows.forEach(r => { s += '<dt>' + r.term + '</dt><dd>' + r.desc + '</dd>'; });
    s += '</dl><p class="hint">打開 AD5543 datasheet,用上面這些關鍵字對照,把模擬學到的觀念連到實際規格。</p></div>';
    return s;
  }

  /* ---- 反向設計:給定目標電壓,反推數位碼 --------------------------- */
  function solveCode(targetV, vref, mode) {
    if (Math.abs(vref) < 1e-9) return null;
    // standard: VOUT = -vref*(D/2^16);  positive: VOUT = vref*(D/2^16)
    const want = mode === 'positive' ? targetV / vref : -targetV / vref;
    const exact = want * MAX;
    let code = Math.round(exact);
    const clamped = Math.max(0, Math.min(MAX - 1, code));
    const reachable = code >= 0 && code <= MAX - 1;
    const achieved = (mode === 'positive' ? 1 : -1) * vref * (clamped / MAX);
    return { code: clamped, exact, reachable, achieved, error: achieved - targetV };
  }

  global.DAC = {
    MAX, R_DAC, presets, compute, ico, P,
    buildPresets, buildMath, buildStats, buildBitReg, buildErrValues,
    buildSchematic, buildChart, buildSpi, concept,
    LESSONS, getDone, markDone, resetProgress, renderNav, quiz, solveCode, readMore,
  };
})(window);
