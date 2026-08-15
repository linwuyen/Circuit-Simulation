# Engineering Sandbox 2.0

This change deliberately does **not** create a V9 framework and does not inflate the formal 16-module / 50-lab verification cardinalities.

The first-principles goal is narrower and more useful: make the generic engineering world richer so an unseen-system learner can connect firmware semantics, timing, data ownership, state, control and physical waveforms.

## Integrated generic machine

The existing Programmable Power Converter Capstone now links five sandbox exercises:

1. `lab_sandbox.html` — dynamic closed-loop converter, CC/CV, virtual oscilloscope, shared ADC/ISR/PWM timeline and non-idealities.
2. `lab_dma.html` — DMA/ring-buffer ownership, complete-before-publish and wrap/overwrite faults.
3. `lab_state_v2.html` — fail-closed OFF/PRECHECK/READY/RUN/FAULT/RECOVERY state invariants.
4. `lab_multifault.html` — two simultaneous faults with a five-measurement diagnostic budget.
5. `lab_code_trace.html` — generic firmware bug → runtime state/timing → electrical consequence → next measurement.

These exercises extend the engineering sandbox around the already formal A-capable Capstone integration-budget path. They do not claim new A-grade verification merely because the simulator has more behaviors.

## Closed-loop teaching model

The dynamic converter is a deliberately generic buck-like plant:

- outer voltage PI produces current reference;
- current reference is clamped by a CC current limit;
- inner current PI produces duty;
- duty drives an inductor/capacitor/load plant;
- voltage/current observations pass through deterministic ADC quantization;
- optional gain, offset, noise, jitter, stale command, duty clamp and missed PWM commit faults can be injected.

The model is for causal training, not hardware certification. It does not represent parasitic switching devices, magnetics loss, thermal networks or any company implementation.

## Shared event timeline

A converter run emits events on one time axis:

`PWM_ZERO → ADC_SOC → ADC_EOC → ISR → CONTROL_DONE → PWM_COMMIT`

A missed commit is represented separately from the computed duty so learners can distinguish control mathematics from actuation timing. Over-current can emit a `TRIP` event.

## DMA ownership contract

The generic data path is:

`Peripheral → DMA → ring slot → DMA complete → publish → CPU consume → release`

Key invariant: publication must not make an incomplete frame visible. The lab injects publish-before-complete, overwrite-unconsumed and ring-wrap corruption.

## Fail-closed state contract

`RUN` requires prerequisites and no active fault. A fault moves the machine to `FAULT`; clearing the raw fault input does not authorize output. Explicit re-arm and recovery are required before returning to the startup path.

## Multi-fault diagnosis

The sandbox can select two simultaneous generic faults from:

- sensor gain error;
- stale command;
- control sign error;
- duty clamp;
- missed PWM commit.

Measurements include independent physical output, raw ADC, scaled engineering value, computed/applied duty, sequence ownership and timing. The score rewards correct two-fault isolation and penalizes unnecessary measurements and false-positive causes.

## Code ↔ physical world

Generic code defects cover unit mismatch, feedback sign, stale index, missed shadow-load timing and integer truncation. Each maps to a physical consequence and a discriminating next measurement.

## Verification boundary

`tests/engineering-sandbox.test.mjs` protects the pure engineering contracts. `tests/e2e/engineering-sandbox.spec.js` protects browser behavior and mobile layout. Existing V6/V7/V8 measurement semantics remain unchanged.

The sandbox is intentionally a richer practice/diagnostic environment around the formal competency system, not a reason to fabricate new independent-oracle claims.
