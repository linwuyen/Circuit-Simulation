(function (global) {
  "use strict";

  const Learning = global.CircuitLearning;
  if (!Learning || typeof Learning.renderHome !== "function") return;
  const previousRenderHome = Learning.renderHome;

  function fmt(value, digits) {
    return Number(value).toFixed(digits == null ? 1 : digits);
  }

  function boostResponsePath() {
    const values = [];
    const count = 140;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1) * 6;
      values.push(1 - Math.exp(-t) - 1.40 * t * Math.exp(-2.8 * t));
    }
    return values.map((value, index) => {
      const x = index / (count - 1) * 520;
      const y = 160 - (value + 0.2) / 1.6 * 160;
      return `${index ? "L" : "M"} ${fmt(x, 2)} ${fmt(Math.max(0, Math.min(160, y)), 2)}`;
    }).join(" ");
  }

  function mount(root) {
    if (!root || root.dataset.powerSystemInvariants === "1") return;
    root.dataset.powerSystemInvariants = "1";

    const protection = root.querySelector('[data-power-stage="6"]');
    if (protection) {
      const inject = protection.querySelector("[data-protect-inject]");
      const clear = protection.querySelector("[data-protect-clear]");
      const safeCurrent = protection.querySelector("[data-protect-safe-current]");
      const current = protection.querySelector("[data-protect-current]");
      const buck = root.querySelector("[data-buck-slider]");
      let latched = false;

      const enforceLatch = () => {
        if (!latched) return;
        const veto = protection.querySelector("[data-protect-veto]");
        const physical = protection.querySelector("[data-protect-physical]");
        if (veto) veto.textContent = "TRIP LATCHED";
        if (physical) physical.textContent = "0% · FORCED SAFE";
        protection.classList.add("is-tripped");
      };
      const later = () => global.setTimeout(enforceLatch, 0);

      if (inject) inject.addEventListener("click", () => { latched = true; later(); });
      if (safeCurrent) safeCurrent.addEventListener("click", later);
      if (current) current.addEventListener("input", later);
      if (buck) buck.addEventListener("input", later);
      if (clear) clear.addEventListener("click", () => {
        if (!current || Number(current.value) < 12) latched = false;
        if (!latched) protection.classList.remove("is-tripped");
        later();
      });
    }

    const topology = root.querySelector('[data-power-stage="5"]');
    if (topology) {
      const path = topology.querySelector("[data-topology-response]");
      const applyBoostCurve = () => {
        const selected = topology.querySelector('[data-topology="boost"].is-selected');
        if (selected && path) path.setAttribute("d", boostResponsePath());
      };
      const boostTab = topology.querySelector('[data-topology="boost"]');
      if (boostTab) boostTab.addEventListener("click", () => global.setTimeout(applyBoostCurve, 0));
      topology.querySelectorAll("[data-boost-predict]").forEach(button => {
        button.addEventListener("click", () => global.setTimeout(applyBoostCurve, 0));
      });
    }
  }

  Learning.renderHome = function renderHomeWithPowerSystemInvariants(rootId) {
    previousRenderHome(rootId);
    mount(document.getElementById(rootId));
  };
})(window);
