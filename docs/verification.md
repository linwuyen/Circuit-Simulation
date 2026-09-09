# Verification evidence

`tools/ci/verification-stages.json` owns the CI stage names and claim boundaries. It does not replace the independent oracle, board-evidence validator, or measured-control validator. See [architecture ownership](architecture-map.md).

| Stage | Checks | Meaning of success |
|---|---|---|
| 0 | Static source and visual-source audit | Source structure accepted |
| 1 | Full Node suite on Linux and Windows | Software assertions accepted |
| 2 | Model invariants and contracts | Tested model domain only |
| 3 | Independent verification and coverage tests | Reference/coverage contracts only |
| 4 | Ownership, context, navigation integration | Existing owners remain connected |
| 5 | Desktop/mobile Chromium | Tested browser behavior |
| 6 | GCC host SIL | Host execution of C controller |
| 7 | Deterministic HIL fixtures | Simulated target interaction |
| 8 | TI target compilation | Target objects compile |
| 9 | TI flash link, map, HEX | Reference image exists; not board operation |
| 10 | Physical-closure and measurement contract tests | Validator behavior; not physical closure |
| 11 | Real measured-control package | BLOCKED until existing validator accepts real captures |
| 12 | Real board package | BLOCKED until existing validator accepts board provenance |

CI wraps real commands with `verification-manifest.mjs`. Each invocation records commit SHA, stage, start/end time, Node/platform, exact command, expected exit/artifacts, actual exit and available test counts, verdict, and SHA-256/size of logs and required artifacts. Firmware logs retain the compiler version. Missing required artifacts yield UNKNOWN; nonzero exit yields FAIL. Subsequent skipped stages remain NOT_RUN. Jobs upload available evidence even after failure.

The final `verification-consolidated` artifact contains the manifests and their referenced files. Aggregation rechecks SHA, paths, sizes and hashes. Software success requires stages 0–10, intact evidence, and all original job gates. Stages 11–12 stay BLOCKED and board status stays UNCLAIMED; a software command cannot award physical success. Missing or mismatched commit provenance cannot pass. Local uncommitted runs default to UNKNOWN provenance.

Example from the repository root:

```sh
node tools/ci/verification-manifest.mjs UNIT -- node tools/run-tests.mjs
node tools/ci/verification-manifest.mjs summarize build/verification --require-software
```

Running only UNIT intentionally leaves the overall software gate incomplete. This is an evidence package with integrity checks, not cryptographic attestation against a malicious workflow author. Physical measurements and human learning outcomes must still be collected; synthetic test fixtures are not substitutes.
