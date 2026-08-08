# V7 Verification Closure

V7 closes the lab-verification boundary without redefining the durable V5 learning-state schema.

## Completion invariants

1. Every normalized curriculum lab has exactly one explicit verification contract.
2. Every module has at least one A-capable independent verification path.
3. A-grade evidence requires preregistered Prediction, machine evidence, independent verification, and a deterministic domain reasoning gate.
4. Labs without a single defensible ground truth are explicitly capped at B; they are never upgraded by inventing a fake oracle.

`lab-verification-contracts.js` is the authoritative registry for these invariants. CI fails if a curriculum lab is missing, a contract points to a nonexistent lab, an A contract has no oracle, or a module loses its A path.

## Verification modes

### Registry-reference agreement

Used where a canonical production model already exists and can be compared with a separately implemented hand-derived reference.

- `buck.lab.buck-ripple`
- `adc.lab.adc-divider`

### Black-box page-output reference

The oracle independently re-derives the expected value and compares it with the actual DOM output produced by the lesson/simulator. It does not call the lesson calculation function.

- `foc.lab.foc-park` — analytic dq target from load angle
- `pi.lab.pi-ki` — `f0 = Ki/(2π)`
- `spi.lab.spi-fifo` — independent `Ta` / `Ts` service-rate calculation
- `loop10us.lab.loop-budget` — independent critical-path and timing-margin calculation
- `ad5543.lab.dac-code` — independent target/VREF-to-16-bit-code mapping
- `afe.lab.afe-phase` — `PF = cos(phi)`
- `acmc-pro.lab.acmc-protection` — independently reproduced published teaching protection rule
- `c2000-dds.lab.dds-pf` — sinusoidal `P = Vrms Irms cos(phi)` and PF identity

### State invariant

Used when the engineering truth is a safety/state relationship rather than a scalar numeric output.

- `inverter.lab.inv-shoot` — same-leg upper/lower switches ON together must expose shoot-through warning
- `bms.lab.bms-failsafe` — injected fault must converge to `FAULT_LOCK` with contactor OPEN

## Grade semantics

| Ceiling | Required evidence | Meaning |
|---|---|---|
| A | preregistered Prediction + machine snapshot + independent oracle PASS + domain reasoning gate | independently verified against the published lesson/model contract |
| B | preregistered Prediction + machine interaction + reasoning rubric | strong learning evidence, but no single independent ground truth |
| C | human-only or post-hoc evidence | useful notes, not strong causal evidence |

A is not hardware certification. In particular, heuristic or explicitly simplified teaching models retain their stated assumptions. The ACMC protection oracle verifies the published 220 Vrms / PF=1 / resistive teaching rule and explicitly records that scope.

## Why some labs remain B

Waveform diagnosis, open-ended tuning, experiment-record quality, protocol checklists and heuristic trend exploration often admit multiple valid engineering paths. Assigning a single numeric oracle to those tasks would increase apparent coverage while reducing measurement validity. V7 treats the absence of a unique ground truth as an explicit property of the task rather than a missing feature.

## Browser evidence bridge

For A-capable lesson pages, `lab-oracles.js` observes a compact black-box snapshot:

- current controls;
- bounded visible outputs/status text;
- simulator metrics;
- relevant switch/fault/button interaction metadata.

After an input/change/click, the independent oracle runs and writes the result through the shared V5 evidence store. This lets state-machine tasks and ordinary slider-based calculations use the same evidence pipeline without changing the persistence schema.

## Regression contract

CI must prove:

- 38/38 labs classified;
- 12/12 modules have an A-capable path;
- every A contract maps to an oracle;
- generic fluent prose fails every A reasoning gate;
- corrupted displayed values fail black-box reference comparison;
- inverter/BMS safety invariants require the actual state transition;
- teaching-estimate scope is preserved instead of being presented as physical certification;
- a real browser can complete Prediction → simulator interaction → independent oracle → A-strength report.
