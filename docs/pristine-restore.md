# Restore after visiting the homepage

Baseline c32b157fab5146478ab09f0334efe97c97bbe659. Opening the continuous experiment immediately stores a version-1 session with an empty selected row, empty history, current config/lesson and completed=false. Evidence.merge then treats the mere presence of this child as meaningful local work and ignores incoming experiment progress. Reproduction preserved `{energy:{}}` instead of the backup's saved first attempt.

Decision: within the existing Evidence.merge owner, allow a supported incoming experiment to replace only the recognized, untouched initialization shape. Empty rows and history, false completion and only known initialization fields are required. Any first attempt, operation field, history, extra field or unsupported version retains the current preservation rule. No new proof rules, migration, row-wise score mixing or changes to other practice sessions.

Validation: merge unit regressions for initialization and preserved nonempty/unknown records; real browser homepage -> map -> preview -> merge -> continuation; existing backup/proof suites. Rollback the narrow merge exception; no new schema or stored metadata.
