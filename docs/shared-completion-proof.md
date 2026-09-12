# Shared completion proof audit

Baseline deployed main e657a838522a3faf5bb7e3ff2b81327d09139b01. Reproduction: an experiment record with version 1, completed true and no rows displays 0/8 on the map but UnifiedLearning.next routes to topology. Conversely, stale false/missing aggregate flags can hold fully proven work at an earlier task.

Root cause: map reads Workspace.learningRecords (existing per-step proof owners), while navigation trusts cached completed booleans. Decision: navigation consumes the same read-only Workspace projection, keeping due reviews, remediation return tickets and explicit advanced tracks higher priority. Dependencies must be available on workspace-bearing shared pages. No new completion engine, persisted progress or evidence migration. Stored aggregate flags remain compatible caches, not proof.

Validation: red/green regression for empty rows with true flags, proven rows with false flags, unknown versions, retained priorities and no evidence mutation. Browser test map and normal shared-page resume links. Existing fixture-only flags must be replaced by real proof-shaped test records without weakening assertions. Rollback navigation consumer/loading changes; existing saved data remain untouched.
