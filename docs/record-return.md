# Record return audit

Baseline deployed main 36b24fd5d97d6f574d6960ffd41e1413bed6a7a4 (PR49). The map reads individual records but its links only open a whole task. Users cannot directly revisit the matching experiment, native application or quiz family.

Decision: UnifiedLearning owns validated record URLs, using existing curriculum/quiz IDs. The map renders these links. Existing experiment hash routes retain prerequisite gates; application selection uses a validated lesson parameter; the V3 quiz filters a validated family within the existing module. Unknown inputs fall back safely. URL selection never grants completion or creates answers. Existing Evidence V5 remains sole persistence.

Test valid/unknown links, original prerequisites, native lesson selection and reload, quiz family isolation and first-attempt retention. Keep existing URLs and global quiz behavior. Rollback links before removing parameter handling; no evidence migration.
