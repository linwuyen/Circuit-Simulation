(function (global) {
  "use strict";
  const Store = global.CircuitPowerSystemStateV1;
  const Models = global.CircuitPowerTeachingModelsV2;
  const I = global.CircuitPowerTeachingV2Internal = global.CircuitPowerTeachingV2Internal || {};
  if (!Store || !Models) return;
  const fmt = (v, d) => Number(v).toFixed(d == null ? 2 : d);
  const text = (root, selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
  function render(root) {
    const state = Store.snapshot();
    const activeStage = Number(Store.get("ui.activeStage") || 0);

    const contractGrid = root.querySelector("[data-v2-contract-grid]");
    if (contractGrid) contractGrid.innerHTML = Models.contractRows(state).map(row => `<article class="${row.stages.includes(activeStage)?"is-relevant":""}"><span>${row.label}</span><b>${row.value}</b></article>`).join("");

    const regionCard = root.querySelector("[data-v2-region-card]");
    if (regionCard) {
      const r = Models.buckRegion(state);
      const load = regionCard.querySelector("[data-v2-load]"); if (load) load.value = state.plant.load;
      text(regionCard, "[data-v2-load-readout]", `${fmt(state.plant.load,1)} Ω`);
      text(regionCard, "[data-v2-region]", r.region);
      text(regionCard, "[data-v2-region-iavg]", `${fmt(r.iavg)} A`);
      text(regionCard, "[data-v2-region-boundary]", `${fmt(r.boundaryA)} A`);
      text(regionCard, "[data-v2-region-ripple]", `${fmt(r.deltaI)} App`);
      text(regionCard, "[data-v2-region-valid]", r.idealRuleValid ? "Vout≈D·Vin VALID" : "MODEL CHANGE REQUIRED");
      text(regionCard, "[data-v2-region-reason]", r.reason);
      regionCard.querySelectorAll("[data-region]").forEach(n => n.classList.toggle("is-active", n.dataset.region === r.region));
    }

    const resolution = root.querySelector("[data-v2-resolution]");
    if (resolution) {
      const b = Models.resolutionBudget(state);
      const input = resolution.querySelector("[data-v2-tbprd]"); if (input) input.value = state.actuator.tbprd;
      text(resolution, "[data-v2-tbprd-readout]", `${state.actuator.tbprd} counts`);
      text(resolution, "[data-v2-adc-lsb]", `${fmt(b.adcLsbOutputV * 1000,2)} mV`);
      text(resolution, "[data-v2-pwm-lsb]", `${fmt(b.dutyLsbPct,3)}%`);
      text(resolution, "[data-v2-pwm-vstep]", `${fmt(b.pwmEquivalentOutputV * 1000,2)} mV`);
      text(resolution, "[data-v2-resolution-floor]", `≈ ${fmt(b.effectiveFloorV * 1000,2)} mV`);
    }

    const sampling = root.querySelector("[data-v2-sampling]");
    if (sampling) {
      const s = Models.sampleInductorCurrent(state);
      const input = sampling.querySelector("[data-v2-jitter]"); if (input) input.value = state.sampling.jitterNs;
      const syncInput = sampling.querySelector("[data-v2-sync]"); if (syncInput) syncInput.checked = state.sampling.synchronous !== false;
      text(sampling, "[data-v2-jitter-readout]", `${Math.round(state.sampling.jitterNs)} ns`);
      const aliasSource = s.aliasRateSource === "EXPLICIT_SAMPLE_RATE" ? "explicit fsample" : "offset-derived fsample";
      text(sampling, "[data-v2-alias-readout]", s.synchronous ? "PHASE LOCKED" : `ALIAS BEAT = ${fmt(s.aliasBeatHz,0)} Hz · fsample ${fmt(s.sampleHz/1000,3)} kHz · ${aliasSource}`);
      text(sampling, "[data-v2-sample-phase]", `${fmt(s.phasePct,1)}% of Ts`);
      text(sampling, "[data-v2-sampled-il]", `${fmt(s.sampledA,3)} A`);
      text(sampling, "[data-v2-average-il]", `${fmt(s.averageA,3)} A`);
      text(sampling, "[data-v2-ripple-error]", `${s.rippleErrorA>=0?"+":""}${fmt(s.rippleErrorA,3)} A`);
      text(sampling, "[data-v2-jitter-band]", `±${fmt(s.jitterBandA,4)} A`);
      text(sampling, "[data-v2-settling]", `${s.modelValid?"CCM sampling model valid":"MODEL WARNING · "+s.region+"：先回 Stage 1 重新選 operating model。"} Acquisition ${fmt(state.timing.acquisitionUs,2)} µs / source τ ${fmt(state.sampling.sourceTauUs,2)} µs → residual settling fraction ≈ ${fmt(s.settlingResidual * 100,1)}%.`);
    }

    const control = root.querySelector("[data-v2-product-control]");
    if (control) {
      const point = Models.ccCvPoint(state, state.plant.load);
      const awNow = Models.simulateWindup(state, !!state.control.antiWindup);
      const awOther = Models.simulateWindup(state, !state.control.antiWindup);
      const ffNow = Models.simulateFeedForward(state, !!state.control.feedForward);
      const ffOther = Models.simulateFeedForward(state, !state.control.feedForward);
      const handoff = Models.bumplessHandoff(state, !!state.control.bumpless);
      const loadInput = control.querySelector("[data-v2-cccv-load]"); if (loadInput) loadInput.value = state.plant.load;
      const limitInput = control.querySelector("[data-v2-current-limit]"); if (limitInput) limitInput.value = state.limits.currentLimitA;
      const awInput = control.querySelector("[data-v2-aw]"); if (awInput) awInput.checked = !!state.control.antiWindup;
      const ffInput = control.querySelector("[data-v2-ff]"); if (ffInput) ffInput.checked = !!state.control.feedForward;
      const bumplessInput = control.querySelector("[data-v2-bumpless]"); if (bumplessInput) bumplessInput.checked = !!state.control.bumpless;
      text(control, "[data-v2-cccv-load-readout]", `${fmt(state.plant.load,2)} Ω`);
      text(control, "[data-v2-current-limit-readout]", `${fmt(state.limits.currentLimitA,1)} A`);
      text(control, "[data-v2-control-mode]", point.mode);
      text(control, "[data-v2-cccv-mode]", `${point.mode} · ${point.limiter}`);
      text(control, "[data-v2-cccv-v]", `${fmt(point.targetV)} V`);
      text(control, "[data-v2-cccv-i]", `${fmt(point.currentA)} A`);
      text(control, "[data-v2-cccv-duty]", `${fmt(point.duty * 100,1)}%`);
      text(control, "[data-v2-aw-result]", `${state.control.antiWindup?"ON":"OFF"} · overshoot ${fmt(awNow.overshootPct,1)}%`);
      text(control, "[data-v2-aw-compare]", `comparison: ${state.control.antiWindup?"OFF":"ON"} → ${fmt(awOther.overshootPct,1)}%`);
      text(control, "[data-v2-ff-result]", `${state.control.feedForward?"ON":"OFF"} · droop ${fmt(ffNow.droopV,2)} V`);
      text(control, "[data-v2-ff-compare]", `comparison: ${state.control.feedForward?"OFF":"ON"} → ${fmt(ffOther.droopV,2)} V`);
      text(control, "[data-v2-bumpless-result]", `${state.control.bumpless?"PRELOADED":"COLD"} · command jump ${fmt(handoff.commandJumpPct,2)}% duty`);
    }

    const bandwidth = root.querySelector("[data-v2-bandwidth]");
    if (bandwidth) {
      const b = Models.loopBandwidthBudget(state);
      text(bandwidth, "[data-v2-separation]", `${fmt(b.separation,0)}× separation`);
      text(bandwidth, "[data-v2-inner-bw]", `${fmt(b.innerHz/1000,2)} kHz`);
      text(bandwidth, "[data-v2-outer-bw]", `${fmt(b.outerHz/1000,2)} kHz`);
      text(bandwidth, "[data-v2-loop-delay]", `${fmt(b.actuationUs,2)} µs`);
      text(bandwidth, "[data-v2-inner-phase]", `−${fmt(b.phaseLagInnerDeg,1)}°`);
    }

    const plant = root.querySelector("[data-v2-plant-regions]");
    if (plant) {
      const id = Store.get("ui.topologyPreview") || "buck";
      const p = Models.plantRegion(id);
      text(plant, "[data-v2-plant-name]", String(id).toUpperCase());
      text(plant, "[data-v2-plant-axis]", p.axis);
      text(plant, "[data-v2-plant-region-list]", p.regions.join(" · "));
      text(plant, "[data-v2-plant-boundary]", p.boundary);
    }

    const startup = root.querySelector("[data-v2-startup]");
    if (startup) {
      const view = Models.startupView(state.startup);
      text(startup, "[data-v2-startup-state]", view.state);
      text(startup, "[data-v2-startup-pwm]", view.pwmAllowed ? "ALLOW" : "BLOCKED");
      text(startup, "[data-v2-startup-guard]", state.startup.faultInput ? "FAULT INPUT" : "qualification gates");
      startup.querySelectorAll("[data-v2-qualifier]").forEach(box => { box.checked = !!state.startup[box.dataset.v2Qualifier]; });
      startup.classList.toggle("is-armed", view.pwmAllowed);
    }

    const obs = root.querySelector("[data-v2-observability]");
    if (obs) {
      const table = obs.querySelector("[data-v2-ownership-table]");
      if (table) {
        table.innerHTML = Object.entries(state.data).map(([name, record]) => {
          const fresh = Models.dataFreshness(record, record.maxAgeMs);
          return `<article class="${fresh.fresh?"":"is-stale"}"><span>${name.toUpperCase()}</span><b>${record.owner}</b><small>${record.writer} → ${record.reader}</small><em>${fmt(fresh.ageMs,3)} ms · v${record.version} · ${fresh.label}</em></article>`;
        }).join("");
      }
      const selected = state.instrumentation.selected || [];
      obs.querySelectorAll("[data-v2-instrument]").forEach(box => { box.checked = selected.includes(box.dataset.v2Instrument); });
      const score = Models.instrumentationScore(selected);
      text(obs, "[data-v2-instrument-score]", `${score.slots}/${state.instrumentation.slots} slots · ${score.score}% coverage`);
      const status = obs.querySelector("[data-v2-instrument-status]");
      if (status && !status.textContent) status.textContent = score.missing.length ? `Missing: ${score.missing.join(", ")}` : "All diagnostic dimensions covered.";
    }
  }

  I.render = render;
})(window);
