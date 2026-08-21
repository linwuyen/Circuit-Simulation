# Board Binding and Evidence Contract

`board-binding.reference.json` is intentionally **not** a board certificate. It is the machine-readable boundary between the linked F2838x reference image and a real converter board.

## Truth ladder

```text
Teaching model
  -> Host SIL
  -> deterministic HIL
  -> TI C2000 compile
  -> linked Flash .out/.map/.hex
  -> physical closure package
  -> control validation
  -> board binding + physical evidence
  -> BOARD_PASS
```

A lower layer cannot certify a higher layer.

## Target build and flash recipe

Required CI builds with pinned TI CGT/C2000Ware and produces:

- `c2000-buck-f2838x.out`
- `c2000-buck-f2838x.map`
- `c2000-buck-f2838x.hex`

`tools/flash/f2838x-uniflash.sh` requires a real `DSLITE` and exported `F2838X_CCXML`. The repository never guesses an XDS probe or board revision.

## P4-A · physical closure package

Start from `board-closure.template.json` and record only sanitized real-board evidence.

The package is stricter than the public board manifest. A valid flash session requires:

- linked image artifact reference;
- real exported CCXML artifact reference;
- probe identity;
- flash timestamp;
- observed reset/boot after programming.

Every one of the nine bindings must be `VERIFIED` with typed provenance `{kind, ref, verifiedAt}`. Every one of the eight physical captures must be `PASS` and accepted with artifact metadata `{ref, sha256, instrument, capturedAt}`.

Validate it with:

```sh
node tools/board/verify-board-closure.mjs board-closure.json --emit-manifest board-binding-evidence.json
```

`assets/learning/physical-board-closure-v1.js` derives the ordinary board manifest only after those provenance gates pass. `BOARD_PASS` cannot be manufactured by changing one status string.

## P4-B · physical control validation

`control-validation.template.json` defines four measured control checks:

1. load-step droop / overshoot / settling;
2. sample-to-actuate timing and strict PWM shadow-load commit;
3. hardware trip fault-to-PWM-low latency;
4. measured SFRA vs model Bode magnitude/phase.

Each analysis also requires capture provenance with artifact reference, SHA-256, instrument and capture timestamp.

Run:

```sh
node tools/board/analyze-control-validation.mjs control-validation.json
```

A passing bundle reports `CONTROL_VALIDATION_PASS`. That means the four measured control checks passed their supplied engineering limits. It **does not imply `BOARD_PASS`** and does not replace the nine bindings/eight board evidence items.

## BOARD_PASS gate

`BOARD_PASS` is valid only when all of the following are true:

1. target image/real flash closure is supported by the physical closure package;
2. every required binding is verified with provenance;
3. all eight physical evidence items pass with real artifact provenance.

Module 19 exposes the reference manifest, P4-A physical closure loader and P4-B control-validation loader. All three default to fail-closed / missing states.

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

CI can certify source, compiler/API compatibility, link placement, image generation, deterministic SIL/HIL and the integrity of these evidence contracts. It cannot connect a probe, know a private board schematic, flash a board in this environment, or create oscilloscope/SFRA captures.

Therefore the committed reference remains `UNBOUND/MISSING` until real measurements exist. The software path for P4-A/P4-B is complete; physical truth still requires physical hardware.
