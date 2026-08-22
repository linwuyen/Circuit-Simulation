(() => {
  "use strict";
  const Models = window.CircuitGuidedPowerModelsV1;
  const Hil = window.C2000BuckHil;
  if (!Models || !Hil) return;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const us = seconds => seconds * 1e6;

  function setMode(mode) {
    document.body.dataset.activeLearningMode = mode;
    $$('[data-learning-mode]').forEach(button => button.classList.toggle('selected', button.dataset.learningMode === mode));
    $$('[data-show-modes]').forEach(section => {
      const modes = section.dataset.showModes.split(/\s+/);
      section.classList.toggle('mode-hidden', !modes.includes(mode));
    });
    document.dispatchEvent(new CustomEvent('buck:mode-change', { detail: { mode } }));
  }

  $$('[data-learning-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.learningMode)));

  let physicsPrediction = null;
  let timingPrediction = null;
  let cycleAnimation = null;

  function physicsInputs() {
    return {
      vin: Number($('#physicsVin').value),
      vout: Number($('#physicsVout').value),
      inductanceH: Number($('#inductanceRange').value) * 1e-6,
      switchingHz: Number($('#physicsFsw').value) * 1e3,
      averageCurrentA: 4
    };
  }

  function renderBuckSvg(model, markerRatio = null) {
    const svg = $('#buckWaveform');
    const x0 = 64, x1 = 688;
    const swHighY = 42, swLowY = 92;
    const currentTopY = 164, currentBottomY = 264;
    const x = t => x0 + (t / model.periodS) * (x1 - x0);
    const iPad = Math.max(0.15, model.rippleA * 0.35);
    const iHi = model.currentMaxA + iPad;
    const iLo = model.currentMinA - iPad;
    const yI = current => currentBottomY - ((current - iLo) / (iHi - iLo)) * (currentBottomY - currentTopY);
    const currentPath = model.points.map((point, index) => `${index ? 'L' : 'M'}${x(point.tS).toFixed(2)},${yI(point.iLA).toFixed(2)}`).join(' ');
    const tonX = x(model.onTimeS);
    let marker = '';
    if (markerRatio != null) {
      const t = model.periodS * markerRatio;
      const iL = t <= model.onTimeS
        ? model.currentMinA + model.slopeOnAps * t
        : model.currentMaxA + model.slopeOffAps * (t - model.onTimeS);
      marker = `<circle class="play-marker" data-play-marker cx="${x(t).toFixed(2)}" cy="${yI(iL).toFixed(2)}" r="5"></circle><text x="${x0}" y="292" data-play-time>actual t = ${us(t).toFixed(2)} µs (visual slow motion)</text>`;
    }
    svg.innerHTML = `
      <line class="axis" x1="${x0}" y1="112" x2="${x1}" y2="112"></line>
      <line class="axis" x1="${x0}" y1="274" x2="${x1}" y2="274"></line>
      <text x="10" y="48">SW node</text><text x="10" y="88">${model.vin.toFixed(1)}→0 V</text>
      <text x="10" y="182">iL</text><text x="10" y="200">A</text>
      <path class="switch-wave" d="M${x0},${swHighY} L${tonX.toFixed(2)},${swHighY} L${tonX.toFixed(2)},${swLowY} L${x1},${swLowY}"></path>
      <path class="current-wave" d="${currentPath}"></path>
      <line class="timing-load" x1="${tonX.toFixed(2)}" y1="26" x2="${tonX.toFixed(2)}" y2="274"></line>
      <text x="${Math.max(x0, tonX - 20).toFixed(2)}" y="20">Ton ${us(model.onTimeS).toFixed(2)} µs</text>
      <text x="${x0}" y="126">ON: vL = Vin − Vout → iL rises</text>
      <text x="${Math.min(x1 - 220, tonX + 12).toFixed(2)}" y="126">OFF: vL = −Vout → iL falls</text>
      <text x="${x0}" y="286">0 µs</text><text x="${x1 - 70}" y="286">${us(model.periodS).toFixed(2)} µs</text>
      ${marker}`;
  }

  function renderPhysics() {
    $('#inductanceValue').textContent = `${Number($('#inductanceRange').value).toFixed(0)} µH`;
    try {
      const model = Models.idealBuckCycle(physicsInputs());
      renderBuckSvg(model);
      $('#physicsDuty').textContent = `${(model.duty * 100).toFixed(2)} %`;
      $('#physicsTon').textContent = `${us(model.onTimeS).toFixed(3)} µs`;
      $('#physicsToff').textContent = `${us(model.offTimeS).toFixed(3)} µs`;
      $('#physicsRipple').textContent = `${model.rippleA.toFixed(3)} A`;
      $('#physicsSlopeOn').textContent = `${(model.slopeOnAps / 1e6).toFixed(3)} A/µs`;
      $('#physicsResidual').textContent = `${model.voltSecondResidualVs.toExponential(2)} V·s`;
      $('#physicsBoundary').textContent = model.ccm
        ? `Ideal CCM model valid for this teaching vector: iL,min=${model.currentMinA.toFixed(3)} A > 0. It intentionally excludes DCR, switch loss, dead time, ESR and closed-loop transients.`
        : `CCM assumption broke: iL,min=${model.currentMinA.toFixed(3)} A. Stop trusting this triangular CCM waveform and move to a DCM-capable model.`;
      return model;
    } catch (error) {
      $('#physicsBoundary').textContent = `模型輸入無效：${error.message}`;
      $('#buckWaveform').innerHTML = '<text x="20" y="40">Invalid model input — keep 0 &lt; Vout &lt; Vin.</text>';
      return null;
    }
  }

  $$('[data-physics-predict]').forEach(button => button.addEventListener('click', () => {
    physicsPrediction = button.dataset.physicsPredict;
    $$('[data-physics-predict]').forEach(item => item.classList.toggle('selected', item === button));
    const pass = physicsPrediction === 'lower';
    const status = $('[data-physics-predict-status]');
    status.dataset.result = pass ? 'pass' : 'fail';
    status.textContent = pass
      ? '✓ 正確。只改 L 時，同樣 vL 會讓 di/dt 與 ΔIL 一起縮小。假設：ideal CCM、Vin/Vout/fsw 固定。真板先量：switch node 與 iL ripple，再對照 L 與 switching period。'
      : '方向先修正：同樣 vL 下，L 變大會讓 di/dt 變小。假設仍是 ideal CCM。真板先量：switch node 與 iL ripple；不要先用 controller 參數解釋 switching physics。';
    $('[data-physics-control]').disabled = false;
    $('[data-play-cycle]').disabled = false;
    renderPhysics();
  }));

  ['#inductanceRange', '#physicsVin', '#physicsVout', '#physicsFsw'].forEach(selector => $(selector).addEventListener('input', renderPhysics));

  $('[data-play-cycle]').addEventListener('click', () => {
    const model = renderPhysics();
    if (!model) return;
    if (cycleAnimation) cancelAnimationFrame(cycleAnimation);
    const started = performance.now();
    const durationMs = 1600;
    const frame = now => {
      const ratio = Math.min(1, (now - started) / durationMs);
      renderBuckSvg(model, ratio);
      if (ratio < 1) cycleAnimation = requestAnimationFrame(frame);
    };
    cycleAnimation = requestAnimationFrame(frame);
  });

  function timingInputs() {
    return {
      switchingHz: Number($('#timingFsw').value) * 1e3,
      adcS: Number($('#timingAdc').value) * 1e-6,
      isrEntryS: Number($('#timingIsr').value) * 1e-6,
      computeS: Number($('#computeRange').value) * 1e-6,
      crossoverHz: Number($('#timingFc').value) * 1e3
    };
  }

  function renderTimingSvg(model) {
    const svg = $('#timingPlot');
    const x0 = 62, x1 = 690, y = 126;
    const horizon = Math.max(model.commitS, model.periodS * 2) * 1.08;
    const x = t => x0 + (t / horizon) * (x1 - x0);
    const event = (t, label, klass, dy) => `<line class="${klass}" x1="${x(t).toFixed(2)}" y1="58" x2="${x(t).toFixed(2)}" y2="188"></line><text x="${Math.min(x1 - 120, x(t) + 5).toFixed(2)}" y="${dy}">${label}</text>`;
    const loadLines = [];
    for (let n = 1; n * model.periodS <= horizon; n += 1) loadLines.push(event(n * model.periodS, `ZERO ${n}`, 'timing-load', 54 + (n % 2) * 16));
    svg.innerHTML = `
      <line class="axis" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"></line>
      <text x="8" y="130">time</text>
      ${event(0, 'SOCA', 'timing-event', 42)}
      ${event(model.adcS, 'ADC ready', 'timing-event', 210)}
      ${event(model.adcS + model.isrEntryS, 'ISR', 'timing-event', 226)}
      ${event(model.computeDoneS, 'shadow write', 'timing-event', 242)}
      ${loadLines.join('')}
      ${event(model.commitS, 'new duty ACTIVE', 'timing-commit', 104)}
      <text x="${x0}" y="252">0 µs</text><text x="${x1 - 82}" y="252">${us(horizon).toFixed(1)} µs</text>`;
  }

  function renderTiming() {
    $('#computeValue').textContent = `${Number($('#computeRange').value).toFixed(1)} µs`;
    try {
      const model = Models.sampleToActuate(timingInputs());
      renderTimingSvg(model);
      $('#timingPeriod').textContent = `${us(model.periodS).toFixed(2)} µs`;
      $('#timingDone').textContent = `${us(model.computeDoneS).toFixed(2)} µs`;
      $('#timingCommit').textContent = `${us(model.commitS).toFixed(2)} µs`;
      $('#timingMiss').textContent = String(model.missedLoadEvents);
      $('#timingSlack').textContent = `${model.firstDeadlineSlackS >= 0 ? '+' : ''}${us(model.firstDeadlineSlackS).toFixed(2)} µs`;
      $('#timingPhase').textContent = `${model.timingPhaseDeg.toFixed(1)}°`;
      $('#timingBoundary').textContent = model.firstLoadMet
        ? `Shadow write finishes strictly before the first ZERO, so the new compare becomes active at ${us(model.commitS).toFixed(2)} µs. The ${model.timingPhaseDeg.toFixed(1)}° number is pure sample-to-actuate delay contribution only — not total phase margin.`
        : `MISS: shadow write completes at ${us(model.computeDoneS).toFixed(2)} µs, after the first ${us(model.periodS).toFixed(2)} µs ZERO. Hardware cannot time-travel; new duty waits until ${us(model.commitS).toFixed(2)} µs. Timing-only phase contribution becomes ${model.timingPhaseDeg.toFixed(1)}°.`;
      return model;
    } catch (error) {
      $('#timingBoundary').textContent = `模型輸入無效：${error.message}`;
      return null;
    }
  }

  $$('[data-timing-predict]').forEach(button => button.addEventListener('click', () => {
    timingPrediction = button.dataset.timingPredict;
    $$('[data-timing-predict]').forEach(item => item.classList.toggle('selected', item === button));
    const pass = timingPrediction === 'next';
    const status = $('[data-timing-predict-status]');
    status.dataset.result = pass ? 'pass' : 'fail';
    status.textContent = pass
      ? '✓ 正確。9.0 µs compute 使 write 在 10.5 µs 完成，已錯過 10 µs ZERO。假設：SOCA@ZERO、CMPA shadow load@ZERO。真板先量：SOCA/EOC、ISR entry/exit、shadow write marker 與 PWM active edge。'
      : '方向先修正：關鍵不是「CPU 算完」，而是 shadow write 是否嚴格早於 load event。假設：SOCA@ZERO、shadow load@ZERO。真板先量完整 sample→actuate timeline，再決定是否要動 PI 或 fsw。';
    $('[data-timing-control]').disabled = false;
    $('[data-timing-fault]').disabled = false;
    $('[data-timing-transfer]').disabled = false;
    renderTiming();
  }));

  ['#computeRange', '#timingFsw', '#timingFc', '#timingAdc', '#timingIsr'].forEach(selector => $(selector).addEventListener('input', renderTiming));
  $('[data-timing-fault]').addEventListener('click', () => { $('#timingFsw').value = '100'; $('#computeRange').value = '9'; renderTiming(); });
  $('[data-timing-transfer]').addEventListener('click', () => { $('#timingFsw').value = '200'; $('#computeRange').value = '4'; renderTiming(); });

  const scenarioButtons = $$('[data-scenario]');
  const faultNames = [
    [Hil.FAULT.OCP, 'OCP'],
    [Hil.FAULT.OVP, 'OVP'],
    [Hil.FAULT.SENSOR, 'SENSOR'],
    [Hil.FAULT.COMMAND_TIMEOUT, 'COMMAND_TIMEOUT']
  ];

  function renderHil(result) {
    $('#hilScenario').textContent = result.name;
    $('#hilPass').textContent = result.pass ? 'PASS' : 'FAIL';
    $('#hilPass').dataset.pass = result.pass ? '1' : '0';
    $('#hilVout').textContent = `${result.vout.toFixed(2)} V`;
    $('#hilDuty').textContent = `${(result.duty * 100).toFixed(1)} %`;
    $('#hilState').textContent = result.state;
    $('#hilLatency').textContent = result.tripLatencyTicks == null ? '—' : `${result.tripLatencyTicks} tick`;
    const active = faultNames.filter(([mask]) => result.faultLatch & mask).map(([, name]) => name);
    $('#hilFault').textContent = active.length ? active.join(' | ') : 'NONE';
    $('#hilTrace').innerHTML = result.trace.slice(-12).map(row => `
      <tr><td>${row.tick}</td><td>${row.vout.toFixed(2)}</td><td>${row.iL.toFixed(2)}</td><td>${(row.duty * 100).toFixed(1)}%</td><td>${row.state}</td></tr>`).join('');
  }

  scenarioButtons.forEach(button => button.addEventListener('click', () => {
    scenarioButtons.forEach(item => item.classList.toggle('selected', item === button));
    renderHil(Hil.runScenario(button.dataset.scenario));
  }));

  const evidence = Hil.boardEvidenceContract();
  $('#boardEvidence').innerHTML = evidence.map(item => `
    <label class="evidence-slot"><input type="checkbox" data-evidence="${item.id}"><span><b>${item.signal}</b><small>${item.criterion}</small></span></label>`).join('');
  $('#boardEvidence').addEventListener('change', () => {
    const checked = $$('[data-evidence]:checked').length;
    $('#evidenceCount').textContent = `${checked}/${evidence.length}`;
  });

  const clearContract = Hil.runFaultClearScenario();
  $('#faultClearContract').textContent = clearContract.unsafeClearRejected && clearContract.heldLevelRejected && clearContract.freshClearAccepted
    ? 'PASS · clear-fault 是一次性 token：不安全時拒絕、held level 不重播、release → assert 的新 token 才能 re-arm。'
    : 'FAIL · fault-clear one-shot contract 未閉合。';

  setMode('guided');
  renderPhysics();
  renderTiming();
  renderHil(Hil.runScenario('nominal'));
})();
