# Direct-entry record protection audit

Base: deployed main 89c41d54dd186c716f28de5fe41cfdf927873115.

The continuation router already sends unsupported practice versions to map/backup. Direct experiment URLs bypass that protection. workspace-experiment-ui initializes an unsupported version as a new session; choose immediately saves it over the existing experiment. Topology and application adapters already reject unsupported session versions at initialization.

Decision: stop experiment editing before initialization or saving when existing experiment version is unsupported. Show a plain-language explanation and existing map/backup route. Preserve Evidence V5 and the original serialized record; no migration, reset, new persistence or proof engine. Also cover a newer record arriving in another tab before a stale editor saves.

Validation: browser red/green with a future version and sentinel data, direct URLs/reload, backup contents, and a stale open editor. Existing valid-session behavior remains covered by continuous-course tests. Rollback removes UI guard only; no data migration to undo. This increment does not validate every malformed field or migrate future schemas.
