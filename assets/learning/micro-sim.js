(function () {
  "use strict";

  const lesson = window.MICRO_LESSON;
  const root = document.getElementById("lesson-root");
  if (!lesson || !root) return;

  const stateKey = "micro-sim-checks-v2:" + location.pathname;
  const values = {};
  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fmt = (value, digits) => Number.isFinite(value) ? value.toFixed(digits == null ? (Math.abs(value) >= 10 ? 1 : 2) : digits) : "—";
  const radians = degrees => degrees * Math.PI / 180;

  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(stateKey) || "{}"); }
    catch (error) { return {}; }
  }

  function saveChecks(checks) {
    try { localStorage.setItem(stateKey, JSON.stringify(checks)); }
    catch (error) {}
  }

  function link(href, label, cls) {
    return href ? '<a class="' + (cls || "ms-link") + '" href="' + esc(href) + '">' + esc(label) + '</a>' : "";
  }

  function renderShell() {
    const checks = loadChecks();
    const controls = (lesson.controls || []).map(control => {
      if (control.type === "select") {
        return '<div class="ms-control"><div class="ms-control-row"><label for="ctrl-' + esc(control.id) + '">' + esc(control.label) + '</label><output id="out-' + esc(control.id) + '"></output></div><select id="ctrl-' + esc(control.id) + '" data-control="' + esc(control.id) + '">' + (control.options || []).map(option => '<option value="' + esc(option.value) + '">' + esc(option.label) + '</option>').join("") + '</select><div class="ms-help">' + esc(control.help || "") + '</div></div>';
      }
      return '<div class="ms-control"><div class="ms-control-row"><label for="ctrl-' + esc(control.id) + '">' + esc(control.label) + '</label><output id="out-' + esc(control.id) + '"></output></div><input id="ctrl-' + esc(control.id) + '" data-control="' + esc(control.id) + '" type="range" min="' + esc(control.min) + '" max="' + esc(control.max) + '" step="' + esc(control.step || 1) + '" value="' + esc(control.value) + '"><div class="ms-help">' + esc(control.help || "") + '</div></div>';
    }).join("");

    root.innerHTML = '<div class="ms-shell">'
      + '<nav class="ms-nav"><a class="ms-brand" href="' + esc((lesson.rootPrefix || "../") + "index.html") + '"><span class="ms-mark">SIM</span><span>電路模擬說明</span></a><div class="ms-links">'
      + link(lesson.prevHref, "上一頁") + link(lesson.nextHref, "下一頁") + link(lesson.fullHref || "index.html", "完整儀表板") + link((lesson.rootPrefix || "../") + "beginner.html", "初學路線")
      + '</div></nav>'
      + '<section class="ms-hero"><div class="ms-eyebrow">' + esc(lesson.eyebrow || lesson.section || "Lesson") + '</div><h1>' + esc(lesson.title) + '</h1><p class="ms-lead">' + esc(lesson.intro) + '</p></section>'
      + '<section class="ms-grid"><aside class="ms-panel"><span class="ms-tag">' + esc(lesson.section || "教學") + '</span><h2>這頁只練一件事</h2><ul class="ms-field-list">'
      + '<li><b>目標</b><span>' + esc(lesson.goal) + '</span></li><li><b>操作</b><span>' + esc(lesson.action) + '</span></li><li><b>判讀</b><span>' + esc(lesson.result) + '</span></li><li><b>實用</b><span>' + esc(lesson.why) + '</span></li></ul>'
      + '<div class="ms-task"><h3>小任務</h3><p class="ms-muted">' + esc(lesson.task) + '</p><div class="ms-checks">' + (lesson.checks || []).map((item, index) => '<label><input type="checkbox" data-check="' + index + '"' + (checks[index] ? " checked" : "") + '><span>' + esc(item) + '</span></label>').join("") + '</div></div></aside>'
      + '<section class="ms-panel"><h2>互動模擬</h2><div class="ms-controls">' + controls + '</div><div class="ms-canvas-wrap"><canvas class="ms-canvas" id="lessonCanvas" aria-label="互動模擬圖"></canvas><div class="ms-status" id="simStatus" aria-live="polite"></div></div><div class="ms-metrics" id="metricGrid"></div><div class="ms-actions">' + link(lesson.nextHref, "下一頁", "ms-button primary") + link(lesson.fullHref || "index.html", "開啟完整儀表板", "ms-button") + '</div></section></section>'
      + '<section class="ms-note-grid"><article class="ms-note"><b>初學者先看</b><span>' + esc(lesson.beginnerNote || "一次只改一個控制項。") + '</span></article><article class="ms-note"><b>工程判斷</b><span>' + esc(lesson.engineeringNote || "確認適用條件、單位與限制。") + '</span></article><article class="ms-note"><b>下一步</b><span>' + esc(lesson.nextNote || "回完整儀表板驗證多變因。") + '</span></article></section></div>';

    (lesson.controls || []).forEach(control => {
      const element = document.getElementById("ctrl-" + control.id);
      if (!element) return;
      element.value = control.value;
      element.addEventListener("input", update);
      element.addEventListener("change", update);
    });
    root.querySelectorAll("[data-check]").forEach(input => input.addEventListener("change", () => {
      const checksNow = loadChecks();
      checksNow[input.dataset.check] = input.checked;
      saveChecks(checksNow);
    }));
  }

  function readValues() {
    (lesson.controls || []).forEach(control => {
      const element = document.getElementById("ctrl-" + control.id);
      if (!element) return;
      values[control.id] = control.type === "select" ? element.value : Number(element.value);
      const out = document.getElementById("out-" + control.id);
      if (!out) return;
      if (control.type === "select") {
        const option = (control.options || []).find(item => String(item.value) === String(values[control.id]));
        out.textContent = option ? option.short || option.label : values[control.id];
      } else out.textContent = fmt(values[control.id], control.digits) + (control.unit || "");
    });
    return values;
  }

  function update() {
    const sim = SIMS[lesson.sim] || SIMS.generic;
    const result = sim(readValues());
    const status = document.getElementById("simStatus");
    const metrics = document.getElementById("metricGrid");
    status.textContent = (result.modelType ? "[" + result.modelType + "] " : "") + (result.status || "");
    metrics.innerHTML = (result.metrics || []).map(metric => '<article class="ms-metric ' + esc(metric.kind || "") + '"><span>' + esc(metric.label) + '</span><strong>' + esc(metric.value) + '</strong><small class="ms-muted">' + esc(metric.note || "") + '</small></article>').join("");
    draw(document.getElementById("lessonCanvas"), result.draw || function () {});
  }

  function draw(canvas, painter) {
    if (!canvas) return;
    const width = Math.max(320, Math.floor(canvas.getBoundingClientRect().width));
    const height = 320;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale; canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#0d1520"; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148,163,184,.15)"; ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += height / 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    painter(ctx, width, height);
  }

  function line(ctx, points, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
    ctx.stroke();
  }

  function sinePoints(width, height, amplitude, phase, ripple, cycles) {
    const points = [];
    for (let x = 0; x <= width; x++) {
      const t = x / width;
      const base = Math.sin(t * Math.PI * 2 * (cycles || 2) + (phase || 0));
      const tri = 2 * Math.abs(2 * ((t * 24) % 1) - 1) - 1;
      points.push([x, height / 2 - base * amplitude - tri * (ripple || 0)]);
    }
    return points;
  }

  function drawBoxes(ctx, width, height, labels, activeIndex) {
    const gap = 16, boxWidth = (width - gap * (labels.length + 1)) / labels.length, y = height / 2 - 42;
    labels.forEach((label, index) => {
      const x = gap + index * (boxWidth + gap);
      ctx.fillStyle = index === activeIndex ? "#123f3b" : "#142033";
      ctx.strokeStyle = index === activeIndex ? "#22c5b7" : "#334155";
      ctx.lineWidth = 2; ctx.fillRect(x, y, boxWidth, 84); ctx.strokeRect(x, y, boxWidth, 84);
      ctx.fillStyle = "#dbe7f4"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center";
      const parts = String(label).split(" "); parts.slice(0, 3).forEach((part, lineIndex) => ctx.fillText(part, x + boxWidth / 2, y + 28 + lineIndex * 18));
      ctx.textAlign = "left";
    });
  }

  function sampledSine(peak, phase, count) {
    return Array.from({ length: count }, (_, index) => peak * Math.sin(2 * Math.PI * index / count + phase));
  }

  function rms(samples) {
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / Math.max(1, samples.length));
  }

  function powerMetrics(v, i) {
    const count = Math.min(v.length, i.length);
    const vrms = rms(v.slice(0, count)), irms = rms(i.slice(0, count));
    const watts = count ? v.slice(0, count).reduce((sum, value, index) => sum + value * i[index], 0) / count : 0;
    const va = vrms * irms;
    return { vrms, irms, watts, va, pf: va ? clamp(watts / va, -1, 1) : 0 };
  }

  const SIMS = {
    generic() { return { modelType: "教學示意", status: "這頁用來建立觀念，不代表完整物理模型。", metrics: [{ label: "狀態", value: "READY", kind: "good", note: "確認適用條件後再使用數字" }], draw(ctx, w, h) { drawBoxes(ctx, w, h, ["輸入", "處理", "輸出", "判讀"], 1); } }; },

    "acmc-map"(v) { const active = Number(v.stage || 1); return { modelType: "系統方塊圖", status: "由左到右追能量與保護路徑。", metrics: [{ label: "DC bus", value: "390 V", kind: "good", note: "教材名目值" }, { label: "隔離輸出", value: "550 V", kind: "good", note: "教材名目值" }, { label: "重點", value: ["PFC", "PSFB", "INV", "DAQ"][active] || "PFC", kind: "good", note: "非即時模擬" }], draw(ctx, w, h) { drawBoxes(ctx, w, h, ["PFC", "PSFB", "SiC INV", "DAQ 保護"], active); } }; },

    "acmc-ripple"(v) {
      const fsw = Number(v.fsw || 100), load = Number(v.load || 1200);
      const index = clamp(32 * (100 / fsw) * Math.sqrt(load / 1200), 5, 100);
      return { modelType: "Heuristic 趨勢指標", status: "沒有 L、C、Vbus 與調變工作點，因此只顯示相對漣波指標，不是百分比設計值。", metrics: [{ label: "相對漣波指標", value: fmt(index, 1) + " / 100", kind: index < 35 ? "good" : index < 60 ? "warn" : "bad", note: "僅比較趨勢" }, { label: "開關週期", value: fmt(1000 / fsw, 2) + " µs", kind: "good", note: "由頻率直接計算" }, { label: "負載", value: fmt(load, 0) + " W", kind: "good", note: "提高時電流壓力通常增加" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 86, 0, index * .5, 2), "#22d3ee", 2); line(ctx, sinePoints(w, h, 86, 0, 0, 2), "#34d399", 2); } };
    },

    "acmc-zvs"(v) {
      const load = Number(v.load || 1200), deadtime = Number(v.deadtime || 120);
      const margin = clamp((load / 300) * clamp(deadtime / 120, .3, 1.7), 0, 3), ok = margin >= 1;
      return { modelType: "Heuristic 換流裕度", status: "真正 ZVS 必須比較 Llk／Lm 儲能與 MOSFET Coss，並確認 dead-time 內能完成換流。", metrics: [{ label: "換流裕度指標", value: fmt(margin, 2) + " x", kind: ok ? "good" : "bad", note: "不是實際能量比" }, { label: "負載區間", value: load < 300 ? "輕載" : "正常", kind: load < 300 ? "warn" : "good", note: "輕載通常較困難" }, { label: "Dead-time", value: fmt(deadtime, 0) + " ns", kind: deadtime < 80 ? "warn" : "good", note: "過長也會增加損失" }], draw(ctx, w, h) { ctx.fillStyle = ok ? "#34d399" : "#fb7185"; ctx.font = "900 38px Consolas"; ctx.textAlign = "center"; ctx.fillText(ok ? "ZVS MARGIN" : "HARD SWITCH", w / 2, h / 2); ctx.font = "700 15px system-ui"; ctx.fillText("teaching index " + fmt(margin, 2), w / 2, h / 2 + 34); ctx.textAlign = "left"; } };
    },

    "acmc-sampling"(v) {
      const sync = String(v.mode) === "sync", fsw = Number(v.fsw || 100), noiseIndex = sync ? 4 : clamp(fsw * .65, 12, 100);
      return { modelType: "Heuristic 噪聲指標", status: sync ? "採樣點避開開關邊緣。" : "非同步採樣可能撞到高 dv/dt／di/dt。", metrics: [{ label: "噪聲指標", value: fmt(noiseIndex, 0) + " / 100", kind: sync ? "good" : "bad", note: "不是 ADC ENOB 或實測 RMS" }, { label: "採樣策略", value: sync ? "EPWM 同步" : "非同步", kind: sync ? "good" : "bad", note: "實機需找安靜窗" }, { label: "fsw", value: fmt(fsw, 0) + " kHz", kind: "good", note: "頻率越高可用窗越短" }], draw(ctx, w, h) { const points = sinePoints(w, h, 78, 0, 0, 2); if (!sync) for (let i = 24; i < points.length; i += 43) points[i][1] -= 45; line(ctx, points, sync ? "#34d399" : "#fb7185", 2); } };
    },

    "acmc-pll"(v) {
      const enabled = String(v.pll) === "on", drift = Number(v.drift || 0), residual = enabled ? Math.abs(drift) * .08 : Math.abs(drift);
      return { modelType: "Heuristic 閉迴路示意", status: enabled ? "PLL 以簡化比例顯示殘餘相位誤差。" : "PLL 關閉時，相位漂移直接保留。", metrics: [{ label: "殘餘相位誤差", value: fmt(residual, 1) + "°", kind: residual < 8 ? "good" : residual < 30 ? "warn" : "bad", note: "非 SOGI/PI 動態模型" }, { label: "PLL", value: enabled ? "LOCK 示意" : "OFF", kind: enabled ? "good" : "warn", note: "需以實際鎖相時間驗證" }, { label: "外部漂移", value: fmt(drift, 0) + "°", kind: "good", note: "輸入條件" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 70, radians(drift), 0, 2), "#a78bfa", 2); line(ctx, sinePoints(w, h, 70, radians(enabled ? drift * .08 : 0), 0, 2), "#22d3ee", 2); } };
    },

    "acmc-trip"(v) {
      const load = Number(v.load || 1200), ocp = Number(v.ocp || 8.5), offset = Number(v.offset || 0);
      const peak = load / 220 * Math.SQRT2, trip = peak > ocp || Math.abs(offset) > 1.5, reason = peak > ocp ? "OCP" : Math.abs(offset) > 1.5 ? "DC SAT" : "READY";
      return { modelType: "估算＋門檻邏輯", status: "峰值電流假設 220 Vrms、PF=1、純電阻負載；真正 OCP 需使用回授比例與瞬時波形。", metrics: [{ label: "估計峰值電流", value: fmt(peak, 1) + " A", kind: peak > ocp ? "bad" : "good", note: "P/220×√2" }, { label: "保護原因", value: reason, kind: trip ? "bad" : "good", note: "門檻示意" }, { label: "DC 偏壓", value: fmt(offset, 1) + " V", kind: Math.abs(offset) > 1.5 ? "bad" : "good", note: "需換算到真實磁通" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 72, 0, trip ? 20 : 4, 2), trip ? "#fb7185" : "#34d399", 2); if (trip) { ctx.fillStyle = "rgba(127,29,29,.82)"; ctx.fillRect(40, 90, w - 80, 130); ctx.fillStyle = "#fff"; ctx.font = "900 30px Consolas"; ctx.textAlign = "center"; ctx.fillText("TRIP " + reason, w / 2, 160); ctx.textAlign = "left"; } } };
    },

    "acmc-lab"(v) {
      const fsw = Number(v.fsw || 100), load = Number(v.load || 1200), sync = String(v.mode) === "sync", ocp = Number(v.ocp || 8.5);
      const rippleIndex = 32 * (100 / fsw) * Math.sqrt(load / 1200), zvs = load >= 300, peak = load / 220 * Math.SQRT2, pass = rippleIndex < 45 && zvs && sync && peak < ocp;
      return { modelType: "Heuristic 綜合練習", status: "PASS 只代表四個教材條件同時成立，不是設計驗證。", metrics: [{ label: "教材判定", value: pass ? "PASS" : "CHECK", kind: pass ? "good" : "warn", note: "不可取代實測" }, { label: "漣波指標", value: fmt(rippleIndex, 1), kind: rippleIndex < 45 ? "good" : "bad", note: "相對指標" }, { label: "OCP 估計裕度", value: fmt(ocp - peak, 1) + " A", kind: ocp > peak ? "good" : "bad", note: "基於 220V/PF=1" }], draw(ctx, w, h) { drawBoxes(ctx, w, h, [rippleIndex < 45 ? "Ripple OK" : "Ripple 高", zvs ? "ZVS 指標 OK" : "輕載", sync ? "Sync OK" : "採樣風險", ocp > peak ? "OCP OK" : "OCP Trip"], pass ? 3 : 0); } };
    },

    "dds-map"(v) { const active = Number(v.stage || 1); return { modelType: "量測鏈方塊圖", status: "由訊號、ADC、Offset 到 RMS/PF 逐段追蹤。", metrics: [{ label: "ADC code", value: "0–4095", kind: "good", note: "12-bit 範例" }, { label: "Offset", value: "1.65 V", kind: "good", note: "範例中點" }, { label: "重點", value: ["Signal", "ADC", "Offset", "RMS/PF"][active] || "Signal", kind: "good", note: "非即時模型" }], draw(ctx, w, h) { drawBoxes(ctx, w, h, ["DDS", "ADC", "Offset", "RMS PF"], active); } }; },

    "dds-offset"(v) {
      const offset = Number(v.offset || 1.65), dynamic = String(v.mode || "dynamic") === "dynamic", residualV = dynamic ? (offset - 1.65) * .05 : offset - 1.65;
      const signalVrms = 84.8528, measured = Math.sqrt(signalVrms * signalVrms + Math.pow(residualV * 50, 2));
      return { modelType: "簡化殘餘 DC 模型", status: dynamic ? "動態估測大幅降低殘餘 DC。" : "固定扣值會把 offset 漂移留在 RMS 計算中。", metrics: [{ label: "估計 Vrms", value: fmt(measured, 2) + " V", kind: Math.abs(measured - signalVrms) < 2 ? "good" : "warn", note: "sqrt(Vac²+Vdc²) 示意" }, { label: "殘餘 offset", value: fmt(residualV, 3) + " V", kind: Math.abs(residualV) < .05 ? "good" : "warn", note: "ADC 端" }, { label: "校正", value: dynamic ? "LPF 動態" : "固定 2048", kind: dynamic ? "good" : "warn", note: "LPF 頻寬仍需設計" }], draw(ctx, w, h) { const shift = residualV * 80; line(ctx, sinePoints(w, h, 58, 0, 0, 2).map(p => [p[0], p[1] - shift]), dynamic ? "#22d3ee" : "#f59e0b", 2); } };
    },

    "dds-wave"(v) {
      const vpeak = Number(v.vpeak || 120), offset = Number(v.offset || 1.65), scaleVPerV = 1.25 / 155, scaled = vpeak * scaleVPerV, min = offset - scaled, max = offset + scaled, ok = min >= 0 && max <= 3.3;
      return { modelType: "線性縮放公式", status: ok ? "ADC 腳位仍在 0–3.3V。" : "訊號超出 ADC 範圍，會削波。", metrics: [{ label: "ADC 最低", value: fmt(min, 2) + " V", kind: min >= 0 ? "good" : "bad", note: "不可低於 0V" }, { label: "ADC 最高", value: fmt(max, 2) + " V", kind: max <= 3.3 ? "good" : "bad", note: "不可高於 3.3V" }, { label: "縮放增益", value: fmt(scaleVPerV, 6) + " V/V", kind: "good", note: "教材固定比例" }], draw(ctx, w, h) { const center = h - offset / 3.3 * h, amp = scaled / 3.3 * h; line(ctx, sinePoints(w, h, amp, 0, 0, 2).map(p => [p[0], p[1] + center - h / 2]), ok ? "#34d399" : "#fb7185", 2); } };
    },

    "dds-rms"(v) {
      const vpeak = Number(v.vpeak || 120), samples = Math.max(4, Math.round(Number(v.samples || 333))), data = sampledSine(vpeak, 0, samples), measured = rms(data), ideal = vpeak / Math.SQRT2, errorPct = (measured - ideal) / ideal * 100;
      return { modelType: "離散 RMS 公式", status: "對完整一週期的 coherent sampling，點數本身不會固定造成正偏差；實務誤差主要來自窗長、非整週期、noise、量化與 offset。", metrics: [{ label: "理想 Vrms", value: fmt(ideal, 4) + " V", kind: "good", note: "Vpeak/√2" }, { label: "離散計算", value: fmt(measured, 4) + " V", kind: "good", note: "sqrt(mean(x²))" }, { label: "數值誤差", value: fmt(errorPct, 6) + " %", kind: Math.abs(errorPct) < .01 ? "good" : "warn", note: "完整一週期" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 82, 0, 0, 2), "#22d3ee", 2); const count = clamp(Math.floor(samples / 10), 8, 70); ctx.fillStyle = "#f59e0b"; for (let i = 0; i < count; i++) { const x = i / (count - 1) * w, y = h / 2 - Math.sin(x / w * Math.PI * 4) * 82; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); } } };
    },

    "dds-pf"(v) {
      const phase = Number(v.phase || 30), vrmsSet = Number(v.vrms || 120), irmsSet = Number(v.irms || 10), count = 720;
      const voltage = sampledSine(vrmsSet * Math.SQRT2, 0, count), current = sampledSine(irmsSet * Math.SQRT2, radians(phase), count), p = powerMetrics(voltage, current), dpf = Math.cos(radians(phase));
      return { modelType: "取樣功率公式", status: "純正弦條件下 Total PF 與 DPF 相同；失真電流時必須用 P/(Vrms×Irms)，不能只用 cosφ。", metrics: [{ label: "實功 P", value: fmt(p.watts, 1) + " W", kind: Math.abs(p.pf) > .85 ? "good" : "warn", note: "mean(v[n]×i[n])" }, { label: "Total PF", value: fmt(p.pf, 4), kind: Math.abs(p.pf) > .9 ? "good" : "warn", note: "P/(Vrms×Irms)" }, { label: "DPF", value: fmt(dpf, 4), kind: "good", note: "cosφ；只看基波相位" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 75, 0, 0, 2), "#34d399", 2); line(ctx, sinePoints(w, h, 75, radians(phase), 0, 2), "#60a5fa", 2); } };
    },

    "dds-zcd"(v) {
      const freq = Number(v.freq || 60), noisePct = Number(v.noise || 1.5), normalizedNoise = noisePct / 100, jitterS = normalizedNoise / (2 * Math.PI * freq), jitterUs = jitterS * 1e6, periodS = 1 / freq, worstFrequency = 1 / Math.max(1e-9, periodS + 2 * jitterS);
      return { modelType: "零交越斜率近似", status: "jitter 以時間表示；頻率誤差由兩次 crossing 的時間誤差推導。", metrics: [{ label: "時間 jitter", value: fmt(jitterUs, 1) + " µs", kind: jitterUs < 100 ? "good" : "warn", note: "Vnoise/(2πfVpk) 近似" }, { label: "名目週期", value: fmt(periodS * 1000, 3) + " ms", kind: "good", note: "1/f" }, { label: "最差單週期估頻", value: fmt(worstFrequency, 3) + " Hz", kind: jitterUs < 100 ? "good" : "warn", note: "未平均" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 80, 0, noisePct * 1.5, 2), noisePct < 3 ? "#34d399" : "#f59e0b", 2); ctx.strokeStyle = "#fb7185"; for (let x = w / 4; x < w; x += w / 4) { ctx.beginPath(); ctx.moveTo(x, h / 2 - 35); ctx.lineTo(x, h / 2 + 35); ctx.stroke(); } } };
    },

    "dds-jitter"(v) {
      const noise = Number(v.noise || 4), hyst = Number(v.hyst || 20), eventIndex = Math.max(0, Math.round(noise * 2.8 - hyst / 8));
      return { modelType: "Heuristic 事件指標", status: "此值只比較 noise 與 hysteresis 趨勢，不代表真實中斷次數。", metrics: [{ label: "重複觸發指標", value: String(eventIndex), kind: eventIndex === 0 ? "good" : eventIndex < 10 ? "warn" : "bad", note: "需用實機 capture 驗證" }, { label: "Hysteresis", value: fmt(hyst, 0) + " count", kind: hyst >= 20 ? "good" : "warn", note: "過大也會產生相位延遲" }, { label: "Noise", value: fmt(noise, 1) + " %", kind: noise < 3 ? "good" : "warn", note: "教材輸入" }], draw(ctx, w, h) { line(ctx, sinePoints(w, h, 76, 0, noise * 2, 2), eventIndex === 0 ? "#34d399" : "#fb7185", 2); ctx.strokeStyle = "#f59e0b"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, h / 2 - hyst * .8); ctx.lineTo(w, h / 2 - hyst * .8); ctx.moveTo(0, h / 2 + hyst * .8); ctx.lineTo(w, h / 2 + hyst * .8); ctx.stroke(); ctx.setLineDash([]); } };
    },

    "dds-cal-lab"(v) {
      const offset = Number(v.offset || 1.65), noise = Number(v.noise || 1.5), dynamic = String(v.mode || "dynamic") === "dynamic", offsetOk = dynamic || Math.abs(offset - 1.65) < .08, noiseOk = noise < 4, pass = offsetOk && noiseOk;
      return { modelType: "教學驗收規則", status: "PASS 代表教材門檻成立，不代表儀器準確度或校正可追溯性。", metrics: [{ label: "教材判定", value: pass ? "PASS" : "CHECK", kind: pass ? "good" : "warn", note: "需另做 uncertainty budget" }, { label: "Offset", value: offsetOk ? "OK" : "NG", kind: offsetOk ? "good" : "bad", note: dynamic ? "動態估測" : "固定扣值" }, { label: "Noise", value: noiseOk ? "OK" : "NG", kind: noiseOk ? "good" : "bad", note: "教材門檻 <4%" }], draw(ctx, w, h) { drawBoxes(ctx, w, h, [offsetOk ? "Offset OK" : "Offset 漂移", noiseOk ? "Noise OK" : "Noise 高", dynamic ? "LPF" : "固定值", pass ? "教材 PASS" : "需調整"], pass ? 3 : 0); } };
    }
  };

  renderShell();
  update();
  window.addEventListener("resize", update);
})();