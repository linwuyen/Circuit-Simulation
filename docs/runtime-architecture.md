# Learning runtime architecture

V3 remains the only production renderer. V4 is the only production learning-state schema.

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
assets/learning/learning-evidence.js
        ↓ circuit-learning-state-v4 + V2/V3 migration + machine evidence
assets/learning/learning-assessment.js
        ↓ baseline + transfer variants + delayed retention + competency DAG
assets/learning/learning-v3.js
        ↓ renderers and progression policy
index / beginner / labs / troubleshooting / progress / quiz / search / report

lesson / simulator page
        ↓
assets/learning/tutor.js
        ↓
learning-evidence.js (same V4 store)
```

## Canonical ownership

- Curriculum facts: `curriculum.js`.
- Normalization and current/legacy identity relationships: `curriculum-schema-v3.js`.
- Durable evidence identity reconciliation and V2/V3 migration: `learning-evidence.js`.
- Formal engineering calculations: `engineering-models.js`.
- Model metadata, versions, IO units and execution entrypoints: `model-registry.js`.
- Diagnostic variants, transfer, delayed retention and competency dependencies: `learning-assessment.js`.
- Page rendering and progression policy: `learning-v3.js`.
- Lesson/simulator event bridging: `tutor.js`.

No production page owns a second learning-state store.

## Evidence ownership

`circuit-learning-state-v4` contains:

- `evidence`: view/practice/worksheet/machine evidence;
- `questions`: question-family histories;
- `reports`: engineering worksheets;
- `events`: bounded audit trail;
- `benchmark`: benchmark metadata;
- `identityAliases`: canonical ↔ legacy identity reconciliation;
- `migrations`: migration markers.

Simulator snapshots contain page path, control values and rendered metric/status text. They are objective interaction evidence, not proof that the learner's causal explanation is correct. Verified evidence therefore combines machine observation with human reasoning when available.

## Assessment ownership

Assessment uses a question family rather than a single mutable question state.

```text
variant A first attempt → baseline
            ↓
recovery if needed
            ↓
variant B first attempt → transfer benchmark
            ↓
correct on ≥2 variants → transfer passed
            ↓
≥24 h later correct retrieval → retained
```

Transfer is sufficient to continue the mainline. Delayed retention becomes a review obligation, not a progression deadlock.

## Stable identity policy

- New curriculum entries use object form and explicit immutable IDs.
- Legacy positional arrays remain readable.
- V4 mirrors evidence to current canonical IDs and available legacy aliases so a single title rename or a single path rename does not erase prior evidence.
- If both title and path semantics are intentionally replaced, the change must include an explicit migration alias.
- IDs describe identity, not display text.

## Model ownership

A formal model must have:

- `id` and semantic version;
- executable pure function;
- input/output units;
- assumptions;
- invalid conditions;
- references;
- test IDs.

Heuristic cards may remain non-executable, but must say so. A heuristic is not promoted to an executable model until its assumptions and validation are explicit.

`micro-sim.js` is legacy visualization/heuristic code. It is not an allowed source for new formal engineering models. New precise calculations must enter through `engineering-models.js` and `model-registry.js`; CI tests cover the canonical registry and cross-page evidence path.

## Legacy boundary

V2 learning runtime files remain only for historical comparison and state migration. They are never production dependencies and must not receive new behavior.

Legacy simulator-local UI state may exist for old page affordances, but it is non-authoritative: Tutor mirrors actual page interaction into the V4 evidence store, and Progress/Report read only V4.

## Change rules

1. Add or change a formal model only in canonical model modules.
2. New/touched curriculum items should receive explicit IDs; preserve aliases during renames.
3. Add an invariant or migration test for schema/model changes.
4. Assessment changes require first-attempt and delayed-time tests.
5. Simulator evidence changes require a browser test proving the correct lab ID receives the snapshot.
6. Keep source reviewable; minified artifacts are generated outputs only.
7. Production entry pages may not reintroduce V2 learning runtime dependencies.
