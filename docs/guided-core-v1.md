# Guided Core v1 · Power Firmware teaching surface

This is a teaching-order change, not a new persistence/measurement framework version. Existing canonical IDs, evidence history, independent oracles and retention semantics remain authoritative.

## Product decision

The default learner surface now treats the repository as **one Buck converter built in eight layers**, rather than a flat list of modules:

```text
1. Power Physics
2. Sensing
3. Feedback Control
4. Sample → Compute → Actuate Timing
5. Dynamics / Math Lens
6. Safety Veto
7. Production State / Command / Data Ownership
8. SIL → HIL → Target → Board Capstone
```

Module 16 remains the math/control lens. Module 17 becomes the topology transfer atlas. Module 18 remains a reusable feedback grammar rather than another mandatory course. The complete module library is still available.

## Learner-facing loop

Every guided lesson should converge on the same engineering loop:

```text
Physical plant
   ↓
Sense / scale
   ↓
ADC sample
   ↓
Compare reference and feedback
   ↓
Controller C(z)
   ↓
Actuator command
   ↓
PWM/phase/fsw physical commit
   ↓
Physical plant
```

Protection is not drawn as an ordinary software block:

```text
Fault → comparator / qualification → trip routing → PWM veto
```

## P0 truth closure

The executable C2000 Buck capstone now uses one semantic contract across host SIL, HIL and target binding:

- `vin`, `vout`, `iL` are physical-domain inputs.
- `control_period_s` / `controlPeriodS` owns integrator cadence.
- feed-forward uses measured/bound `vin`; the controller does not hard-code 48 V.
- command freshness belongs to the external command producer; the ADC ISR cannot invent a heartbeat.
- ePWM time-base/AQ/shadow-load setup is explicit.
- ADC clock/mode/power-up/startup delay is explicit.
- CMPSS CTRIPH → ePWM XBAR TRIP4 → DCAEVT1 → Trip Zone routing is explicit.
- startup PWM is held fail-closed by a software OST until a fresh validated enable command grants authority.

Board pinmux, sensor calibration, actual comparator mux/threshold, gate-driver polarity, dead time and physical re-arm qualification remain board-specific and cannot be certified by CI.

## Precise dynamic lesson models

### Ideal Buck switching-cycle view

The guided waveform uses ideal CCM identities only:

```text
D = Vout / Vin
T = 1 / fsw
Ton = D·T
Toff = (1−D)·T
(di/dt)ON  = (Vin−Vout)/L
(di/dt)OFF = −Vout/L
ΔIL = (Vin−Vout)·Ton/L
```

The displayed waveform is computed from these equations. Volt-second residual is shown explicitly and should be numerical roundoff near zero for the ideal identity.

Default vector:

```text
Vin = 48 V
Vout = 12 V
L = 200 µH
fsw = 100 kHz
D = 25 %
Ton = 2.5 µs
Toff = 7.5 µs
(di/dt)ON = +0.18 A/µs
(di/dt)OFF = −0.06 A/µs
ΔIL = 0.45 A p-p
```

This view does not model DCR, switch/diode loss, dead time, ESR, startup or closed-loop transient behavior.

### Sample-to-actuate view

The timing view assumes:

- ePWM SOCA at TBCTR = ZERO;
- ADC acquisition/conversion then interrupt entry then control compute;
- CMPA shadow load only at ZERO;
- a compare write must finish **strictly before** the intended load event to affect that event.

For crossover `fc`, the lesson reports only the pure timing contribution:

```text
phase loss = −360° · fc · Td
```

It is explicitly **not** total phase margin; plant dynamics, ZOH, analog filtering and other delay terms remain separate.

Default vector:

```text
fsw = 100 kHz → T = 10 µs
ADC = 1.2 µs
ISR entry = 0.3 µs
compute = 4.0 µs
compute done = 5.5 µs
physical CMPA commit = 10 µs
missed ZERO = 0
sample-to-actuate Td = 10 µs
fc = 10 kHz → timing-only phase = −36°
```

Fault-injection vector:

```text
compute = 9.0 µs
compute done = 10.5 µs
next eligible ZERO = 20 µs
missed ZERO = 1
Td = 20 µs
fc = 10 kHz → timing-only phase = −72°
```

Unseen transfer vector:

```text
fsw = 200 kHz → T = 5 µs
same 5.5 µs sample-to-compute path now misses the 5 µs ZERO
physical commit = 10 µs
```

## P1–P3 learning KPIs

The default page exposes these in learner language:

1. **First attempt** — commit a directional prediction before seeing the result.
2. **Next measurement** — choose the measurement with the largest diagnostic value before changing gains/code.
3. **Unseen transfer** — change real engineering conditions, not merely prompt wording.
4. **Retention** — retrieve later at 1d/7d/30d/90d using the existing measurement system.

Framework terms such as evidence grade, A-capable oracle and statistical coverage remain available under an advanced disclosure instead of dominating the first screen.

## Stop rules

- Do not add another module merely to explain the same feedback grammar.
- Do not let model/HIL/SIL PASS imply Target or Board PASS.
- Do not animate a waveform independently from the equations used for displayed metrics.
- Do not silently convert a missed shadow-load event into same-cycle actuation.
- Do not tune PI before verifying sensing scale and effective sample-to-actuate timing when the evidence points there.
