# Learning Outcome Protocol

The course measures engineering performance on **unseen first attempts**, not page completion.

## Outcome profiles

The durable runtime remains `outcomeV1`; this change does not create a new state schema or another framework generation. The instrument now has two explicit profiles so old evidence is never silently reinterpreted.

### `legacy4` — frozen compatibility instrument

Existing `benchmark.outcomeV1` records that predate profile metadata remain `legacy4` forever unless they have no attempts and are explicitly reconfigured. Its four competencies are:

1. **Physics** — predict the direction of a physical change before seeing the result.
2. **Timing** — determine whether ADC/ISR/compute reaches the first PWM shadow-load deadline and identify the physical commit time.
3. **Next measurement** — select the highest-information measurement before changing code or gains.
4. **Transfer** — reuse the same causal rule after switching frequency / operating conditions change.

The legacy instrument keeps two cases per competency, so one phase remains eight questions.

### `core8` — default instrument for new learner records

New learner records default to one unseen case for each authoritative Module 19 causal layer:

1. **Physics** — `vL / L → di/dt` and switching-physics direction.
2. **Sensing** — physical quantity → divider/AFE → ADC count before firmware scaling.
3. **Feedback** — `r − ŷ → C(z) → command` first-step direction under stated assumptions.
4. **Timing** — sample-to-actuate deadline and physical PWM commit time.
5. **Dynamics** — plant/delay direction, including `φdelay = −360 f Td`.
6. **Safety** — hardware veto ownership versus slower software observation/reaction.
7. **Production** — fail-closed PWM authority from state/freshness/validity invariants.
8. **Evidence** — identify the highest engineering claim actually supported by Model / HIL / Target / Board evidence.

`core8` is also eight questions per phase. Coverage improves without increasing the formal PRE/POST/retention burden.

## Primary metrics

For every profile:

- first-attempt accuracy;
- competency-level first-attempt accuracy;
- PRE/POST accuracy change;
- R1 / R2 / R3 / R4 retention at 1 / 7 / 30 / 90 days.

`legacy4` additionally reports the historical next-measurement and transfer summary metrics. `core8` reports eight-layer coverage directly; diagnosis practice and Module 17 topology-transfer verification remain separate learning surfaces rather than being mislabeled as the same instrument.

## Unseen rule

`pre`, `post`, `r1`, `r2`, `r3`, and `r4` each own a separate collision-free variant block. Unseen status is checked at the **content level**, not only by case ID.

The benchmark fingerprints competency + prompt + choices + human-visible choice labels + expected answer + physical parameters. Generated sets reject duplicate fingerprints, PRE/POST comparison rejects content reused under a different ID, and retention sets are checked against one another.

For `core8`, six phases × eight competencies produce 48 content-disjoint formal cases for a given seed/profile contract.

## Durable session contract

`assets/learning/outcome-session-v1.js` stores the live learner protocol under `benchmark.outcomeV1` inside the existing V5 state (`circuit-learning-state-v5`).

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

- new records default to `profile=core8`, `countPerCompetency=1`;
- an older record with no profile is normalized to `legacy4`, preserving its original case semantics;
- profile / seed / count configuration becomes immutable after the first attempt;
- the first answer for a case is immutable;
- later answers are stored as retries and never replace the first-attempt score;
- Module 19 requires PRE completion before starting POST;
- retention phases require a completed POST and their due time;
- completing POST creates durable 1/7/30/90-day due dates;
- absence of real learner attempts is displayed as missing evidence, not as a synthetic score.

## Core8 case boundaries

Formal questions teach engineering contracts, not hidden product facts.

- Sensing questions state that the ADC is unsaturated before asking count direction.
- Feedback questions freeze reconstructed feedback for the first step and state positive Kp/Ki / no saturation.
- Dynamics questions explicitly ask for the **delay-only** phase contribution, not total phase margin.
- Production questions state which other authority invariants are already valid and preserve the strict `commandAge > timeout` fail-closed contract.
- Evidence questions use hypothetical evidence packages. A question whose correct answer is `BOARD_PASS` does not claim that this repository, CI run, or any real board has passed; it only tests whether the learner understands the evidence ladder.

## Timing truth

Timing cases use a strict PWM shadow-load contract. A CMPA shadow write completed exactly at the ZERO load instant is treated as a miss because setup/ordering margin is zero; the new command becomes active at the next eligible load event.

This prevents an optimistic `<= deadline` simplification from teaching the wrong real-time rule.

## P4-C · real learner study export

`assets/learning/outcome-study-v1.js` converts the current outcome summary into a privacy-minimized participant bundle.

The export contains only:

- anonymous `participantId` supplied by the operator;
- `outcomeProfile`;
- phase completion/attempt counts;
- aggregate accuracy metrics;
- competency-level aggregate accuracy;
- paired PRE→POST delta;
- retention metrics.

It explicitly does **not** contain raw answers, prompts, free-text reports or personal profile fields.

### Profile-homogeneous cohort rule

`legacy4` and `core8` are different measurement instruments. Their totals may both be eight questions, but their competency composition is not equivalent. Therefore cohort aggregation fails closed when bundles from different outcome profiles are mixed.

This prevents a historical four-competency score from being averaged with an eight-layer score as though they measured the same construct.

Multiple same-profile participant bundles can be summarized with:

```sh
node tools/learning/summarize-outcome-study.mjs p_001.outcome-study.json p_002.outcome-study.json ...
```

The cohort summary reports participant count, paired PRE/POST count, mean PRE/POST/delta, competency-level post means, legacy next-measurement/transfer metrics when present, and retention completion/accuracy.

Evidence labels remain local:

- `< 4` paired PRE/POST learners: `insufficient`
- `4–7`: `provisional`
- `>= 8`: `usable`

`usable` still does **not** mean causal proof. Every participant and cohort export carries `causalClaimAllowed: false`.

## Pre/post interpretation

A positive PRE/POST delta means:

> This learner performed better on the POST set of content-disjoint unseen cases from the same outcome profile.

A positive cohort mean delta means:

> The observed same-profile learner sample performed better on POST than PRE on average.

Neither statement by itself proves that the course caused the improvement. A causal effectiveness claim requires an actual study design with suitable controls, sampling and analysis.

## APIs

- `assets/learning/outcome-benchmark-v1.js` — profile-aware generation, content fingerprinting, first-attempt scoring, PRE/POST comparison, retention planning and strict timing truth.
- `assets/learning/outcome-session-v1.js` — durable profile/configuration, phase start/attempt recording, phase status, summary and reset while preserving pre-profile records as `legacy4`.
- `assets/learning/outcome-study-v1.js` — de-identified profile-tagged participant export, validation and profile-homogeneous cohort aggregation.

CI tests ensure:

- `legacy4` generation remains deterministic and backward-compatible;
- `core8` covers all eight causal layers with eight questions per phase;
- PRE / POST / R1–R4 are content-disjoint;
- changed IDs cannot disguise cloned content;
- retry cannot wash a wrong first attempt;
- profile / seed / count lock after first evidence;
- POST completion schedules 1 / 7 / 30 / 90-day retention;
- exact-load-event timing remains fail-closed;
- study export omits prompts/raw answers;
- mixed outcome profiles cannot be aggregated;
- cohort summaries never emit a causal claim.

## What remains empirical

The repository contains the measurement instrument and the real-data export/aggregation path. Actual learner effectiveness still requires real learners completing PRE/POST and retention over time. CI must never generate synthetic perfect scores and present them as human learning evidence.
