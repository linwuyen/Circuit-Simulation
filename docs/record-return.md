# Record return audit

Baseline deployed main 36b24fd5d97d6f574d6960ffd41e1413bed6a7a4 (PR49). The map reads individual records but its links only open a whole task. Users cannot directly revisit the matching experiment, native application or quiz family.

Decision: UnifiedLearning owns validated record URLs, using existing curriculum/quiz IDs. The map renders these links. Existing experiment hash routes retain prerequisite gates; application selection uses a validated lesson parameter; the V3 quiz filters a validated family within the existing module. Unknown inputs fall back safely. URL selection never grants completion or creates answers. Existing Evidence V5 remains sole persistence.

Test valid/unknown links, original prerequisites, native lesson selection and reload, quiz family isolation and first-attempt retention. Keep existing URLs and global quiz behavior. Rollback links before removing parameter handling; no evidence migration.

## Implemented data flow

UnifiedLearning.recordRoute validates identifiers from EngineeringCurriculum and QuizBank and builds internal URLs. The map links each row through that API. Existing continuous-experiment hashes retain prerequisite redirects. Native application `lesson` selection is read-only on opening; explicit interactions retain the existing metadata save and keep the URL aligned with the selected lesson. The V3 quiz restricts `family` inside the selected module and falls back to that module for unknown/cross-module IDs. Links to all four concepts and the map remain available.

No grading, simulator, or persisted answer schema changed. First attempts remain in Evidence V5. Focused tests cover URL validation, lesson/reload behavior, no proof from viewing, family isolation, wrong-first preservation and prerequisite redirects. Independent read-only code review found no blocking issues. Revert record links before removing URL handling; existing URLs remain supported.
