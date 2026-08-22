# Dynamic Visualization Audit · Modules 0–19

Visual fidelity is an engineering contract, not a styling label. Ownership is intentionally split by responsibility:

- `docs/dynamic-visualization-audit.json` owns **module-level policy**: default fidelity, model family, valid region, known boundary, closure action.
- `assets/learning/model-contracts-v1.json` owns **quantitative model metadata**: model id, equation, input/output, units/dimensional signature, assumptions, valid region, known boundary, derivation and boundary tests.
- `tools/audit-dynamic-visuals.mjs` inventories live surfaces and joins those two sources. Module 17 canvases must have a matching equation-grade model contract.

This removes the previous duplicate `module17Visuals` metadata from the audit manifest. A change to a Module 17 equation or units now has one authoritative record.

The scientific closure chain is:

`Visualization → Model/Equation → Units → Assumptions → Valid Region → Boundary Test → Fidelity → Evidence`

Inventory coverage is not proof that a curve is physically correct. Analytical tests prove identities only inside the declared model boundary. Board/configuration claims remain evidence-gated.

## Fidelity levels

- **EQUATION_GRADE** — explicit equation, units, assumptions, valid region and regression boundary tests.
- **PHYSICAL_APPROXIMATION** — numerical physical model with declared omissions.
- **TEACHING_SURROGATE** — causal comparison; do not infer hardware bandwidth, settling, phase margin or latency.
- **QUALITATIVE_SIGNATURE** — directional/features-only visualization.
- **HARDWARE_EVIDENCE** — closure requires device/configuration/board evidence.
- **MIXED** — a page contains more than one class; quantitative cards keep their local contract.

## Key scientific boundaries

### Boost CCM

`Gvd(s)=Vin/(1-D)^2 · (1-s/ωRHPZ) / [1+s/(Qω0)+(s/ω0)^2]`, with `ωRHPZ=R(1-D)^2/L`. The RHP zero is non-minimum-phase and contributes negative phase. It is not a controller-zero cancellation target.

### Boost PFC

Fast inner current plant and slow bus-energy plant remain separate. The 100/120 Hz `2ω` bus ripple is a forced line-power disturbance, **not** the outer plant pole.

### PSFB

The equation-grade Bode plant is the ideal no-commutation-duty-loss output filter. The ZVS energy ratio remains a teaching estimate; nonlinear Coss, leakage/magnetizing current, dead time and real switching waveforms determine hardware ZVS.

### LLC

Normalized FHA is a **steady-state conversion-gain** approximation. Its local gain sensitivity is numerical; it does not create dynamic loop phase or transient settling.

### Inverter LCL

The ideal undamped stiff-grid model is singular at resonance and preserves the unwrapped phase transition from approximately -90° to -270°. Real damping and grid impedance must be added before controller sign-off.

### C2000 timing / protection

Absolute sample-to-actuate or fault-to-gate latency is configuration-dependent. Cycle-level models may compute latency from declared clocks/events, but universal fixed microseconds are forbidden without configuration and/or scope evidence.

## Module 18 workbench

Module 18 is now `MIXED`: architecture/unification cards remain teaching-level, while the engineering workbench contains equation-backed sampled-data calculations. The workbench factorizes

`L = C · P · H_zoh · H_delay · H_sensor`

and separately models PWM shadow-load timing, measurement correlation, evidence provenance, operating-envelope movement, robustness, and known model-breaking cases. Imported CSV can become numerically `CORRELATED`; it does **not** become hardware evidence until provenance is bound.

## SVG scanner boundary

The scanner recognizes bounded local/inline DOM mutation forms (`setAttribute`, `removeAttribute`, `replaceChildren`, `appendChild`, `textContent`, `innerHTML`, `classList`, `style`) targeting an SVG or descendant by ID. Static/decorative SVG is intentionally ignored. New runtime mutation patterns require a detector regression rather than an audit bypass.

## Regression rule

Run `node tools/audit-dynamic-visuals.mjs` for the inventory and `npm test` for enforceable contracts. New interactive module pages must inherit a module policy. New Module 17 quantitative canvases must be added to `model-contracts-v1.json` with units, equation, valid region, known boundary and boundary tests. Hardware-evidence claims may never be upgraded merely to make the UI look complete.
