# Unpublished PR #135 description draft — 2026-10-24

Proposed title: Draft: first-principles circuit corrections and durable evidence acceptance

## Problem and resulting behavior

Several lessons and readouts could present physically incorrect results or accept learning progress before durable evidence was saved. This branch corrects the affected circuit/control/measurement models, preserves first attempts through guarded durable writes, and makes applicable teaching boundaries explicit.

The latest local five-gap follow-up corrects unsigned-AD5543 quadrant teaching, opamp clamp-duration teaching, harmonic AFE RMS readouts, and DDS45/65 Hz sampled-window/rate-change behavior, with genuine-boundary acquisition and ten-consecutive-cycle range qualification. A numeric browser regression additionally proves the existing active36 V transfer readout replaces stale48 V records.

## Scope and evidence

- Model/control follow-up and negative vectors are mapped in docs/first-principles-remediation-20261023.md.
- Durability/snapshot and cross-tab behavior is described in docs/evidence-concurrency.md.
- The five newly reviewed gaps, independent numeric derivations, RED/GREEN results and remaining scope are detailed in docs/five-gap-follow-up-20261024.md.
- Each changed behavior retains an independently specified negative vector. No schema migration, dependency upgrade, physical-board result or learning-effectiveness claim is introduced.

## Validation

Published head2771187: Validate40010698686 and Packaging40010698695 passed. That CI validated synthetic merge08d1070c7d666ee20819f4d570de36c088936244 against baseed5566d; its tree matched the head candidate.

The new five-gap follow-up remains unpublished. Local Windows validation passed: project/static visuals,496 unit tests and461 complete desktop/mobile browser tests (3 intentional existing mobile duplicate-visual skips,2 workers). Independent review found no remaining correctness findings in the five-gap scope, with57 focused tests and1440 DDS challenge cases passing. One pre-existing historical10 us tutor-injection static warning remains. Firmware/TI compilation was not rerun for this batch. No new-SHA GitHub/packaging result is claimed.

## Acceptance and remaining limits

Keep Draft. Software green is not a declaration that all22 historical findings are fully closed. Physical MEASURED_CONTROL/BOARD_EVIDENCE remain BLOCKED/UNCLAIMED, and independent SPICE/PLECS comparison and human effectiveness are unclaimed. AFE RMS is a finite sampled-window quantity; DDS endpoint acceptance includes integer-sample quantization; opamp/DAC lessons retain their explicit model/topology assumptions.

Do not merge or deploy without separate authorization and required acceptance evidence. This file is a local draft; the GitHub PR title/body/state have not been edited in this batch.
