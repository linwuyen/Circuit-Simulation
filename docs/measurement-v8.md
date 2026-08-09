# V8 External Validity and Real Engineering Transfer

V8 moves the project from **measurement integrity** to **external validity and broad engineering transfer**. It keeps the durable `circuit-learning-state-v5` schema and the V3 renderer; no new persistence generation is introduced.

## Completion invariants

1. All 12 curriculum modules expose at least one official baseline → unseen transfer → spaced-retention competency family.
2. Transfer variants are deterministic and seeded, but seed identity alone is not enough: depth changes the actual engineering condition and/or representation.
3. Numeric generation extends beyond Buck/ADC/SPI so recognition is not the only assessment mode.
4. Bayesian diagnostic practice covers ten engineering failure scenarios and keeps information gain tied to posterior entropy reduction.
5. Every module has an explicit external anchor with source provenance, model scope and a stable golden vector.
6. A-grade lab evidence remains independent verification of the published lesson/model contract. External validation is a separate dimension and never silently upgrades A into hardware certification.
7. A-capable lab observation uses a typed observable contract before the V7 oracle consumes it.
8. CI injects representative engineering faults and measures whether the independent verification layer detects them.
9. Adaptive sequencing ranks only evidence already present in the learning state. Psychometric labels remain `insufficient` or `provisional` until enough first-attempt observations exist.

## Official competency expansion

V8 adds official assessment families for the nine modules that previously had lab verification but no complete transfer/retention family:

- Inverter — `inverter.shoot-through.safety`
- FOC — `foc.park.frame`
- PI — `pi.integrator.crossover`
- 10 µs loop — `loop10us.deadline.budget`
- BMS — `bms.failsafe.convergence`
- AD5543 — `ad5543.code.mapping`
- AFE — `afe.phase.power`
- ACMC Pro — `acmc.protection.boundary`
- C2000 DDS — `dds.phase.power`

Buck, ADC and SPI retain the V6 seeded families. Together these cover all 12 modules.

## Open response

The original three numeric task families remain. V8 adds nine more seeded tasks:

- FOC Park projection
- PI integrator crossover
- 10 µs timing margin
- AD5543 code mapping
- AFE displacement PF
- DDS real power
- Inverter dead-time lower bound
- BMS/AFE divider voltage
- ACMC sinusoidal peak-current teaching estimate

Answers retain seed, parameters, unit and relative error through the existing V5 evidence store.

## Diagnostic reasoning

The existing SPI overrun and Buck DCM Bayesian games remain. V8 adds:

- ADC front-end saturation
- PI oscillation / loop-margin diagnosis
- FOC angle / phase-order diagnosis
- real-time worst-case jitter
- BMS fault-to-contactor actuation
- DAC polarity / mapping
- AFE current-polarity / phase
- ACMC transient OCP

The scoring engine is unchanged in principle: priors and measurement likelihoods update a posterior, and information gain is Shannon entropy reduction.

## External reality anchors

`external-anchors-v8.js` is a **third truth source** beside the teaching model and independent oracle. Each anchor stores:

- module and anchor identity;
- source description and HTTPS provenance URL;
- explicit scope;
- stable input vector;
- expected output;
- tolerance;
- deterministic validation result.

These anchors use public equations, datasheet transfer definitions, SI dimensional definitions or safety contracts. Runtime validation uses the locally stored golden vector; it does not fetch the Internet during study or CI.

External anchor PASS does **not** mean the actual hardware implementation has been certified. Hardware parasitics, timing, tolerance, sensing, layout, thermal behavior and implementation-specific safety requirements remain outside simplified teaching contracts unless explicitly modeled and measured.

## Typed observables

`observables-v8.js` defines typed `inputs`, `outputs` and `state` adapters for all 12 A-capable lab paths. The Tutor loads this contract on lesson pages before recording verification evidence.

The V7 oracle remains the source of independent acceptance semantics. V8 canonicalizes page observations before they reach that oracle, reducing dependence on ad-hoc DOM text parsing while preserving backward compatibility with the V7 snapshot shape.

## Mutation campaign

`mutation-v8.js` injects one representative defect into each A-capable verification path, including:

- numeric gain/scale corruption;
- hidden safety warning;
- swapped dq outputs;
- Hz conversion error;
- service-time error;
- timing-margin sign error;
- stuck contactor;
- DAC off-by-one;
- `sin` vs `cos` PF error;
- wrong protection state;
- wrong real-power sign.

The CI contract requires the independent verification layer to reject every injected mutation. This is a fault-detection metric, not code-coverage theater.

## Competency graph and adaptive sequencing

V8 adds explicit prerequisites between the new competencies and earlier fundamentals. Adaptive ranking is intentionally simple and reviewable:

- retention due first;
- unseen transfer next;
- retention establishment after transfer;
- lower priority for maintenance;
- module importance and confidence uncertainty provide secondary weighting;
- a time budget removes tasks that do not fit.

This is deterministic evidence-based scheduling, not an ML recommender.

## Psychometric boundary

`psychometricSummary()` reports item-family first-attempt facility only when data exists and labels evidence strength by sample count:

- `< 4` first attempts: `insufficient`
- `4–7`: `provisional`
- `>= 8`: `usable`

For a single learner this is a local measurement-quality signal, not population IRT or a validated standardized test. Population discrimination parameters would require multi-user data and a separate research design.

## Maintenance rule

After V8, framework work should be triggered by observed learning or measurement failures. New infrastructure should answer a concrete question such as:

> Which unseen engineering judgment becomes more valid, more diagnostic, or more durable because of this change?

If that question cannot be answered, the change does not belong in the learning core.
