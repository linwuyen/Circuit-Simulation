# Board Binding and Evidence Contract

`board-binding.reference.json` is intentionally **not** a board certificate. It is the machine-readable boundary between the linked F2838x reference image and a real converter board.

## Truth ladder

```text
Teaching model
  -> Host SIL
  -> deterministic HIL
  -> TI C2000 compile
  -> linked Flash .out/.map/.hex
  -> board binding
  -> physical evidence
  -> BOARD_PASS
```

A lower layer cannot certify a higher layer.

## Target build

The reference manifest records the CI target image artifact. Required CI builds with pinned TI CGT/C2000Ware and produces:

- `c2000-buck-f2838x.out`
- `c2000-buck-f2838x.map`
- `c2000-buck-f2838x.hex` (Intel HEX)

The link includes C2000Ware `device.c`, `f2838x_codestartbranch.asm`, `2838x_FLASH_lnk_cpu1.cmd` and `driverlib.lib`; the map gate verifies the flash `codestart` region.

## Flash recipe

`tools/flash/f2838x-uniflash.sh` uses TI UniFlash/DSLite but intentionally requires:

- `DSLITE` — actual UniFlash CLI executable/script
- `F2838X_CCXML` — exported target configuration for the real probe/board
- optional `F2838X_UFSETTINGS`
- optional `F2838X_IMAGE` (defaults to the linked `.out`)

No CCXML means no flash attempt. The repository never guesses an XDS probe or board revision.

## BOARD_PASS gate

`BOARD_PASS` is valid only when all of the following are true:

1. `targetBuild.status` is `PASS` and names a non-empty image artifact.
2. Every entry under `bindings` is `VERIFIED` and names a non-empty source such as a public schematic/calibration record or deliberately sanitized lab record.
3. The eight required physical evidence items are all `PASS` and reference a non-empty artifact identifier/path.

`assets/learning/board-evidence-v1.js` implements this same gate for Node tests and the browser. Module 19 loads the reference manifest and can validate a local sanitized manifest; it does not offer manual PASS checkboxes.

## Required bindings

- PWM pinmux and gate-driver polarity
- ADC Vin/Vout/iL channel ownership
- ADC acquisition window
- voltage scaling
- current-sense zero/gain
- CMPSS input/threshold/filter policy
- dead time/complementary output policy
- startup and re-arm policy
- real communication owner for command freshness

## Required physical evidence

- PWM period/duty
- GPIO31 ISR timing/slack
- ADC SOC phase
- CMPSS/XBAR/DCAEVT1/TZ fault-to-PWM-low path
- soft-start waveform
- load-step Vout/iL response
- stale-command fail-closed behavior
- qualified fault re-arm

## What CI cannot do

CI can certify source, compiler/API compatibility, link placement, image generation, deterministic SIL/HIL and manifest integrity. It cannot connect a probe, know a private board schematic, or produce oscilloscope captures. Those remain `UNBOUND/MISSING` until real measurements exist.

The gate is fail-closed: changing the manifest to `BOARD_PASS` without target image + 9 verified bindings + 8 physical artifacts makes `npm test` fail.
