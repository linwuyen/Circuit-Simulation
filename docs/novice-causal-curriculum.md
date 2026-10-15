# From first-year circuits to digital power: staged causal teaching

## Learning goal

The eight continuous Buck exercises remain the authoritative beginner route. They now provide novice-level prompts without replacing the registered simulator or altering answer/grading logic.

| Learner phase | What appears | What must stay hidden |
| --- | --- | --- |
| Before first prediction | Component vocabulary / first-principles baseline (no graded direction or numeric solution) | Model result, post-transfer explanatory answer |
| After running model | Exactly what to inspect in the existing plot, sampled numbers, switching cycle or event timeline | Future 36 V result |
| After an incorrect observation or reason | Optional misconception-specific clue, not automatic scoring correction | New-condition model result |
| After successfully completing 36 V transfer | Full causal explanation + a prompt to explain without multiple-choice scaffolding | No hidden transfer answer remains |

Guides live in `engineering-curriculum.js::workbenchGuides` (the single curriculum owner). `workspace-experiment-ui.js` renders them based on the existing `shown`, `record.operated`, `record.first`, `observationFirst`, `reasonFirst` and `record.transferPassed`; no new persistence key.

## Areas covered

- Buck: PWM on-time, capacitor/output response, and inductor volt-second relation
- Inductor freewheel: diode path during OFF; switch and iL scrubber are sampled from the registered model
- Demand: compare Vout and Iout, avoid unqualified CCM conclusions
- ADC: physical output versus sensed number, including wrong gain
- Feedback: reference vs sensed output; controller command vs physical response
- PWM timing: ADC -> ISR -> computation -> shadow write -> next load
- Dynamics: full start-up peak/overshoot versus final average
- Protection: separate control request and Trip veto, with remaining energy

## Scope and acceptance

This is a **guided teaching improvement**, not proof that all beginners learn successfully. Five unscripted first-time learners still need to attempt the first two lessons and the ADC/PWM/feedback/protection path without the README; log reachability, predictions, misconceptions, time to first correct causal explanation and unseen-condition transfer.

Automated tests verify the eight guides have required fields, stage-based rendering, wrong-attempt hints, and protected V5 first-attempt and transfer behavior. Maintain exact-head Ubuntu/Windows/Browser/Firmware/aggregate PASS before merge.

## Rollback

Revert the separate guide PR: only curriculum text, its renderer, visual styles and tests are touched. The switch/timing readout introduced in the preceding PR is not removed, and Evidence V5 storage requires no migration.
