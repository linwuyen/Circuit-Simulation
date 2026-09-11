# Learning map record integration audit

Baseline main cf451884fa2880d78db259f333612fc34c99c129, deployed after PRs 45–48. Its tree equals the validated PR48 source.

Problem: map.html uses the shared learning bridge, but renders older beginner rows and aggregate quiz counts. Eight continuous experiments, Buck/Boost comparison and four native applications are invisible there. Completed practice can therefore appear missing despite existing Evidence V5 records.

Decision: add a read-only projection to the existing Workspace owner; use existing PlainCourse/Workspace proof gates and Assessment metrics. The existing map renderer consumes curriculum labels and these projections. Do not write derived progress, promote practice into assessment, change the global lab contract population, or create a new navigation/store. Keep older learning records as a clearly labeled expandable path, not a competing recommended sequence.

Validation: empty and partial records, missing/forged completion flags, first wrong attempts, transfer and due reviews; preserve serialized evidence unchanged. Browser checks cover record display, native return links, mobile overflow and keyboard. Existing CI remains required. Rollback renderer first, then read-only projection; no data migration required.

## Implemented projection

`CircuitWorkspace.learningRecords` reads existing child records and uses `PlainCourse.proven`, `Workspace.topologyProof/applicationProof`, and `Assessment.metrics`. Curriculum and QuizBank own labels and question-family membership. Aggregate `completed` flags do not establish proof. Unknown record versions and malformed quiz histories do not count as passed. No writes or model calculations occur in the projection.

Only a learning-hub page loads the additional curriculum/PlainCourse/QuizBank/Workspace dependencies. Existing bridge rendering displays four groups, per-step status, first attempts, review time and UnifiedLearning return routes. The older stage/library view remains expandable with its original IDs; the existing formal benchmark and backup controls remain.

Unit checks cover proof semantics, invalid records, read-only behavior and due reviews. Desktop/mobile browser checks cover preserved records, keyboard details, overflow and the quiz return route. Wider coverage of formal global lab contracts, diagnostic assessments, bidirectional power and physical-board proof remains open.
