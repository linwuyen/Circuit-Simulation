# Control Engineering Workbench Contract

## Goal

The engineering workbench closes one traceable chain:

`operating point -> plant equation -> controller -> discretization -> ZOH/delay -> PWM commit -> measurement -> correlation -> evidence claim`

It is intentionally not a collection of unrelated calculators. Every quantitative surface must state what is exact, what is approximated, and what remains unverified.

## Single source of truth

`assets/learning/model-contracts-v1.json` owns equation-grade visual metadata: model id, input/output, units, dimensional signature, equation, assumptions, valid region, known boundary, derivation steps, boundary tests and provenance notes.

The dynamic-visual audit and regression tests consume that file. UI surfaces should consume it instead of restating the same contract independently.

## Loop stack

`assets/learning/control-engineering-v1.js` composes independent factors:

`L = C * P * H_zoh * H_delay * H_sensor`

`P` is the topology plant; `C` is the continuous/discrete controller; `H_zoh` is the zero-order hold; `H_delay` is explicit pure delay; `H_sensor` is explicit sensing/scaling gain. A plant mismatch, ZOH phase and compute/PWM delay therefore remain separately diagnosable.

## Controller compiler boundary

The PI compiler produces incremental coefficients and a C arithmetic template. The generic bilinear second-order path produces a digital 2P2Z/biquad representation. Generated C is **not** declared production-complete: target scaling, saturation, anti-windup, arithmetic type, ISR/CLA ownership, register ordering and ePWM shadow-load semantics remain target-verification items.

## C2000 timing boundary

The timing model separates ADC acquisition/conversion, firmware compute/write, command-ready instant, eligible PWM shadow-load events, effective sample-to-actuate delay and phase loss at crossover. If the command misses an eligible load event, the model waits for the next one and reports missed-load count. It never invents a universal ISR latency.

## Measurement states

Imported CSV moves through explicit states: `MODEL_ONLY`, `MEASURED`, `CORRELATED`. Evidence provenance is separate: a CSV remains `UNVERIFIED_IMPORT` until source type, instrument, board id and capture time are bound. Correlation alone never proves hardware provenance.

## Operating envelope and robustness

Nominal operating points are insufficient. The workbench includes Boost Vin × load CCM/DCM/RHPZ sweeps, seeded L/C/R Monte Carlo, and explicit model-breaking cases for DCM, PFC 2ω disturbance chasing, LLC FHA misuse, Nyquist aliasing, ADC acquisition settling and PI windup. The purpose is to expose model validity boundaries, not make every model universally detailed.

## Misconception engine

Question selection is tag-driven. Incorrect concepts increase later priority for forced-disturbance-vs-pole, RHP-zero cancellation, FHA steady-state-vs-dynamic confusion, pure-delay phase, and quantization-vs-total-accuracy errors.

## Hardware closure

Nothing in the software workbench upgrades board-dependent claims by itself. Absolute protection latency, real SFRA agreement, switching-node behavior, ZVS, dead time, noise and physical-board stability remain evidence-gated until target configuration and measurements are attached.
