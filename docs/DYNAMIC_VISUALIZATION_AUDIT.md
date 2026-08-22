# Dynamic Visualization Audit · Modules 0–19

This repository treats visual fidelity as an engineering contract, not a styling label. The machine-readable source of truth is `docs/dynamic-visualization-audit.json`; `tools/audit-dynamic-visuals.mjs` walks every numbered module and fails CI if an interactive HTML page has no module policy. Module 17 additionally requires every canvas to have an explicit per-visual fidelity, units and boundary.

## Fidelity levels

- **EQUATION_GRADE** — equation, units, assumptions and valid region are explicit; outputs are regression-testable inside that region.
- **PHYSICAL_APPROXIMATION** — numerical physical model with intentional omissions such as parasitics or alternate conduction modes.
- **TEACHING_SURROGATE** — causal comparison only; do not infer hardware bandwidth, settling time, phase margin or absolute latency.
- **QUALITATIVE_SIGNATURE** — direction/features only; normalized axes are not measurements.
- **HARDWARE_EVIDENCE** — the claim closes only with device/configuration/board evidence.
- **MIXED** — a page contains multiple classes and must label each quantitative surface locally.

## 0–19 audit result / engineering boundary

| Module | Default fidelity | What is numerically defensible | Main boundary / closure rule |
| ---: | --- | --- | --- |
| 0 Buck | Physical approximation | CCM volt-second balance, ripple, LC/ESR identities | DCM/loss/DCR/digital delay must be added explicitly |
| 1 ADC | Physical approximation | divider/scaling/ideal quantization | ACQPS settling, noise, INL/DNL, Vref error are separate |
| 2 Code artifact | Mixed | exact timer/modulation identities where parameterized | UI/state animation is not automatically a plant |
| 3 FOC | Mixed | Clarke/Park identities | motor dynamics need an explicit machine model |
| 4 PI | Mixed | selected discrete PI arithmetic | generic response surrogate is not the attached plant |
| 5 SPI | Physical approximation | frame/bit timing | DMA/ISR/SI/pad delay require configuration/hardware evidence |
| 6 10 µs loop | Mixed | explicit sample/compute/commit event timing | generic transient curves cannot imply LC settling |
| 7 BMS | Mixed | deterministic state/logic paths | electrochemistry and absolute fault latency are separate |
| 8 DAC | Physical approximation | ideal code-to-output mapping | settling/glitch/op-amp/startup behavior requires datasheet/board model |
| 9 AFE | Mixed | declared ideal gain/filter equations | GBW/slew/noise/tolerance/ADC loading can invalidate ideal response |
| 10 ACMC | Mixed | per-loop equations | current plant, voltage plant, line disturbance and delay are distinct |
| 11 DDS | Physical approximation | phase accumulator/frequency identities | jitter/spurs/reconstruction filter are separate |
| 12 Op-amp SR | Mixed | declared SR/GBW models | real device macro-model/recovery/output-current limits vary |
| 13 Sync | Mixed | declared transforms/discrete equations | grid distortion/delay/quantization alter lock dynamics |
| 14 Protection | Hardware evidence | authority/state logic | no universal fixed fault→gate time; measure configured path |
| 15 Debug bank | Teaching surrogate | deterministic case-bank elimination | not measured fault probability; Module 19 owns executable capstone |
| 16 Transforms | Mixed | Fourier/Laplace/Z/coordinate identities | animations do not create a topology-specific plant |
| 17 Topology atlas | Mixed, per-canvas contract | Buck/Boost/PFC/PSFB/Inverter ideal averaged plants + LLC FHA steady state | parasitics/mode changes/digital delay/SFRA remain separate |
| 18 Unification | Teaching surrogate | causal mapping between control concepts | numerical claims must link back to owning plant/model |
| 19 C2000 Buck lab | Mixed | executable firmware/SIL/timing contracts | physical-board claims remain evidence-gated |

## Module 17 equation-grade upgrades

### Boost CCM

The duty-to-output model is the ideal CCM voltage-mode small-signal plant:

`Gvd(s) = Vin/(1-D)^2 · (1-s/ωRHPZ) / [1+s/(Qω0)+(s/ω0)^2]`

with `ω0=(1-D)/sqrt(LC)`, `Q=R(1-D)sqrt(C/L)` and `ωRHPZ=R(1-D)^2/L`. The RHP zero therefore contributes increasing magnitude and *negative* phase. ESR/DCR/current-mode/digital delay are outside this boundary.

### Boost PFC

The page deliberately does **not** collapse PFC into one transfer function. It renders two averaged plants:

- fast inner, stiff-bus approximation: `îL/d̂ = Vbus/(Ls)`;
- slow outer energy plant, peak-current command to bus voltage: `ηVrms/(sqrt(2) C Vbus) / [s+2/(Rload C)]`.

The 100/120 Hz bus ripple is shown conceptually as a forced `2ω` energy disturbance, not mislabeled as the outer plant pole.

### PSFB

The Bode plot is equation-grade only for the ideal buck-derived, no-commutation-duty-loss output stage:

`Gvφ(s)=(nVin/180)/[1+sLo/R+s²LoCo]` in V/degree.

The ZVS energy ratio remains a teaching budget, because nonlinear Coss, leakage/magnetizing current, dead-time and duty-cycle loss determine actual commutation.

### LLC

The normalized FHA gain equation remains a **steady-state** equation. This audit adds the local normalized sensitivity `dln(M)/dln(f)` so an operating point has a quantitative frequency-to-gain slope. It intentionally does not invent loop phase or settling time; those require a defined small-signal linearization or SFRA at the target Vin/load point.

### Inverter

Two ideal averaged plants are explicit:

- standalone LC: `Vout/m = Vdc/[LCs²+(L/R)s+1]`;
- stiff-grid undamped LCL: `Igrid/m = Vdc/[L1L2Cs³+(L1+L2)s]`.

The ideal LCL model is singular at resonance by construction. Real grid impedance, ESR and active/passive damping regularize that peak and must be included before controller sign-off.

## Regression / future-change rule

Run `node tools/audit-dynamic-visuals.mjs` for a readable inventory, and `npm test` for the enforceable contract. Any new numbered-module interactive HTML must inherit an audit policy; every new Module 17 canvas must additionally declare units and a validity boundary in the manifest. A visual can be downgraded to a teaching surrogate if that is the scientifically correct description; it must not be made to look equation-grade merely to satisfy UI consistency.
