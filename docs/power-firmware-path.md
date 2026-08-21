# Power Electronics Firmware Engineer Path

This document is the authoritative learning-path description for the power-firmware course. It does not create a V9 framework: the production renderer remains V3, durable learning state remains V5, and V6–V8 measurement / transfer / external-validity semantics remain in force.

## Product definition

The course builds one digital converter through eight causal layers rather than presenting unrelated topics:

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
   SIL → HIL → linked F2838x image → board binding → physical evidence → transfer
```

Module 19 gives every layer an executable causal surface. The sticky grammar remains:

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
- **Module 17 · Transfer Atlas** — reuse the grammar on Boost / PFC / PSFB / LLC / Inverter.
- **Module 18 · Control Grammar** — reusable `r → e → C(z) → u → P → y` reference.
- **Module 19 · Executable Capstone** — shared controller contract across model, Host SIL, deterministic HIL, linked F2838x Flash image, board evidence and unseen outcome sessions.

## Capability target

- L0 Recognize
- L1 Calculate
- L2 Predict
- L3 Measure
- L4 Diagnose
- L5 Design
- L6 Integrate
- L7 Debug unknown system

The highest target is first-attempt judgment on an unseen system, followed by the highest-information next measurement and a falsifiable causal explanation.

## Engineering truth ladder

```text
Teaching model
→ Host SIL
→ deterministic HIL
→ TI C2000 object compile
→ linked F2838x Flash .out/.map/.hex
→ actual board binding
→ physical board evidence
```

Lower levels cannot certify higher levels.

### TI target image gate

GitHub `validate` uses:

- TI C2000 CGT **25.11.1.LTS**
- C2000Ware core SDK **REL_C2000Ware_v26.01.00.00.STS**
- F2838x CPU1 / EABI / FPU32 / TMU0 / VCU2 settings

It first compiles the pure controller and target binding, then builds the Flash image with C2000Ware `device.c`, `f2838x_codestartbranch.asm`, official `2838x_FLASH_lnk_cpu1.cmd`, `driverlib.lib` and RTS. The gate requires non-empty `.out`, `.map`, and Intel `.hex` outputs and verifies the Flash codestart region before merge.

The UniFlash/DSLite recipe is fail-closed: it requires a real exported CCXML and never guesses probe or board settings.

### Board binding gate

`19_c2000_buck_firmware_lab/board/board-binding.reference.json` intentionally remains `UNCLAIMED` until real board evidence exists.

`BOARD_PASS` requires all three:

1. linked target image artifact PASS;
2. all nine board bindings VERIFIED with non-empty source records;
3. all eight physical captures PASS with non-empty artifact references.

The browser and Node tests use the same machine-readable validator. A browser checkbox cannot manufacture BOARD evidence.

## Learning outcome measurement

Course quality is measured with content-disjoint unseen benchmark sets rather than page completion.

Primary metrics:

- first-attempt accuracy
- next-measurement accuracy
- unseen-transfer accuracy
- pre/post accuracy change
- retention checkpoints at 1d / 7d / 30d / 90d

`assets/learning/outcome-session-v1.js` persists the benchmark flow inside the V5 durable learning state:

```text
PRE unseen
→ normal learning
→ POST unseen
→ R1 1d
→ R2 7d
→ R3 30d
→ R4 90d
```

The first attempt is immutable. Retries are stored separately and cannot wash an incorrect first judgment. POST completion schedules retention due dates. Module 19 runs the flow; the homepage displays only real stored learner results. CI verifies the measurement machinery but never injects synthetic human improvement.

A measured pre/post improvement is learner evidence, not a causal scientific claim about the course.

See `docs/learning-outcome-protocol.md`.

## Public-content boundary

This repository contains only public, de-productized teaching material. Do not commit company product identifiers, proprietary schematics/pin maps, proprietary command payloads, firmware snapshots, internal calibration/threshold/control coefficients, customer specifications, or unsanitized measurement logs.

Allowed content is the reusable engineering pattern: timing, scaling, protection latency, state invariants, producer/consumer ownership, control reasoning, fault isolation, and sanitized evidence contracts.

## Validation

```text
node tools/validate-project.mjs
npm test
# CI also runs Host SIL, TI object compile, F2838x Flash link/HEX generation.
npm run test:e2e
```

The required `validate` job is the merge gate.

## Maintenance stop rule

Do not add another framework version merely to create infrastructure. New work must improve an unseen engineering judgment, diagnosis, transfer, retention, target/board truth, or real physical evidence.
