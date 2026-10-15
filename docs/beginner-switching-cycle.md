# Beginner switching-cycle explorer

## Purpose

The default Buck workspace now uses a post-operation **time scrubber** so first-time learners can observe one simulation switching cycle rather than infer the current path from a static circuit drawing.

The scrubber shows a sampled microstep from the existing `generic-power-causal-kernel` `waveform`:

- Switch ON: current path from DC source through switch, inductor, and load
- Switch OFF with `iL > 0`: diode freewheel path (inductor energy continues flowing)
- Switch OFF and approximately zero inductor current: idle/zero-current region, **no claim of valid DCM inductor voltage slope**
- Model-provided `vL` and `di/dt` from the same microstep update, never recomputed in the browser
- A time slider/cursor aligned to the *single-cycle* current waveform, not the 16-ms startup plot

This is an explanatory simulated view; gate/diode paths do **not** represent measured semiconductor conduction or full circuit parasitics.

## Evidence and protection invariants

- No new power physics formula or state owner; existing kernel provides `gate`, `iL`, `vOut`, `vL`, `diDtAperS`
- Does not change PWM safety veto, control state transitions, score, Evidence V5 or formal assessment
- Hidden before first simulated operation and during unanswered 36 V transfer tests
- Reuses existing eight lessons, one-cycle chart and stored experiment record
- Idle case intentionally masks the simplistic clamped CCM equation's negative derivative: this is not a DCM solver
- The current slider is **explanatory**, not a claim of measuring an actual transistor or diode

## Verification

- `tests/switching-lesson-v1.test.mjs`: compare projected ON/freewheel states, current, time, inductance voltage/slope to actual kernel sample values and verify idle-case masking
- `tests/e2e/continuous-workspace.spec.js`: after-operation visibility, ON→OFF SVG path updates, waveform cursor, and unseen-transfer masking
- Required exact-head Windows/Linux/Firmware/Browser/aggregate `validate`

## Future expansion

Use the same “point to a time and explain cause” interaction for ADC acquisition, PWM shadow update, closed-loop feedback and hardware trip, with each stage grounded in existing event/trace evidence and novice hints. Independent analog circuit simulations, measured board switching waveforms and learning outcomes remain separate gates.
