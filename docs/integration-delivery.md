# Repository integration delivery — PR 44

This is the audit and highest-value canonicalization increment allowed by the integration request. It is not a claim that all twenty modules have been rewritten or that physical hardware has passed.

## Before and after

Before: module-specific pages, models and validators existed, but shared navigation repeated Buck bounds and the eight-layer order. The stronger generic causal solver was not discoverable through the model registry. Shared context did not explain model scope, curriculum prerequisites or physical-evidence limits. CI retained browser failures and the firmware image but lacked one stage/provenance package.

After: the training solver owns Buck bounds, CoreFlow owns layer identities, and the registry delegates specialized models to their original implementations. A read-only engineering context joins the existing curriculum, map, registry and navigation. Five views share curriculum facts with Module 19. Existing simulation, grading, persistence and hardware validators retain authority. CI publishes a checked stage package while physical claims remain blocked.

The full A–H flow map, baseline inventory, and **model / state / navigation ownership tables** are in [architecture-map.md](architecture-map.md). Findings and decisions are in [integration-audit.md](integration-audit.md). The executable stage matrix is documented in [verification.md](verification.md).

## Removed duplication and compatibility

- Removed repeated Buck normalization limits from unified navigation; strict scenario validation delegates to the production owner.
- Removed repeated eight-layer identities/order from unified navigation; routes derive from CoreFlow.
- Extracted Module 19 five-view curriculum facts to one shared extension.
- Registry adapters invoke original solvers; no second simulation model was published.
- Fixed a curriculum extension's navigation side effect outside Module 18.
- Kept Evidence V5, Schema V3, competency/item IDs, assessments, independent oracles, legacy URLs and original model boundaries. No historical files were deleted merely because static references were absent.

## Validation and evidence

Baseline: 315 Node tests, 229 browser passes / 3 skips, static audit, host SIL, TI compile and flash link passed (exact links in architecture map). Current local Node suite: 325 passes. Full local desktop/mobile browser suite: 235 passes / 3 skips. Static and dynamic-visual audits pass. Current browser and target results are the PR's exact-commit Actions results, not extrapolated from the baseline. The first context run exposed a duplicate summary selector and a light surface in dark lesson pages; both were corrected without weakening the tests.

PASS / FAIL for software must be read from the final PR check and consolidated artifact. Actual hardware: **BLOCKED / UNCLAIMED**. Human learning improvement: **NOT_ESTABLISHED**.

## Remaining debt and truth gaps

The shared panel is a context adapter, not a coupled model for every page. Some entries have module-level rather than exact-page model mappings; the UI labels that boundary. The generic kernel's full quantitative valid-range contract remains partial. Bidirectional topology transfer, every module's firmware-variable/register mapping, full glossary expansion and complete product-wide visual redesign remain future work. Module 19 still uses its explicitly registered CoreFlow evidence rather than pretending it is a formal curriculum module. A new universal scoring or state store has not been introduced.

Missing hardware evidence: board identity and configuration, calibration provenance, actual flash/run trace, synchronized measured captures, physical fault/recovery observations, and accepted control/board validation packages. Missing learner evidence: real participants, baseline/post/transfer results, reasoning agreement, retention and uncertainty estimates. Software fixtures cannot fill either gap.

## Rollback

Audit-only commit: `03426416f0cc13cc11e6714e62f328ed0ea59174`. Ownership delegation: `9f5818a601fd992d63e4c72178fccc5d571e703c`. Context adapter: `6ec3952f6bde20cbf90469e72d61e48590cdd992`. Subsequent fixes and CI packaging are separate commits in PR 44. Revert in reverse order as needed; no storage migration is required. Baseline main is `74797e5eef24b72fa21284d092cdfeb7494f62a1`.

The authoritative changed-file list is the PR Files changed view; it excludes unpublished prototype files and generated local test outputs.
