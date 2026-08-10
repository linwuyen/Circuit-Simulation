# OPA first-principles DC reasoning trainer

## Scope

This is a deliberately narrow Level 0–5 trainer. It teaches the deterministic reasoning chain:

`V+ -> V- -> resistor ΔV -> Ohm's Law -> conventional-current direction -> KCL -> feedback drop -> Vout`

It does **not** add saturation or slew-rate questions to this trainer. Saturation is a later Level 6 extension; slew rate remains the separate dynamic-response branch already present in the OP AMP module.

## Teaching contract

For DC negative-feedback problems, the trainer starts from these rules instead of a memorized closed-form gain equation:

1. In linear negative feedback, `V- ≈ V+`.
2. For the ideal op amp, `I+ ≈ I- ≈ 0`.
3. For a resistor, `I = ΔV / R`.
4. At a node, `ΣI = 0`.

Current direction is never discarded. `Solver` uses signed branch currents, then derives feedback-current direction and Vout polarity from KCL.

## Skill graph

```text
UNIT_CONVERSION
  -> VOLTAGE_DIFFERENCE
  -> OHMS_LAW
  -> CURRENT_DIRECTION
  -> VIRTUAL_SHORT
  -> KCL
  -> FEEDBACK_DROP
  -> VOUT_CALCULATION
```

Levels:

- Level 0: engineering-unit arithmetic
- Level 1: voltage difference
- Level 2: Ohm's Law magnitude
- Level 3: conventional-current direction
- Level 4: virtual short
- Level 5: full biased feedback chain, one reasoning step at a time

## Architecture responsibilities

The browser implementation is kept in one dependency-free file for GitHub Pages, but the runtime is separated into explicit components:

- `QuestionGenerator`: parameterized mental-math-friendly scenarios; never owns truth.
- `CircuitModel`: circuit parameters only.
- `Solver`: the single deterministic source of numerical and directional ground truth.
- `SkillGraph`: prerequisites and unlock/frontier rules.
- `AnswerEvaluator`: compares a submitted answer to the Solver-backed expected value; it does not independently solve circuits.
- `ErrorDiagnoser`: classifies the failed reasoning step and builds prerequisite remediation micro-questions.
- `AdaptiveEngine`: approximately 60% weakest unlocked skills, 25% review, 15% frontier/challenge; repeated errors lower difficulty and clean streaks can raise it.
- `MasteryTracker`: per-skill attempts, correct/incorrect counts, streaks, mastery score, hints, last error, last seen, recent outcomes and parameter diversity.
- `SessionManager`: 10–20 reasoning-step sessions, remediation queue, retry ownership, persistence and end-of-session report.
- `UI`: circuit highlighting, one-question presentation, hints and reporting only.

`Solver` is the only ground-truth owner. An LLM is not required and must never decide numerical correctness.

## Remediation behavior

A wrong answer does not reveal the full solution. Example for `30 µA × 40 kΩ`:

1. ask `30 × 40 = ?`
2. ask what unit `µA × kΩ` produces
3. ask `1200 mV = ? V`
4. retry the original question

Other errors similarly return to the smallest useful prerequisite: voltage-subtraction order, Ohm's Law rearrangement, high-to-low current direction, virtual-short condition, ideal-input-current KCL, or Vout polarity.

## Mastery

Every trained skill persists at least:

- `skill_id`
- `attempts`
- `correct_count`
- `incorrect_count`
- `current_streak`
- `best_streak`
- `mastery_score` (0–1)
- `hint_count`
- `last_error_type`
- `last_seen_at`

A skill is marked mastered only when all are true:

- recent five attempts contain at least four correct
- at least three consecutive correct answers without hints
- at least three distinct parameter signatures have been tested

A prerequisite miss also reduces confidence in dependent skills.

## Stop rule

Do not add Level 6 saturation or Level 7 slew rate to this trainer until the Level 0–5 loop has been used enough to show whether unit, direction, KCL and feedback-polarity error rates are actually improving.