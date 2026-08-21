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
   load-step phenomenon → energy storage / delay → P(s) / Bode / SFRA
        ↓
06 Safety
   Fault → CMPSS → XBAR/DC → Trip Zone → PWM LOW
        ↓
07 Production Firmware
   state + ownership + command freshness + validity invariants → PWM authority
        ↓
08 Capstone / Evidence
   SIL → HIL → linked F2838x image → physical closure → measured control validation → transfer
```

Module 19 gives every core layer an executable causal surface. The sticky grammar remains:

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

Every guided layer converges on the same learner loop:

```text
plain-language claim
→ directional prediction
→ change one variable
→ observe
→ causal explanation + assumption boundary
→ highest-value next measurement
```

## Five fixed engineering views

Module 19 keeps the same five coordinates visible throughout the course so the learner does not rebuild the architecture from scratch on every page:

```text
PHYSICAL
PWM / switch state → switch node → vL / di/dt → L/C energy → load / Vout

SIGNAL
physical V/I → divider / AFE → ADC pin → sample / count → reconstructed feedback ŷ

CONTROL
reference r → error e → C(z) → duty / phase / fsw command → plant

TIME
SOCA → ADC ready → ISR / CLA → shadow write → active PWM commit

AUTHORITY
RUN ∧ COMMAND_FRESH ∧ SENSING_VALID ∧ NO_FAULT ∧ PERIPHERALS_READY ∧ CALIBRATION_VALID
→ software PWM grant

Independent hardware veto:
fault → CMPSS / qualification → XBAR / Trip Zone → PWM LOW
```

The views are diagnostic coordinates, not five extra modules. When an output is wrong, first identify which contract is broken before changing controller code.

## Core vs. lens / transfer content

- **Module 15 · Debug Challenge Bank** — after the normal causal chain is learned in Module 19, diagnose unknown sensing / timing / ownership / state / control faults with limited measurement budget. It is not a second capstone.
- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay are views of the same loop.
- **Module 17 · Transfer Atlas** — reuse the same grammar on Boost / PFC / PSFB / LLC / Inverter.
- **Module 18 · Control Grammar** — reusable `r → e → C(z) → u → P → y` reference.
- **Module 19 · Executable Capstone** — the authoritative Buck model/SIL/HIL/F2838x image, physical closure, measured validation and learner outcome sessions.

## Dynamics teaching order

Frequency-domain tools are not the entry point. The default causal order is:

```text
load current ↑
→ capacitor initially supplies the deficit
→ Vout sags
→ inductor current cannot jump, only ramp
→ ADC eventually samples the sag
→ controller computes a new command
→ PWM shadow load commits later
→ plant responds
```

Only after that phenomenon is understood do `P(s)`, Bode and SFRA appear as compact ways to quantify how the plant plus delay respond to disturbances at different speeds. A timing-only phase term is never presented as total phase margin.

## Production authority invariant

`RUN` is not a sufficient enable bit. The software request for PWM must remain fail-closed unless all required invariants are simultaneously valid:

```text
PWM_AUTHORITY =
    (state == RUN)
 && command_fresh
 && sensing_valid
 && no_fault
 && peripherals_ready
 && calibration_valid
```

Command freshness belongs to the external producer; the ADC/control ISR cannot refresh a heartbeat on the producer's behalf. Even when software authority is granted, CMPSS / Trip Zone may independently veto PWM.

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
→ P4-A physical closure package
→ P4-B measured control validation
→ actual board binding + physical evidence
→ BOARD_PASS
```

Lower levels cannot certify higher levels.

### TI target image gate

GitHub `validate` uses TI C2000 CGT 25.11.1.LTS and C2000Ware REL_C2000Ware_v26.01.00.00.STS. It compiles the controller/target binding and links a CPU1 Flash image with `device.c`, codestart, the official Flash linker command, driverlib and RTS. Non-empty `.out`, `.map`, and Intel `.hex` are required before merge.

The UniFlash/DSLite recipe remains fail-closed: a real exported CCXML and real probe configuration are required.

## P4-A · real-board closure workflow

`19_c2000_buck_firmware_lab/board/board-closure.template.json` is the operator-facing physical package. A complete package requires:

- real flash session: image + CCXML + probe + timestamp + observed reset/boot;
- 9/9 board bindings VERIFIED with typed provenance and verification timestamps;
- 8/8 physical captures PASS with acceptance criterion, SHA-256, instrument and capture timestamp.

`assets/learning/physical-board-closure-v1.js` and `tools/board/verify-board-closure.mjs` validate the package and can derive the ordinary board manifest. The committed repository template remains incomplete by design because CI cannot fabricate hardware evidence.

## P4-B · measured control validation

A sanitized real-board bundle can be analyzed with `assets/learning/control-validation-v1.js` / `tools/board/analyze-control-validation.mjs`.

The four measured gates are:

1. load-step droop / overshoot / settling;
2. sample-to-actuate timing with strict shadow-load commit semantics;
3. hardware trip fault-to-PWM-low latency;
4. SFRA/model Bode magnitude/phase agreement.

A passing bundle reports `CONTROL_VALIDATION_PASS`. It never implies `BOARD_PASS`.

## P4-C · learner study closure

The durable PRE→POST→R1/R2/R3/R4 flow remains under the existing `benchmark.outcomeV1` state and first attempts remain immutable. The measurement instrument is now explicit:

- **`legacy4`** preserves pre-existing four-competency learner evidence and direct V1 benchmark compatibility.
- **`core8`** is the default for new learner records and uses one unseen case for each authoritative layer: Physics, Sensing, Feedback, Timing, Dynamics, Safety, Production and Evidence.

Both profiles remain eight questions per phase, so the new instrument increases causal-layer coverage without increasing formal quiz length. PRE / POST / R1–R4 remain deterministic and content-disjoint within a profile.

`assets/learning/outcome-study-v1.js` adds a privacy-minimized study export containing only anonymous participant ID, outcome profile, aggregate metrics and competency-level aggregate accuracy. It does not export prompts, raw answers or free text. Multiple participant bundles can be summarized by `tools/learning/summarize-outcome-study.mjs`.

Cohort aggregation is profile-homogeneous and fails closed if `legacy4` and `core8` bundles are mixed. The aggregate remains observational learner evidence and always carries `causalClaimAllowed: false`.

## P5 · topology transfer closure

Module 17 has one shared executable transfer model in `assets/learning/topology-transfer-v1.js` plus a live `P5 · Unseen Transfer Verification` surface.

The transfer target is not memorizing five additional formula sets. It is identifying the topology-specific constraint while preserving the same control grammar:

| Topology | Same grammar | Constraint that changes the design |
|---|---|---|
| Boost CCM | duty → plant → Vout | RHP zero moves with duty/load/L; non-minimum phase |
| Boost PFC | current/voltage feedback | double-line energy ripple; outer loop must stay slow relative to current shaping |
| PSFB | error → phase shift | ZVS commutation energy margin collapses toward light load |
| LLC | error → switching frequency | gain/plant depends strongly on normalized frequency, Ln and Q |
| Inverter | modulation/current/voltage loop | LC/LCL resonance and damping become explicit bandwidth constraints |

P5 includes deterministic first-attempt transfer checks and live constraint values derived from the same operating-point controls already present in Module 17. These are transfer-learning evidence, not physical-board certification.

## Learning outcome measurement

For new `core8` learner records, the formal outcome target is first-attempt accuracy across all eight causal layers, PRE/POST delta, competency-level gaps and 1/7/30/90-day retention. This answers the question “which layer of the same converter can the learner actually reason about on an unseen case?” rather than using page completion as mastery.

Historical `legacy4` records continue to report their original first-attempt, next-measurement and transfer metrics. Those metrics are not retroactively mapped onto `core8` because the instruments have different competency composition.

Diagnosis measurement remains explicit in Module 15 and topology-transfer measurement remains explicit in Module 17. They complement the core8 capstone instrument rather than being silently mixed into it.

The homepage and Module 19 display only real stored learner results. CI verifies the measurement machinery but never injects synthetic human improvement.

See `docs/learning-outcome-protocol.md`.

## Public-content boundary

This repository contains only public, de-productized teaching material. Do not commit company product identifiers, proprietary schematics/pin maps, proprietary command payloads, firmware snapshots, internal calibration/threshold/control coefficients, customer specifications, or unsanitized measurement logs.

Allowed content is the reusable engineering pattern: timing, scaling, protection latency, state invariants, producer/consumer ownership, control reasoning, fault isolation, sanitized evidence contracts and de-identified learning metrics.

## Validation

```text
node tools/validate-project.mjs
npm test
# CI also runs Host SIL, TI object compile, F2838x Flash link/HEX generation.
npm run test:e2e
```

The required `validate` job is the merge gate.

## Maintenance stop rule

Do not add another framework version merely to create infrastructure. New work must improve an unseen engineering judgment, diagnosis, transfer, retention, target/board truth, measured control evidence, or real physical evidence.
