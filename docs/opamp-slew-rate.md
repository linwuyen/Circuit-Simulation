# OP AMP Slew Rate / Dynamic Response Training

This content extension adds `opamp` as the 13th curriculum module without changing the V3 renderer or durable V5 learning-state schema.

## First-principles competency

Canonical competency: `opamp.large-signal.slew-rate`

The learner must be able to distinguish and connect four different limits:

1. **Slew Rate** — maximum large-signal output slope, `SR = max |dVout/dt|`.
2. **Full-Power Bandwidth** — for a sine, `SRrequired = 2π f Vpk` and `FPBW = SR/(2πVpk)`.
3. **Small-signal bandwidth / GBW** — gain and phase behavior when amplitude is kept small enough to avoid slew limiting.
4. **Settling time** — entering and remaining inside an accuracy band after the large-signal interval; `ΔV/SR` is only a lower-bound component, not the full settling specification.

## Curriculum

Six lessons:

- Slew Rate first principles
- Step response: slew then settling
- Sine / full-power bandwidth
- GBW vs Slew Rate diagnosis
- Settling time
- Datasheet selection from application requirements

Three labs:

- `opamp.lab.opamp-step` — machine + reasoning, ceiling B
- `opamp.lab.opamp-sine` — independent oracle, A-capable
- `opamp.lab.opamp-diagnose` — diagnostic judgment, ceiling B

The A-capable sine lab requires the worst of `SR+` and `SR−` to provide a 1.2–1.5 margin over `2πfVpk`, while the displayed required SR, FPBW, margin and limited/not-limited state must independently agree with a separate analytic implementation.

## Assessment

Official family: `opamp-slew-large-signal`

It uses baseline → unseen transfer → spaced retention with genuinely different representations:

- direct `SRrequired` calculation
- reverse `FPBW` calculation
- scope-waveform interpretation
- model selection from amplitude dependence

Seeded numeric open-response adds:

- `opamp-open-required-sr`
- `opamp-open-fpbw`
- `opamp-open-step-time`

Bayesian diagnostic case:

- `opamp-slew-vs-bandwidth-game`

The diagnostic case compares Slew Rate, small-signal bandwidth and output-rail hypotheses using amplitude reduction, measured zero-crossing slope, small-signal sweep and DC headroom tests.

## External validity

Primary anchor:

- TI Precision Labs — Op Amps, **Slew rate introduction**: https://www.ti.com/video/4078676441001
- TI Precision Labs — **Bandwidth - AOL gain slew rate**: https://www.ti.com/video/4078648294001
- Analog Devices AN-1026, **High Speed Differential ADC Driver Design Considerations**: https://www.analog.com/en/resources/app-notes/an-1026.html

The external golden vector uses 10 Vpp at 100 kHz, which requires approximately 3.14159 V/µs from `2πfVpk`.

External-anchor PASS validates the published equation and local golden vector only. It does not certify a real amplifier, PCB, load, thermal condition or settling requirement.

## Mutation guard

The OP AMP mutation campaign injects the classic **missing `2π` / wrong full-power slope** failure into the displayed required Slew Rate. The independent oracle must reject it. This extends the engineering mutation campaign from 12 to 13 representative paths.

## Model boundary

The interactive waveform uses a deliberately reviewable teaching model:

1. first-order closed-loop bandwidth based on `GBW / gain`;
2. asymmetric `SR+ / SR−` slope clamps;
3. separate reporting of pure-slew lower bound and a simple settling estimate.

Real devices may additionally be limited by output current, capacitive load stability, output swing, common-mode range, overdrive recovery, higher-order poles/zeros, compensation and temperature. These effects must not be inferred as certified by this teaching model.
