# Continuous experiment integration

## Decision and scope

Baseline: main `0bf06d68cc30bed286d2aae860eee5972bea1c1e`, containing PR 44. All source blobs were checked against this exact tree before editing. The repository-wide inventory and ownership audit remain in [architecture-map.md](architecture-map.md) and [integration-audit.md](integration-audit.md).

Problem: the old workspace retained a circuit drawing but used a steady-state Buck model for the first five lessons and a separate arithmetic correction demonstration for the last three. A control change therefore did not cause the displayed physical circuit response.

Decision: the default homepage follows eight experiments through the existing generic switched power kernel. The old eight lesson hashes remain compatible. Their scores do not count as completion of the new physical experiments. This increment implements the continuous experiment and guided interface stages; it does not claim topology transfer, hardware completion, or human learning effectiveness.

## Canonical owners and data flow

| Concern | Owner | Change |
|---|---|---|
| Lesson facts | `engineering-curriculum.js` | Eight declarative workbench experiments; no equations |
| Experiment plans | `workspace-core.js` | Successive plans retain all prior changes; explicit repair before controlled comparisons |
| Plant, sensing, control, timing, protection | `engineering-sandbox-core.js` | Existing solver; optional manual command uses the same PWM queue and authority gate |
| Execution discovery | `model-registry.js` | Same registered kernel, version 3.2.0; no alternative solver |
| Guided proof gates | `plain-course-core.js` | Reuses first prediction, observation, reason and transfer requirements |
| State | `learning-evidence.js` | Evidence V5, existing `benchmark.learningWorkspace.experiment`; no new storage key |
| Navigation | `unified-learning.js` | One experiment task, below due reviews and original remediation; explicit advanced track retained |
| UI | `workspace-experiment-ui.js` | Adapter mounted by existing workspace entry on the same DOM shell |
| Independent/physical acceptance | Existing oracle and board owners | Unchanged; guided answers never award their PASS |

Curriculum → workspace plan → registered kernel → physical trace/events → comparison → existing proof gates → Evidence V5 → existing recommendation. The adapter does not implement plant or control equations. Optional within-cycle samples are emitted from the original integration loop rather than reconstructed from an unrelated waveform formula.

## User-visible flow

The sequence is energy, inductor continuation, load, sensing, feedback, timing, response strength, and protection. Each experiment asks for a prediction before enabling the operation, then requires observation and explanation before a 36 V transfer trial. Results of that transfer remain hidden until a correct prediction. Changing settings or opening a page does not count as completion.

The sensing experiment deliberately uses a wrong gain with manual control. Before feedback, the learner explicitly repairs gain and retains both repair runs. Before comparing controller strength, the learner explicitly restores the timing budget. Thus each main comparison changes one factor; repairs are visible rather than silently resetting conditions.

Continuity means the same components, accumulated configuration, model and records. Each comparison restarts from zero stored energy and runs for the same 16 ms. This is labeled on screen. It is **not** a live checkpoint/resume claim or real-board capture. Transfer trials do not overwrite the main experiment configuration. History retains configuration, model ID/version, time and summary; full traces can be regenerated from the deterministic configuration.

## Compatibility and rollback

`index.html#duty` through the old eight hashes continue to use the original renderer and records. Existing lesson pages, formal assessments, CoreFlow, firmware, HIL and target compilation stay unchanged. Legacy browser tests now name their explicit legacy route; equivalent new-home behavior has its own end-to-end tests.

Evidence V5 remains version 5. New experiment records stay inside the existing workspace section. Backup import preserves an existing experiment protocol rather than mixing attempts, and can import a new experiment into a legacy-only workspace. No previous scores are promoted. Reverting the UI entry restores the old default without deleting stored records. The kernel extension is opt-in; omitted `controlMode` retains the original closed-loop behavior and omitted `detailCycle` retains the original output shape. Manual mode still respects fault lockout and delayed PWM application.

## Verification and remaining boundaries

`continuous-kernel.test.mjs` checks ideal steady-state scaling, inductor current after switch-off, delayed application, sensing/physical separation, invalid manual inputs, and protection veto. `continuous-course.test.mjs` checks every lesson and transfer direction against the registered kernel and verifies adjacent configurations match exactly. Browser tests traverse all eight experiments, preserve the circuit node, test wrong-answer gates, hidden transfer results, persistence, legacy evidence, source metadata, due-review priority and mobile overflow.

These are software and guided-model checks, not an independent certification of learner ability. The generic model's full valid-range contract remains partial. Component parasitics, thermal behavior, device calibration, board provenance, real captures and learner outcome studies remain missing. Existing Stage 11–12 physical evidence remains BLOCKED / UNCLAIMED. Read the PR's exact-commit CI and consolidated manifest for final test results.
