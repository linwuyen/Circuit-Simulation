(function (global) {
  "use strict";
  const Store = global.CircuitPowerSystemStateV1;
  const Models = global.CircuitPowerTeachingModelsV2;
  const I = global.CircuitPowerTeachingV2Internal = global.CircuitPowerTeachingV2Internal || {};
  if (!Store || !Models) return;
  function bind(root) {
    const load = root.querySelector("[data-v2-load]");
    const tbprd = root.querySelector("[data-v2-tbprd]");
    const jitter = root.querySelector("[data-v2-jitter]");
    const sync = root.querySelector("[data-v2-sync]");
    const cccvLoad = root.querySelector("[data-v2-cccv-load]");
    const currentLimit = root.querySelector("[data-v2-current-limit]");
    const aw = root.querySelector("[data-v2-aw]");
    const ff = root.querySelector("[data-v2-ff]");
    const bumpless = root.querySelector("[data-v2-bumpless]");
    if (load) load.addEventListener("input", () => { Store.set("plant.load", Number(load.value), { source:"teaching-v2-region" }); Store.set("plant.duty", Store.get("plant.duty"), { source:"teaching-v2-region-refresh" }); });
    if (tbprd) tbprd.addEventListener("input", () => Store.set("actuator.tbprd", Number(tbprd.value), { source:"teaching-v2-resolution" }));
    if (jitter) jitter.addEventListener("input", () => Store.set("sampling.jitterNs", Number(jitter.value), { source:"teaching-v2-sampling" }));
    if (sync) sync.addEventListener("change", () => Store.set("sampling.synchronous", sync.checked, { source:"teaching-v2-sync" }));
    if (cccvLoad) cccvLoad.addEventListener("input", () => { Store.set("plant.load", Number(cccvLoad.value), { source:"teaching-v2-cccv" }); Store.set("plant.duty", Store.get("plant.duty"), { source:"teaching-v2-cccv-refresh" }); });
    if (currentLimit) currentLimit.addEventListener("input", () => Store.set("limits.currentLimitA", Number(currentLimit.value), { source:"teaching-v2-current-limit" }));
    if (aw) aw.addEventListener("change", () => Store.set("control.antiWindup", aw.checked, { source:"teaching-v2-aw" }));
    if (ff) ff.addEventListener("change", () => Store.set("control.feedForward", ff.checked, { source:"teaching-v2-ff" }));
    if (bumpless) bumpless.addEventListener("change", () => Store.set("control.bumpless", bumpless.checked, { source:"teaching-v2-bumpless" }));

    root.querySelectorAll("[data-v2-qualifier]").forEach(box => box.addEventListener("change", () => Store.set(`startup.${box.dataset.v2Qualifier}`, box.checked, { source:"teaching-v2-startup" })));
    const startupStatus = root.querySelector("[data-v2-startup-status]");
    function transition(event) {
      const result = Models.startupTransition(Store.get("startup"), event);
      Store.set("startup", result.next, { source:`teaching-v2-startup-${event}` });
      if (startupStatus) startupStatus.textContent = result.blocked ? `BLOCKED · ${result.blocked}` : `${event} → ${result.next.state}`;
    }
    const power = root.querySelector("[data-v2-startup-power]"); if (power) power.addEventListener("click", () => transition("power_on"));
    const advance = root.querySelector("[data-v2-startup-advance]"); if (advance) advance.addEventListener("click", () => transition("advance"));
    const fault = root.querySelector("[data-v2-startup-fault]"); if (fault) fault.addEventListener("click", () => transition("fault"));
    const safe = root.querySelector("[data-v2-startup-safe]"); if (safe) safe.addEventListener("click", () => { Store.set("startup.faultInput", false, { source:"teaching-v2-startup-safe" }); if (startupStatus) startupStatus.textContent = "Fault input cleared; latch/state still requires qualified clear."; });
    const clear = root.querySelector("[data-v2-startup-clear]"); if (clear) clear.addEventListener("click", () => transition("clear_fault"));

    const ageHost = root.querySelector("[data-v2-age-host]");
    if (ageHost) ageHost.addEventListener("click", () => Store.set("data.vref.ageMs", Number(Store.get("data.vref.ageMs") || 0) + 250, { source:"teaching-v2-age" }));
    const refreshHost = root.querySelector("[data-v2-refresh-host]");
    if (refreshHost) refreshHost.addEventListener("click", () => {
      Store.set("data.vref.ageMs", 0, { source:"teaching-v2-refresh" });
      Store.set("data.vref.version", Number(Store.get("data.vref.version") || 0) + 1, { source:"teaching-v2-refresh" });
    });

    const instrumentStatus = root.querySelector("[data-v2-instrument-status]");
    root.querySelectorAll("[data-v2-instrument]").forEach(box => box.addEventListener("change", () => {
      const selected = Array.from(root.querySelectorAll("[data-v2-instrument]:checked")).map(n => n.dataset.v2Instrument);
      const slots = Number(Store.get("instrumentation.slots") || 8);
      if (selected.length > slots) {
        box.checked = false;
        if (instrumentStatus) instrumentStatus.textContent = `Slot budget full: only ${slots} signals can be retained.`;
        return;
      }
      Store.set("instrumentation.selected", selected, { source:"teaching-v2-instrumentation" });
      if (instrumentStatus) instrumentStatus.textContent = `${selected.length}/${slots} slots used.`;
    }));
  }

  I.bind = bind;
})(window);
