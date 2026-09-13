# Topology editor protection audit

Baseline deployed main 23f856df5a1d4b2b8277af932ca92751d3f5b6b6. The comparison and four-application adapters validate saved versions only during initialization. Their save functions load current evidence but replace the child with their older in-memory session without rechecking the version. A future record imported while an editor remains open is therefore overwritten on its next interaction.

Decision: extend each existing adapter's version rejection to save and storage updates. Stop its guided editing, preserve the existing Evidence V5 record, and link to the existing map/backup page. Native application tools remain independent of guided progress. Reuse current storage and proof owners; no migration, reset, new solver or new persistence. Valid-version concurrent edits and malformed-field migration remain outside this increment.

Validation: direct entry and stale-editor red/green browser tests, real storage events, retained future fields, existing topology/application flows and mobile view. Rollback adapter guards only; no data transformation to reverse.
