# C2000 Buck Firmware Lab

This lab keeps one controller contract across model, Host SIL, deterministic HIL and the F2838x target binding. Passing a lower layer never certifies a higher layer.

## One semantic contract

`BuckControl_tick()` receives physical-domain values:

- `vin` — converter input voltage in volts.
- `vout` — regulated output voltage in volts.
- `iL` — inductor-current feedback in amperes.
- `control_period_s` — controller integration cadence owned by configuration.
- `soft_start_volts_per_second` — SI rate multiplied by `control_period_s`.

Duty feed-forward is `soft_vref / vin`; neither the pure C controller nor HIL hard-codes 48 V.

## Host SIL

```sh
gcc -std=c11 -Wall -Wextra -Werror \
  19_c2000_buck_firmware_lab/firmware/buck_control.c \
  19_c2000_buck_firmware_lab/firmware/host_sil.c \
  -I19_c2000_buck_firmware_lab/firmware -lm -o /tmp/c2000-buck-sil
/tmp/c2000-buck-sil
```

This proves only the pure-controller / averaged-plant invariants encoded by the test.

## TI C2000 target compile + image gate

Required GitHub `validate` uses:

- TI C2000 CGT `25.11.1.LTS`
- C2000Ware core SDK `REL_C2000Ware_v26.01.00.00.STS`
- F2838x CPU1 / EABI / FPU32 / TMU0 / VCU2

`tools/ci/build-f2838x-target.sh` first compiles `buck_control.c` and `f2838x_target.c` as a fast API/compiler contract.

`tools/ci/build-f2838x-image.sh` then closes the actual Flash build path:

1. compile `buck_control.c`, `f2838x_target.c`, C2000Ware `device.c`, and `f2838x_codestartbranch.asm` with `_FLASH` + `CPU1`;
2. link with TI's `2838x_FLASH_lnk_cpu1.cmd`, C2000Ware `driverlib.lib`, RTS, `--entry_point=code_start` and `--rom_model`;
3. verify the link map includes `codestart` in the F2838x Flash entry region;
4. generate Intel HEX with `hex2000 -i -romwidth 16 -memwidth 16`;
5. require non-empty `.out`, `.map` and `.hex` and upload them as the `c2000-buck-f2838x-flash-image` CI artifact.

This is a **linked reference image**, not proof that a specific external board is wired correctly.

## Flash recipe

`tools/flash/f2838x-uniflash.sh` is deliberately parameterized. It requires the actual UniFlash/DSLite executable and the actual exported target CCXML:

```sh
DSLITE=/path/to/dslite.sh \
F2838X_CCXML=/path/to/actual-board.ccxml \
bash tools/flash/f2838x-uniflash.sh
```

Optional `F2838X_UFSETTINGS` and `F2838X_IMAGE` may override settings/image. The default image is `build/f2838x-flash/c2000-buck-f2838x.out`.

The script refuses to guess a probe, board revision, security setting or flash option.

## F2838x target binding

`f2838x_target.c` owns:

1. TBCLKSYNC disabled during pipeline setup.
2. ePWM1 time base, CMPA shadow load at ZERO, AQ, SOCA, and startup OST.
3. ADCA prescaler/mode/startup, three SOCs and interrupt source.
4. CMPSS1 CTRIPH → ePWM X-BAR TRIP4 → DCAH/DCAEVT1 → Trip Zone LOW.
5. TBCLKSYNC enabled only after the ADC ISR ownership is installed.
6. ADC ISR reading `Vin`, `Vout`, `iL`, executing the pure controller, then writing CMPA shadow.
7. command freshness owned only by `BuckTarget_publishCommand()`.

The command mailbox uses two payload slots plus a 16-bit active-slot selector; the ADC ISR never spins waiting for a pre-empted publisher.

## Target truth boundary

The linked target remains a **reference-lab binding**, not a board certificate. The following still require the actual schematic/calibration/evidence record:

- EPWM pinmux and gate polarity
- ADC channel ownership and acquisition time
- voltage/current calibration
- CMPSS input / threshold / filter policy
- dead time / complementary outputs
- startup / relay / re-arm policy
- real communication freshness owner

Reference scale/threshold constants are not measured board calibration.

## Command ownership

A communication layer calls:

```c
BuckTarget_publishCommand(enable, clear_fault);
```

only after its frame passes its own validity/ownership checks. The control ISR resets command age only when the published sequence changes. A stale enabled command fails closed; disabled authority remains OFF without fabricated heartbeats.

## Deterministic HIL

The browser/Node HIL uses the same cadence, `vin` and `iL` semantics as C and injects nominal, load-step, OCP, OVP, ADC invalid, command timeout and idle/OFF scenarios.

HIL is deterministic training evidence. It is not physical board proof.

## Board evidence contract

`19_c2000_buck_firmware_lab/board/board-binding.reference.json` starts `UNCLAIMED` even though its CI target-image field is PASS.

`BOARD_PASS` requires all three:

- linked target image artifact
- 9/9 board-specific bindings VERIFIED with non-empty sources
- 8/8 physical evidence captures PASS with non-empty artifact references

`tests/board-evidence-contract.test.mjs` and `assets/learning/board-evidence-v1.js` enforce the same fail-closed rule in CI and the browser.
