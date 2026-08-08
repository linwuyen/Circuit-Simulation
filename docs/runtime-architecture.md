# Learning runtime architecture

V3 remains the only production renderer. V5 remains the durable learning-state schema. V6 changes **measurement semantics**, not the storage key.

```text
assets/learning/curriculum.js
        ↓ raw curriculum facts
assets/learning/curriculum-schema-v3.js
        ↓ normalization + canonical identity
assets/learning/quiz-bank.js
        ↓ misconception-aware baseline questions
assets/learning/engineering-models.js
        ↓ production teaching/calculation models
assets/learning/model-registry.js
        ↓ executable/versioned models + IO units + boundaries
assets/learning/lab-oracles.js
        ├─ production model execution
        └─ independent hand-derived reference implementation
                     ↓ agreement + acceptance
assets/learning/learning-evidence.js
        ↓ circuit-learning-state-v5 + immutable histories
assets/learning/learning-assessment.js
        ↓ true-transfer generation + reasoning rubric + CI + coverage
assets/learning/engineering-challenges.js
        ↓ seeded numeric tasks + Bayesian diagnostic inference
assets/learning/learning-v3.js
        ↓ V6 rendering and progression policy
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
- Normalization and identity relationships: `curriculum-schema-v3.js`.
- Durable evidence, aliases and V2/V3/V4 migration: `learning-evidence.js`.
- Production engineering calculations: `engineering-models.js`.
- Production model metadata/version/IO/execution: `model-registry.js`.
- Independent reference-backed lab acceptance: `lab-oracles.js`.
- Baseline, seeded transfer, spaced retention, uncertainty, coverage and reasoning rubric: `learning-assessment.js`.
- Seeded numeric generation and Bayesian diagnostics: `engineering-challenges.js`.
- Rendering and progression policy: `learning-v3.js`.
- Lesson/simulator bridge: `tutor.js`.

No production page owns a second learning-state store.

## Measurement independence

A-grade machine evidence must not be established by the same implementation that generated the teaching output.

```text
normalized input
      ├─ production calculation
      └─ independent reference calculation
                 ↓
          field agreement check
                 ↓
             lab acceptance
```

`lab-oracles.js` owns reference implementations that do **not** call `CircuitModels` or `ModelRegistry` internally. The oracle still executes the production model through the registry, but compares it with the independent reference before applying acceptance.

A verification record contains:

- oracle version;
- production model ID/version/output;
- independent reference ID/version/output;
- normalized input;
- agreement failures, if any;
- acceptance target/measured value/pass-fail.

Current independent oracles cover Buck current ripple and ADC divider. All other simulators remain interaction evidence until an independent reference and acceptance rule exist.

## V5 state under V6 semantics

`circuit-learning-state-v5` remains the schema because V6 data fits the existing revision/event containers:

- `evidence`: stage, strength, machine records and provenance;
- `questions`: immutable attempts including seed, transfer depth, representation, confidence and elapsed time;
- `predictions`: immutable Prediction Commit revisions;
- `reports`: drafts plus committed revisions, including reasoning rubric;
- `openResponses`: seeded numeric histories;
- `diagnosticGames`: Bayesian test sequences and posterior/entropy results;
- `events`, `identityAliases`, `migrations`.

Changing the storage version solely for new optional fields would create migration cost without a schema break.

## Evidence strength

Stage and evidence strength remain separate.

- **C**: human-only or post-hoc evidence after reasoning rubric pass;
- **B**: preregistered prediction + machine interaction + reasoning rubric pass;
- **A**: preregistered prediction + independent reference agreement + oracle acceptance + reasoning rubric pass.

Historical V5 machine records without `independentValidated` do not automatically become A under V6.

## Prediction integrity

The first Prediction revision is immutable and must exist before the first simulator event to count as preregistered. Event order, rather than millisecond timestamp ties alone, determines whether the prediction was already present when machine evidence first appeared.

## Deterministic reasoning rubric

Report completion evaluates five dimensions, each 0–2:

1. Claim;
2. Evidence;
3. Mechanism;
4. Boundary;
5. Transfer.

A report needs at least 8/10 and must contain Claim, Evidence and Mechanism. Buck ripple and ADC divider add deterministic domain checks. The rubric is intentionally rule-based rather than free-form AI scoring so regression behavior remains reproducible.

## True-transfer generation

Baseline A remains authored. Transfer/retention variants are deterministic functions of:

```text
family ID + role + variant ID + transfer depth → seed → parameters/context/representation
```

High-quality generators exist for the benchmark Buck/ADC/SPI families. A generated question stores `seed`, `transferDepth` and `representation` in the attempt. When no generator exists, `nextQuestion()` returns no assessment rather than fabricating a prompt-prefix clone; the missing measurement appears in coverage.

Wrong transfer variants cannot be retried into transfer evidence. A new unseen seed/variant is required.

## Retention

Retention starts at `transferPassedAt` and follows 1d → 7d → 30d → 90d. A failed due review reduces the stage. Mainline progression requires transfer, not permanent R4.

## Benchmark uncertainty

Benchmarking is paired: baseline and transfer use the same competency denominator. V6 adds:

- 95% Wilson intervals for baseline and transfer accuracy;
- conservative delta interval;
- evidence grade based on paired `N`;
- confidence calibration alongside correctness.

Small-N results must be displayed as uncertain rather than as precise performance claims.

## Measurement coverage

`coverageSummary()` joins curriculum and assessment metadata into competency rows:

- lesson/taught;
- lab/practiced;
- independent oracle;
- seeded transfer;
- seeded retention;
- status: `taught`, `practiced`, `measured`, or `verified`.

The Progress page exposes this matrix. `unmeasured`/`taught` is a valid state and must not be visually conflated with mastery.

## Parameterized numeric generation

Numeric challenge templates are instantiated by deterministic seed. Seed 0 is reserved as a stable regression vector; subsequent attempts use different parameters. Evidence stores seed, parameters, entered unit, normalized answer and relative error.

## Bayesian diagnostic engine

Diagnostic games define hypothesis priors and per-test likelihoods for the observed result. Each selected measurement updates the posterior by Bayes' rule.

```text
H_before = entropy(prior/posterior)
posterior ∝ prior × P(observed result | cause)
IG = H_before - H_after
```

UI and stored results expose posterior, entropy change and information gain in bits. Efficiency combines correct root-cause selection, posterior concentration, entropy reduction and test cost. Hand-authored `informationGain: 5` scores are not permitted.

## Stable identity and semantic import

Tutor consumes normalized `item.id`; new/touched curriculum items should use explicit immutable IDs. Legacy arrays remain readable and V5 aliases preserve evidence/prediction/report identity. Import remains semantic: stronger/newer evidence is retained and event/revision histories are unioned rather than shallow-overwritten.

## Change rules

1. Production calculation and independent verification may share equations, but must not share the same executable calculation path.
2. Independent reference changes require corruption tests plus metamorphic invariants.
3. Reasoning rubric changes require positive and fluent-nonsense negative fixtures.
4. Transfer changes require proof that seeds/representations/parameters differ; prompt-prefix clones are forbidden.
5. A family without a high-quality generator stays a coverage gap.
6. Benchmark changes must keep paired denominators, `N`, confidence intervals and evidence grade.
7. Diagnostic IG must derive from probability/entropy updates, never an arbitrary score constant.
8. A-grade evidence requires preregistration, independent agreement, acceptance and reasoning pass.
9. Keep V5 storage compatibility unless a real schema incompatibility appears.
10. Production pages may not reintroduce legacy learning runtimes or parallel persistence.