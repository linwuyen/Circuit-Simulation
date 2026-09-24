# GitHub Codespaces fallback

This is the cloud execution path when GitHub-hosted Actions runners are unavailable or Actions quota/budget is blocked.

## Why this path exists

The repository previously ran the same GitHub-hosted runner labels successfully. The current failing jobs stop before `Set up job`, with no runner allocated. That makes a source-code failure unlikely and prevents the TI downloader from ever starting.

Codespaces uses a separate compute/storage quota from GitHub Actions, so it provides a GitHub-hosted execution environment without depending on the learner's PC.

## Use

1. Open the repository on GitHub.
2. Choose **Code → Codespaces → Create codespace**.
3. The dev container automatically runs:
   ```bash
   npm ci --no-audit --no-fund
   npm run learning:ti:bootstrap
   ```
4. Inspect:
   - `.learning-cache/ti/download-report.json`
   - `.learning-cache/codespace-bootstrap-report.json`
   - `.learning-cache/today-session.md`

The bootstrap fails closed if any recommended TI source cannot be fetched as a valid PDF.

## Re-run

```bash
npm run learning:ti:bootstrap
```

## Boundary

The downloaded PDFs and learner state stay inside gitignored `.learning-cache/`. They are not committed to the repository. GitHub Actions remains the preferred CI evidence path after hosted-runner access is restored.


## Final closure command

For PR closure, use the single deterministic command:

```bash
npm run learning:ti:closure
```

It reruns the TI bootstrap, focused Node validation, and the desktop Playwright learner loop. If the Chromium runtime is missing, the closure verifier installs it once and retries the browser gate. The result is written to:

```text
.learning-cache/ti-closure-evidence.md
```

A closeable repo-side result ends with `TI_CLOSURE_PASS`. GitHub-hosted Actions runner allocation and the manual artifact workflow remain independent infrastructure gates.
