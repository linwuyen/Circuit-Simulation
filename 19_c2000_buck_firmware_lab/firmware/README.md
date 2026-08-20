# C2000 Buck Firmware Lab

This lab separates one power-supply controller into three evidence levels:

1. **Host SIL** — `buck_control.c` compiles with a normal C11 compiler and proves deterministic controller invariants.
2. **C2000 target binding** — `f2838x_target.c` maps the same controller to C2000Ware driverlib: ePWM SOCA → ADC SOC/EOC → ISR → CMPA, with CMPSS → Digital Compare → Trip Zone as the fail-closed safety veto.
3. **HIL / board evidence** — the browser/Node HIL harness injects deterministic faults. The board checklist defines what must be captured on real hardware; it does not fabricate board measurements.

## Host SIL

```sh
gcc -std=c11 -Wall -Wextra -Werror \
  19_c2000_buck_firmware_lab/firmware/buck_control.c \
  19_c2000_buck_firmware_lab/firmware/host_sil.c \
  -I19_c2000_buck_firmware_lab/firmware -lm -o /tmp/c2000-buck-sil
/tmp/c2000-buck-sil
```

CI runs this exact build.

## F2838x target build

Prerequisites:

- TI C2000Ware with F2838x driverlib
- TI C2000 Code Generation Tools
- a board-specific linker command file and pinmux
- real current-sense scaling bound into `BuckControlInput.iout`

Compile `buck_control.c` and `f2838x_target.c` in a normal C2000Ware project. The target file intentionally keeps hardware access in driverlib symbols rather than raw register magic numbers.

## Board evidence contract

Do not call the board stage PASS until all of these are captured from physical hardware:

- PWM period and duty on the gate-command pin
- GPIO31 high pulse from ADC ISR entry to compare update
- ADC SOC phase relative to PWM switching edge
- CMPSS / Trip Zone response from injected over-current to PWM forced low
- soft-start Vout ramp
- load-step Vout and current response
- command-timeout fail-closed behavior
- fault-latch clear only after the source is physically safe

The repository can validate the model, SIL, target API contract, and HIL scenarios automatically. Physical board captures require the actual target, probe, and load.
