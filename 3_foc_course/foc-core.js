/* =============================================================
   foc-core.js — FOC 教學課程共用數學核心（單一可信來源）
   所有課程都載入這支檔，確保 Clarke / Park / 飽和 等數學一致。
   純函式 + 少量 canvas 小工具，無任何課程專屬邏輯。
   ============================================================= */
const FOC = (() => {
  const TAU = Math.PI * 2;
  const SQ3 = Math.sqrt(3);

  // 反 Park：旋轉 dq → 靜止 αβ
  function invPark(vd, vq, th) {
    return { alpha: vd * Math.cos(th) - vq * Math.sin(th),
             beta:  vd * Math.sin(th) + vq * Math.cos(th) };
  }
  // Park：靜止 αβ → 旋轉 dq
  function park(al, be, th) {
    return { d:  al * Math.cos(th) + be * Math.sin(th),
             q: -al * Math.sin(th) + be * Math.cos(th) };
  }
  // 反 Clarke：兩相 αβ → 三相 abc（幅值不變式）
  function invClarke(al, be) {
    const k = SQ3 / 2;
    return { a: al, b: -0.5 * al + k * be, c: -0.5 * al - k * be };
  }
  // Clarke：三相 abc → 兩相 αβ（假設 a+b+c=0）
  function clarke(a, b, c) {
    return { alpha: a, beta: (b - c) / SQ3 };
  }
  // SVPWM 六邊形飽和裁切（內切圓半徑 = 1.0；頂點在 0°,60°,...）
  function clipToHexagon(a, b) {
    const mag = Math.hypot(a, b);
    if (mag === 0) return { alpha: 0, beta: 0 };
    let phi = Math.atan2(b, a); if (phi < 0) phi += TAU;
    const ps = phi % (Math.PI / 3);
    const rMax = 1 / Math.cos(ps - Math.PI / 6);
    return mag > rMax ? { alpha: a * rMax / mag, beta: b * rMax / mag }
                      : { alpha: a, beta: b };
  }

  // ---- canvas 小工具 ----
  function fit(canvas) {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  // αβ / dq 平面通用底圖：十字線 + 可選的單位圓 / 六邊形
  function plane(ctx, w, h, cx, cy, scale, opt = {}) {
    ctx.clearRect(0, 0, w, h);
    // 十字線
    ctx.strokeStyle = 'rgba(0,240,150,.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();
    if (opt.unitCircle) {
      ctx.strokeStyle = 'rgba(0,240,150,.18)';
      ctx.beginPath(); ctx.arc(cx, cy, scale, 0, TAU); ctx.stroke();
    }
    if (opt.hexagon) {
      ctx.strokeStyle = 'rgba(239,68,68,.30)'; ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      const rv = (2 / SQ3) * scale;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = i * Math.PI / 3;
        const x = cx + rv * Math.cos(a), y = cy - rv * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // 從中心畫一支發光向量箭頭到 (ax,ay)（資料座標，y 向上為正）
  function vector(ctx, cx, cy, ax, ay, scale, color) {
    const tx = cx + ax * scale, ty = cy - ay * scale;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = color;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowBlur = 0;
    return { tx, ty };
  }
  // 折線繪製（points = [{x,y}...] 螢幕座標）
  function poly(ctx, pts, color, lw = 2) {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.shadowBlur = 4; ctx.shadowColor = color;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.shadowBlur = 0;
  }

  return { TAU, SQ3, invPark, park, invClarke, clarke, clipToHexagon, fit, plane, vector, poly };
})();
