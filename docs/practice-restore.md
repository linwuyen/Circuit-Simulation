# Restore past empty comparison/application selection

Baseline 590c755de8bea392ef139df02a7d63d11b819d8f. Comparison initialization saves a version-1 record with empty rows and operated=false. Application lesson selection saves empty rows/currentLesson before any preparation or answer. Evidence.merge still preserves these placeholders and ignores incoming progress; its previous exception covered only the experiment.

Decision: generalize that same private untouched-session check inside Evidence.merge to the two recognized adapter initialization shapes. Shared requirements remain supported version, completed=false, empty rows and a strict known-field allowlist. Comparison also requires its protocol, operated=false and initialized metadata; applications require currentLesson. Keep the existing experiment guard intact. Actual rows, preparation/operation, history, unknown fields/versions, invalid protocol and other practice types remain preserved. This is backup admission, not a second completion engine or row-wise score merge.

Validation: direct merge regressions and actual comparison opening/application lesson switching -> map -> restore -> matching progress. Existing first-answer and unsupported-record protection tests remain required. Rollback the additional two shape cases; no schema change.
