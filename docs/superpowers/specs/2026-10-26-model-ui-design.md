# Model correctness and usable experiment flow

Implement the authorized review fixes on a separate local branch from main a2219be95f660062b318db457cb71f68175f99de. Preserve the audit checkout, historical branches, learning records and existing course entry points. No push, PR, merge, deployment or package installation.

Use the current static HTML/CSS/JavaScript architecture. A framework replacement would increase migration risk; cosmetic-only edits would leave the demonstrated workflow and correctness failures. The chosen approach is focused changes to model contracts and the existing adapters, with behavioral regressions before production changes. This choice follows the user's detailed repair authorization and instruction to proceed with reversible assumptions.

Numeric contract:
- Invalid, empty, nonfinite or nonphysical inputs cannot produce normal status or durable valid machine evidence.
- The switched Buck model uses real PWM/ADC/trip event boundaries; reported sample times match the physical state used. Accuracy is checked against independent volt-second balance and step convergence.
- A command must be ready strictly before a load event, with a documented numerical tolerance, across timing owners.
- The AFE remains an explicitly educational proxy, not an H-bridge solver. Defaults must support the chosen load. Capacitor energy changes by signed input power minus load; exhausted energy is an explicit model limit, never hidden by 50/600 V clamping.
- Reset restores every dynamic engine state and waveform/readout while preserving clearly stated user parameters. Paused reset updates immediately.
- PF, DPF and sampled THD labels match the quantities actually computed; PLL text describes simulated time and finite acquisition.
- Retained narrow-peak crossover code is repaired without reattaching retired UI.

UI contract:
Keep existing functionality and records. Improve the actual route course -> parameter edit -> results/warnings -> compare/save -> reset/back. Provide valid field labels/units, local error feedback, an understandable invalid-results state, keyboard focus, wrapping legends and useful canvas alternatives. Work on the demonstrated sandbox and AFE friction plus course navigation; do not delete courses or merge independent oracle/model implementations.

Verification uses existing Node tests, static/graphics checks and installed browser facilities only. No new dependency. Run appropriate old and new suites on the final source; partial success must not be reported as complete regression coverage. Preserve RED/GREEN logs and review evidence outside the source checkout.
