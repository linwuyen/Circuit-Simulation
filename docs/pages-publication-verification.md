# GitHub Pages publication verification

## Deployment owner

- Public site: https://linwuyen.github.io/Circuit-Simulation/
- Pages Settings: `Deploy from a branch` → `main` → `/(root)`.
- `index.html` and `.nojekyll` live at the repository root.
- `.github/workflows/validate.yml` runs software and browser **tests**. A passing `validate` run is **not** evidence that GitHub Pages has published a site.

## Automated post-push smoke

`.github/workflows/pages-smoke.yml` runs on pushes to `main`, or manually via `workflow_dispatch`. It requests the published HTML and a selected subset of critical assets from the public GitHub Pages URL, with retries to allow for the Pages publication delay.

It requires HTTP success and byte-for-byte agreement with these files in the checked-out commit:

- `index.html`
- `assets/learning/workspace-ui.js`
- `assets/learning/workspace.css`
- `assets/engineering-sandbox-core.js`

**Evidence boundary:** a PASS certifies only public retrieval and agreement of these **sampled files** with the checkout. Unchanged sampled assets do not prove that GitHub Pages is serving the full exact commit. It does not establish complete dependency closure, interactive browser behavior, user learning, independent model verification, or real-board evidence.

## Manual publication acceptance

For each release, capture the following separately:

1. GitHub **Pages build and deployment** run, status, source SHA and URL.
2. `pages-smoke` workflow run and results, with the exact checkout SHA.
3. Unauthenticated desktop and mobile browser checks: first lesson begins, JS Console has no uncaught exceptions, CSS and JS load, a single experimental change produces visible output, and reload preserves progress.
4. `validate` workflow at the **same source SHA** with jobs, steps and artifacts. If Actions fails before a runner starts, classify it as **CI infrastructure blocked**, not a failing model test.

**PASS:** Items 1–4 have direct evidence. **FAIL/BLOCKED:** any item is missing or fails. Do not merge blocked feature PRs claiming full qualification.

## Visibility and content safety

GitHub Pages is a public website. Public-repository contents and commit history are public too; bundling source into a paid ZIP is not access control. Before publishing proprietary or paid-only assets, review current files **and history** for secrets, private schematics, calibration data, private control constants, customer information, and paid-only source. Existing keyword checks in `tools/validate-project.mjs` are not a complete security scan.

A production-ready public site does **not** confer hardware certification. Keep `BOARD_PASS` and `CONTROL_VALIDATION_PASS` blocked until real measurement/binding artifacts exist.

## Rollback

Revert the isolated Pages smoke workflow if it produces incorrect results; this does not disable GitHub Pages. Reverting it also does not revert a deployed page. Site rollback must separately restore a previously qualified branch revision and capture a fresh Pages deployment result. Do not alter learning-state V5 or test evidence during a publication-only rollback.
