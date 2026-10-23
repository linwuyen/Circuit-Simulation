# Browser evidence durability and concurrent writers

`CircuitEvidence.save()` remains synchronous for compatibility: it returns the locally normalized draft, **not a durable-save acknowledgment**. `load()` reads that pending draft. Use `await CircuitEvidence.flush()` and check `saved` before navigation, import confirmation, formal seed acceptance, result acceptance, or showing a subsequent formal question.

Browser writes to the entire `circuit-learning-state-v5` JSON use one exclusive Web Lock with that exact key name. Within the lock, the serialized durable baseline must still match the snapshot that produced the draft. Different sections of that JSON are not independent lock domains. A losing tab does not silently merge or overwrite first answers: it remains conflicted, editing is paused, and its draft can be exported. Retry cannot bless a newer baseline. Reload/reconciliation is deliberate. Snapshots from the same tab's successfully committed revision remain usable; genuinely older local snapshots are rejected and included as `unsavedConflictDrafts` in its export.

- No schema version or existing stored evidence is migrated/deleted by this change.
- Multiple immediate writes in one tab coalesce; success-event reentrant writes are drained before `flush()` reports success.
- A quota/security failure retains the draft and original baseline. A later retry can succeed only if the durable baseline remains unchanged.
- A remote deletion is also a conflict, not permission to resurrect stale data.
- Imported auxiliary stores are not restored before the primary conflict gate; pending auxiliary input remains exportable. Existing auxiliary stores retain their own persistence APIs; this is not a multi-key database transaction.
- Pending/conflict state is announced through `circuit:evidence-persistence` and the persistent export/retry notice. A `beforeunload` warning is requested, but browsers may suppress it; no guarantee of flushing during page termination is made. Export before closing when a write is pending.
- No Web Locks support (or rejected lock acquisition) means **memory/export only**, with an explicit unsaved warning; there is no unsafe localStorage lock fallback.
- Chromium 139 was checked on HTTP and `file://`: same named locks coordinated same-file and different-module file tabs. Other offline browsers must expose working Web Locks; otherwise use export or a supported browser/local server.
- Non-browser Node/VM test hosts retain synchronous storage semantics. Browser behavior is exercised separately using a fake lock manager and actual two-tab Playwright cases.

Supported mutation contract: start from `load()` (or `merge()` for backups), mutate the returned state, then `save()`. Untracked replacement objects are rejected in browsers rather than guessed to be current snapshots.

Tests: `evidence-concurrency.test.mjs`, `evidence-async-callers.test.mjs`, `e2e/evidence-concurrency.spec.js`, existing storage/backup/restore tests. The lock only coordinates cooperating versions of this application; an older already-open deployment or arbitrary DevTools code can bypass it. Reload old tabs before using the corrected version.

## Browser acceptance follow-up (2026-10-23)

CI run `39999496680` on `ded666c` exposed three remaining caller races (report prediction, bridge completion, topology reason) despite earlier local passes. The actual trace showed visible progression before the queued Web Lock write completed, followed by immediate navigation/reload. This is not repaired by increasing sleeps or retrying CI.

Explicit accepted judgments, first-answer disclosure, completed stages, saved settings, report/quiz grades, and remediation pass events now wait for `flush().saved` in the active report/shell, bridge, root/experiment/topology/application workspaces, Module 17 fixed-concept cards, and training remediation UI. During a pending write the relevant controls remain frozen and completion is not displayed. Failed persistence keeps the unaccepted draft available for backup; retry either restores the durable view or explicitly asks for reload after successful saving. Export/backup controls remain usable. Existing computed circuit/model outputs are not hidden merely because evidence is pending: model validity and durable learning evidence remain separate claims.

Deterministic browser regressions hold the real origin Web Lock, check that pending answers do not advance or disclose accepted results, then release it and verify persistence through reload. Quota/conflict vectors test failure and recovery without rewriting first answers. Cached bridge/fixed-concept record groups reject a newer same-group snapshot before writing; unrelated evidence remains intact.

Browser fixture initialization now flushes and uses the lock-aware test reset rather than deleting the primary key behind its owner. Seeded records must commit before navigation or cross-tab inspection. User-flow tests wait for the durable visible state before external reload; one numeric/radio helper waits for the submit control to become enabled before choosing the next input type. No answer, first-attempt, color, grading or persistence assertions are removed.
