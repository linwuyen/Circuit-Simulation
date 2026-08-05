# Learning runtime architecture

V3 is the only production learning runtime.

```text
assets/learning/curriculum.js
        ↓ raw curriculum data
assets/learning/curriculum-schema-v3.js
        ↓ normalization, stable IDs, legacy-ID migration
quiz-bank.js / model-registry.js / engineering-models.js
        ↓ questions, assumptions, formulas, failure boundaries
assets/learning/learning-v3.js
        ↓ state machine and page renderers
index / beginner / labs / troubleshooting / progress / quiz / search / report
```

## Canonical ownership

- Curriculum facts live in `curriculum.js`.
- Schema normalization and stable identity live in `curriculum-schema-v3.js`.
- Engineering formulas live in pure calculation modules, not page code.
- Learning evidence and migration behavior live in `learning-v3.js`.
- Production entry pages load only V3 schema, runtime, and CSS.

## Legacy boundary

V2 files remain only to support historical review and migration tests. They are not loaded by production pages and must not receive new features.

## Change rules

1. Add or change a model in its canonical module; UI code must not duplicate formulas.
2. Preserve stable IDs or add an explicit legacy-ID mapping.
3. Add an invariant or migration test for every schema-level change.
4. Keep source reviewable; minified artifacts must be generated, never treated as canonical source.
5. A pull request fails when a production page reintroduces a V2 JS or CSS dependency.
