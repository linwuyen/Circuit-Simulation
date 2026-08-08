(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitLabOracles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const number = (controls, key, scale) => {
    const value = Number(controls && controls[key]);
    return Number.isFinite(value) ? value * (scale == null ? 1 : scale) : null;
  };

  const definitions = {
    "buck.lab.buck-ripple": {
      modelId: "buck-ripple-ccm",
      build(snapshot) {
        const controls = snapshot && snapshot.controls || {};
        const inductanceH = number(controls, "ind", 1e-6);
        const switchingHz = number(controls, "fsw", 1e3);
        const outputCurrentA = number(controls, "load", 1);
        if (![inductanceH, switchingHz, outputCurrentA].every(Number.isFinite)) return null;
        return { vin: 12, vout: 3.3, inductanceH, switchingHz, outputCurrentA };
      },
      accept(output, input) {
        const ratio = input.outputCurrentA > 0 ? output.deltaIA / input.outputCurrentA : Infinity;
        return {
          passed: output.mode === "CCM" && Math.abs(ratio - 0.20) <= 0.02,
          target: "ΔI/Iout = 20% ±2% 且維持 CCM",
          measured: Number.isFinite(ratio) ? ratio : null,
          unit: "ratio"
        };
      }
    },
    "adc.lab.adc-divider": {
      modelId: "adc-divider",
      build(snapshot) {
        const controls = snapshot && snapshot.controls || {};
        const topOhm = number(controls, "rtop", 1e3);
        const bottomOhm = number(controls, "rbot", 1e3);
        const busV = number(controls, "bus2", 1);
        if (![topOhm, bottomOhm, busV].every(Number.isFinite)) return null;
        return { busV, topOhm, bottomOhm, vrefV: 3.3, bits: 12 };
      },
      accept(output) {
        return {
          passed: output.adcInputV > 0 && output.adcInputV < 3.3,
          target: "ADC input < 3.3 V",
          measured: output.adcInputV,
          unit: "V"
        };
      }
    }
  };

  function verify(labId, snapshot, registry) {
    const definition = definitions[labId];
    if (!definition || !registry || typeof registry.get !== "function" || typeof registry.run !== "function") {
      return { supported: false, passed: false, reason: "no-structured-oracle" };
    }
    const card = registry.get(definition.modelId);
    const input = definition.build(snapshot);
    if (!card || !input) return { supported: false, passed: false, reason: "insufficient-input" };
    try {
      const output = registry.run(definition.modelId, input);
      const acceptance = definition.accept(output, input);
      return {
        supported: true,
        passed: !!acceptance.passed,
        model: { id: card.id, version: card.version },
        inputs: input,
        outputs: output,
        acceptance
      };
    } catch (error) {
      return { supported: true, passed: false, model: { id: card.id, version: card.version }, reason: error.message };
    }
  }

  return {
    definitions,
    supports(labId) { return !!definitions[labId]; },
    verify
  };
});