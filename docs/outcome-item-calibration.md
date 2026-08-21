# Outcome Item Calibration

This document extends `docs/learning-outcome-protocol.md` with an **opt-in instrument-calibration path**. It does not change learner scores, PRE/POST semantics, retention timing, target firmware, or board evidence.

## Why this exists

A formal outcome instrument can be content-disjoint and still be poorly calibrated. Three different questions must stay separate:

1. **Did learners score higher?** — learner outcome evidence.
2. **Which competency had lower observed accuracy?** — diagnostic cohort signal.
3. **Is a specific item too easy, too hard, or unable to discriminate?** — instrument calibration.

The existing `outcome-study-v1.js` intentionally answers the first two with aggregate-only bundles. Item calibration needs first-attempt correctness by item, so it uses a separate explicit export instead of silently expanding the privacy surface of the study bundle.

## Privacy boundary

`assets/learning/outcome-calibration-v1.js` exports:

- anonymous `participantId`;
- `outcomeProfile`;
- exact instrument configuration: `seed` + `countPerCompetency` + semantic `contractFingerprint`;
- phase completion counts;
- for attempted first attempts only: `caseId`, `competency`, `correct`.

The fingerprint is computed from the generated six-phase item contracts but exports only a compact hash, not the item text. It is an accidental-drift guard, not a security primitive.

It does **not** export:

- prompt text;
- choices or choice labels;
- the learner's selected/raw answer;
- retries;
- free text;
- personal profile fields.

The Module 19 UI therefore exposes calibration as a second **opt-in** download. The existing study JSON remains aggregate-only.

## Exact-instrument rule

Item analysis is stricter than cohort outcome aggregation.

All bundles in one calibration run must have the same:

```text
outcomeProfile + seed + countPerCompetency + contractFingerprint
```

They must also expose the same case-ID set for the selected phase. Mixed instrument configurations fail closed.

Reason: two learners can both be on `core8` while receiving different seeded items. Those responses can inform competency-level outcome research, but they cannot be treated as repeated observations of the **same item**.

The semantic fingerprint closes another failure mode: if a developer changes prompt wording, answer contract, choices, or physical parameters without changing the seed/profile, new bundles still stop matching historical bundles instead of silently contaminating calibration evidence.

## Phase isolation

Run calibration on exactly one phase at a time:

```text
PRE | POST | R1 | R2 | R3 | R4
```

Do not mix PRE and POST item responses into one item statistic. The content is intentionally disjoint, and the learner state has changed between phases.

Only learners who completed the selected phase are included in item statistics. Partial phases are retained in exported bundles but excluded from calibration analysis.

## Statistics

### Proportion correct

For item `i`:

```text
p_i = correct first attempts / completed learners who saw item i
```

The implementation calls this `proportionCorrect`, not intrinsic "difficulty". A value such as `0.80` describes this sample under this instrument administration.

### Corrected discrimination

The implementation correlates the binary item score with the learner's **rest-of-phase score**, excluding the item itself:

```text
r_i = corr(item_i, score_without_item_i)
```

This is a corrected item-total correlation. Excluding the item from the total avoids the simplest part-whole inflation.

If the item score or rest score has zero variance, discrimination is reported as not estimable rather than inventing a number.

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

When `n < 20`, the system emits only `insufficient-sample`; it does not label an item too easy/hard or low-discrimination even when the tiny sample happens to be extreme.

A flag means **review the item**, not automatically delete it. A deliberately easy safety invariant may be instructionally valid; a low p-correct transfer item may expose a real prerequisite gap. Read item statistics together with engineering content and learner evidence.

## Competency review priority

The calibration summary also orders competencies by observed mean accuracy for the selected phase, but only after the minimum review sample is reached.

For the default `core8` profile there is currently one item per competency per phase. Therefore:

> low competency accuracy and hard-item behavior are partially confounded within a single phase.

Do not call the lowest competency a proven conceptual bottleneck from one item. Triangulate across POST and later retention phases, qualitative debug behavior, and future additional items before changing curriculum structure.

## CLI

Download calibration bundles from Module 19, then run:

```sh
node tools/learning/calibrate-outcome-items.mjs --phase post \
  p_001.outcome-calibration.json \
  p_002.outcome-calibration.json \
  p_003.outcome-calibration.json
```

The command emits JSON containing:

- exact profile/instrument metadata and semantic fingerprint;
- completed sample size and evidence status;
- mean phase accuracy;
- item-level `proportionCorrect`;
- corrected discrimination;
- review flags;
- competency-level observed means and review ordering.

Invalid bundles, duplicate participant IDs, mixed instrument configurations, semantic fingerprint drift, unknown phases, and inconsistent item sets are rejected rather than silently filtered.

## Evidence boundary

Calibration output is **observational instrument evidence**. It is not:

- proof that the course caused learning;
- proof that a competency is intrinsically difficult;
- proof that an item is universally easy/hard;
- board evidence;
- permission to rewrite already-collected item semantics in place.

If calibrated evidence motivates a material change to item wording, answer contract, or physical parameters, preserve historical evidence by versioning the instrument/profile rather than silently reinterpreting old responses. The fingerprint is a guardrail against accidental mixing; deliberate instrument evolution still needs an explicit versioning decision.

Synthetic CI fixtures exist only to verify the math and fail-closed rules. Real calibration claims require real learner bundles.
