# Five-gap first-principles follow-up — 2026-10-24

Baseline: 27711875c24527fafffe9dfa527cceb43f759f36 on the local fix/first-principles-review-20261021 branch. This batch is local and unpublished. The old green CI run 40010698686 tested synthetic PR merge 08d1070c7d666ee20819f4d570de36c088936244 against base ed5566da8896db3cd9754e46ec7ecf72e3ade8b9; it is not evidence for this working-tree follow-up.

## Results and independent negative vectors

| Gap | First-principles correction / scope | Actual focused evidence |
|---|---|---|
| AD5543 | For unsigned D, Vout=-VREF*D/65536 retains one digital gain sign. Signed/AC VREF alone is two-quadrant; reference-offset summing gives (D/32768-1)*VREF and a signed digital factor. Corrected active ratio/application teaching; correct polarity lesson and model retained. | New executed lesson/model regression RED 2 pass/3 fail → GREEN 5/5; related DAC/measurement 31/31. |
| Opamp clamp interval | Clamp ends when remaining error equals SRdirection*tau. Thus t_ramp=max(0,(abs(deltaV)-SRdirection*tau)/SRdirection), not a lower bound of abs(deltaV)/SR. Full-excursion SR scale and precision settling are distinct. | New regression RED 1 pass/6 fail → GREEN 7/7; related opamp 42/42. For A=8 V,tau=1 us: SR+=2 gives3 us ramp vs4 us full-excursion scale; SR-=0.5 gives15 vs16 us. Small steps can have zero clamp interval. Model unchanged. |
| AFE readouts | Both active routes now display sqrt(sum(v[n]^2)/N) over the visible sample window. Canvas/topology labels disclose the finite20 ms window (400 samples,50 us); startup zeros are included and empty window returns0. This is not a whole-cycle/fundamental RMS claim. PF/power and engine equations are unchanged. | Behavioral display regression RED 0/20 → GREEN20/20; with existing measurement regression38/38. Harmonic fixtures independently produce7.6 V while the old peak formula reports7.0 or9.9 V. |
| DDS endpoints/rate switch | A real sampled endpoint alternates between floor(Fs/f) and ceil(Fs/f). Use inclusive floor(Fs/65)..ceil(Fs/45) as a coarse single-cycle filter, then qualify10 consecutive complete cycles by their total elapsed sample count. First synchronize the sign and acquire a genuine crossing; its fragment is discarded. No authoritative measurement is published before qualification. Invalid cycles break the batch. A rate change clears partial/batch/acquisition/qualified state and waveform history while retaining the ADC offset estimate. | Initial RED4 fail/2 pass → GREEN6/6. Independent review then reproduced low-rate66 Hz leakage and a phase-continuous partial cycle; added RED5 pass/2 fail → final GREEN7/7, new+existing measurement25/25. All36 sample rates5..40 kHz exercise45,60,65 and reject44/66 Hz. Actual DDS phase continues across four rate switches; no accepted or batched measurement precedes two genuine crossings. |
| Active transfer numeric readout | Existing first/result selection is already correct. Added real desktop/mobile energy flow + reload with an independent switched-buck RK4 numeric reference. No production change for this item. | Current code2/2 PASS; stale before/after response mutation2 expected FAIL; restored2/2 PASS. Active36 V mean8.9902→14.3819 V versus stale48 V mean11.9869→19.1759 V; independent peak/current/ADC assertions also retained. |

AD5543 primary source: [Analog Devices AD5543/AD5553 Rev. H](https://www.analog.com/media/en/technical-documentation/data-sheets/ad5543_5553.pdf), p9 Eq.1 and p11 Eq.3/Figure22.

The existing DDS jitter/timeout/overlong fixtures now establish real negative→positive→negative samples to arm the detector before injecting a partial snapshot; all accumulator assertions remain. Their starting count now uses the actual maximum admissible cycle length, so the next sample is genuinely overlong after endpoint445 is accepted at20 kHz.

## Validation and review

- Clean baseline unit suite:457/457 PASS (Node22.22.3, Windows).
- Focused RED/GREEN logs, independent derivations and browser mutation traces are preserved outside the repo under delivery/five-gap-review-20261024.
- Initial local aggregate: static PASS,495 unit PASS,461 browser PASS/3 intentional skips. The independent review nevertheless found two DDS gaps; those initial results are retained as history and are not final evidence for the later qualification/arming changes.
- Independent initial review found no additional gaps in AD5543, opamp, AFE or numeric transfer coverage and independently recomputed the RK4 oracle. DDS re-review approved the final source with57/57 focused tests,1440 independent DDS cases with0 failures, and eight phase-continuous invalid-to-valid recovery sequences.
- Static project validation retains one pre-existing warning on the unchanged historical10 us route: tutor injection missing.
- Final aggregate receipt will identify the tested local diff and all actual failures/skips. New GitHub CI remains NOT_RUN because publication is not authorized in this batch.

## Remaining boundaries

This is a five-gap follow-up, not proof that all22 historical acceptance findings are closed. The original table is an implementation/evidence inventory, and these newly found gaps demonstrate why a green suite is not universal closure. The AFE metric is explicitly finite-window sampled RMS. DDS frequency discrimination retains integer-sample resolution near45/65 Hz and a finite ten-cycle acquisition/detection interval; it does not police live frequency changes instantaneously. The opamp remains a clamped one-pole teaching model. The simple AD5543 topology is not silently promoted to bipolar hardware. Independent SPICE/PLECS equivalence, physical measured control/BOARD_EVIDENCE, and human learning effectiveness remain unclaimed. No hardware, GitHub write, merge, or deployment occurred in this batch.


## Final local validation — completed

Windows, Node22.22.3 / Playwright1.54.2:
- Project static validation PASS (622 files), with the single pre-existing historical10 us tutor-injection warning retained.
- Dynamic visual audit PASS.
- Bare npm test:496 passed,0 failed,0 skipped.
- Final complete desktop/mobile Playwright suite (--workers=2):461 passed,0 failed,3 intentional existing mobile duplicate-visual skips.
- Post-review related hardware/measurement browser suite:10/10 PASS.
- Independent review: no remaining Critical/Important/Minor correctness findings in these five requirements;57 focused tests and1440 independent DDS cases passed.
- Full source was frozen through the final browser run; final DDS hashes match the independent reviewer. Documentation status updates do not alter tested production/test code.

All actual logs (including initial green aggregates that missed the later review vectors), both review reports, negative-control traces and final file hashes remain in the external five-gap-review-20261024 delivery directory. The local Git branch still has these changes uncommitted against2771187. A complete review patch and final receipt bind the changed files. No publication or new-SHA GitHub result is claimed. Firmware/TI compilation was not rerun in this lesson/measurement batch; previous2771187 CI remains historical evidence only.
