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
