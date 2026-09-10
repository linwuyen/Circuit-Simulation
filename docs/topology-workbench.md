# Cross-topology workbench: audit and integration decision

Baseline: PR #45, `33411a1f5a76d910b9d9b752f3b723619d7241c3`.
This increment follows the repository-wide inventory and ownership audit in PR #44.

## Problems confirmed before implementation

- The continuous workbench ends before Module 17; its experiment conditions do not reach the topology models.
- Module 17 embeds a second Buck working-point and frequency-response calculation. Other topologies already delegate to `topology-transfer-v1.js`.
- The Bode renderer checks response objects with `Number.isFinite`, skipping actual response lines.
- Five fixed concept questions are called “unseen transfer verification”; first attempts live only in a Map and disappear on refresh. They are not independent assessments.
- Quantitative contracts already live in `model-contracts-v1.json`; they must not be copied into another metadata authority.

## Canonical owners and intended data flow

Evidence V5 workspace experiment → explicit shared SI working point → Workspace adapter → existing topology model → comparison → guided reasoning → Evidence V5 workspace record. Module 17 can explicitly apply the shared working point and return to the same record.

- Calculations: `topology-transfer-v1.js`; no new switched Boost solver.
- Quantitative boundaries: `model-contracts-v1.json`; registry delegates rather than reproducing equations.
- Shared context: existing `CircuitWorkspace`; persistence: existing `CircuitEvidence`.
- Navigation priority: existing `CircuitUnifiedLearning`; formal verification and independent oracles remain unchanged.

The comparison reuses parameters from a manual experiment, not a live energy checkpoint, PI state or fault state. It compares declared CCM steady working points. The Boost-specific right-half-plane zero is explained as a limit on how quickly feedback can respond; it is not a measured bandwidth or generated transient.

## Verification and rollback

Check analytical limits and unchanged Module 17 values, CCM boundaries, actual canvas data strokes, refresh and backup preservation, shared SI conversion, wrong-first-attempt retention, desktop/mobile layout, and existing regression suites. CI evidence must identify its tested commit. Revert the UI/state increment before reverting the model extraction; existing legacy entries and evidence remain readable.

## Truth gaps

Buck/Boost comparison and returning to Buck are not bidirectional power flow. Bidirectional energy flow has no executable model here. PFC, PSFB, LLC and inverter retain their existing declared models; their complete guided sequences remain future work. Fixed guided questions do not award formal assessment or board evidence. Hardware closure and real learner effectiveness remain unclaimed without real evidence.


## Implemented interface and compatibility

- `index.html#topology` / `learn.html#topology` use the existing workspace shell. The eighth experiment leads here; the route menu also allows direct entry.
- `CircuitWorkspace.topologyPlan` converts the latest manual, correctly scaled experiment parameters to SI units. If no manual run exists, the energy experiment's declared after-configuration is used and labeled. Controller integrators, fault state and stored energy are never copied.
- `topologyCompare` delegates both working points to the registry. The exercise increases duty by 0.1. Only zero-ESR, declared input ranges with positive inductor valley currents in all four working points are accepted. Out-of-range stored context is reported and left intact.
- `CircuitModelRegistry.loadTopologyContracts` reads the original JSON contract. `run(id, {...params, frequencyHz})` returns the existing frequency response; `operatingPoint(id, params)` returns the DC point. These are distinct APIs.
- Evidence V5 `benchmark.learningWorkspace.topologyTransfer` stores version, protocol, SI parameters, source, model IDs/versions, operation and first-attempt/proof rows. Existing workspace experiment/legacy state and formal assessment are preserved. `topologyConcepts` contains only the fixed Module 17 practice questions. Backup import fills absent children without overwriting existing first attempts.
- Module 17 offers an explicit apply action. All slider ranges and steps are validated before any mutation; zero ESR is supported by the original Buck model. The shared context is applied to both circuits and a return link resumes the workspace. Exploratory slider changes remain local to Module 17; they do not silently rewrite the original comparison or its proof.
- Due review and explicit advanced-track choices keep navigator priority. Guided completion leads to the existing independent engineering verification, without granting its grades.

## Verification mapping

| Concern | Evidence |
| --- | --- |
| Unchanged Buck formulas / ESR and CCM limits | topology-transfer.test.mjs |
| Registry contracts, shared units, Boost CCM, invalid context | topology-workspace.test.mjs |
| First attempts, backup merge, formal separation / navigation | topology-workspace.test.mjs |
| Real data lines, all six Bode canvases and LLC | topology-plots.spec.cjs |
| Guided gates, reload, explicit Module 17 apply/return, fixed questions, invalid ranges, mobile fit | topology-workspace.spec.js |
| Legacy learning and firmware truth | Complete Node/browser suites and existing CI Stage 0–12 manifests |

The new questions are guided, fixed exercises. They are neither an unseen assessment nor a measurement of learner effectiveness. Remaining work includes topology-specific guided cases for PFC/PSFB/LLC/inverter, bidirectional energy-flow modeling, target/board closure where missing, and real learner trials. This increment does not claim completion of those stages.
