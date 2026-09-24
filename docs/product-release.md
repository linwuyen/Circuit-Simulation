# Product release contract

Current product release metadata lives in `product/release.json`. Internal Evidence V5 / measurement V8 names are **schema/evidence versions**, not product versions.

## Stable entry

- Public URL: `https://linwuyen.github.io/Circuit-Simulation/`
- Product channel: beta
- Custom domain: not configured. Do not add `CNAME` until an owned domain is explicitly supplied.

## PWA / offline boundary

The root service worker caches the application shell and runtime same-origin GET assets. A route that has never been fetched is not guaranteed offline. TI PDF binaries remain outside the repository/cache contract; the app stores official source URLs and provenance instead.

Service-worker cache version changes only with an intentional product release. A new worker deletes older `circuit-sim-*` caches on activation.

## Progress / backup / sync

`CircuitEvidence` V5 remains the **only** learner state authority.

Local backup:

```text
CircuitEvidence.exportBackup()
        ↓
JSON file / opaque remote blob
        ↓
CircuitEvidence.merge()
```

Future cloud sync may transport an Evidence V5 backup, but it must not:
- create a second progress schema;
- mutate individual evidence rows remotely;
- overwrite immutable first attempts;
- bypass `Evidence.merge()`;
- upgrade engineering evidence or board claims.

No cloud backend is configured in this release.

## Diagnostics / telemetry

Runtime diagnostics are local-only and capped. The product shell records coarse navigation/paint timing plus sanitized error messages in local storage. It does **not** auto-upload analytics, learner answers, health data, source files, or engineering evidence. The learner can export or clear diagnostics manually.

A future remote telemetry adapter must be explicit opt-in and must not include raw learner answers or proprietary engineering artifacts.

## Packaging tiers

`product/tiers.json` is descriptive metadata, not client-side entitlement enforcement.

- Free — core simulator and TI learning path.
- Pro — advanced control/timing/protection/topology/tutor surfaces.
- Engineering Pack — existing C2000 Digital Buck source/HIL/board tooling bundle.

Commercial entitlement must be enforced by the distribution/payment layer, not by hiding secrets in browser JavaScript.

## Release gate

A release is not a new evidence claim. Before marking a release stable:

1. Node/model tests pass.
2. desktop/mobile browser smoke tests pass.
3. PWA shell and backup/import tests pass.
4. exact-head hosted CI executes rather than failing before runner allocation.
5. P4/HIL/board claims remain exactly as supported by their own artifacts.
6. paid bundle reference closure passes if the Engineering Pack is published.

Rollback is a previous product release + cache version. Evidence state stays V5-compatible and is never rolled back by service-worker activation.
