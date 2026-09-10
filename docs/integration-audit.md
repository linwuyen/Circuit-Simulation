# Integration audit and convergence plan

Baseline: `74797e5eef24b72fa21284d092cdfeb7494f62a1`. Inventory includes the complete remote tree, README, every docs/assets/tests/tools/workflow path, all Modules 0–19 and recent PR intentions. [Architecture map](architecture-map.md) records owners and actual arrow-to-file mappings. [Machine inventory](architecture-inventory.json) records files and static reference evidence.

## Recent decisions that remain binding

- [PR #32](https://github.com/linwuyen/Circuit-Simulation/pull/32): quantitative metadata belongs to `model-contracts-v1.json`; model/measurement correlation does not prove physical provenance.
- [PR #35](https://github.com/linwuyen/Circuit-Simulation/pull/35): CoreFlow is the eight-layer lifecycle owner; Module 19 is the canonical core player. Do not duplicate its first-attempt/completion semantics.
- [PR #38](https://github.com/linwuyen/Circuit-Simulation/pull/38): explicit initialization, V5 pending-write recovery and cross-platform CI.
- [PR #41](https://github.com/linwuyen/Circuit-Simulation/pull/41): unified next-step routing, registered return task, same-family parameter handoff, no cross-model silent overwrite.
- [PR #42](https://github.com/linwuyen/Circuit-Simulation/pull/42), [PR #43](https://github.com/linwuyen/Circuit-Simulation/pull/43): plain-language beginner flow and persistent workspace. They do not replace the engineering core, independent verification or board gates.

## Findings / duplication map

| ID | Class / priority | Evidence and current problem | Canonical owner / decision |
|---|---|---|---|
| T01 | Truth/documentation / high | `docs/unified-causal-kernel.md` describes ready-at-deadline as eligible (`<=`); `engineering-sandbox-core.js::timingWindow` requires positive margin, other timing/board validators require strict eligibility. | Correct prose to strict-before; retain all calculations and boundary tests. |
| T02 | Truth/documentation / high | `runtime-architecture.md` says `index.html` starts Journey/V3; PR #43 makes it native workspace. `integrated-learning.md` still calls `learn.html` the map; the map is now `map.html`. | Document renderer scopes and compatibility routes accurately; do not restore old entry behavior. |
| D01 | Duplicate validation / high | `unified-learning.js::schema` repeats seven numeric ranges already owned by `training-experiments-core.js::buckConfig`. Future bounds can diverge between save and simulation. | Export the existing owner's input contract; strict saved-payload validation delegates to it, while preserving no-default/no-string rules on imported settings. |
| D02 | Duplicate navigation facts / medium | `unified-learning.js::layers` repeats CoreFlow's eight-layer identity/order. | Derive routing layer identities from CoreFlow; retain U-owned route labels only if explicitly presentation-specific. Keep `next()` precedence and first attempts unchanged. |
| D03 | Duplicate engineering view facts / medium | Module 19 `layer-live.js::mentalViews` is private to its renderer; other modules cannot consume the same grammar. | Move those curriculum facts to a shared curriculum extension, consume from both Module 19 and shell. No second navigation/state/assessment. |
| F01 | Model discovery fragmentation / high | `model-registry.js` covers base calculations; specialized switched Buck and training Buck are used directly. Registry visual JSON correctly owns Module 17 contracts but is not a universal runtime model. | Register delegate cards for existing production owners; do not port/reimplement formulas. Explicit descriptive vs executable metadata. |
| F02 | Learning context fragmentation / high | Bridge exposes links and terms but cannot answer model/IO/boundary/prerequisite/evidence owner. Module 19 has much richer context. | Read-only context projection from canonical curriculum/schema, model registry, CoreFlow and U. Unknown mapping remains UNKNOWN; no invented competency or PASS. |
| F03 | Taxonomy / medium | Stage groupings, module competencies and fault names use different levels. `competency-bindings.js` already solves specific semantic aliases. | Add taxonomy relationships as curriculum facts, bind existing IDs instead of renaming stored evidence IDs. No merged mastery metric. |
| F04 | Parameter / time semantics / high | Steady Buck, averaged guided feedback, switched sandbox and HIL use different units/states/cadence. `shared-case-core.js` correctly declares its time/frequency lenses are not one coupled machine. | Preserve explicit families and adapters. The switched kernel is the extension point for deeper beginner causal tasks; do not create a second solver. |
| F05 | Verification artifacts / high | Static/Node/Host SIL successes live mainly in console output. Flash files upload only after success; browser diagnostics already upload with `always()`. A single final job hides which evidence is missing. | Add an orchestration manifest with stage, exact command/input, SHA/time/tool, expected/actual, verdict and hashed artifacts. Missing files cannot become PASS. Hardware absence remains BLOCKED/UNKNOWN. |
| F06 | UI / medium | Workspace, V3 renderer, engineering pages and firmware panels have intentional visual differences plus repeated shell/navigation styling. | Share scoped shell tokens/components and context, retain existing instrument layouts. Avoid resetting every page's styles or rewriting renderers. |
| L01 | Legacy / retained | `learning.js`, `learning-v2.js`, `curriculum-schema.js`, compatibility teaching adapters and originals have historical/testing/migration value. Static zero-reference alone cannot prove bookmarked-route safety. | No bulk deletion. Inventory candidates, retain until production/test/route/migration absence is separately proven. |
| L02 | Unpublished prototype / rejected for integration | A separate continuous Buck/course/progress prototype was prepared before this full-repository specification. It would duplicate the existing switched kernel and add a parallel assessment interpretation. | Keep outside this branch. Reuse interaction design later through existing model/evidence owners. Passing prototype tests is not justification to bypass canonical ownership. |
| G01 | Topology coverage gap | P5 covers Boost/PFC/PSFB/LLC/Inverter with distinct constraints. Bidirectional power has topic-level material, not an equivalent independently verified transfer path. | Expose gap honestly. Extend existing topology-transfer owner only with justified model/oracle tests; no encyclopedia pretending to be validated transfer. |
| G02 | Hardware / learner truth gap | Public templates are UNCLAIMED/MISSING; no real captures or human study supplied. | BLOCKED actual board closure; learner effect NOT_ESTABLISHED. CI can validate contracts only. |

## Target architecture

One canonical **context**, not one giant DOM:

```text
Existing curriculum facts + engineering taxonomy
    → Schema V3 identity
    → read-only page/workbench context
       ├─ existing model registry → existing production model
       ├─ CoreFlow / UnifiedLearning → current / next / return
       ├─ Evidence V5 / Assessment → original evidence dimensions
       └─ shared shell → PHYSICAL / SIGNAL / CONTROL / TIME / AUTHORITY

Existing verification → stage manifest → persistent artifact
Real board package → unchanged board gates (never inferred from manifest)
```

The shell cannot calculate a new voltage, award mastery, interpret arbitrary return URLs, or infer board truth. Specialized renderer/model contracts remain intact. Page-level metadata can inherit a module scope but must say when a precise per-lab model mapping is missing.

## Change contracts

| Logical change | Problem / owner / data flow | Verification | Rollback / semantic impact |
|---|---|---|---|
| Audit baseline | No repo-wide owner map; existing code → immutable inventory/docs | Verify referenced paths and baseline logs/CI SHA | Documentation-only revert; no behavior or evidence change |
| Input/route canonicalization | Duplicated ranges and layer list; owner contract → U validation/routing | Range-edge and corrupt-payload tests; all U recommendation/backup tests | Revert adapters and tests; saved schemas/grades unchanged |
| Shared engineering context | Module-private grammar, opaque model provenance; curriculum/registry → shell | Model provenance, unknown-context, cross-module route, keyboard/mobile tests | Remove shell adapter; old pages/URLs still render |
| Verification persistence | Logs lack durable stage evidence; real command → exit/result → hashed files | Failed command, absent/empty artifact, missing-stage, manifest round-trip tests; live CI artifacts | Restore workflow commands; no production/hardware calculation changes |

## Phase order and stop rule

0. Baseline: local static/315 Node tests; exact-head Windows/Linux/browser/Host SIL/TI link CI evidence.
1. Commit audit/map/inventory before behavior.
2. Canonicalize high-value existing contracts with focused regression tests.
3. Add shared context/shell against those owners, then affected browser tests.
4. Make CI stage evidence persistent and run the complete merge gate.
5. Further task redesign, topology expansion and firmware/measurement handoffs use the same owners. They are separate reviewed increments, not implied complete by this PR.
6. Delete legacy only after four kinds of absence are proven. No candidate currently meets that bar.

If focused validation fails, fix it before adding the next logical change. Main remains a deployable rollback point; no forced rewrite, no synthetic learner/board data, no downgraded tests.

## Verification matrix at baseline

| Stage | Result available | Interpretation |
|---|---|---|
| 0 STATIC | PASS, local 513 files | One pre-existing Module 6 tutor warning |
| 1 UNIT | PASS, 315 tests | Real local and exact-head CI tests |
| 2 MODEL | Covered by Node suite | Dedicated manifest missing at baseline |
| 3 INDEPENDENT ORACLE | Covered by corruption/invariant tests | Executable independence retained; not hardware evidence |
| 4 INTEGRATION | Covered by Node/browser | Dedicated manifest missing at baseline |
| 5 BROWSER / UX | PASS, 229 / 3 skipped in exact-head CI | Skips remain explicit, not counted PASS |
| 6 HOST SIL | PASS in exact-head CI | Pure C controller / averaged plant |
| 7 HIL | Covered by deterministic Node/browser | Not physical hardware-in-loop capture |
| 8 C2000 COMPILE | PASS in exact-head CI | Compiler/API compatibility |
| 9 FLASH LINK / HEX | PASS; archive hash in architecture map | Linked reference image, not actual flash session |
| 10 PHYSICAL CLOSURE | BLOCKED actual package; contract tests PASS | Missing real flash/provenance |
| 11 MEASURED CONTROL | BLOCKED actual captures; contract tests PASS | Missing scope/SFRA captures |
| 12 BOARD EVIDENCE | BLOCKED; committed reference UNCLAIMED | Never infer BOARD_PASS from 0–9 |

## Remaining scope after the initial convergence increment

- Beginner scenarios must be adapted to the existing switched kernel and assessment owners, with a real first-attempt/transfer contract; the isolated prototype is not shipped.
- Every legacy page does not yet have a precise executable-model ID. Preserve module-level context and expose UNKNOWN rather than guess.
- BMS/motor/inverter plant and authority rules remain distinct; common grammar does not justify copying control gains or clear policies.
- Generic system architecture already exists in ACMC/Module 15. A future unified system case should reuse it, without company identifiers, internal thresholds or proprietary schematics.
- UI shell consistency does not prove better learning. Human learner evidence and hardware evidence require separate real inputs.
