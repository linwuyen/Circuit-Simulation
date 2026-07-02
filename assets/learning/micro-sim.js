(function () {
  "use strict";

  const lesson = window.MICRO_LESSON;
  if (!lesson) return;

  const root = document.getElementById("lesson-root");
  const stateKey = "micro-sim-checks-v1:" + location.pathname;
  const controlState = {};

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(value, digits) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    return value.toFixed(digits == null ? (Math.abs(value) >= 10 ? 1 : 2) : digits);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(stateKey) || "{}"); }
    catch (e) { return {}; }
  }

  function saveChecks(checks) {
    try { localStorage.setItem(stateKey, JSON.stringify(checks)); }
    catch (e) {}
  }

  function link(href, label, cls) {
    if (!href) return "";
    return '<a class="' + (cls || "ms-link") + '" href="' + esc(href) + '">' + esc(label) + '</a>';
  }

  function render() {
    const checks = loadChecks();
    const controls = (lesson.controls || []).map(control => {
      if (control.type === "select") {
        return '<div class="ms-control"><div class="ms-control-row"><label for="ctrl-' + esc(control.id) + '">' + esc(control.label) + '</label><output id="out-' + esc(control.id) + '"></output></div>'
          + '<select id="ctrl-' + esc(control.id) + '" data-control="' + esc(control.id) + '">' + control.options.map(option => '<option value="' + esc(option.value) + '">' + esc(option.label) + '</option>').join("") + '</select>'
          + '<div class="ms-help">' + esc(control.help || "") + '</div></div>';
      }
      return '<div class="ms-control"><div class="ms-control-row"><label for="ctrl-' + esc(control.id) + '">' + esc(control.label) + '</label><output id="out-' + esc(control.id) + '"></output></div>'
        + '<input id="ctrl-' + esc(control.id) + '" data-control="' + esc(control.id) + '" type="range" min="' + esc(control.min) + '" max="' + esc(control.max) + '" step="' + esc(control.step || 1) + '" value="' + esc(control.value) + '">'
        + '<div class="ms-help">' + esc(control.help || "") + '</div></div>';
    }).join("");

    root.innerHTML = '<div class="ms-shell">'
      + '<nav class="ms-nav"><a class="ms-brand" href="' + esc((lesson.rootPrefix || "../") + "index.html") + '"><span class="ms-mark">SIM</span><span>電路模擬說明</span></a>'
      + '<div class="ms-links">'
      + link(lesson.prevHref, "上一頁")
      + link(lesson.nextHref, "下一頁")
      + link(lesson.fullHref || "index.html", "完整儀表板")
      + link((lesson.rootPrefix || "../") + "beginner.html", "初學路線")
      + '</div></nav>'
      + '<section class="ms-hero"><div class="ms-eyebrow">' + esc(lesson.eyebrow || lesson.section || "Lesson") + '</div><h1>' + esc(lesson.title) + '</h1><p class="ms-lead">' + esc(lesson.intro) + '</p></section>'
      + '<section class="ms-grid">'
      + '<aside class="ms-panel"><span class="ms-tag">' + esc(lesson.section || "教學") + '</span><h2>這頁只練一件事</h2><ul class="ms-field-list">'
      + '<li><b>目標</b><span>' + esc(lesson.goal) + '</span></li>'
      + '<li><b>操作</b><span>' + esc(lesson.action) + '</span></li>'
      + '<li><b>判讀</b><span>' + esc(lesson.result) + '</span></li>'
      + '<li><b>實用</b><span>' + esc(lesson.why) + '</span></li>'
      + '</ul><div class="ms-task"><h3>小任務</h3><p class="ms-muted">' + esc(lesson.task) + '</p><div class="ms-checks">'
      + (lesson.checks || []).map((item, index) => '<label><input type="checkbox" data-check="' + index + '"' + (checks[index] ? " checked" : "") + '><span>' + esc(item) + '</span></label>').join("")
      + '</div></div></aside>'
      + '<section class="ms-panel"><h2>互動模擬</h2><div class="ms-controls">' + controls + '</div><div class="ms-canvas-wrap"><canvas class="ms-canvas" id="lessonCanvas"></canvas><div class="ms-status" id="simStatus"></div></div><div class="ms-metrics" id="metricGrid"></div><div class="ms-actions">'
      + link(lesson.nextHref, "下一頁", "ms-button primary")
      + link(lesson.fullHref || "index.html", "開啟完整儀表板", "ms-button")
      + '</div></section></section>'
      + '<section class="ms-note-grid">'
      + '<article class="ms-note"><b>初學者先看</b><span>' + esc(lesson.beginnerNote || "只改一個控制項，先看波形方向與數字變化，不急著背公式。") + '</span></article>'
      + '<article class="ms-note"><b>工程判斷</b><span>' + esc(lesson.engineeringNote || "把現象連到限制條件：量測範圍、時間預算、保護門檻或穩定度。") + '</span></article>'
      + '<article class="ms-note"><b>下一步</b><span>' + esc(lesson.nextNote || "完成小任務後，再回完整儀表板，把多個變因一起驗證。") + '</span></article>'
      + '</section></div>';

    for (const control of lesson.controls || []) {
      const element = document.getElementById("ctrl-" + control.id);
      if (!element) continue;
      element.value = control.value;
      element.addEventListener("input", update);
    }

    root.querySelectorAll("[data-check]").forEach(input => {
      input.addEventListener("change", () => {
        const stored = loadChecks();
        stored[input.getAttribute("data-check")] = input.checked;
        saveChecks(stored);
      });
    });

    update();
  }

  function readValues() {
    for (const control of lesson.controls || []) {
      const element = document.getElementById("ctrl-" + control.id);
      if (!element) continue;
      const value = control.type === "select" ? element.value : Number(element.value);
      controlState[control.id] = value;
      const out = document.getElementById("out-" + control.id);
      if (out) {
        if (control.type === "select") {
          const option = (control.options || []).find(item => String(item.value) === String(value));
          out.textContent = option ? option.short || option.label : value;
        } else {
          out.textContent = fmt(value, control.digits) + (control.unit || "");
        }
      }
    }
    return controlState;
  }

  function update() {
    const values = readValues();
    const canvas = document.getElementById("lessonCanvas");
    const status = document.getElementById("simStatus");
    const metrics = document.getElementById("metricGrid");
    if (!canvas || !status || !metrics) return;
    const sim = SIMS[lesson.sim] || SIMS.generic;
    const result = sim(values);
    status.textContent = result.status || "";
    metrics.innerHTML = (result.metrics || []).map(metric => '<article class="ms-metric ' + esc(metric.kind || "") + '"><span>' + esc(metric.label) + '</span><strong>' + esc(metric.value) + '</strong><small class="ms-muted">' + esc(metric.note || "") + '</small></article>').join("");
    draw(canvas, result.draw || (() => {}));
  }

  function draw(canvas, painter) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = 320;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height);
    painter(ctx, width, height);
  }

  function drawGrid(ctx, width, height) {
    ctx.fillStyle = "#0d1520";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += height / 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  function line(ctx, points, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  function sinePoints(width, height, amp, phase, ripple, cycles) {
    const points = [];
    const n = Math.floor(width);
    for (let x = 0; x <= n; x++) {
      const t = x / n;
      const base = Math.sin(t * Math.PI * 2 * (cycles || 2) + (phase || 0));
      const tri = 2 * Math.abs(2 * ((t * 24) % 1) - 1) - 1;
      points.push([x, height / 2 - base * amp - tri * (ripple || 0)]);
    }
    return points;
  }

  function drawBoxes(ctx, width, height, labels, activeIndex) {
    const gap = 18;
    const boxW = (width - gap * (labels.length + 1)) / labels.length;
    const y = height / 2 - 42;
    labels.forEach((label, index) => {
      const x = gap + index * (boxW + gap);
      ctx.fillStyle = index === activeIndex ? "#123f3b" : "#142033";
      ctx.strokeStyle = index === activeIndex ? "#22c5b7" : "#334155";
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, boxW, 84, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dbe7f4";
      ctx.font = "700 13px system-ui";
      wrapText(ctx, label, x + 12, y + 32, boxW - 24, 17);
      if (index < labels.length - 1) {
        ctx.strokeStyle = "#64748b";
        ctx.beginPath();
        ctx.moveTo(x + boxW + 4, y + 42);
        ctx.lineTo(x + boxW + gap - 6, y + 42);
        ctx.stroke();
      }
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split("");
    let lineText = "";
    for (const word of words) {
      const test = lineText + word;
      if (ctx.measureText(test).width > maxWidth && lineText) {
        ctx.fillText(lineText, x, y);
        lineText = word;
        y += lineHeight;
      } else {
        lineText = test;
      }
    }
    if (lineText) ctx.fillText(lineText, x, y);
  }

  const SIMS = {
    generic() {
      return {
        status: "這頁用來建立觀念，不需要複雜模型。",
        metrics: [{ label: "狀態", value: "READY", kind: "good", note: "先閱讀左側目標，再開完整儀表板。" }],
        draw(ctx, w, h) {
          drawBoxes(ctx, w, h, ["輸入", "處理", "輸出", "判讀"], 1);
        }
      };
    },

    "acmc-map"(v) {
      const active = Number(v.stage || 1);
      return {
        status: "從左到右看能量路徑：前級整流與 PFC、隔離 DC-DC、逆變輸出、最後量測與保護。",
        metrics: [
          { label: "DC bus", value: "390 V", kind: "good", note: "PFC 後的穩定母線" },
          { label: "隔離輸出", value: "550 V", kind: "good", note: "PSFB 升壓後供逆變器" },
          { label: "重點段落", value: ["PFC", "PSFB", "INV", "DAQ"][active], kind: "good", note: "一次只追一段" }
        ],
        draw(ctx, w, h) {
          drawBoxes(ctx, w, h, ["PFC 前級", "PSFB 隔離升壓", "SiC 逆變輸出", "C2000 DAQ/保護"], active);
        }
      };
    },

    "acmc-ripple"(v) {
      const fsw = Number(v.fsw || 100);
      const load = Number(v.load || 1200);
      const ripple = clamp(38 * (100 / fsw) * Math.sqrt(load / 1200), 8, 86);
      const kind = ripple < 35 ? "good" : ripple < 58 ? "warn" : "bad";
      return {
        status: ripple < 35 ? "漣波在容易濾掉的範圍。" : "漣波偏大，濾波器與控制器壓力會上升。",
        metrics: [
          { label: "估計漣波", value: fmt(ripple, 1) + " %", kind, note: "相對高頻紋波指標" },
          { label: "開關週期", value: fmt(1000 / fsw, 2) + " us", kind: "good", note: "fsw 越高週期越短" },
          { label: "負載功率", value: fmt(load, 0) + " W", kind: load < 300 ? "warn" : "good", note: "也會影響 ZVS" }
        ],
        draw(ctx, w, h) {
          line(ctx, sinePoints(w, h, 88, 0, ripple, 2), "#22d3ee", 2);
          line(ctx, sinePoints(w, h, 88, 0, 0, 2), "rgba(16,185,129,0.72)", 2);
        }
      };
    },

    "acmc-zvs"(v) {
      const load = Number(v.load || 1200);
      const deadtime = Number(v.deadtime || 120);
      const ratio = (load / 300) * (deadtime / 120);
      const margin = clamp(ratio, 0, 3);
      const ok = ratio >= 1;
      return {
        status: ok ? "原邊能量足以完成 Coss 充放電，ZVS 有機會成立。" : "能量不足，會轉成硬切換，效率與溫升惡化。",
        metrics: [
          { label: "ZVS 能量比", value: fmt(ratio, 2) + "x", kind: ok ? "good" : "bad", note: "大於 1 才算有裕度" },
          { label: "負載區間", value: load < 300 ? "輕載" : "正常", kind: load < 300 ? "warn" : "good", note: "輕載最容易失效" },
          { label: "死區時間", value: fmt(deadtime, 0) + " ns", kind: deadtime < 80 ? "warn" : "good", note: "太短不易完成換流" }
        ],
        draw(ctx, w, h) {
          const cx = w / 2, cy = h / 2 + 20, radius = 92;
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = ok ? "#34d399" : "#fb7185";
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI, Math.PI + Math.PI * clamp(margin / 2, 0, 1));
          ctx.stroke();
          ctx.fillStyle = "#dbe7f4";
          ctx.font = "900 34px Consolas";
          ctx.textAlign = "center";
          ctx.fillText(ok ? "ZVS OK" : "HARD", cx, cy - 10);
          ctx.font = "700 14px system-ui";
          ctx.fillText("能量比 " + fmt(ratio, 2) + "x", cx, cy + 20);
          ctx.textAlign = "left";
        }
      };
    },

    "acmc-sampling"(v) {
      const sync = String(v.mode) === "sync";
      const fsw = Number(v.fsw || 100);
      const spike = sync ? 4 : clamp(fsw * 0.65, 12, 100);
      return {
        status: sync ? "採樣點避開開關跳變，ADC 波形乾淨。" : "隨機採樣可能剛好撞到高 dv/dt，突波被帶進計算。",
        metrics: [
          { label: "噪聲指標", value: fmt(spike, 0), kind: sync ? "good" : "bad", note: "越低越好" },
          { label: "採樣策略", value: sync ? "同步" : "隨機", kind: sync ? "good" : "bad", note: "EPWM 觸發優先" },
          { label: "fsw", value: fmt(fsw, 0) + " kHz", kind: "good", note: "越高越需要精準採樣點" }
        ],
        draw(ctx, w, h) {
          const points = sinePoints(w, h, 78, 0, 0, 2);
          if (!sync) {
            for (let i = 24; i < points.length; i += 43) {
              points[i][1] -= 36 + (i % 3) * 12;
              if (points[i + 1]) points[i + 1][1] += 22;
            }
          }
          line(ctx, points, sync ? "#34d399" : "#fb7185", 2);
          for (let x = 30; x < w; x += 52) {
            ctx.fillStyle = sync ? "#22d3ee" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(x, h / 2 - Math.sin((x / w) * Math.PI * 4) * 78, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };
    },

    "acmc-pll"(v) {
      const enabled = String(v.pll) === "on";
      const drift = Number(v.drift || 0);
      const error = enabled ? clamp(Math.abs(drift) * 0.08, 0, 6) : Math.abs(drift);
      return {
        status: enabled ? "PLL 會把相位誤差拉回來，輸出參考能跟著市電走。" : "PLL 關閉時，外部相位漂移會直接變成控制誤差。",
        metrics: [
          { label: "相位誤差", value: fmt(error, 1) + " deg", kind: error < 8 ? "good" : error < 30 ? "warn" : "bad", note: "越低越穩" },
          { label: "PLL", value: enabled ? "LOCK" : "OFF", kind: enabled ? "good" : "warn", note: "併網通常需要" },
          { label: "外部漂移", value: fmt(drift, 0) + " deg", kind: Math.abs(drift) > 90 ? "warn" : "good", note: "測試追相能力" }
        ],
        draw(ctx, w, h) {
          const phase = drift * Math.PI / 180;
          line(ctx, sinePoints(w, h, 70, phase, 0, 2), "#a78bfa", 2);
          line(ctx, sinePoints(w, h, 70, enabled ? phase * 0.08 : 0, 0, 2), "#22d3ee", 2);
        }
      };
    },

    "acmc-trip"(v) {
      const load = Number(v.load || 1200);
      const ocp = Number(v.ocp || 8.5);
      const offset = Number(v.offset || 0);
      const peak = load / 220 * 1.42;
      const trip = peak > ocp || Math.abs(offset) > 1.5;
      const reason = peak > ocp ? "OCP" : Math.abs(offset) > 1.5 ? "DC SAT" : "READY";
      return {
        status: trip ? "保護應該鎖死，先排除真故障，再允許 reset。" : "負載與偏壓仍在保護門檻內。",
        metrics: [
          { label: "峰值電流", value: fmt(peak, 1) + " A", kind: peak > ocp ? "bad" : "good", note: "與 OCP 比較" },
          { label: "保護原因", value: reason, kind: trip ? "bad" : "good", note: "鎖死原因要明確" },
          { label: "DC 偏壓", value: fmt(offset, 1) + " V", kind: Math.abs(offset) > 1.5 ? "bad" : "good", note: "過大可能磁飽和" }
        ],
        draw(ctx, w, h) {
          line(ctx, sinePoints(w, h, 72, 0, trip ? 22 : 5, 2), trip ? "#fb7185" : "#34d399", 2);
          if (trip) {
            ctx.fillStyle = "rgba(127, 29, 29, 0.82)";
            ctx.fillRect(36, 84, w - 72, 148);
            ctx.strokeStyle = "#fb7185";
            ctx.strokeRect(36, 84, w - 72, 148);
            ctx.fillStyle = "#fff";
            ctx.font = "900 30px Consolas";
            ctx.textAlign = "center";
            ctx.fillText("TRIP LOCK", w / 2, 145);
            ctx.font = "700 14px system-ui";
            ctx.fillText("Reason: " + reason, w / 2, 178);
            ctx.textAlign = "left";
          }
        }
      };
    },

    "acmc-lab"(v) {
      const fsw = Number(v.fsw || 100);
      const load = Number(v.load || 1200);
      const sync = String(v.mode) === "sync";
      const ocp = Number(v.ocp || 8.5);
      const ripple = 38 * (100 / fsw) * Math.sqrt(load / 1200);
      const zvs = load >= 300;
      const peak = load / 220 * 1.42;
      const pass = ripple < 45 && zvs && sync && peak < ocp;
      return {
        status: pass ? "這組參數同時通過漣波、ZVS、同步採樣與 OCP 裕度。" : "至少一個條件不合格，請逐項調整。",
        metrics: [
          { label: "整體判定", value: pass ? "PASS" : "CHECK", kind: pass ? "good" : "warn", note: "四項條件一起看" },
          { label: "漣波", value: fmt(ripple, 1) + " %", kind: ripple < 45 ? "good" : "bad", note: "目標 < 45%" },
          { label: "OCP 裕度", value: fmt(ocp - peak, 1) + " A", kind: ocp > peak ? "good" : "bad", note: "必須大於 0" }
        ],
        draw(ctx, w, h) {
          drawBoxes(ctx, w, h, [
            ripple < 45 ? "Ripple OK" : "Ripple 高",
            zvs ? "ZVS OK" : "ZVS 失效",
            sync ? "Sync OK" : "採樣噪聲",
            ocp > peak ? "OCP OK" : "OCP Trip"
          ], pass ? 3 : 0);
        }
      };
    },

    "dds-map"(v) {
      const active = Number(v.stage || 1);
      return {
        status: "量測鏈要從類比訊號一路追到暫存器與顯示值，任何一段錯都會讓結果失真。",
        metrics: [
          { label: "ADC 範圍", value: "0-4095", kind: "good", note: "對應 0-3.3V" },
          { label: "Offset", value: "1.65 V", kind: "good", note: "讓 AC 有正負空間" },
          { label: "重點段落", value: ["Signal", "ADC", "Offset", "RMS/PF"][active], kind: "good", note: "一次追一段" }
        ],
        draw(ctx, w, h) {
          drawBoxes(ctx, w, h, ["DDS 產生 AC", "ADC 取樣", "Offset 校正", "RMS/PF 計算"], active);
        }
      };
    },

    "dds-offset"(v) {
      const offset = Number(v.offset || 1.65);
      const mode = String(v.mode || "dynamic");
      const err = Math.abs(offset - 1.65);
      const vrms = mode === "dynamic" ? 84.85 * (1 + err * 0.02) : 84.85 * (1 + err * 0.35);
      const kind = Math.abs(vrms - 84.85) < 2 ? "good" : Math.abs(vrms - 84.85) < 8 ? "warn" : "bad";
      return {
        status: mode === "dynamic" ? "動態 LPF 會估測偏壓，漂移造成的 RMS 誤差明顯下降。" : "固定扣 2048 假設 offset 永遠是 1.65V，漂移時會直接造成誤差。",
        metrics: [
          { label: "估測 Vrms", value: fmt(vrms, 2) + " V", kind, note: "理想約 84.85V" },
          { label: "Offset 漂移", value: fmt(err, 2) + " V", kind: err < 0.12 ? "good" : "warn", note: "偏離 1.65V" },
          { label: "校正模式", value: mode === "dynamic" ? "LPF" : "2048", kind: mode === "dynamic" ? "good" : "warn", note: "動態估測較實用" }
        ],
        draw(ctx, w, h) {
          const raw = sinePoints(w, h, 58, 0, 0, 2).map(p => [p[0], p[1] - (offset - 1.65) * 70]);
          line(ctx, raw, "#34d399", 2);
          line(ctx, sinePoints(w, h, 58, 0, 0, 2), mode === "dynamic" ? "#22d3ee" : "#f59e0b", 2);
        }
      };
    },

    "dds-wave"(v) {
      const vpeak = Number(v.vpeak || 120);
      const offset = Number(v.offset || 1.65);
      const scaled = vpeak / 155 * 1.25;
      const min = offset - scaled;
      const max = offset + scaled;
      const ok = min >= 0 && max <= 3.3;
      return {
        status: ok ? "ADC 腳位仍在 0-3.3V 內。" : "訊號超出 ADC 範圍，會削波或量測錯誤。",
        metrics: [
          { label: "ADC 最低", value: fmt(min, 2) + " V", kind: min >= 0 ? "good" : "bad", note: "不可低於 0V" },
          { label: "ADC 最高", value: fmt(max, 2) + " V", kind: max <= 3.3 ? "good" : "bad", note: "不可高於 3.3V" },
          { label: "峰值", value: fmt(vpeak, 0) + " V", kind: ok ? "good" : "warn", note: "已縮放到 ADC 端" }
        ],
        draw(ctx, w, h) {
          const center = h - (offset / 3.3) * h;
          const amp = scaled / 3.3 * h;
          line(ctx, sinePoints(w, h, amp, 0, 0, 2).map(p => [p[0], p[1] + center - h / 2]), ok ? "#34d399" : "#fb7185", 2);
          ctx.strokeStyle = "#f59e0b";
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, center);
          ctx.lineTo(w, center);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      };
    },

    "dds-rms"(v) {
      const vpeak = Number(v.vpeak || 120);
      const samples = Number(v.samples || 333);
      const ideal = vpeak / Math.sqrt(2);
      const sampleErr = samples < 120 ? 5.5 : samples < 220 ? 2.2 : 0.6;
      const measured = ideal * (1 + sampleErr / 100);
      return {
        status: samples >= 220 ? "單週期取樣點數足夠，RMS 誤差小。" : "取樣點數偏少，週期統計比較容易受相位與雜訊影響。",
        metrics: [
          { label: "理想 Vrms", value: fmt(ideal, 2) + " V", kind: "good", note: "Vpeak / sqrt(2)" },
          { label: "估測 Vrms", value: fmt(measured, 2) + " V", kind: sampleErr < 2 ? "good" : "warn", note: "含取樣誤差" },
          { label: "單週期點數", value: fmt(samples, 0), kind: samples >= 220 ? "good" : "warn", note: "越多越穩" }
        ],
        draw(ctx, w, h) {
          line(ctx, sinePoints(w, h, 82, 0, 0, 2), "#22d3ee", 2);
          const count = clamp(Math.floor(samples / 12), 8, 70);
          ctx.fillStyle = "#f59e0b";
          for (let i = 0; i < count; i++) {
            const x = i / (count - 1) * w;
            const y = h / 2 - Math.sin((x / w) * Math.PI * 4) * 82;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };
    },

    "dds-pf"(v) {
      const phase = Number(v.phase || 30);
      const vrms = Number(v.vrms || 120);
      const irms = Number(v.irms || 10);
      const pf = Math.cos(phase * Math.PI / 180);
      const p = vrms * irms * pf;
      return {
        status: Math.abs(phase) < 10 ? "電壓電流接近同相，實功接近視在功率。" : "相位差變大時，同樣 V/I 下真正做功比例下降。",
        metrics: [
          { label: "實功 P", value: fmt(p, 0) + " W", kind: pf > 0.85 ? "good" : "warn", note: "V x I x cos(phi)" },
          { label: "PF", value: fmt(pf, 3), kind: pf > 0.9 ? "good" : pf > 0.75 ? "warn" : "bad", note: "功率因數" },
          { label: "視在功率", value: fmt(vrms * irms, 0) + " VA", kind: "good", note: "V x I" }
        ],
        draw(ctx, w, h) {
          line(ctx, sinePoints(w, h, 75, 0, 0, 2), "#34d399", 2);
          line(ctx, sinePoints(w, h, 75, phase * Math.PI / 180, 0, 2), "#60a5fa", 2);
        }
      };
    },

    "dds-zcd"(v) {
      const freq = Number(v.freq || 60);
      const noise = Number(v.noise || 1.5);
      const jitter = noise * 0.18;
      return {
        status: noise < 3 ? "過零點清楚，頻率回算穩定。" : "雜訊接近零點時，ZCD 可能提早或延後觸發。",
        metrics: [
          { label: "頻率估測", value: fmt(freq + jitter, 2) + " Hz", kind: noise < 3 ? "good" : "warn", note: "受 jitter 影響" },
          { label: "Jitter", value: fmt(jitter, 2) + " Hz", kind: noise < 3 ? "good" : "warn", note: "雜訊越大越糟" },
          { label: "Noise", value: fmt(noise, 1) + " %", kind: noise < 3 ? "good" : noise < 7 ? "warn" : "bad", note: "接近零點最敏感" }
        ],
        draw(ctx, w, h) {
          const pts = sinePoints(w, h, 80, 0, noise * 1.5, 2);
          line(ctx, pts, noise < 3 ? "#34d399" : "#f59e0b", 2);
          ctx.strokeStyle = "#fb7185";
          ctx.lineWidth = 2;
          for (let x = w / 4; x < w; x += w / 4) {
            ctx.beginPath();
            ctx.moveTo(x, h / 2 - 35);
            ctx.lineTo(x, h / 2 + 35);
            ctx.stroke();
          }
        }
      };
    },

    "dds-jitter"(v) {
      const noise = Number(v.noise || 4);
      const hyst = Number(v.hyst || 20);
      const count = Math.max(0, Math.round(noise * 2.8 - hyst / 8));
      return {
        status: count === 0 ? "Hysteresis 足以擋掉零點附近抖動。" : "過零偵測仍在抖，頻率與週期統計要小心。",
        metrics: [
          { label: "jitterCount", value: String(count), kind: count === 0 ? "good" : count < 10 ? "warn" : "bad", note: "越低越好" },
          { label: "Hysteresis", value: fmt(hyst, 0) + " count", kind: hyst >= 20 ? "good" : "warn", note: "太小擋不住噪聲" },
          { label: "Noise", value: fmt(noise, 1) + " %", kind: noise < 3 ? "good" : noise < 7 ? "warn" : "bad", note: "測試邊界" }
        ],
        draw(ctx, w, h) {
          line(ctx, sinePoints(w, h, 76, 0, noise * 2, 2), count === 0 ? "#34d399" : "#fb7185", 2);
          ctx.strokeStyle = "rgba(245,158,11,0.9)";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, h / 2 - hyst * 0.8);
          ctx.lineTo(w, h / 2 - hyst * 0.8);
          ctx.moveTo(0, h / 2 + hyst * 0.8);
          ctx.lineTo(w, h / 2 + hyst * 0.8);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      };
    },

    "dds-cal-lab"(v) {
      const offset = Number(v.offset || 1.65);
      const noise = Number(v.noise || 1.5);
      const mode = String(v.mode || "dynamic");
      const offsetOk = mode === "dynamic" || Math.abs(offset - 1.65) < 0.08;
      const noiseOk = noise < 4;
      const pass = offsetOk && noiseOk;
      return {
        status: pass ? "這組量測條件可交付：offset 與 noise 都在可控範圍。" : "量測條件仍不穩，請先處理 offset 或 noise。",
        metrics: [
          { label: "整體判定", value: pass ? "PASS" : "CHECK", kind: pass ? "good" : "warn", note: "校正與雜訊一起看" },
          { label: "Offset 條件", value: offsetOk ? "OK" : "NG", kind: offsetOk ? "good" : "bad", note: "固定模式怕漂移" },
          { label: "Noise 條件", value: noiseOk ? "OK" : "NG", kind: noiseOk ? "good" : "bad", note: "目標 < 4%" }
        ],
        draw(ctx, w, h) {
          drawBoxes(ctx, w, h, [
            offsetOk ? "Offset OK" : "Offset 漂移",
            noiseOk ? "Noise OK" : "Noise 高",
            mode === "dynamic" ? "LPF 校正" : "固定扣 2048",
            pass ? "可交付" : "需調整"
          ], pass ? 3 : 0);
        }
      };
    }
  };

  render();
  window.addEventListener("resize", update);
})();
