# Learning Outcome Protocol

The course measures engineering performance on **unseen first attempts**, not page completion.

## What is measured

Four benchmark competencies are sampled with deterministic, content-disjoint variants:

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

`pre`, `post`, `r1`, `r2`, `r3`, and `r4` each own a separate collision-free variant block. Unseen status is checked at the **content level**, not only by case ID.

The benchmark fingerprints competency + prompt + choices + expected answer + physical parameters. Generated sets reject duplicate fingerprints, pre/post comparison rejects content reused under a different ID, and retention sets are checked against one another.

## Durable session contract

`assets/learning/outcome-session-v1.js` stores the live learner protocol under `benchmark.outcomeV1` inside the existing V5 state (`circuit-learning-state-v5`). It does not create a new state schema.

```text
PRE unseen
  ↓ complete
normal guided learning
  ↓
POST unseen
  ↓ complete → schedule due dates
R1 = 1 day
R2 = 7 days
R3 = 30 days
R4 = 90 days
```

Rules:

- benchmark seed/count configuration becomes immutable after the first attempt;
- the first answer for a case is immutable;
- later answers are stored as retries and never replace the first-attempt score;
- Module 19 requires PRE completion before starting POST;
- retention phases require a completed POST and their due time;
- completing POST creates durable 1/7/30/90-day due dates;
- the homepage reads the same V5 state and displays actual PRE / POST / delta / next-measurement / transfer / next-retention status;
- absence of real learner attempts is displayed as missing evidence, not as a synthetic score.

## P4-C · real learner study export

`assets/learning/outcome-study-v1.js` converts the current outcome summary into a privacy-minimized participant bundle.

The export deliberately contains only:

- anonymous `participantId` supplied by the operator;
- phase completion/attempt counts;
- accuracy metrics;
- paired PRE→POST delta;
- retention metrics.

It explicitly does **not** contain raw answers, prompts, free-text reports or personal profile fields. The Module 19 UI can download this study JSON after a real learner session.

Multiple participant bundles can be aggregated with:

```sh
node tools/learning/summarize-outcome-study.mjs p_001.outcome-study.json p_002.outcome-study.json ...
```

The cohort summary reports participant count, paired PRE/POST count, mean PRE/POST/delta, next-measurement, transfer, and retention completion/accuracy. Duplicate participant IDs are rejected.

Evidence labels remain local:

- `< 4` paired PRE/POST learners: `insufficient`
- `4–7`: `provisional`
- `>= 8`: `usable`

`usable` still does **not** mean causal proof. Every participant and cohort export carries `causalClaimAllowed: false`.

## Pre/post interpretation

A positive pre/post delta means:

> This learner performed better on the post set of content-disjoint unseen cases.

A positive cohort mean delta means:

> The observed learner sample performed better on post than pre on average.

Neither statement by itself proves:

> The course caused the improvement.

A causal effectiveness claim requires an actual study design with suitable controls, sampling and analysis.

## Timing truth

Timing cases use a strict PWM shadow-load contract. A CMPA shadow write completed exactly at the ZERO load instant is treated as a miss because setup/ordering margin is zero; the new command becomes active at the next eligible load event.

This prevents an optimistic `<= deadline` simplification from teaching the wrong real-time rule.

## APIs

- `assets/learning/outcome-benchmark-v1.js` — generation, content fingerprinting, first-attempt scoring, pre/post comparison, retention planning and strict timing truth.
- `assets/learning/outcome-session-v1.js` — durable phase configuration, start/attempt recording, phase status, summary and reset.
- `assets/learning/outcome-study-v1.js` — de-identified participant export, validation and cohort aggregation.

CI tests ensure:

- deterministic generation
- content-disjoint PRE / POST / R1–R4 sets
- changed IDs cannot disguise cloned content
- retry cannot wash a wrong first attempt
- session configuration locks after first evidence
- POST completion schedules 1 / 7 / 30 / 90-day retention
- next-measurement and transfer are reported separately
- exact-load-event timing remains fail-closed
- browser state survives navigation from Module 19 to the homepage
- study export omits prompts/raw answers
- cohort aggregation rejects duplicate participant IDs and never emits a causal claim

## What remains empirical

The repository now contains the measurement instrument **and** the real-data export/aggregation path. Actual learner effectiveness still requires actual learners completing PRE/POST and retention over time. CI must never generate synthetic perfect scores and present them as human learning evidence.
