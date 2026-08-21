# Power Electronics Firmware Engineer Path

This document is the authoritative learning-path description for the power-firmware course. It does not create a V9 framework: the production renderer remains V3, durable learning state remains V5, and V6–V8 measurement / transfer / external-validity semantics remain in force.

## Product definition

The course is not a list of independent topics. It builds one digital Buck converter through eight causal layers:

```text
01 Power Physics
   energy flow, ON/OFF, vL, di/dt
        ↓
02 Sensing
   physical V/I → sensor/scale → ADC
        ↓
03 Feedback
   r − ŷ → C(z) → u → P → y
        ↓
04 Timing
   PWM SOCA → ADC → ISR/CLA → shadow write → PWM load
        ↓
05 Dynamics
   P(s) → Bode → C(z) → delay → SFRA
        ↓
06 Safety
   Fault → CMPSS → XBAR/DC → Trip Zone → PWM LOW
        ↓
07 Production Firmware
   state + ownership + command freshness + fail-closed policy
        ↓
08 Capstone / Evidence
   Physics → SIL → HIL → C2000 target → Board evidence
```

The sticky grammar is:

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

The teaching loop is:

```text
Problem
→ Prediction
→ Experiment
→ Observation
→ Mechanism
→ Firmware mapping
→ Fault injection
→ Next measurement
→ Unseen transfer
```

## Core vs. lens / transfer content

The core path stays on one Buck until the learner can reason across all eight layers.

- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay are views of the same loop.
- **Module 17 · Transfer Atlas** — reuse the same control grammar on Boost / PFC / PSFB / LLC / Inverter.
- **Module 18 · Control Grammar** — reusable `r → e → C(z) → u → P → y` reference, not another prerequisite course.
- **Module 19 · Executable Capstone** — shared controller contract across model, Host SIL, deterministic HIL, F2838x target binding, and physical evidence.

## Capability target

The engineering ladder remains:

- L0 Recognize
- L1 Calculate
- L2 Predict
- L3 Measure
- L4 Diagnose
- L5 Design
- L6 Integrate
- L7 Debug unknown system

The highest target is not memorization. It is first-attempt judgment on an unseen system, followed by the highest-information next measurement and a falsifiable causal explanation.

## P0 target truth ladder

Module 19 now distinguishes six evidence levels:

```text
Teaching model
→ Host SIL
→ deterministic HIL
→ TI C2000 target compile
→ actual board binding
→ physical board evidence
```

Lower levels cannot certify higher levels.

### TI target compile gate

GitHub `validate` compiles both `buck_control.c` and `f2838x_target.c` with:

- TI C2000 CGT **25.11.1.LTS**
- C2000Ware core SDK tag **REL_C2000Ware_v26.01.00.00.STS**
- F2838x CPU1 / EABI / FPU32 / TMU0 / VCU2 compile settings

This catches real DriverLib/API/compiler mismatches instead of relying only on source-text assertions.

### Board binding gate

`19_c2000_buck_firmware_lab/board/board-binding.reference.json` is intentionally `UNCLAIMED`. `BOARD_PASS` is legal only after all board-specific bindings are VERIFIED and all eight physical captures are PASS with artifact references.

Required board bindings include PWM polarity/pinmux, ADC ownership/acquisition time, V/I calibration, CMPSS input/threshold/filtering, dead time, startup/re-arm policy, and communication ownership.

Required physical evidence includes PWM period/duty, ISR timing, ADC SOC phase, hardware trip-to-PWM-low, soft-start, load step, stale-command fail-closed behavior, and qualified re-arm.

## Learning outcome measurement

Course quality is measured with deterministic unseen benchmark sets rather than page completion.

Primary metrics:

- first-attempt accuracy
- next-measurement accuracy
- unseen-transfer accuracy
- pre/post change by competency
- retention checkpoints at 1d / 7d / 30d / 90d

Retries never replace the first attempt. Pre and post sets use different seeded variants. A measured improvement is reported as learner evidence, not as a causal scientific claim about the course unless a real study design supports that conclusion.

See `docs/learning-outcome-protocol.md`.

## Public-content boundary

This repository contains only public, de-productized teaching material.

Do not commit:

- company product names or internal model numbers
- proprietary schematic / PCB net / pin map
- proprietary command payloads
- firmware snapshots
- internal calibration, threshold, control coefficients, or measurement logs
- customer specifications

Allowed content is the reusable engineering pattern: timing, scaling, protection latency, state invariants, producer/consumer ownership, control reasoning, fault isolation, and sanitized evidence contracts.

## Validation

```text
node tools/validate-project.mjs
npm test
# Host SIL is compiled and executed in GitHub Actions.
# F2838x target objects are compiled by TI cl2000 in GitHub Actions.
npm run test:e2e
```

The required `validate` job is the merge gate.

## Maintenance stop rule

Do not add another framework version merely to create infrastructure. New work must improve an unseen engineering judgment, diagnosis, transfer, retention, target truth, or physical evidence boundary.
