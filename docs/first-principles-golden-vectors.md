# First-principles model golden vectors

## Purpose and evidence boundary

`tests/first-principles-golden-vectors.test.mjs` pins a small set of **hand-derived fixed analytical values** against the current registered teaching functions in `engineering-models.js` and `topology-transfer-v1.js`.

These are regression **reference checks**, not independent SPICE/PLECS agreement, numerical parameter-sweep qualification, dynamic switching validation, physical-board measurements, or proof of learner outcomes. Neither the model code nor a call to its output is used to generate an expected value at test runtime.

## Cases and assumptions

| Case | Fixed input | Expected quantity | Assumption |
| --- | --- | --- | --- |
| Buck CCM | Vin 48 V, D 0.25, L 400 µH, C 220 µF, R 8 Ω, ESR 20 mΩ, fs 100 kHz | Vout 12 V; ΔiL 0.225 App; IL,valley 1.3875 A; fLC ≈ 536.51 Hz; fESR ≈ 36,171.58 Hz | Lossless steady CCM and approximate ripple, ESR zero |
| Buck BCM/DCM gate | Vin 48 V, Vout 12 V, L 400 µH, fs 100 kHz | ΔiL 0.225 A, boundary Iout 0.1125 A; below boundary invalid CCM formula | Do **not** interpret the CCM-derived current peak as a verified DCM peak |
| Boost CCM | Vin 48 V, D 0.4, L 300 µH, C 220 µF, R 48 Ω | Vout 80 V; Gvd(0) ≈ 133.33 V/duty; RHPZ ≈ 9167.32 Hz | Ideal, continuous conduction |
| Boost PFC | 230 Vrms, 1.5 kW, Vbus 400 V, Cbus 680 µF, 50 Hz, η=97% | Iin,rms ≈ 6.723 A; 2ω = 100 Hz; bus ripple amplitude ≈ 8.777 V; outer pole ≈ 4.388 Hz | Unity PF, averaged line-energy balance, no switching losses; Vbus above line peak is necessary, not sufficient |
| PSFB | Vin 400 V, phase 90°, n 0.1, Llk 5 µH, Ccomm 2 nF | Ideal secondary mapping 20 V; ZVS energy index 1.5625 at 10 A and 0.0625 at 2 A | Approximate stored-energy sufficiency only; no real ZVS certification |
| LLC | Lr 20 µH, Cr 100 nF, Lm 120 µH, Q 0.5, fs≈112.54 kHz | fn≈1, normalized FHA gain≈1 | Steady-state FHA, not startup or frequency response |
| LCL inverter | L1 2 mH, L2 1 mH, Cf 10 µF | Ideal undamped resonance ≈1949.24 Hz | No grid impedance, damping, active control or device loss |

## Owner / test strategy

- Production model: `assets/learning/topology-transfer-v1.js` and `assets/learning/engineering-models.js`.
- Golden tests: fixed scalar values in `tests/first-principles-golden-vectors.test.mjs`, run via existing `npm test`.
- Existing metamorphic and domain tests stay authoritative for parameter sweeps, positive/negative tests, event timing and UI route behavior.
- Regression PASS requires the **exact PR SHA** plus `validate` including Windows/Linux/browser/firmware jobs.
- No state schema, lesson score, or safety/board logic changes in this PR.

## Next external-validation gate (still BLOCKED)

Before claiming independent model verification, obtain and archive a second, independent implementation (e.g. LTspice/PLECS or lab captures) with tool version, parameter sheet, operating-point validity, reference waveforms/transfer functions, numeric tolerance, source SHA and raw evidence artifact.

Do not upgrade `MODEL` to `BOARD_PASS`, `CONTROL_VALIDATION_PASS`, HIL or learner effectiveness without the required separate evidence.
