# Learning Outcome Protocol

The course measures engineering performance on **unseen first attempts**, not page completion.

## What is measured

Four benchmark competencies are sampled with deterministic but disjoint seeded variants:

1. **Physics** — predict the direction of a physical change before seeing the result.
2. **Timing** — determine whether ADC/ISR/compute reaches the first PWM shadow-load deadline and identify the physical commit time.
3. **Next measurement** — select the highest-information measurement before changing code or gains.
4. **Transfer** — reuse the same causal rule after switching frequency / operating conditions change.

Primary metrics:

- first-attempt accuracy
- next-measurement accuracy
- transfer accuracy
- pre/post accuracy change
- R1 / R2 / R3 / R4 retention at 1 / 7 / 30 / 90 days

## Unseen rule

`pre`, `post`, `r1`, `r2`, `r3`, and `r4` use different seed namespaces. Their case IDs cannot overlap.

A retry does not replace the first attempt. The benchmark scorer keeps the earliest attempt for a case even if a later retry is correct.

## Evidence quality

The benchmark uses the same local sample-size labels as the rest of the learning system:

- `< 4` first attempts: `insufficient`
- `4–7`: `provisional`
- `>= 8`: `usable`

`usable` means the local measurement is large enough to be displayed as a learner signal. It is not population psychometrics, IRT, or a controlled education study.

## Pre/post interpretation

A positive pre/post delta means:

> This learner performed better on the post set of disjoint unseen cases.

It does **not** by itself prove:

> The course caused the improvement.

A causal effectiveness claim would require an actual study design with suitable controls, sampling, and analysis.

## Timing truth

Timing cases use a strict PWM shadow-load contract. A CMPA shadow write completed exactly at the ZERO load instant is treated as a miss because setup/ordering margin is zero; the new command becomes active at the next eligible load event.

This deliberately prevents an optimistic `<= deadline` simplification from teaching the wrong real-time rule.

## API

`assets/learning/outcome-benchmark-v1.js` exports:

- `generateBenchmarkSet()`
- `scoreFirstAttempts()`
- `compareSessions()`
- `retentionPlan()`
- `strictSampleToActuate()`

CI tests ensure:

- deterministic generation
- disjoint pre/post sets
- retry cannot wash a wrong first attempt
- next-measurement and transfer are reported separately
- exact-load-event timing remains fail-closed
- retention phases remain 1 / 7 / 30 / 90 days

## What remains empirical

The repository now contains the measurement instrument and its integrity tests. Actual learner effectiveness still requires real learner attempts. CI must never generate synthetic perfect scores and present them as evidence that the course improved a human learner.
