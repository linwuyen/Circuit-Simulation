# Board Binding and Evidence Contract

`board-binding.reference.json` is intentionally **not** a board certificate. It is the machine-readable boundary between the executable F2838x reference target and a real converter board.

## Truth ladder

```text
Teaching model
  -> Host SIL
  -> deterministic HIL
  -> TI C2000 target compile
  -> board binding
  -> physical evidence
  -> BOARD_PASS
```

A lower layer cannot certify a higher layer.

## BOARD_PASS gate

`BOARD_PASS` is valid only when all of the following are true:

1. Every entry under `bindings` is `VERIFIED` and names a non-empty evidence source such as a public schematic/calibration record or a deliberately sanitized lab record.
2. The eight required physical evidence items are all `PASS` and reference a non-empty artifact identifier/path.
3. The target has already passed the pinned TI compiler/C2000Ware CI gate.

The public repository starts with `boardClaim: UNCLAIMED`. That is the correct state until measurements exist.

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

The CI test is fail-closed: changing the manifest to `BOARD_PASS` without all required bindings and evidence makes `npm test` fail.
