# TI primary-source engineering learning

This directory connects official TI power/C2000 documents to the repository's existing evidence-driven learning model.

## Loop

```text
engineering problem
→ learner prediction
→ TI primary source
→ causal model correction
→ waveform / timing / measurement prediction
→ project mapping
→ grade
→ 1 / 3 / 7 / 30 day retrieval
```

The PDFs are **not committed**. `manifest.json` keeps the authoritative source URLs. `tools/learning/ti-docs.mjs` downloads them into gitignored `.learning-cache/ti/`, verifies the PDF payload, and records SHA-256 plus final URL in `download-report.json`.

## Commands

```bash
npm run learning:ti:validate
npm run learning:ti:download
npm run learning:ti:plan
npm run learning:ti:session
node tools/learning/engineering-learning.mjs grade --concept buck-energy-flow --result pass
```

Optional deterministic date/state:

```bash
node tools/learning/engineering-learning.mjs plan --date 2026-09-24 --state .learning-cache/learning-state.json
```

## Grade contract

| Grade | Meaning | Next retrieval |
|---|---|---:|
| FAIL | causal model is wrong | 1 day |
| PARTIAL | result may be right, reasoning incomplete | 3 days |
| PASS | causal chain and evidence are sound | 7 days |
| TRANSFER | model works in a changed topology/context | 30 days |

New concepts start with prediction. Reviews move toward diagnosis and then transfer; vocabulary recall alone does not count as mastery.

## Ownership

AI owns source organization, question selection, scheduling and causal-gap review. The learner owns prediction, explanation, waveform/timing reasoning, engineering judgement and physical evidence.


## GitHub cloud fallback: Codespaces

If GitHub-hosted Actions cannot allocate a runner, use GitHub Codespaces instead of a local PC. Creating the repository Codespace automatically runs:

```bash
npm ci --no-audit --no-fund
npm run learning:ti:bootstrap
```

That command downloads and validates all TI PDFs, writes SHA-256 provenance, and generates `.learning-cache/today-session.md`. See [`docs/ti-learning-codespaces.md`](../../docs/ti-learning-codespaces.md).

The Actions workflow is intentionally manual while the account-level runner block is unresolved, avoiding repeated failed private-repo runner attempts.


## Web learning workspace

The learner-facing TI flow is part of the existing `circuit-learning-state-v5` workspace, not a second terminal product.

Open:

```text
learn.html#ti-learning
```

Current web MVP closes one real concept loop for `buck-energy-flow`:

`predict → change Duty → simulate first PWM cycle → observe waveform → explain causality → grade → next review date`.

The first-cycle view intentionally holds the old Vout during the first PWM period so the learner can see the immediate causal effect of duty: state voltages/slopes are initially unchanged, while dwell time changes and produces temporary volt-second imbalance. The CLI/Codespace workflow remains verification and source-ingestion tooling only.
