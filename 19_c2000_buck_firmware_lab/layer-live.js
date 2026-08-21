(() => {
  "use strict";
  const Models = window.CircuitGuidedLayerModelsV1;
  if (!Models) return;
  const $ = selector => document.querySelector(selector);
  const number = (selector, fallback = 0) => Number($(selector)?.value ?? fallback);

  function lineSvg(points, xKey, yKey, label) {
    if (!points.length) return "";
    const width = 720, height = 250, left = 58, right = 20, top = 24, bottom = 42;
    const xs = points.map(point => point[xKey]);
    const ys = points.map(point => point[yKey]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
    const pad = Math.max(0.01, (yMaxRaw - yMinRaw) * 0.12);
    const yMin = yMinRaw - pad, yMax = yMaxRaw + pad;
    const x = value => left + ((value - xMin) / Math.max(1e-12, xMax - xMin)) * (width - left - right);
    const y = value => height - bottom - ((value - yMin) / Math.max(1e-12, yMax - yMin)) * (height - top - bottom);
    const path = points.map((point, index) => `${index ? "L" : "M"}${x(point[xKey]).toFixed(2)},${y(point[yKey]).toFixed(2)}`).join(" ");
    return `<line class="axis" x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}"></line><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${height-bottom}"></line><path class="current-wave" d="${path}"></path><text x="${left}" y="${height-10}">0</text><text x="${width-100}" y="${height-10}">${(xMax*1e3).toFixed(1)} ms</text><text x="8" y="${top+10}">${label}</text>`;
  }

  function renderSensing() {
    const result = Models.sensingSample({
      physicalV: 12,
      rippleVpp: number('#senseRipple', 0.2),
      phaseDeg: number('#sensePhase', 0),
      divider: number('#senseDivider', 0.2)
    });
    $('#sensePhaseOut').textContent = `${number('#sensePhase').toFixed(0)}°`;
    $('#sensePhysical').textContent = `${result.sampledPhysicalV.toFixed(4)} V`;
    $('#senseAdcV').textContent = `${result.adcInputV.toFixed(4)} V`;
    $('#senseCode').textContent = `${result.code}/${result.maxCode}`;
    $('#senseRecon').textContent = `${result.reconstructedV.toFixed(4)} V`;
    $('#senseError').textContent = `${(result.quantizationErrorV*1000).toFixed(2)} mV`;
    $('#senseBoundary').textContent = result.clipped ? 'ADC CLIPPED：此 scale 已失真，不能把 controller 調參當修復。' : 'Scale chain 未飽和；此誤差只包含 sample phase + ADC quantization。';
  }

  function renderFeedback() {
    const result = Models.feedbackResponse({ initialV: number('#feedbackInitial', 8), referenceV: number('#feedbackRef', 12), kp: number('#feedbackKp', 0.3), ki: number('#feedbackKi', 100) });
    $('#feedbackPlot').innerHTML = lineSvg(result.points, 'tS', 'voutV', 'Vout');
    $('#feedbackFinal').textContent = `${result.finalV.toFixed(3)} V`;
    $('#feedbackError').textContent = `${result.errorV.toFixed(3)} V`;
    $('#feedbackDuty').textContent = `${(result.finalDuty*100).toFixed(2)} %`;
    $('#feedbackBoundary').textContent = 'Averaged CCM teaching plant：保留 L/C/load dynamics 與離散 PI cadence；不含 switching ripple、dead-time 與 real sensor delay。';
  }

  function renderDynamics() {
    const result = Models.dynamicsAt({ loadOhm: number('#dynLoad', 6), frequencyHz: number('#dynFc', 10)*1000, delayS: number('#dynDelay', 10)*1e-6 });
    $('#dynRes').textContent = `${result.resonantHz.toFixed(1)} Hz`;
    $('#dynMag').textContent = `${result.magnitudeDb.toFixed(2)} dB`;
    $('#dynPlantPhase').textContent = `${result.plantPhaseDeg.toFixed(1)}°`;
    $('#dynDelayPhase').textContent = `${result.delayPhaseDeg.toFixed(1)}°`;
    $('#dynTotalPhase').textContent = `${result.totalPhaseDeg.toFixed(1)}°`;
    $('#dynBoundary').textContent = 'Gvd(s)=Vin/(LCs²+(L/R)s+1) + pure delay。這是 plant/delay lens，不把 controller phase 或完整 phase margin 混進來。';
  }

  function renderSafety() {
    const result = Models.safetyLatency({ comparatorNs:number('#safeCmp',80), xbarNs:number('#safeXbar',20), tripZoneNs:number('#safeTz',30), gateNs:number('#safeGate',100), adcUs:number('#safeAdc',1.2), isrUs:number('#safeIsr',0.3), computeUs:number('#safeCompute',4) });
    $('#safeHardware').textContent = `${result.hardwareNs.toFixed(0)} ns`;
    $('#safeSoftware').textContent = `${result.softwareUs.toFixed(2)} µs`;
    $('#safeSpeedup').textContent = `${result.speedup.toFixed(1)}×`;
    const hwX = Math.min(650, 70 + result.hardwareUs / Math.max(result.softwareUs, 0.001) * 560);
    $('#safetyPlot').innerHTML = `<line class="axis" x1="60" y1="130" x2="680" y2="130"></line><line class="timing-commit" x1="${hwX}" y1="70" x2="${hwX}" y2="185"></line><line class="timing-load" x1="650" y1="70" x2="650" y2="185"></line><text x="60" y="55">FAULT</text><text x="${Math.min(hwX+8,540)}" y="90">hardware veto ${result.hardwareUs.toFixed(3)} µs</text><text x="470" y="210">ISR path ${result.softwareUs.toFixed(2)} µs</text>`;
    $('#safeBoundary').textContent = '數值是 parameterized latency budget，不是假裝 datasheet/實板測量；BOARD claim 仍必須由 scope capture 替換。';
  }

  function renderProduction() {
    const result = Models.productionFreshness({ timeoutTicks: number('#prodTimeout',500), missedTicks: number('#prodMissed',0), enable: $('#prodEnable').checked });
    $('#prodAge').textContent = `${result.commandAgeTicks} ticks / ${result.commandAgeMs.toFixed(2)} ms`;
    $('#prodFaultAt').textContent = `${result.faultTick} ticks / ${result.faultAfterMs.toFixed(2)} ms`;
    $('#prodState').textContent = result.state;
    $('#prodState').dataset.risk = result.faulted ? '1' : '0';
    $('#prodBoundary').textContent = result.faulted ? 'FAIL-CLOSED：enable authority 存在且 freshness age 已嚴格大於 timeout budget。' : '尚未 timeout；disabled authority 會保持 OFF，而不是靠假 heartbeat 維持正常。';
  }

  function renderTransfer() {
    try {
      const result = Models.boostTransfer({ vin:number('#transferVin',24), vout:number('#transferVout',48), L:number('#transferL',200)*1e-6, loadOhm:number('#transferLoad',12) });
      $('#transferDuty').textContent = `${(result.duty*100).toFixed(2)} %`;
      $('#transferRhp').textContent = `${(result.rhpZeroHz/1000).toFixed(2)} kHz`;
      $('#transferFcMax').textContent = `${(result.recommendedCrossoverMaxHz/1000).toFixed(2)} kHz`;
      $('#transferBoundary').textContent = 'Boost CCM 出現 Buck 沒有的 RHP zero；同一 feedback grammar 可遷移，但 plant constraint 不能照抄。';
    } catch (error) {
      $('#transferBoundary').textContent = `輸入超出 Boost CCM teaching boundary：${error.message}`;
    }
  }

  ['#senseRipple','#sensePhase','#senseDivider'].forEach(id => $(id)?.addEventListener('input', renderSensing));
  ['#feedbackInitial','#feedbackRef','#feedbackKp','#feedbackKi'].forEach(id => $(id)?.addEventListener('input', renderFeedback));
  ['#dynLoad','#dynFc','#dynDelay'].forEach(id => $(id)?.addEventListener('input', renderDynamics));
  ['#safeCmp','#safeXbar','#safeTz','#safeGate','#safeAdc','#safeIsr','#safeCompute'].forEach(id => $(id)?.addEventListener('input', renderSafety));
  ['#prodTimeout','#prodMissed','#prodEnable'].forEach(id => $(id)?.addEventListener('input', renderProduction));
  ['#transferVin','#transferVout','#transferL','#transferLoad'].forEach(id => $(id)?.addEventListener('input', renderTransfer));

  renderSensing(); renderFeedback(); renderDynamics(); renderSafety(); renderProduction(); renderTransfer();
})();
