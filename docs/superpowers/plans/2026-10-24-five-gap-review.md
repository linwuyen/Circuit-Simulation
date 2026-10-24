# Five First-Principles Review Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Correct the five owner-approved follow-up gaps against 27711875c24527fafffe9dfa527cceb43f759f36 without publishing.
**Architecture:** Keep the existing lesson/model structure. Derive each numeric boundary independently, add focused behavioral or teaching-contract regression first, and make only the changes needed for that contract. Shared tests and final evidence are integrated by the coordinator.
**Tech Stack:** Existing HTML/JavaScript, Node test runner, Playwright 1.54.2.
**Spec:** Owner-approved 2026-10-24 five-gap follow-up; existing audit mapping in docs/first-principles-remediation-20261023.md.

## Global Constraints

- Use the existing D:/GITHUB/Circuit_Simulation_d08cab3 checkout and fix/first-principles-review-20261021 local branch.
- Preserve original work; baseline was clean and unit 457/457 PASS.
- No GitHub write, push, PR metadata edit, merge to main, deployment, or hardware operation.
- No schema/dependency/model refactor outside the five confirmed gaps.
- Record actual RED/GREEN commands and outcomes; existing green CI does not prove all 22 findings closed.
- Project node_modules is installed from the unchanged lockfile. Coordinator owns browser server/aggregate runs.
- Evidence lives in the external delivery/five-gap-review-20261024 directory; concise durable conclusions go into repo docs.

## Review Focus

1. Signed/AC VREF with an unsigned DAC code must not be mistaken for a signed digital multiplier.
2. A small step below SR*tau must have zero clamped ramp duration although abs(deltaV)/SR is positive.
3. Harmonic phase/amplitude must change sampled RMS correctly; empty/start-up buffers must remain finite.
4. Quantized 45/65 Hz windows must work for both alternating integer periods and every advertised sampling rate; rate changes must discard mixed-rate windows.
5. Numeric readouts must use active 36 V first/result values even when legacy 48 V before/after data coexist.

## Task 1: AD5543 teaching contract

Files: active 8.ad5543_simulator lessons; create tests/review-ad5543-quadrants.test.mjs.
Interface: preserve the existing unsigned DAC model and UI.
- [x] Read the active claims and verify the topology against the manufacturer primary source.
- [x] Add and run a focused regression that rejects the false four-quadrant claim.
- [x] Correct all affected active lessons consistently: unsigned gain retains one sign; true four-quadrant behavior requires the bipolar offset/summing topology.
- [x] Run GREEN plus relevant existing DAC/measurement tests; record evidence.

## Task 2: Opamp ramp-duration contract

Files: 12_opamp_slew_rate/02_step_response.html and directly related active lessons; create tests/review-opamp-step-lesson.test.mjs.
Interface: keep OpampModel.step's existing clamped one-pole solution.
- [x] Add a RED consistency case for A<=SR*tau (ramp=0) and a large-step case using max(0,(A-SR*tau)/SR).
- [x] Correct the lesson distinction between a full-excursion slew scale, actual clamped interval, and precision settling.
- [x] Run GREEN and existing opamp model/negative tests; cover positive/negative SR.

## Task 3: AFE sampled RMS readout

Files: 9.afe-tutorial/afe.html, simulator-core.html; create tests/review-afe-rms.test.mjs.
Interface: both canvas CH1 RMS and topology RMS use the same actual sample-window metric.
- [x] Add a RED harmonic vector whose true sampled RMS differs from peak/sqrt(2).
- [x] Use the sampled mean-square definition with an explicit finite-window scope; preserve PF/power behavior.
- [x] Cover both routes, initial buffer, harmonic amplitude/phase, and both displayed bindings.
- [x] Run GREEN and existing hardware-measurement model regressions.

## Task 4: DDS exact advertised boundaries

Files: 11.c2000_dds_dashboard/index.html; create tests/review-dds-boundaries.test.mjs.
Interface: retain the current ADC/count/PML API.
- [x] Reproduce exact 45 and 65 Hz across sampling rates and independent integer cycle quantization.
- [x] Demonstrate RED for confirmed rounded-window/rate-change defects.
- [x] Correct admissible integer bounds and reject mixed-rate partial windows without weakening range semantics.
- [x] Run GREEN plus existing DDS/measurement regressions.

## Task 5: Active 36 V numeric transfer regression

Files: create tests/e2e/review-transfer-readout.spec.js; production edits only if a new confirmed defect is found.
Interface: active transfer first/result records take precedence over historical before/after.
- [x] Trace the actual route, storage shape, and numeric display.
- [x] Exercise a real browser flow containing distinct 36 V and stale 48 V vectors.
- [x] Assert the numeric values, not merely text labels or absence of strings.
- [x] If baseline behavior already passes, demonstrate a stale-selector negative control and record that this is coverage, not a newly reproduced production bug.
- [x] Coordinator runs focused browser regression in an isolated test server.

## Integration and completion

- [x] Inspect all scoped diffs and resolve shared-contract issues without dropping assertions.
- [x] Run project/static visual validation, bare npm test, and full desktop/mobile Playwright with two workers.
- [x] Request a fresh independent review of all five requirements and negative vectors.
- [x] Address concrete review findings and repeat only affected verification.
- [x] Update local remediation evidence honestly and prepare an unpublished PR-description draft.
- [x] Record final local branch/HEAD or diff identity, tests, intentional skips, and remaining limitations. No remote publication.

Completion ruling: owner authorized execution of the detailed five-gap scope in the existing checkout; no extra design/publication approval was inferred. The transfer item was confirmed as a coverage gap, not a new production defect. Two independent DDS findings were reproduced RED and corrected before final validation. Changes remain local and uncommitted; no GitHub write.
