# Learning-map backup integration audit

Baseline deployed main 65c99e079297730e4baca8a155e51f25975f2193. The map exports complete Evidence V5 backups but sends restoration to a capstone training-pilot page. Protected editors direct learners to the map, which then makes them leave again to restore. Evidence.merge already owns import rules and auxiliary CoreFlow restore, and the map already loads/registers CoreFlow.

Bounded design: place download, file selection, read-only preview, explicit merge/cancel and feedback together in a map section. Reuse Evidence.exportBackup/merge and Workspace.learningRecords for preview counts. Refresh the existing map and continuation after merging. Explain that existing local sessions/first attempts are retained; this is a merge, not replacement or migration. No second storage/progress/import engine; no changes to grading or physical-evidence claims. Only supported Evidence V5 files are offered for merging in this new entry.

Validation: preview/cancel and invalid input do not mutate evidence; fresh import restores practice and updates resume without navigation; local first attempts remain unchanged. Desktop/mobile browser tests, existing backup/progress suites, independent review and CI. Rollback the map adapter controls; no stored schema change.
