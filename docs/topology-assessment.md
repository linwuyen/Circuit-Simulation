# Topology assessment integration audit

Baseline: PR #47 at 4a2115e101e4d8c5b7631d4df1c9efaabf4f9441. Builds on the repository-wide architecture audit in PR #44.

Problem: four guided native-tool comparisons end at the generic engineering route. Their operation records cannot establish transfer or retention. The existing quiz runtime already owns first attempts, generated conditions, and timed reviews, but Module 17 has no questions in its canonical bank.

Decision: add four question families to the existing quiz bank and generators to CircuitAssessment. Reuse Evidence V5 questions and the V3 renderer. No new store or assessment engine. Arithmetic used to grade explicitly stated ideal scaling relations is an intentional independent assessment reference, not a production simulator. Keep production models and machine verification contracts unchanged.

Flow: native guided applications → Module 17 quiz filter → first attempt → changed conditions → timed review, with a return to the original tools. Completion of guided practice never writes formal question history. Quiz success does not mean simulation agreement, board evidence, or measured learning effectiveness.

Validation: independent expected values and wrong options, deterministic variants, first-wrong preservation, delayed review, original renderer with desktop/mobile and reload. Run all existing validation. Rollback routing first, then generator/bank additions; retain stored question histories and existing URLs.

## Implemented ownership and compatibility

- QuizBank owns four baseline families; CircuitAssessment generates deterministic numerical conditions using independent ideal scaling references. Forty depths per family are checked for distinct prompts, unique options, and correct grading. These are parameter-transfer questions, not broad unseen engineering diagnosis.
- Evidence V5 existing `questions[familyId].history` owns baseline/transfer/retention; no second state or progress counter. Four passed transfer families return navigation to the existing engineering core. Advanced-track and due-review priorities remain.
- The V3 quiz page loads the canonical Module 17 definition before schema normalization. Existing report/progress lab-contract populations stay unchanged; their broader Module 17 coverage integration remains separate work. Existing URLs and saved histories remain valid.
- Existing quiz pager now keys completed cards by family ID. Previously multiple completed cards lost identity when answer buttons disappeared, causing selection to jump to the first completed card.
- Module-filtered quiz uses the existing one-card renderer, a collapsible engineering reference path, plain Chinese prompts and return links. Guided completion only opens assessment; it does not generate answers.

No simulator, oracle, grading store, or routing engine was copied. Production model and formal machine-verification boundaries are unchanged. Remaining gaps: diagnostic and model-selection assessment beyond these scalar relations, actual learner trials, bidirectional power, and physical board evidence.
