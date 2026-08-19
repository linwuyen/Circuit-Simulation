(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmt = (v, digits = 2) => Number(v).toLocaleString("zh-TW", { maximumFractionDigits: digits });
  const TAU = Math.PI * 2;

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = Math.max(320, rect.width || canvas.width);
    const cssHeight = cssWidth * (Number(canvas.getAttribute("height")) / Number(canvas.getAttribute("width")));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function axes(ctx, w, h, x0 = w / 2, y0 = h / 2) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#26394b";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(12, y0); ctx.lineTo(w - 12, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, 12); ctx.lineTo(x0, h - 12); ctx.stroke();
  }

  const sigma = $("sigma");
  const omega = $("omega");
  const sampleUs = $("sampleUs");

  function drawPoleLab() {
    const sig = Number(sigma.value);
    const om = Number(omega.value);
    const ts = Number(sampleUs.value) * 1e-6;
    const zr = Math.exp(sig * ts);
    const angle = om * ts;
    const zx = zr * Math.cos(angle);
    const zy = zr * Math.sin(angle);

    $("sigmaOut").textContent = `${fmt(sig, 0)} 1/s`;
    $("omegaOut").textContent = `${fmt(om, 0)} rad/s`;
    $("sampleOut").textContent = `${fmt(ts * 1e6, 0)} µs`;
    $("sValue").textContent = `${sig >= 0 ? "+" : ""}${fmt(sig, 0)} ${om ? `+ j${fmt(om, 0)}` : ""}`;
    $("zValue").textContent = `${fmt(zx, 3)} ${zy >= 0 ? "+" : "−"} j${fmt(Math.abs(zy), 3)}`;
    $("zMag").textContent = fmt(zr, 4);

    const badge = $("stabilityBadge");
    badge.className = "status";
    if (sig < 0) { badge.textContent = "STABLE"; badge.classList.add("stable"); }
    else if (sig > 0) { badge.textContent = "UNSTABLE"; badge.classList.add("unstable"); }
    else { badge.textContent = "MARGINAL / FOURIER AXIS"; badge.classList.add("marginal"); }

    if (sig < 0) {
      $("polePlain").textContent = `每一拍只剩前一拍的 ${(zr * 100).toFixed(2)}%，擾動會逐拍縮小，所以最後回到平衡。`;
      $("poleMath").innerHTML = `σ=${fmt(sig,0)}&lt;0，所以 e<sup>σt</sup> 衰減；取樣後 |z|=e<sup>σTs</sup>=${fmt(zr,4)}&lt;1。`;
    } else if (sig > 0) {
      $("polePlain").textContent = `每一拍反而放大到前一拍的 ${(zr * 100).toFixed(2)}%，小擾動不會消失，而是越來越大。`;
      $("poleMath").innerHTML = `σ=${fmt(sig,0)}&gt;0，所以 e<sup>σt</sup> 成長；取樣後 |z|=e<sup>σTs</sup>=${fmt(zr,4)}&gt;1。`;
    } else {
      $("polePlain").textContent = "振幅既不縮小也不放大，只剩持續振盪；這正是穩定邊界。";
      $("poleMath").innerHTML = "σ=0 → e<sup>σt</sup>=1 → |z|=1。s-plane 的 jω 軸因此映到 z-plane 的 unit circle。";
    }

    $("timeHint").textContent = sig < 0 ? "包絡線 e^(σt) 衰減：pole 往左，settling 更快。" : sig > 0 ? "包絡線 e^(σt) 成長：任何小擾動都被放大。" : "σ = 0：只剩純振盪，正好落在 Fourier 的 jω 軸。";
    $("zHint").textContent = zr < 1 ? "|z| < 1：sample-to-sample 響應會縮小。" : zr > 1 ? "|z| > 1：每一拍都把狀態放大，離散系統不穩定。" : "|z| = 1：對應 s-plane 的 jω 軸，也就是 DTFT 的 unit circle。";

    drawTime(sig, om);
    drawS(sig, om);
    drawZ(zx, zy, zr);
  }

  function drawTime(sig, om) {
    const { ctx, w, h } = setupCanvas($("timeCanvas"));
    const mid = h / 2;
    axes(ctx, w, h, 34, mid);
    const duration = 0.012;
    let maxAmp = 1;
    if (sig > 0) maxAmp = Math.exp(sig * duration);
    ctx.strokeStyle = "#65d6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < w - 50; i++) {
      const t = duration * i / (w - 50);
      const y = Math.exp(sig * t) * Math.cos(om * t) / maxAmp;
      const px = 34 + i;
      const py = mid - y * (h * .34);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = "#71889b"; ctx.font = "12px system-ui";
    ctx.fillText("t", w - 20, mid - 6); ctx.fillText("x(t)", 8, 16);
  }

  function drawS(sig, om) {
    const { ctx, w, h } = setupCanvas($("sCanvas"));
    const x0 = w * .52, y0 = h / 2;
    axes(ctx, w, h, x0, y0);
    ctx.fillStyle = "rgba(88,227,154,.06)"; ctx.fillRect(0, 0, x0, h);
    ctx.fillStyle = "rgba(255,111,125,.05)"; ctx.fillRect(x0, 0, w - x0, h);
    ctx.strokeStyle = "#65d6ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, 10); ctx.lineTo(x0, h - 10); ctx.stroke();
    const sx = clamp(x0 + (sig / 1600) * (w * .42), 18, w - 18);
    const sy = clamp(y0 - (om / 12000) * (h * .42), 18, h - 18);
    ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx - 7, sy - 7); ctx.lineTo(sx + 7, sy + 7); ctx.moveTo(sx + 7, sy - 7); ctx.lineTo(sx - 7, sy + 7); ctx.stroke();
    ctx.fillStyle = "#8ca3b5"; ctx.font = "12px system-ui";
    ctx.fillText("σ", w - 20, y0 - 7); ctx.fillText("jω", x0 + 7, 16); ctx.fillText("Fourier axis", x0 + 8, h - 12);
  }

  function drawZ(zx, zy, mag) {
    const { ctx, w, h } = setupCanvas($("zCanvas"));
    const x0 = w / 2, y0 = h / 2, r = Math.min(w, h) * .34;
    axes(ctx, w, h, x0, y0);
    ctx.strokeStyle = "#65d6ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0, y0, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(88,227,154,.05)"; ctx.beginPath(); ctx.arc(x0, y0, r, 0, TAU); ctx.fill();
    const scale = r;
    const px = clamp(x0 + zx * scale, 16, w - 16);
    const py = clamp(y0 - zy * scale, 16, h - 16);
    ctx.strokeStyle = mag <= 1 ? "#58e39a" : "#ff6f7d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px - 7, py - 7); ctx.lineTo(px + 7, py + 7); ctx.moveTo(px + 7, py - 7); ctx.lineTo(px - 7, py + 7); ctx.stroke();
    ctx.fillStyle = "#8ca3b5"; ctx.font = "12px system-ui"; ctx.fillText("|z| = 1", x0 + r - 55, y0 - 8);
  }

  [sigma, omega, sampleUs].forEach(el => el.addEventListener("input", drawPoleLab));
  document.querySelectorAll("[data-pole-preset]").forEach(button => button.addEventListener("click", () => {
    const preset = button.dataset.polePreset;
    const values = preset === "stable" ? [-500, 3200, 10] : preset === "unstable" ? [180, 3200, 10] : [0, 3200, 10];
    sigma.value = values[0]; omega.value = values[1]; sampleUs.value = values[2]; drawPoleLab();
  }));

  const fc = $("fc"), delayUs = $("delayUs");
  function updateDelay() {
    const f = Number(fc.value), td = Number(delayUs.value) * 1e-6;
    const phase = -360 * f * td;
    const period = 1 / f;
    const ratio = td / period;
    $("fcOut").textContent = `${fmt(f / 1000, 1)} kHz`;
    $("delayOut").textContent = `${fmt(td * 1e6, 0)} µs`;
    $("phaseLoss").textContent = `${phase.toFixed(1)}°`;
    $("budgetFill").style.width = `${clamp(Math.abs(phase) / 180 * 100, 0, 100)}%`;
    $("crossoverPeriod").textContent = `${fmt(period * 1e6, 1)} µs`;
    $("delayCycleRatio").textContent = `${fmt(ratio * 100, 1)}%`;
    $("delayRule").textContent = `現在 delay 佔 crossover 一週期的 ${fmt(ratio * 100, 1)}%，所以相位落後就是 360° × ${fmt(ratio, 3)} ≈ ${Math.abs(phase).toFixed(1)}°。`;
    let text = "延遲影響尚低，但仍應納入 loop model。工程上要量的是 sample age 到 PWM 真正生效的總 latency。";
    if (Math.abs(phase) >= 60) text = "危險：delay 單獨就已吃掉 ≥60°。提高 crossover 前，先縮短 ADC→ISR→PWM latency、改 sample/update 時序，或降低 crossover。";
    else if (Math.abs(phase) >= 30) text = "顯著：這已足以把理論上 60° 的 phase margin 壓到很窄。若 SFRA phase 比模型差，優先量 GPIO timing 與確認 PWM shadow load。";
    $("delayInterpretation").textContent = text;
  }
  [fc, delayUs].forEach(el => el.addEventListener("input", updateDelay));

  const kp = $("kp"), ki = $("ki");
  function piResponse(f, kpVal, kiVal) {
    const w = TAU * f;
    const re = kpVal;
    const im = -kiVal / w;
    return { magDb: 20 * Math.log10(Math.hypot(re, im)), phase: Math.atan2(im, re) * 180 / Math.PI };
  }
  function updatePi() {
    const kpv = Number(kp.value), kiv = Number(ki.value);
    const wz = kiv / kpv, fz = wz / TAU;
    $("kpOut").textContent = kpv.toFixed(2);
    $("kiOut").textContent = fmt(kiv, 0);
    $("wzOut").textContent = `${fmt(wz, 0)} rad/s`;
    $("fzOut").textContent = `${fmt(fz, 1)} Hz`;
    $("piLowRegion").textContent = `f ≪ ${fmt(fz,1)} Hz：Ki/s 主導`;
    $("piHighRegion").textContent = `f ≫ ${fmt(fz,1)} Hz：Kp 主導`;
    $("piInterpretation").textContent = `目前 PI zero 在 ${fmt(fz,1)} Hz。Ki/Kp 再變大，zero 會往高頻移；Ki/Kp 變小，zero 往低頻移。真正要做的是把這個交棒點放到 plant 與目標 crossover 需要的位置。`;
    drawBode(kpv, kiv, fz);
  }
  function drawBode(kpv, kiv, fz) {
    const { ctx, w, h } = setupCanvas($("bodeCanvas"));
    ctx.clearRect(0, 0, w, h);
    const left = 46, right = 18, top = 18, mid = h * .55, bottom = 25;
    const xFor = f => left + (Math.log10(f) - 1) / 4 * (w - left - right);
    ctx.strokeStyle = "#26394b"; ctx.lineWidth = 1;
    [10,100,1000,10000,100000].forEach(f => { const x = xFor(f); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h-bottom); ctx.stroke(); ctx.fillStyle="#71889b";ctx.font="11px system-ui";ctx.fillText(f>=1000?`${f/1000}k`:String(f),x-8,h-7); });
    ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(w-right, mid); ctx.stroke();

    const samples = 220;
    ctx.strokeStyle = "#65d6ff"; ctx.lineWidth = 2; ctx.beginPath();
    for (let i=0;i<samples;i++) { const f = 10 * Math.pow(10000, i/(samples-1)); const r=piResponse(f,kpv,kiv); const x=xFor(f); const y=mid - (r.magDb/50)*(mid-top-8); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
    ctx.stroke();
    ctx.strokeStyle = "#a98bff"; ctx.beginPath();
    for (let i=0;i<samples;i++) { const f = 10 * Math.pow(10000, i/(samples-1)); const r=piResponse(f,kpv,kiv); const x=xFor(f); const y=mid + 12 + ((-r.phase)/90)*(h-mid-bottom-18); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
    ctx.stroke();
    const zx = xFor(clamp(fz,10,100000)); ctx.strokeStyle="#ffb454";ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(zx,top);ctx.lineTo(zx,h-bottom);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#ffb454";ctx.fillText("fz",zx+4,top+12); ctx.fillStyle="#65d6ff";ctx.fillText("Magnitude",left+5,top+12); ctx.fillStyle="#a98bff";ctx.fillText("Phase",left+5,mid+24);
  }
  [kp, ki].forEach(el => el.addEventListener("input", updatePi));

  let sweepTimer = null;
  $("sweepButton").addEventListener("click", () => {
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
    let i = 0;
    const steps = 80;
    $("sweepButton").textContent = "■ 重新開始";
    sweepTimer = setInterval(() => {
      const p = i / (steps - 1);
      const freq = 10 * Math.pow(1000, p);
      const model = 20 - 22 * Math.log10(1 + freq / 70) - 11 * Math.log10(1 + freq / 700);
      const delayPenalty = 3.5 * Math.pow(freq / 10000, .7);
      const measured = model - delayPenalty;
      $("sweepDot").style.left = `${p * 100}%`;
      $("sweepFreq").textContent = freq >= 1000 ? `${fmt(freq/1000,2)} kHz` : `${fmt(freq,0)} Hz`;
      $("modelMag").textContent = `${model.toFixed(1)} dB`;
      $("measuredMag").textContent = `${measured.toFixed(1)} dB`;
      $("sweepVerdict").textContent = Math.abs(model-measured) > 2 ? "實測開始偏離模型 → 查漏掉的 delay / pole" : "模型與實測接近";
      i++;
      if (i >= steps) { clearInterval(sweepTimer); sweepTimer = null; $("sweepButton").textContent = "▶ 再掃一次"; }
    }, 55);
  });

  const explanations = [
    "1 · 物理：先從電感、電容、能量守恆寫出微分方程。這最接近真實電路，但不適合直接看穩定度與頻率結構。",
    "2 · Laplace：微分變成乘 s，卷積變乘法。G(s) 的 pole 告訴你自然 mode 怎麼衰減或振盪，zero 告訴你哪些頻率會被抑制或重塑。",
    "3 · Fourier / Bode：令 s=jω，沿 imaginary axis 掃頻。你開始能直接讀 gain、phase、crossover、phase margin。",
    "4 · Compensator：PI / Type-II / Type-III 不是神秘公式，而是有目的地放 pole / zero，把 loop gain 塑造成想要的樣子。",
    "5 · Discretize：MCU 每 Ts 才算一次。連續 pole 精確映成 z=e^(sTs)，controller 則依需求選 ZOH、Tustin、Euler 或 matched pole-zero。",
    "6 · Difference equation：z⁻¹ 就是上一拍。C(z) 整理後會變成 u[n]、u[n−1]、e[n]、e[n−1] 的遞迴關係。",
    "7 · C2000：ADC sample → ISR / CLA → controller → PWM shadow register。這裡開始出現 acquisition、execution、jitter、commit delay。",
    "8 · SFRA：最後把實機 T(jω) 量回來跟模型疊。差異不是失敗，而是告訴你還漏了哪個 pole、delay、filter 或 operating-point effect。"
  ];
  let chainStep = -1, chainTimer = null;
  function showStep(i) {
    document.querySelectorAll(".step").forEach((el, idx) => el.classList.toggle("active", idx === i));
    $("chainExplain").textContent = explanations[i];
  }
  $("playChain").addEventListener("click", () => {
    if (chainTimer) clearInterval(chainTimer);
    chainStep = 0; showStep(chainStep);
    chainTimer = setInterval(() => {
      chainStep++;
      if (chainStep >= explanations.length) { clearInterval(chainTimer); chainTimer = null; $("playChain").textContent = "▶ 再播一次"; return; }
      showStep(chainStep);
    }, 1500);
  });
  document.querySelectorAll(".step").forEach((el, idx) => el.addEventListener("click", () => showStep(idx)));

  document.querySelectorAll(".reveal").forEach(button => button.addEventListener("click", () => {
    const answer = $(button.dataset.answer);
    answer.hidden = !answer.hidden;
    button.textContent = answer.hidden ? "看答案" : "收起答案";
  }));

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { drawPoleLab(); updatePi(); }, 120);
  });

  drawPoleLab();
  updateDelay();
  updatePi();
})();