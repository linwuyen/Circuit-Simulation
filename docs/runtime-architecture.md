# Learning runtime architecture

V3 remains the only production renderer. V5 is the only production learning-state schema.

```text
assets/learning/curriculum.js
        ↓ raw curriculum facts
assets/learning/curriculum-schema-v3.js
        ↓ normalization + identity aliases
assets/learning/quiz-bank.js
        ↓ misconception-aware base questions
assets/learning/engineering-models.js
        ↓ canonical pure calculations
assets/learning/model-registry.js
        ↓ executable/versioned models + IO units + boundaries
assets/learning/lab-oracles.js
        ↓ structured model-backed lab acceptance
assets/learning/learning-evidence.js
        ↓ circuit-learning-state-v5 + prediction/report revisions + semantic merge
assets/learning/learning-assessment.js
        ↓ unseen first-attempt transfer + spaced retention + calibration
assets/learning/engineering-challenges.js
        ↓ numeric open-response + diagnostic games
assets/learning/learning-v3.js
        ↓ renderers and progression policy
index / beginner / labs / troubleshooting / progress / quiz / search / report

lesson / simulator page
        ↓
assets/learning/tutor.js
        ↓ normalized curriculum + canonical item ID
        ↓
lab-oracles.js + learning-evidence.js
```

## Canonical ownership

- Curriculum facts: `curriculum.js`.
- Normalization and current/legacy identity relationships: `curriculum-schema-v3.js`.
- Durable evidence identity reconciliation and V2/V3/V4 migration: `learning-evidence.js`.
- Formal engineering calculations: `engineering-models.js`.
- Model metadata, versions, IO units and execution entrypoints: `model-registry.js`.
- Structured lab acceptance: `lab-oracles.js`.
- Baseline, unseen transfer, calibration and spaced retention: `learning-assessment.js`.
- Numeric generation tasks and information-gain diagnostic games: `engineering-challenges.js`.
- Page rendering and progression policy: `learning-v3.js`.
- Lesson/simulator event bridging: `tutor.js`, which consumes normalized curriculum rather than positional arrays.

No production page owns a second learning-state store.

## V5 evidence ownership

`circuit-learning-state-v5` contains:

- `evidence`: viewed/practiced/verified stage plus evidence strength;
- `questions`: immutable attempt histories including confidence and elapsed time;
- `predictions`: immutable Prediction Commit revisions;
- `reports`: drafts plus committed report revisions;
- `openResponses`: numeric generated-answer history;
- `diagnosticGames`: diagnostic-test sequences and efficiency scores;
- `events`: bounded audit trail;
- `identityAliases`: canonical ↔ legacy identity reconciliation;
- `migrations`: V2/V3/V4 migration markers.

### Stage and evidence strength are separate

Stage answers “how far did the learner progress?” Evidence strength answers “how trustworthy is the verification?”

- **C**: human reasoning only, or post-hoc prediction;
- **B**: preregistered prediction plus machine interaction;
- **A**: preregistered prediction + structured machine oracle pass + human reasoning.

A simulator interaction is therefore not automatically machine verification.

## Prediction integrity

For strong lab evidence, Prediction must be committed before the first simulator snapshot.

```text
predictionCommittedAt < firstMachineAt
```

The first prediction revision is immutable. Later prediction revisions are allowed but remain visibly post-observation revisions. Report completion preserves the prediction revision used for the evidence claim.

## Assessment validity

Assessment uses question families and unseen variants.

```text
variant A first attempt → baseline
            ↓
recovery may occur
            ↓
unseen transfer variant first attempt
            ├─ correct → transfer pass
            └─ wrong   → that variant can never become transfer evidence
                         next unseen variant required
```

Retention starts at `transferPassedAt`, not at the first correct answer.

```text
transfer pass
   ↓ 1 day
R1
   ↓ 7 days
R2
   ↓ 30 days
R3
   ↓ 90 days
R4
```

A failed due review reduces the retention stage. Mainline progression requires transfer, not permanent R4 retention.

Benchmarking is paired: baseline and transfer percentages use the same competency denominator and always expose paired sample size `N`. Confidence calibration is reported alongside correctness.

## Machine verification and model provenance

A structured oracle stores:

- model ID;
- model semantic version;
- exact normalized inputs;
- model outputs;
- acceptance target;
- measured value;
- pass/fail result.

This makes evidence reproducible. A future model-version change can identify evidence that was verified under an older model instead of silently treating every historical snapshot as equivalent.

Current structured oracles cover the Buck ripple lab and ADC divider lab. Other simulator pages remain interaction evidence until a canonical model and acceptance rule are explicit.

## Stable identity policy

- Tutor never derives IDs from display text; it consumes `CircuitSchema.normalizeCurriculum()` and uses `item.id` directly.
- New curriculum entries use object form and explicit immutable IDs.
- Legacy positional arrays remain readable for compatibility.
- V5 mirrors evidence, predictions and reports across canonical IDs and available legacy aliases.
- If both title and path semantics are intentionally replaced, the change must include an explicit migration alias.
- IDs describe identity, not display text.

## Semantic import merge

Imported state never shallow-overwrites current state.

- evidence keeps the stronger/newer claim;
- machine snapshots union by digest;
- question attempts union by event ID;
- prediction/report revisions are preserved;
- open-response and diagnostic-game histories are unioned.

This prevents an old backup from silently downgrading newer local evidence.

## Model ownership

A formal model must have:

- `id` and semantic version;
- executable pure function;
- input/output units;
- assumptions;
- invalid conditions;
- references;
- test IDs.

Heuristic cards may remain non-executable, but must say so. `micro-sim.js` remains legacy visualization/heuristic code and is not an allowed source for new formal engineering calculations.

## Change rules

1. Add or change a formal model only in canonical model modules.
2. New/touched curriculum items should receive explicit IDs; preserve aliases during renames.
3. Assessment changes require tests for first-attempt eligibility and time origin.
4. Lab verification changes require oracle unit tests and browser flow tests.
5. A Prediction-integrity change must prove simulator-first activity is marked post-hoc.
6. Benchmark metrics must use paired denominators and expose N.
7. Imports must preserve stronger/newer evidence and immutable histories.
8. Keep source reviewable; minified artifacts are generated outputs only.
9. Production entry pages may not reintroduce V2 learning runtime dependencies.