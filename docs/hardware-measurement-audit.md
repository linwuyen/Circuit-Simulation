# Hardware/measurement correction vectors (PR 135)

These are executable **teaching-model** regressions, not independent circuit-simulator results, TI library certification, or board measurements.

Run: `node --test tests/hardware-measurement-audit.test.mjs`.

## AFE

Both `afe.html` and `simulator-core.html` used the same derivative to integrate alpha and beta and applied an unnormalized volts-valued error to the PLL. The 60 Hz/155 V test became nonfinite. Independent SOGI states now follow `alpha' = omega*(k*(v-alpha)-beta)` and `beta' = omega*alpha`, with midpoint integration. For a sine input beta lags by 90 degrees; the phase detector is `(alpha*cos(theta)+beta*sin(theta))/155`. Frequency correction is limited to ±20% nominal.

Negative vectors: two seconds of a 155 V peak 60 Hz input must yield finite, ~155 V quadrature magnitude and <0.03 normalized waveform RMS error; a 45-degree phase step plus harmonics must recover. Capacitor energy must increase by `(v*i-Pload)*dt`, not by treating the instantaneous current as a peak amplitude. Zero current cannot yield PF=1; reverse current must give negative sampled PF.

PF is `sum(v*i)/sqrt(sum(v²)*sum(i²))` over approximately one nominal 60 Hz period. It has finite-window/transient error and is not efficiency. The current plant remains an explicitly labelled first-order proxy, not a switching bridge or LCL solver. Voltage rail clamps are model boundaries, not protective hardware evidence.

Reference: [TI SOGI description](https://software-dl.ti.com/C2000/c2000_apps_public_sw/c2000ware_sdk/digitalpowersdk/5_03_00_00/html_guide/group__SPLL__1PH__SOGI.html).

## DDS

Per-sample EMA subtraction filtered the measured AC waveform as well as DC: a 120 V peak quadrature vector produced 81.835 V RMS instead of 84.853 V and biased PF. The dashboard now holds the previous valid cycle's raw ADC mean throughout the next cycle. It does not claim to execute TI's production PML implementation.

Invalid short windows discard numerators together with the denominator. Timeout/overlong windows discard both cycle and multi-cycle power/frequency accumulators before reacquisition. Regression vectors include quadrature PF≈0, a late zero crossing, short jitter, no-crossing timeout, and post-timeout recovery at 50 Hz with PF=-sqrt(3)/2. The signed PF is retained in the dashboard.

Applicability: 45–65 Hz cycle detection, steady periodic unclipped signals. Offset/frequency changes and noisy crossings have settling error; fixed-current offset remains a model assumption. The separate micro-lessons are explicitly simplified residual-offset models, not this dashboard's estimator.

## C2000 memory and acquisition clock

For F2838x, ACQPS encodes acquisition SYSCLK cycles minus one, while conversion uses ADCCLK. ACQPS=14 at 200 MHz means 75 ns, not 300 ns; this does not assert sufficient settling for every source impedance/resolution. [TI ADC API](https://software-dl.ti.com/C2000/docs/C2000_driverlib_api_guide/f2838x/build/html/modules/adc.html).

CPU1-to-CM data uses dedicated directional message RAM, not C28x GS RAM. The lesson's handshake does not prove address mapping, word/byte addressing or ordering. [TI memory ownership table](https://software-dl.ti.com/C2000/docs/C2000_Multicore_Development_User_Guide/memories.html).

The RC lesson now compares e^(-t/180 ns) against a 12-bit, full-scale-step half-LSB criterion: 600 ns leaves 3.57% residual; approximately 1622 ns is required. It does not claim total ADC accuracy. The full timing lesson now identifies its legacy `state.acq` as an external-result wait with illustrative 550 ns readiness, not an internal ACQPS setting or an LTC2353 timing guarantee. Real external conversion/BUSY and serial transfer must be separately established.
