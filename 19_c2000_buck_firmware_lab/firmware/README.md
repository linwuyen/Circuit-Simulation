# C2000 Buck Firmware Lab

This lab keeps one controller contract across model, Host SIL, deterministic HIL and the F2838x target binding. Passing a lower layer never certifies a higher layer.

## One semantic contract

`BuckControl_tick()` receives physical-domain values:

- `vin` — converter input voltage in volts.
- `vout` — regulated output voltage in volts.
- `iL` — inductor-current feedback in amperes. It is intentionally **not** named `iout`.
- `control_period_s` — controller integration cadence owned by configuration, not a hidden 10 us constant.
- `soft_start_volts_per_second` — a rate in SI units; the controller multiplies it by `control_period_s`.

Duty feed-forward is `soft_vref / vin`; neither the C controller nor HIL hard-codes 48 V.

## Host SIL

```sh
gcc -std=c11 -Wall -Wextra -Werror \
  19_c2000_buck_firmware_lab/firmware/buck_control.c \
  19_c2000_buck_firmware_lab/firmware/host_sil.c \
  -I19_c2000_buck_firmware_lab/firmware -lm -o /tmp/c2000-buck-sil
/tmp/c2000-buck-sil
```

CI runs this exact build. It proves only the pure-controller / averaged-plant invariants encoded by the test: nominal regulation, software OCP veto, command timeout, and disabled OFF state.

## TI C2000 target compile gate

The required GitHub `validate` job also compiles the target objects with the actual TI toolchain rather than a host compiler or source-text approximation:

- TI C2000 CGT `25.11.1.LTS`
- C2000Ware core SDK tag `REL_C2000Ware_v26.01.00.00.STS`
- F2838x CPU1, EABI, FPU32, TMU0 and VCU2 compile options

The gate compiles both `buck_control.c` and `f2838x_target.c`. A DriverLib symbol/API/compiler mismatch therefore blocks merge.

## F2838x target binding

`f2838x_target.c` closes the previously missing driverlib ownership:

1. TBCLKSYNC is disabled while the control pipeline is configured.
2. ePWM1 gets an explicit time-base mode, CMPA shadow load at ZERO, AQ behavior, SOCA at ZERO, and startup one-shot trip.
3. ADCA gets prescaler/mode/pulse configuration, `ADC_enableConverter()`, the required 500 us startup delay, three SOCs, and an interrupt from the final SOC.
4. CMPSS1 CTRIPH is explicitly routed through ePWM X-BAR TRIP4 into DCAH / DCAEVT1 and Trip Zone, asynchronously forcing EPWM1A low.
5. TBCLKSYNC is enabled only after PWM, ADC and hardware-veto configuration are complete.
6. The ADC ISR reads `Vin`, `Vout` and `iL`, executes the pure controller, then writes CMPA shadow.
7. Command freshness is owned by the communication producer through `BuckTarget_publishCommand()`. The ADC ISR cannot invent a heartbeat.

The command mailbox uses two payload slots and a 16-bit active-slot selector. A publisher fills the inactive slot completely and flips the selector last; the ADC ISR takes one bounded snapshot and never spins waiting for a pre-empted writer.

## Target truth boundary

The target source is deliberately executable **reference-lab binding**, not a board certificate. These items remain board-specific and must be rebound from the actual schematic/calibration record:

- EPWM1A pinmux and gate-driver polarity.
- ADC channel ownership and acquisition window.
- voltage-divider gains and current-sense zero/gain.
- CMPSS positive-input mux, DAC threshold and any digital-filter policy.
- dead time / complementary outputs when the real power stage needs them.
- board-safe startup, contactor/relay sequencing and qualified re-arm conditions.
- real communication ownership and freshness source.

The constants `VOUT_VOLTS_PER_ADC_V`, `VIN_VOLTS_PER_ADC_V`, `IL_ZERO_ADC_V`, `IL_AMPS_PER_ADC_V` and `CONTROL_OCP_DAC_CODE` are therefore reference values, not measured board calibration.

## Command ownership

A communication layer should call:

```c
BuckTarget_publishCommand(enable, clear_fault);
```

**only after** its frame has passed the product's CRC/version/range/ownership checks. Each new publication advances a sequence number. The control ISR resets `command_age_ticks` only when that published sequence changes. If communication stops while enable authority is requested, command age crosses the configured budget and the controller fails closed. Disabled authority remains safely OFF without requiring fabricated heartbeats.

## Deterministic HIL

The browser/Node HIL model uses the same `controlPeriodS`, `vin` and `iL` meaning as C. It injects:

- nominal regulation
- load step
- OCP
- OVP
- ADC invalid
- command timeout
- idle/disabled OFF

HIL is deterministic training evidence. It is not peripheral timing proof and not physical board proof.

## Board evidence contract

The machine-readable board gate lives at:

`19_c2000_buck_firmware_lab/board/board-binding.reference.json`

It starts as `boardClaim: UNCLAIMED`. Do not mark `BOARD_PASS` until all board-specific bindings are VERIFIED and physical captures demonstrate all eight items:

- PWM period and duty on the actual gate-command pin.
- GPIO31 ISR pulse width / execution slack.
- ADC SOC phase relative to the switching edge.
- CMPSS -> ePWM X-BAR -> DCAEVT1 -> Trip Zone forcing PWM low.
- soft-start Vout ramp.
- load-step Vout and inductor-current response.
- stale command fail-closed behavior from the real communication owner.
- fault re-arm only after the actual fault source and product qualifiers are safe.

`tests/board-evidence-contract.test.mjs` fails closed if `BOARD_PASS` is asserted without every binding source and all eight evidence artifacts.
