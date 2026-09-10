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
