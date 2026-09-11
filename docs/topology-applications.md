# Guided topology applications: audit and decision

Baseline: PR #46, `323b316651d5f367a9ade953e608d3e017b868c8`; follows the repository-wide audit in PR #44 and the shared Buck/Boost integration in #46.

## Confirmed gaps

Module 17 has working quantitative PFC, PSFB, LLC and inverter models and controls, but its five fixed questions do not require operating these models. The workspace stops at Buck/Boost and the remaining quantitative models are not registered. Fixed question history must stay separate from a new operation-based protocol.

## Owners and intended data flow

Curriculum facts describe the four teaching comparisons. Existing Workspace helpers prepare and validate the native control values, and delegate calculation to the registry. Registry metadata comes from `model-contracts-v1.json`; equations remain in `topology-transfer-v1.js`. Module 17's original controls and plots are the experiment surface. Evidence V5 stores first attempts and before/after snapshots; UnifiedLearning owns the return/resume route. No second plant, assessment or storage engine is introduced.

Each application explicitly prepares its own conditions. AC input, isolation, resonant-tank and grid-filter parameters cannot be inferred from the Buck checkpoint. Only a declared one-parameter change is compared. PFC ripple is not a plant pole; PSFB commutation energy is only an estimate; LLC FHA is steady state rather than transient response; ideal LCL lacks real damping/grid impedance.

## Validation and rollback

Check model identities and scaling with independent analytical invariants, native controls matching recorded snapshots, prediction/operation/reason gates, wrong-first retention, reload/backup compatibility, and desktop/mobile rendering. Run existing Node/browser/firmware CI with Stage 0–12 evidence. Revert guided UI/routing before removing its registry adapters. Old concept records and formal verification remain untouched.

Guided comparisons are not unseen assessment, learner-effectiveness data, bidirectional power flow, or board evidence. Those remain explicit gaps.


## Implemented contracts

- `CircuitEngineeringCurriculum.applicationLessons` owns four scenarios, explicit native-control preparations, a one-control change, display metrics, questions and boundaries.
- `CircuitWorkspace.applicationPlan/applicationRun/applicationProof` prepares controls, converts SI units and delegates calculation; it does not contain new plant equations. The registry now covers all seven existing quantitative surfaces. LLC normalized gain remains a steady-state gain API, not a phase response; inverter response requires an explicit LC/LCL mode.
- `topology-application-ui.js` is a renderer over the original Module 17 controls/plots. Preparation checks the entire range/step set before changing any control. Manual changes are detected; operation requires the stated baseline. Both native values and model snapshots are retained.
- Evidence V5 child `benchmark.learningWorkspace.topologyApplications` has version 1, rows, currentLesson and derived completion. Rows preserve protocol `topology-application-v1`, first prediction/observation/reason, before/after parameters/results, controls, model version and operation time. Fixed-concept history and formal assessments are separate. Backup merge fills a missing child without replacing an existing one.
- Mere page viewing creates no new record. Reload shows stored comparisons with an explicit distinction from current native controls. A native-section return button restores the selected lesson. UnifiedLearning routes unfinished applications after due reviews and respects explicit advanced tracks.

## Verification map

| Concern | Tests |
| --- | --- |
| One parameter, PFC inverse capacitance scaling, PSFB squared-current energy, LLC frequency scaling, LCL resonance scaling | topology-applications.test.mjs |
| Seven registry contracts, separate FHA/current/grid-filter semantics | topology-applications.test.mjs |
| Backup preservation, formal separation and resume priorities | topology-applications.test.mjs |
| All four native operations, snapshots, wrong-first retention, reload and malformed records | topology-applications.spec.js |
| Native graph return, mobile fit and sticky-header clearance | topology-applications.spec.js |

These are four bounded guided comparisons, not complete topology design courses. Remaining coverage includes independent unseen assessments for these tasks, broader operating regions, bidirectional power flow, target-specific/real-board closure, and actual learner trials.
