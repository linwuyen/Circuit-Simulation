# First-principles audit continuation — 2026-10-23

Baseline: remote PR #135 head `d780409b9f5156294391b851340262ac4576b6d8`, cloned independently. Unknown old unpublished work was neither reconstructed nor claimed preserved. No remote write, merge, deployment, or board operation is part of this local continuation.

## 22 acceptance findings (including the two baseline corrections)

| # | Finding / implementation | Negative evidence and boundary |
|---|---|---|
| 1 | Transfer readout uses active first/result (baseline) | `experiment-causal-readout`; transfer is 36 V, not original 48 V |
| 2 | Fault revokes precheck, explicit recovery before RUN (baseline) | `engineering-sandbox`; fault-clear → ready → run rejected |
| 3 | LCL multiple unity crossings cannot claim CLOSED | `control-audit-regressions`; 100 Hz design with 3 crossings; undamped model never certified stable |
| 4 | Module 4 PI first-crossing margin cannot PASS | same suite; Kp .1 / Ki 3600 exposes 3 crossings on all 3 routes |
| 5 | AFE SOGI, sampled P/PF and instantaneous energy | `hardware-measurement-audit`; independent SOGI states, zero/negative PF, both routes; averaged educational circuit only |
| 6 | BMS all-state fault veto | `audit-bms-timing`; INIT/STANDBY/DISCHARGE × OVP/OCP/SPI; thresholds/reset; this FSM does not sense thermal/UV inputs |
| 7 | DDS EMA bias and invalid-window accumulators | hardware suite; hand-derived RMS, signed PF, timeout and overlong-cycle resets; first DC-offset window is warm-up |
| 8 | Inverter LC freewheel | `power-audit-regressions`; opposing resistor/inductor current and ±1 mA; both implementations; fixed-step, not exact diode-extinction/neutral solver |
| 9 | Trip detection/actuation timestamps | `audit-bms-timing`; detection at 10.5 µs, requested 10.6 µs, actual grid actuation 10.75 µs; no backdating |
| 10 | Same-version cross-tab evidence | stale workspace guards plus central whole-key Web Lock/snapshot gate; concurrency/async-caller/browser tests; see `evidence-concurrency.md` |
| 11 | SVPWM normalization | power suite; Vdc/√3 inscribed-circle frame, SPWM limit √3/2, duty rails at 30° |
| 12 | Opamp step solver/readout | `audit-opamp-negative`; exact held-command slew-limited first-order ODE, signed/zero/small/ramp-band steps |
| 13 | AD5543 bipolar topology claim | same suite; simple polarity inversion explicitly not four-quadrant; true offset-summing formula distinguished, not silently implemented |
| 14 | ADC acquisition SYSCLK vs ADCCLK | hardware + timing suites; 15 SYSCLK + 14 ADCCLK =355 ns; τ180 ns,600 ns gives3.57%, not accurate12-bit settling; external ADC readiness distinct |
| 15 | C2000 CPU1-to-CM memory | hardware suite; active handshake/glossary/quiz use MSGRAM; CPU-to-CPU GSRAM distinct |
| 16 | Buck unreachable and near-input condition | browser `audit-bms-buck`; invalid clears stale metrics/waves; valid98% duty no95% clipping; ideal switch/no minimum off-time |
| 17 | Workbench ZERO timing | `audit-bms-timing`; SOC-coincident ZERO not counted as missed future load; late result misses1 future event |
| 18 | ACMC W vs VA | power suite;1200VA,PF.5 →600W; PF input refreshes qualitative ZVS estimate, not hardware ZVS proof |
| 19 | DC trainer zero-unit tolerance | opamp suite;5mA and blank not accepted as0A; relative scaling, explicit tighter tolerance retained |
| 20 | Synthetic SFRA delay | control suite; delay does not attenuate magnitude,10µs contributes−36° at10kHz; clearly synthetic, not measured |
| 21 | BMS keyboard access | native cell/NTC buttons; Enter/Space browser regression |
| 22 | Legacy routes/teaching boundaries | archive labels/return routes on6BMS +2SPI pages; previously blank10µs route explicitly unavailable rather than fabricated simulator |

Additional regression found during full browser run: mobile bridge-axis label clipped at y25; baseline moved to35 in a separate UI commit with bounding-box test.

## Evidence and nonclaims

Negative tests use fixed hand-derived quantities or independently specified state/timing contracts, not generated golden values from the same production function. Numerical solver assumptions and intentionally unimplemented topologies remain visible. CI/software PASS is not independent SPICE/PLECS validation, physical BOARD_PASS, or human learning-effectiveness proof.

Final exact-commit logs, firmware outputs/checksums, patch series, and Git bundle are delivered outside the worktree. At the original2026-10-23 delivery, Windows/new-SHA GitHub validation was pending. The2026-10-24 local five-gap follow-up records its own Windows validation separately; new GitHub Actions still require authorized publication. Old remote green CI is not reused as evidence for newer changes. Public Pages smoke remains after a separately authorized merge only. PR must remain Draft until those external acceptance gates are verified.


## 2026-10-24 review: five gaps, not universal closure

The table above is a historical implementation/evidence inventory, not proof that every acceptance condition is closed. A later review found residual AD5543 quadrant teaching, opamp ramp-duration teaching, harmonic AFE RMS and DDS endpoint/rate-change gaps. These are corrected locally, with a new numeric regression for the already-correct active36 V transfer readout. See [the five-gap follow-up](five-gap-follow-up-20261024.md) for independently derived negative vectors, actual RED/GREEN results, aggregate validation and remaining limits. This batch is unpublished; prior CI is not reused as evidence for it.
