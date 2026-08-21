# Outcome Item and Family Calibration

This document extends `docs/learning-outcome-protocol.md` with an **opt-in instrument-calibration path**. It does not change learner scoring, PRE/POST semantics, retention timing, target firmware, HIL truth, or board evidence.

## Why this exists

A formal outcome instrument can be content-disjoint and still be poorly calibrated. Four questions must stay separate:

1. **Did learners score higher?** — learner outcome evidence.
2. **Which competency had lower observed accuracy?** — diagnostic cohort signal.
3. **Is a specific exact item too easy, too hard, or unable to discriminate?** — exact-item calibration.
4. **Does the same semantic family behave consistently across seeded forms?** — cross-form family calibration.

The existing `outcome-study-v1.js` intentionally answers the first two with aggregate-only bundles. Calibration needs first-attempt correctness by item, so it uses a separate explicit export rather than silently expanding the privacy surface of the study bundle.

## Instrument versioning

Historical evidence is never silently reinterpreted.

- `legacy4` remains the frozen compatibility instrument.
- Existing `core8` records created before versioned item families are normalized to `instrumentVersion=1` and keep the original generator forever.
- New `core8` learner records default to `instrumentVersion=2`.
- `instrumentVersion`, profile, seed and count configuration become immutable after the first recorded attempt.
- `core8 v2` keeps `countPerCompetency=1`: eight questions per phase, not sixteen.

Version 2 separates the **semantic family bank** from the **six-phase scheduler**:

```text
outcome-families-v2.js
  semantic family contracts + parameterized forms
            ↓
outcome-core8-instrument-v2.js
  PRE / POST / R1 / R2 / R3 / R4 scheduling
  + visible-content disjointness
            ↓
outcome-session-v1.js
  durable first-attempt protocol
```

The scheduler, not a hidden nonce, is responsible for keeping all 48 visible cases content-disjoint for a learner seed.

## Core8 v2 family bank

Every core8 competency has two explicit semantic families:

| Competency | Family A | Family B |
| --- | --- | --- |
| Physics | inductance → ripple | switching frequency → ripple |
| Sensing | divider → ADC count | AFE gain → ADC count |
| Feedback | reference first-step | feedback first-step |
| Timing | shadow-load deadline | rate-change deadline |
| Dynamics | delay change → phase | frequency change → delay phase |
| Safety | hardware vs software veto | trip-latch authority |
| Production | command freshness | authority conjunction |
| Evidence | highest supported claim | physical board-closure gap |

A learner still sees one item per competency in a phase. Across seeded forms, however, a cohort can observe both semantic families without doubling individual test burden.

PRE / POST / R1 / R2 use the two-family parameterized bank directly. R3 / R4 currently use content-fresh compatibility generators bridged to the matching family-A semantic contract so that long-term retention remains visibly disjoint. Consequently, family comparison coverage must be read from `familiesObserved`; do not assume every retention phase contains both families.

## Privacy boundary

`assets/learning/outcome-calibration-v1.js` exports:

- anonymous `participantId`;
- `outcomeProfile`;
- exact form configuration: `seed` + `countPerCompetency` + semantic `contractFingerprint`;
- phase completion counts;
- for attempted first attempts only: `caseId`, `competency`, `correct`.

It does **not** export:

- prompt text;
- choices or choice labels;
- the learner's selected/raw answer;
- family/variant text or contracts;
- retries;
- free text;
- personal profile fields.

The Module 19 UI therefore exposes calibration as a second **opt-in** download. The existing study JSON remains aggregate-only.

The cross-form analyzer does not need family IDs in the exported JSON. It regenerates the versioned form from the seed, resolves `caseId → familyId / variantId`, and first recomputes the exact six-phase semantic fingerprint. The hash is an accidental-drift guard, not a security primitive.

## Two analysis modes

### 1. Exact-item calibration

Use `tools/learning/calibrate-outcome-items.mjs` when learners received the **same exact form**.

All bundles must have the same:

```text
outcomeProfile + seed + countPerCompetency + contractFingerprint
```

They must also expose the same case-ID set for the selected phase. Mixed exact forms fail closed.

Reason: responses to different seeded items cannot be treated as repeated observations of the same item.

### 2. Cross-form family calibration

Use `tools/learning/calibrate-outcome-families.mjs` for `core8 v2` bundles from different seeds.

Different seeds are allowed, but each bundle must independently pass all of these checks:

- valid privacy-minimized calibration schema;
- `core8` profile;
- `countPerCompetency=1`;
- its exported fingerprint must equal the fingerprint regenerated from the current v2 scheduler for that seed;
- every selected-phase `caseId` must map back to the regenerated case with the same competency.

A `core8 v1` bundle therefore cannot be silently relabeled as v2 family evidence. Likewise, prompt/answer/parameter drift causes fingerprint mismatch and rejection.

## Phase isolation

Run either calibration mode on exactly one phase at a time:

```text
PRE | POST | R1 | R2 | R3 | R4
```

Do not pool PRE and POST responses into one item/family statistic. The content is intentionally disjoint and learner state has changed between phases.

Only learners who completed the selected phase are included in the statistics. Partial phases remain in exported bundles but are excluded from calibration analysis.

## Statistics

### Proportion correct

For an exact item or family observation set `i`:

```text
p_i = correct first attempts / completed learners who saw i
```

The implementation calls this `proportionCorrect`, not intrinsic "difficulty". A value such as `0.80` describes the observed sample and administration.

### Corrected discrimination

The binary item/family observation is correlated with the learner's **rest-of-phase score**, excluding the item itself:

```text
r_i = corr(item_i, score_without_item_i)
```

This corrected item-rest correlation avoids the simplest part-whole inflation. If either side has zero variance, discrimination is reported as not estimable rather than inventing a value.

### Descriptive ability bands

Cross-form family output additionally reports observed proportion-correct within three rest-of-phase bands:

```text
low  < 0.50
mid  0.50 .. <0.75
high >= 0.75
```

These are descriptive strata only. They are **not Rasch/IRT latent-ability estimates**, do not prove item invariance, and do not remove form/sample imbalance.

## Review thresholds

These are operational review heuristics, not universal psychometric laws:

| Signal | Review rule |
| --- | --- |
| Sample size | `<20` = `insufficient`; `20–49` = `provisional`; `>=50` = `usable` for operational review |
| Very hard candidate | `proportionCorrect < 0.30` |
| Very easy candidate | `proportionCorrect > 0.90` |
| Low discrimination | corrected discrimination `< 0.15` |
| Watch discrimination | `0.15 ≤ r < 0.25` |
| Negative discrimination | `r < 0` — investigate keying, ambiguity, hidden prerequisite, or construct mismatch |

When `n < 20`, the system emits only `insufficient-sample`; it does not label an item/family too easy, too hard, or low-discrimination even when a tiny sample is extreme.

A flag means **review the item/family**, not automatically delete it. A deliberately easy safety invariant may be instructionally valid; a difficult transfer family may expose a real prerequisite gap.

## Competency versus item-family confounding

Within one learner phase, core8 still has one item per competency. Therefore a single learner or single exact form cannot cleanly separate competency ability from item difficulty.

Version 2 improves this at the cohort level by rotating two semantic families across seeded forms. The family summary reports:

- `familiesObserved`;
- minimum sample per family;
- observed family proportion-correct spread;
- whether both families reached the minimum review sample.

This is a stronger diagnostic than one fixed item, but it is still not a latent-trait model. Call a competency a durable bottleneck only after triangulating multiple forms, phases/retention and qualitative engineering behavior.

## CLI

Exact-item analysis:

```sh
node tools/learning/calibrate-outcome-items.mjs --phase post \
  p_001.outcome-calibration.json \
  p_002.outcome-calibration.json
```

Cross-form family analysis:

```sh
node tools/learning/calibrate-outcome-families.mjs --phase post \
  form_a_001.outcome-calibration.json \
  form_b_002.outcome-calibration.json \
  form_c_003.outcome-calibration.json
```

The family command emits:

- v2 family contract fingerprint;
- completed sample size and evidence status;
- mean phase accuracy;
- family-level `proportionCorrect`;
- corrected discrimination;
- form and variant counts;
- rest-of-phase descriptive bands;
- competency family coverage/spread.

Invalid bundles, duplicate participant IDs, unknown phases, v1/v2 semantic mismatch, fingerprint drift and case-to-family mapping mismatches are rejected rather than silently filtered.

## Evidence boundary

Calibration output is **observational instrument evidence**. It is not:

- proof that the course caused learning;
- proof that a competency is intrinsically difficult;
- proof that an item/family is universally easy or hard;
- a Rasch/IRT calibration;
- board evidence;
- permission to rewrite already-collected item semantics in place.

If evidence motivates a material change to wording, answer contract, family semantics or physical parameters, preserve historical evidence by creating a new instrument version rather than silently reinterpreting old responses.

Synthetic CI fixtures exist only to verify math, scheduling and fail-closed rules. Real calibration claims require real learner bundles.
