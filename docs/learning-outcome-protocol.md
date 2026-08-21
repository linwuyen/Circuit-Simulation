# Learning Outcome Protocol

The course measures engineering performance on **unseen first attempts**, not page completion.

## Outcome profiles and instrument versions

The durable runtime remains `outcomeV1`; instrument evolution is versioned inside that record so historical evidence is never silently reinterpreted.

### `legacy4` — frozen compatibility instrument

Existing `benchmark.outcomeV1` records that predate profile metadata remain `legacy4`. Its four competencies are:

1. **Physics** — predict the direction of a physical change before seeing the result.
2. **Timing** — determine whether ADC/ISR/compute reaches the first PWM shadow-load deadline and identify the physical commit time.
3. **Next measurement** — select the highest-information measurement before changing code or gains.
4. **Transfer** — reuse the same causal rule after switching frequency / operating conditions change.

The legacy instrument keeps two cases per competency, so one phase remains eight questions.

### `core8` — eight authoritative Module 19 layers

Core8 measures one unseen case for each causal layer:

1. **Physics** — `vL / L → di/dt` and switching-physics direction.
2. **Sensing** — physical quantity → divider/AFE → ADC count before firmware scaling.
3. **Feedback** — `r − ŷ → C(z) → command` first-step direction under stated assumptions.
4. **Timing** — sample-to-actuate deadline and physical PWM commit time.
5. **Dynamics** — plant/delay direction, including `φdelay = −360 f Td`.
6. **Safety** — hardware veto ownership versus slower software observation/reaction.
7. **Production** — fail-closed PWM authority from state/freshness/validity invariants.
8. **Evidence** — identify the highest engineering claim actually supported by Model / HIL / Target / Board evidence.

Core8 remains **eight questions per phase**.

#### `core8 instrumentVersion=1`

Core8 evidence created before family versioning stays on the original generator. A stored core8 record with no `instrumentVersion` is normalized to v1 so existing first attempts keep the exact question/answer semantics they had when recorded.

#### `core8 instrumentVersion=2`

New core8 records default to v2. V2 keeps one item per competency per phase but introduces two semantic item families per competency across seeded forms. This creates cohort-level variation without doubling individual PRE/POST/retention burden.

The implementation separates:

- `outcome-families-v2.js` — semantic family bank and parameterized forms;
- `outcome-core8-instrument-v2.js` — six-phase scheduler and visible-content disjointness;
- `outcome-session-v1.js` — durable first-attempt protocol and version lock.

V2 rejects `countPerCompetency != 1` rather than silently increasing learner burden.

## Primary metrics

For every profile/version:

- first-attempt accuracy;
- competency-level first-attempt accuracy;
- PRE/POST accuracy change;
- R1 / R2 / R3 / R4 retention at 1 / 7 / 30 / 90 days.

`legacy4` additionally reports the historical next-measurement and transfer summary metrics. `core8` reports eight-layer coverage directly. Diagnosis practice and Module 17 topology-transfer verification remain separate learning surfaces rather than being mislabeled as the formal outcome instrument.

## Unseen rule

`pre`, `post`, `r1`, `r2`, `r3`, and `r4` own content-fresh cases. Unseen status is checked at the **visible content level**, not only by case ID.

The benchmark fingerprint includes competency + prompt + choices + human-visible choice labels + expected answer + physical parameters. Generated sets reject duplicate fingerprints, PRE/POST comparison rejects content reused under another ID, and the v2 scheduler verifies all six phases are disjoint.

For core8, six phases × eight competencies = 48 formal cases for one learner seed.

A hidden nonce does not count as content freshness. If two questions show the learner the same engineering problem, changing only metadata is not sufficient.

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

- new records default to `profile=core8`, `instrumentVersion=2`, `countPerCompetency=1`;
- an older record with no profile is normalized to `legacy4`;
- an existing core8 record with no instrument version is normalized to `instrumentVersion=1`;
- profile / instrumentVersion / seed / count configuration becomes immutable after the first attempt;
- the first answer for a case is immutable;
- later answers are stored as retries and never replace the first-attempt score;
- Module 19 requires PRE completion before POST;
- retention phases require completed POST and their due time;
- completing POST creates durable 1/7/30/90-day due dates;
- absence of real learner attempts is displayed as missing evidence, not as a synthetic score.

## Core8 case boundaries

Formal questions teach engineering contracts, not hidden product facts.

- Physics family forms vary inductance or switching frequency under a stated CCM boundary.
- Sensing forms vary divider or AFE gain while explicitly keeping the ADC unsaturated.
- Feedback forms isolate either a reference or reconstructed-feedback first step with positive Kp/Ki and no saturation.
- Timing forms preserve strict sample-to-actuate/shadow-load semantics.
- Dynamics forms isolate pure-delay phase direction rather than claiming total phase margin.
- Safety forms preserve independent hardware veto authority.
- Production forms preserve strict external freshness ownership and conjunction-based software PWM authority.
- Evidence forms use hypothetical evidence packages; `BOARD_PASS` as a correct answer does not claim that this repository or a real board passed.

## Timing truth

Timing cases use a strict PWM shadow-load contract. A CMPA shadow write completed exactly at the ZERO load instant is a **miss** because setup/ordering margin is zero; the new command becomes active at the next eligible load event.

The authoritative implementation remains `strictSampleToActuate()`. V2 timing family expectations are checked against that function rather than reimplementing a looser `<= deadline` rule.

## P4-C · real learner study export

`assets/learning/outcome-study-v1.js` converts the current outcome summary into a privacy-minimized participant bundle containing only aggregate metrics:

- anonymous `participantId`;
- `outcomeProfile`;
- phase completion/attempt counts;
- aggregate accuracy metrics;
- competency-level aggregate accuracy;
- paired PRE→POST delta;
- retention metrics.

It does **not** contain raw answers, prompts, free-text reports or personal profile fields.

### Profile-homogeneous cohort rule

`legacy4` and `core8` are different measurement instruments, so study aggregation fails closed when those profiles are mixed.

Multiple same-profile participant bundles can be summarized with:

```sh
node tools/learning/summarize-outcome-study.mjs p_001.outcome-study.json p_002.outcome-study.json ...
```

Evidence labels remain local:

- `< 4` paired PRE/POST learners: `insufficient`
- `4–7`: `provisional`
- `>= 8`: `usable`

`usable` still does **not** mean causal proof. Every participant and cohort export carries `causalClaimAllowed: false`.

## P4-D · opt-in item/family calibration

Calibration is a separate privacy surface. The download still contains only anonymous ID, exact form metadata, completion counts, and first-attempt rows of:

```text
caseId + competency + correct
```

It does not export prompts, choices, selected answers, retries or family contracts.

Two analyses are intentionally separate:

1. **Exact-item calibration** — same seed/form only:

```sh
node tools/learning/calibrate-outcome-items.mjs --phase post p1.json p2.json ...
```

2. **Cross-form family calibration** — core8 v2 bundles may use different seeds:

```sh
node tools/learning/calibrate-outcome-families.mjs --phase post form_a.json form_b.json ...
```

The family analyzer regenerates each seeded v2 form, recomputes its six-phase semantic fingerprint, resolves case IDs back to family/variant metadata, and rejects v1 or drifted contracts. It reports descriptive family proportion-correct, corrected item-rest discrimination, family coverage/spread and rest-of-phase score bands.

Those bands are **not Rasch/IRT latent-ability estimates**. Family calibration remains observational and does not prove course causality or an intrinsic competency difficulty.

See `docs/outcome-item-calibration.md` for thresholds and interpretation boundaries.

## Pre/post interpretation

A positive PRE/POST delta means:

> This learner performed better on the POST set of content-disjoint unseen cases from the same stored instrument contract.

A positive cohort mean delta means:

> The observed same-profile learner sample performed better on POST than PRE on average.

Neither statement proves that the course caused the improvement. A causal effectiveness claim requires an actual study design with suitable controls, sampling and analysis.

## APIs

- `assets/learning/outcome-benchmark-v1.js` — frozen compatibility generation, content fingerprinting, first-attempt scoring, PRE/POST comparison, retention planning and strict timing truth.
- `assets/learning/outcome-families-v2.js` — core8 semantic family bank and parameterized family forms.
- `assets/learning/outcome-core8-instrument-v2.js` — core8 v2 six-phase scheduling and visible-content disjointness.
- `assets/learning/outcome-session-v1.js` — durable profile/version/configuration, attempts, phase status, retention and compatibility migration.
- `assets/learning/outcome-study-v1.js` — aggregate-only learner study export and cohort aggregation.
- `assets/learning/outcome-calibration-v1.js` — exact-form privacy-minimized calibration export and exact-item aggregation.
- `assets/learning/outcome-family-calibration-v1.js` — cross-seed core8 v2 family analysis after contract regeneration.

CI tests ensure:

- legacy4 and core8 v1 compatibility remain deterministic;
- pre-version core8 records remain pinned to v1;
- fresh core8 records use v2;
- each v2 phase remains eight questions;
- seeded cohorts expose both semantic families per competency where the family bank is scheduled;
- PRE / POST / R1–R4 remain visibly content-disjoint;
- strict timing truth remains fail-closed;
- first attempts cannot be washed by retry;
- profile/version/seed/count lock after first evidence;
- POST completion schedules 1 / 7 / 30 / 90-day retention;
- study export omits raw responses;
- calibration export keeps only case ID / competency / correctness;
- exact-item analysis rejects mixed forms;
- family analysis verifies the exact v2 semantic contract before mixing seeds;
- synthetic calibration fixtures never become learner-effectiveness claims.

## What remains empirical

The repository now contains versioned item families, the real-data export path and exact/cross-form calibration analyzers. Actual learner effectiveness and actual family calibration still require real learners completing PRE/POST and retention over time. CI synthetic fixtures prove implementation behavior only; they are not human learning evidence.
