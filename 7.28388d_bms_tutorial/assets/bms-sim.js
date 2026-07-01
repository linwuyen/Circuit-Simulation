(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const stateMeta = {
    INIT: { label: "INIT", className: "" },
    STANDBY: { label: "STANDBY", className: "amber" },
    DISCHARGE: { label: "DISCHARGE", className: "green" },
    FAULT: { label: "FAULT_LOCK", className: "red" }
  };

  const limits = {
    ovp: 4250,
    dischargeMaxVoltage: 4150,
    ocp: 150,
    ot: 60,
    spiMax: 3
  };

  const lessonState = {
    v: 4000,
    i: 0,
    spi: 0,
    spiBroken: false,
    state: "INIT",
    contactor: false,
    udsSession: "01",
    cm4Online: true,
    cm4V: 4000,
    cm4I: 0,
    watchdog: 5
  };

  function text(id, value) {
    const node = typeof id === "string" ? document.getElementById(id) : id;
    if (node) node.textContent = value;
  }

  function hex(value, pad = 4) {
    const normalized = Math.max(0, Number(value) || 0);
    return "0x" + normalized.toString(16).toUpperCase().padStart(pad, "0");
  }

  function setPill(id, state) {
    const node = typeof id === "string" ? document.getElementById(id) : id;
    if (!node) return;
    const meta = stateMeta[state] || stateMeta.INIT;
    node.className = `state-pill ${meta.className}`.trim();
    node.innerHTML = `<span class="led"></span>${meta.label}`;
  }

  function setState(state) {
    lessonState.state = state;
    setPill("system-state", state);
    $$(".state-box").forEach((box) => {
      box.classList.toggle("active", box.dataset.state === state && state !== "FAULT");
      box.classList.toggle("fault", box.dataset.state === state && state === "FAULT");
    });
  }

  function setContactor(closed, note) {
    lessonState.contactor = closed;
    const node = $("#contactor");
    if (!node) return;
    node.className = `state-pill ${closed ? "green" : "red"}`;
    node.innerHTML = `<span class="led"></span>${closed ? "閉合 CLOSED" : "斷開 OPEN"}${note ? " / " + note : ""}`;
  }

  function log(id, message, type = "") {
    const box = document.getElementById(id);
    if (!box) return;
    const line = document.createElement("div");
    line.className = `event ${type}`.trim();
    line.textContent = message;
    box.prepend(line);
  }

  function term(id, message, type = "") {
    const box = document.getElementById(id);
    if (!box) return;
    const line = document.createElement("div");
    line.className = type;
    line.textContent = message;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function bindRange(sliderId, valueId, parser, formatter, onChange) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    const update = () => {
      const value = parser(slider.value);
      text(valueId, formatter(value));
      if (onChange) onChange(value);
    };
    slider.addEventListener("input", update);
    update();
  }

  function updateAfeStatus() {
    text("afe-voltage-hex", hex(lessonState.v));
    text("afe-current-hex", hex(Math.abs(lessonState.i)));
    text("afe-spi-count", lessonState.spi);

    const voltageStatus = $("#afe-voltage-status");
    if (voltageStatus) {
      if (lessonState.v > limits.ovp) {
        voltageStatus.textContent = "超過 OVP 門檻，狀態機必須禁止放電。";
        voltageStatus.className = "callout danger";
      } else if (lessonState.v > limits.dischargeMaxVoltage) {
        voltageStatus.textContent = "電壓偏高：還沒過充，但不允許進入 DISCHARGE。";
        voltageStatus.className = "callout warning";
      } else {
        voltageStatus.textContent = "電壓在可放電範圍內，可以接受 VCU 放電請求。";
        voltageStatus.className = "callout";
      }
    }

    const currentStatus = $("#afe-current-status");
    if (currentStatus) {
      if (lessonState.i > limits.ocp) {
        currentStatus.textContent = "超過 OCP 門檻，接觸器需要立刻斷開。";
        currentStatus.className = "callout danger";
      } else {
        currentStatus.textContent = "電流未超過保護門檻，仍需持續監控。";
        currentStatus.className = "callout";
      }
    }
  }

  function initAfe() {
    bindRange("voltage-slider", "voltage-value", Number, (v) => `${v} mV`, (v) => {
      lessonState.v = v;
      updateAfeStatus();
    });
    bindRange("current-slider", "current-value", Number, (i) => `${i.toFixed(1)} A`, (i) => {
      lessonState.i = i;
      updateAfeStatus();
    });
    $("#spi-once")?.addEventListener("click", () => {
      lessonState.spi += 1;
      updateAfeStatus();
      log("afe-log", `注入第 ${lessonState.spi} 次 SPI CRC 錯誤。`, lessonState.spi >= limits.spiMax ? "err" : "warn");
    });
    $("#spi-break")?.addEventListener("click", () => {
      lessonState.spiBroken = true;
      lessonState.spi += 3;
      updateAfeStatus();
      log("afe-log", "SPI 線路失效：CPU1 會看到錯誤計數快速累積。", "err");
    });
    updateAfeStatus();
  }

  function initIpc() {
    bindRange("ipc-voltage-slider", "ipc-voltage-value", Number, (v) => `${v} mV`, (v) => {
      lessonState.v = v;
      text("cpu1-adc", hex(v));
    });
    let locked = false;
    $("#ipc-step")?.addEventListener("click", () => {
      locked = !locked;
      $(".wire")?.classList.toggle("active", locked);
      text("ipc-lock", locked ? "LOCKED / CPU1 正在寫入" : "ACK / CM4 已讀取");
      if (locked) {
        lessonState.cm4V = lessonState.v;
        text("gsram-value", hex(lessonState.v));
        log("ipc-log", `CPU1 將 ADC ${hex(lessonState.v)} 寫入 GSRAM。`, "ok");
      } else {
        text("cm4-rx", hex(lessonState.cm4V));
        log("ipc-log", "CM4 讀取 GSRAM 後送出 IPCACK，鎖被釋放。", "ok");
      }
    });
    $("#ipc-auto")?.addEventListener("click", () => {
      const button = $("#ipc-auto");
      if (button.dataset.running === "1") return;
      button.dataset.running = "1";
      let count = 0;
      const timer = setInterval(() => {
        $("#ipc-step")?.click();
        count += 1;
        if (count >= 6) {
          clearInterval(timer);
          button.dataset.running = "0";
        }
      }, 550);
    });
  }

  function evaluateFsm(source = "tick") {
    if (lessonState.state === "FAULT") return;
    const v = lessonState.v;
    const i = lessonState.i;

    if (lessonState.state === "INIT") {
      setState("STANDBY");
      log("fsm-log", "初始化完成，BMS 進入 STANDBY。", "ok");
      return;
    }

    if (lessonState.state === "STANDBY") {
      if (v > limits.ovp) {
        setState("FAULT");
        setContactor(false);
        log("fsm-log", `OVP：${v} mV > ${limits.ovp} mV，進入 FAULT_LOCK。`, "err");
      } else if (source === "request" && v <= limits.dischargeMaxVoltage) {
        setState("DISCHARGE");
        setContactor(true);
        log("fsm-log", "VCU 放電請求成立，接觸器閉合。", "ok");
      } else if (source === "request") {
        log("fsm-log", `拒絕放電：${v} mV 高於 ${limits.dischargeMaxVoltage} mV。`, "warn");
      }
      return;
    }

    if (lessonState.state === "DISCHARGE") {
      if (i > limits.ocp) {
        setState("FAULT");
        setContactor(false);
        log("fsm-log", `OCP：${i.toFixed(1)} A > ${limits.ocp} A，接觸器斷開。`, "err");
      } else if (lessonState.spi >= limits.spiMax) {
        setState("FAULT");
        setContactor(false);
        log("fsm-log", `AFE SPI 失聯：錯誤計數 ${lessonState.spi}，進入 FAULT_LOCK。`, "err");
      }
    }
  }

  function initFsm() {
    bindRange("fsm-voltage-slider", "fsm-voltage-value", Number, (v) => `${v} mV`, (v) => {
      lessonState.v = v;
      evaluateFsm();
    });
    bindRange("fsm-current-slider", "fsm-current-value", Number, (i) => `${i.toFixed(1)} A`, (i) => {
      lessonState.i = i;
      evaluateFsm();
    });
    $("#fsm-request")?.addEventListener("click", () => evaluateFsm("request"));
    $("#fsm-spi")?.addEventListener("click", () => {
      lessonState.spi += 1;
      text("fsm-spi-count", lessonState.spi);
      log("fsm-log", `SPI 錯誤計數 +1，目前為 ${lessonState.spi}。`, lessonState.spi >= limits.spiMax ? "err" : "warn");
      evaluateFsm();
    });
    $("#fsm-reset")?.addEventListener("click", () => {
      lessonState.state = "INIT";
      lessonState.spi = 0;
      setState("INIT");
      setContactor(false);
      text("fsm-spi-count", "0");
      log("fsm-log", "硬體重置：FAULT_LOCK 被清除，系統回到 INIT。", "ok");
    });
    setState("INIT");
    setContactor(false);
  }

  function initUds() {
    bindRange("uds-voltage-slider", "uds-voltage-value", Number, (v) => {
      return `${v} mV / ${hex(v)}`;
    }, (v) => {
      lessonState.cm4V = v;
      text("uds-cm4-voltage", hex(v));
    });

    // 簡化版 UDS 棧:含 session 切換、安全存取(seed/key)與真實 NRC 代碼。
    const UDS_SEED = "1A 2B 3C 4D";
    const UDS_KEY = "C3 D4 E5 F6"; // 對應 seed 的正確金鑰(教學用固定值)
    let udsUnlocked = false;

    function nrc(sid, code, meaning) {
      term("uds-term", `RX: 7F ${sid} ${code}  // ${meaning}`, "err");
    }

    function send(cmd) {
      const clean = cmd.trim().toUpperCase().replace(/\s+/g, " ");
      if (!clean) return;
      term("uds-term", `TX: ${clean}`, "tx");
      if (!lessonState.cm4Online) {
        term("uds-term", "RX: (no response) CM4 / CAN controller offline", "err");
        return;
      }
      if (clean === "HELP") {
        term("uds-term", "Services: 10 01/03 · 11 01 · 3E 00 · 22 01 · 22 F1 90 · 27 01 · 27 02 <key> · 31 01", "ok");
        return;
      }
      const p = clean.split(" ");
      const sid = p[0];

      switch (sid) {
        case "10": { // DiagnosticSessionControl
          const sub = p[1];
          if (!["01", "02", "03"].includes(sub)) { nrc("10", "12", "sub-function not supported"); break; }
          lessonState.udsSession = sub;
          if (sub !== "03") udsUnlocked = false; // 離開 extended 立刻上鎖
          text("uds-session", `0x${sub}`);
          term("uds-term", `RX: 50 ${sub} 00 32 01 F4  // session=0x${sub}, P2 timing`, "ok");
          break;
        }
        case "11": { // ECUReset
          if (p[1] !== "01") { nrc("11", "12", "sub-function not supported"); break; }
          term("uds-term", "RX: 51 01  // ECU hard reset scheduled", "ok");
          break;
        }
        case "3E": { // TesterPresent
          term("uds-term", "RX: 7E 00  // tester present ack", "ok");
          break;
        }
        case "22": { // ReadDataByIdentifier
          const did = p.slice(1).join(" ");
          if (did === "01") {
            term("uds-term", `RX: 62 01 ${hex(lessonState.cm4V).slice(2)}  // max cell voltage`, "ok");
          } else if (did === "F1 90") {
            term("uds-term", "RX: 62 F1 90 42 4D 53 2D 53 49 4D  // VIN = 'BMS-SIM'", "ok");
          } else if (did === "F1 8C") {
            term("uds-term", "RX: 62 F1 8C 30 30 31 32 33  // ECU serial", "ok");
          } else {
            nrc("22", "31", "request out of range (unknown DID)");
          }
          break;
        }
        case "27": { // SecurityAccess
          const sub = p[1];
          if (lessonState.udsSession !== "03") { nrc("27", "22", "conditions not correct (need 10 03 first)"); break; }
          if (sub === "01") {
            if (udsUnlocked) term("uds-term", "RX: 67 01 00 00 00 00  // already unlocked", "ok");
            else term("uds-term", `RX: 67 01 ${UDS_SEED}  // seed(回 27 02 + key 解鎖)`, "ok");
          } else if (sub === "02") {
            const key = p.slice(2).join(" ");
            if (key === UDS_KEY) { udsUnlocked = true; term("uds-term", "RX: 67 02  // security unlocked", "ok"); }
            else nrc("27", "35", "invalid key");
          } else {
            nrc("27", "12", "sub-function not supported");
          }
          break;
        }
        case "31": { // RoutineControl(需先解鎖)
          if (!udsUnlocked) { nrc("31", "33", "security access denied"); break; }
          term("uds-term", "RX: 71 01 FF 00  // routine started", "ok");
          break;
        }
        default:
          nrc(sid || "00", "11", "service not supported");
      }
    }

    $("#uds-send")?.addEventListener("click", () => {
      const input = $("#uds-input");
      send(input.value);
      input.value = "";
    });
    $("#uds-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") $("#uds-send")?.click();
    });
    $$("[data-uds]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $("#uds-input");
        input.value = button.dataset.uds;
        input.focus();
      });
    });
    $("#uds-cm4-off")?.addEventListener("click", () => {
      lessonState.cm4Online = false;
      const node = $("#uds-cm4-state");
      if (node) {
        node.className = "state-pill red";
        node.innerHTML = '<span class="led"></span>CM4 OFFLINE';
      }
      term("uds-term", ">> CM4 halted. CAN controller offline.", "err");
    });
  }

  function initFaults() {
    setState("STANDBY");
    setContactor(false);
    const run = (name) => {
      if (name === "ovp") {
        lessonState.v = 4300;
        setState("FAULT");
        setContactor(false);
        log("fault-log", "過壓實驗：最高單體電壓 4300mV，狀態機鎖定 FAULT。", "err");
      }
      if (name === "ocp") {
        setState("DISCHARGE");
        setContactor(true);
        log("fault-log", "先進入 DISCHARGE，接觸器閉合。", "ok");
        setTimeout(() => {
          lessonState.i = 180;
          setState("FAULT");
          setContactor(false);
          log("fault-log", "過流實驗：Pack 電流 180A，接觸器斷開。", "err");
        }, 600);
      }
      if (name === "spi") {
        setState("DISCHARGE");
        setContactor(true);
        lessonState.spi = 0;
        const timer = setInterval(() => {
          lessonState.spi += 1;
          log("fault-log", `SPI timeout count = ${lessonState.spi}`, lessonState.spi >= 3 ? "err" : "warn");
          if (lessonState.spi >= 3) {
            clearInterval(timer);
            setState("FAULT");
            setContactor(false);
            log("fault-log", "AFE 失聯：BMS 不再信任感測資料，進入安全狀態。", "err");
          }
        }, 500);
      }
      if (name === "cm4") {
        setState("DISCHARGE");
        setContactor(true);
        lessonState.watchdog = 5;
        log("fault-log", "CM4 hard fault：網路核心停止回應。", "warn");
        const timer = setInterval(() => {
          lessonState.watchdog -= 1;
          text("fault-watchdog", `ERR(${lessonState.watchdog})`);
          log("fault-log", `CPU1 watchdog 倒數：${lessonState.watchdog}`, "warn");
          if (lessonState.watchdog <= 0) {
            clearInterval(timer);
            setState("FAULT");
            setContactor(false, "HW TRIP");
            log("fault-log", "NMI_TRIP：CPU1 強制打開接觸器。", "err");
          }
        }, 500);
      }
    };

    $$("[data-fault]").forEach((button) => {
      button.addEventListener("click", () => run(button.dataset.fault));
    });
    $("#fault-reset")?.addEventListener("click", () => {
      lessonState.watchdog = 5;
      setState("STANDBY");
      setContactor(false);
      text("fault-watchdog", "OK");
      log("fault-log", "重置實驗環境，回到 STANDBY。", "ok");
    });
  }

  // ch03 比較/門檻:把 96 電芯 / 12 NTC 量測值拿去和保護門檻比,只產生判定,不做狀態轉換。
  function initCompare() {
    const NCELL = 96, NNTC = 12;
    const cells = Array(NCELL).fill(3700); // mV
    const ntcs = Array(NNTC).fill(25);     // °C
    const maxCell = () => Math.max(...cells);
    const minCell = () => Math.min(...cells);
    const maxNtc = () => Math.max(...ntcs);

    function paintCell(i) {
      const el = document.getElementById("cmp-cell-" + i);
      if (!el) return;
      const v = cells[i];
      el.textContent = (v / 1000).toFixed(2);
      el.className = "cell" + (v > limits.ovp ? " over" : v < 3000 ? " under" : "");
    }
    function paintNtc(i) {
      const el = document.getElementById("cmp-ntc-" + i);
      if (!el) return;
      el.textContent = ntcs[i] + "°";
      el.className = "ntc" + (ntcs[i] > limits.ot ? " hot" : "");
    }
    function buildGrids() {
      const g = document.getElementById("compare-cell-grid");
      if (g) {
        g.innerHTML = "";
        for (let i = 0; i < NCELL; i++) {
          const d = document.createElement("div");
          d.id = "cmp-cell-" + i;
          d.title = "Cell " + (i + 1) + ":點擊循環 正常→過壓→欠壓";
          d.onclick = () => {
            cells[i] = cells[i] === 3700 ? 4350 : cells[i] === 4350 ? 2500 : 3700;
            paintCell(i); verdict();
          };
          g.appendChild(d);
          paintCell(i);
        }
      }
      const n = document.getElementById("compare-ntc-grid");
      if (n) {
        n.innerHTML = "";
        for (let i = 0; i < NNTC; i++) {
          const d = document.createElement("div");
          d.id = "cmp-ntc-" + i;
          d.title = "NTC " + (i + 1) + ":點擊循環 正常→過溫";
          d.onclick = () => { ntcs[i] = ntcs[i] === 25 ? 65 : 25; paintNtc(i); verdict(); };
          n.appendChild(d);
          paintNtc(i);
        }
      }
    }

    function verdict() {
      const v = maxCell();
      const i = lessonState.i;
      const t = maxNtc();
      lessonState.v = v;
      text("compare-voltage-hex", hex(v));
      text("compare-current-hex", hex(Math.abs(i)));
      text("compare-max-cell", `${v} mV`);
      text("compare-min-cell", `${minCell()} mV`);
      text("compare-max-temp", `${t} °C`);

      const vs = $("#compare-voltage-status");
      if (vs) {
        if (v > limits.ovp) {
          vs.textContent = `最高電芯 ${v} mV > OVP ${limits.ovp} mV：過壓,必須禁止放電並 FAULT。`;
          vs.className = "callout danger";
        } else if (v > limits.dischargeMaxVoltage) {
          vs.textContent = `${limits.dischargeMaxVoltage} < ${v} ≤ ${limits.ovp} mV：偏高灰帶,還沒過充但不准放電。`;
          vs.className = "callout warning";
        } else {
          vs.textContent = `最高電芯 ${v} mV ≤ ${limits.dischargeMaxVoltage} mV：在可放電窗內。`;
          vs.className = "callout";
        }
      }

      const cs = $("#compare-current-status");
      if (cs) {
        if (i > limits.ocp) {
          cs.textContent = `${i.toFixed(1)} A > OCP ${limits.ocp} A：過流,接觸器需立刻斷開。`;
          cs.className = "callout danger";
        } else {
          cs.textContent = `${i.toFixed(1)} A ≤ OCP ${limits.ocp} A：電流在容許範圍。`;
          cs.className = "callout";
        }
      }

      const ts = $("#compare-temp-status");
      if (ts) {
        if (t > limits.ot) {
          ts.textContent = `最高溫 ${t}°C > OT ${limits.ot}°C：過溫,必須進入保護。`;
          ts.className = "callout danger";
        } else {
          ts.textContent = `最高溫 ${t}°C ≤ OT ${limits.ot}°C:溫度在容許範圍。`;
          ts.className = "callout";
        }
      }

      const all = $("#compare-verdict");
      if (all) {
        const ok = v <= limits.dischargeMaxVoltage && i <= limits.ocp && t <= limits.ot;
        const warn = v <= limits.ovp && i <= limits.ocp && t <= limits.ot;
        const label = ok ? "綜合判定:PASS — 允許進入 DISCHARGE。"
          : warn ? "綜合判定:HOLD — 條件不足,維持 STANDBY。"
          : "綜合判定:FAULT — 任一門檻越界,鎖定保護。";
        all.className = "state-pill " + (ok ? "green" : warn ? "amber" : "red");
        all.innerHTML = `<span class="led"></span>${label}`;
      }
    }

    bindRange("compare-current-slider", "compare-current-value", Number, (i) => `${i.toFixed(1)} A`, (i) => {
      lessonState.i = i; verdict();
    });
    buildGrids();
    verdict();
  }

  // ch05 致動/預充:RC 充電曲線 + 接觸器時序,示範為何不能直接閉合主正。
  function initActuate() {
    const packV = 355; // 96 * ~3.7V,僅供示意
    let cap = 0;
    let timer = null;
    let elapsed = 0;

    function paint(stage) {
      text("pre-cap", `${cap.toFixed(0)} V / ${packV} V`);
      const pct = Math.min(100, (cap / packV) * 100);
      const bar = $("#pre-bar");
      if (bar) bar.style.width = pct.toFixed(0) + "%";
      if (stage) text("pre-stage", stage);
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function setRelays(neg, pre, pos) {
      [["r-neg", neg], ["r-pre", pre], ["r-pos", pos]].forEach(([id, on]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = "relay " + (on ? "closed" : "open");
        const s = el.querySelector("strong");
        if (s) s.textContent = on ? "閉合 CLOSED" : "斷開 OPEN";
      });
    }
    function setSafety(ok) {
      const el = document.getElementById("pre-safety");
      if (!el) return;
      el.className = "state-pill " + (ok ? "green" : "red");
      el.innerHTML = `<span class="led"></span>${ok ? "安全防禦:正常" : "安全防禦:故障切斷"}`;
    }

    function reset() {
      stop(); cap = 0; elapsed = 0;
      setContactor(false);
      setRelays(false, false, false);
      setSafety(true);
      paint("待命 STANDBY");
      log("pre-log", "重置:電容洩放,接觸器全開,回到 STANDBY。", "ok");
    }

    $("#pre-start")?.addEventListener("click", () => {
      if (timer) return;
      cap = 0; elapsed = 0;
      setContactor(false, "主負+預充閉合");
      setRelays(true, true, false);
      setSafety(true);
      log("pre-log", "步驟1:主負繼電器閉合、預充繼電器閉合(主正仍開)。", "ok");
      log("pre-log", "步驟2:電流經預充電阻給電容充電,限制突波。", "warn");
      timer = setInterval(() => {
        elapsed += 100;
        cap += (packV - cap) * 0.35; // RC 充電
        if (cap >= packV * 0.95) {
          stop();
          cap = packV;
          setContactor(true, "主正閉合");
          setRelays(true, false, true);
          paint("RUN — 主正閉合、預充斷開");
          log("pre-log", `步驟3:電容已達 ${(packV * 0.95).toFixed(0)} V(95%),閉合主正、斷開預充,進入 RUN。`, "ok");
          return;
        }
        if (elapsed > 1000) {
          stop();
          setContactor(false, "HW TRIP");
          setRelays(false, false, false);
          setSafety(false);
          paint("FAULT — 預充逾時");
          log("pre-log", "預充逾時(>1000ms 仍未到 95%):判定負載側短路,鎖定 FAULT。", "err");
          return;
        }
        paint("預充中 PRECHARGE");
      }, 100);
    });

    $("#pre-short")?.addEventListener("click", () => {
      if (timer) return;
      cap = 0; elapsed = 0;
      setContactor(false, "主負+預充閉合");
      setRelays(true, true, false);
      setSafety(true);
      log("pre-log", "情境:負載側短路。開始預充,電容電壓建立不起來…", "warn");
      timer = setInterval(() => {
        elapsed += 100;
        cap += (packV - cap) * 0.01; // 短路→幾乎充不上
        if (elapsed > 1000) {
          stop();
          setContactor(false, "HW TRIP");
          setRelays(false, false, false);
          setSafety(false);
          paint("FAULT — 預充逾時");
          log("pre-log", `預充逾時:1000ms 內電容僅 ${cap.toFixed(0)} V,直接斷路鎖定,保護元件。`, "err");
          return;
        }
        paint("預充中(電壓不足)");
      }, 100);
    });

    $("#pre-reset")?.addEventListener("click", reset);
    paint("待命 STANDBY");
    setContactor(false);
    setRelays(false, false, false);
    setSafety(true);
  }

  function initLab() {
    initFsm();
    initUds();
    $("#lab-sync")?.addEventListener("click", () => {
      lessonState.cm4V = lessonState.v;
      text("uds-cm4-voltage", hex(lessonState.cm4V));
      text("uds-voltage-value", `${lessonState.cm4V} mV / ${hex(lessonState.cm4V)}`);
      term("uds-term", `>> IPC synced: CM4 voltage = ${hex(lessonState.cm4V)}`, "ok");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "afe") initAfe();
    if (page === "compare") initCompare();
    if (page === "ipc") initIpc();
    if (page === "fsm") initFsm();
    if (page === "precharge") initActuate();
    if (page === "uds") initUds();
    if (page === "faults") initFaults();
    if (page === "lab") initLab();
  });
})();
