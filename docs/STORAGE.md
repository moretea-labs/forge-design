# Repository-native design storage

Forge Design does not own project design data. Each target repository owns one tracked `.design-harness/` directory:

```text
<target-repository>/
└── .design-harness/
    ├── project.json
    ├── product.json
    ├── design-units.json
    ├── tokens.json
    ├── components.json
    ├── screens/
    │   └── <screen-id>.json
    └── README.md
```

## Authority

- The target repository remains the design authority boundary. Git supplies history, review, exact revision identity, merge, and rollback.
- `.design-harness/design-units.json` partitions a larger application into reviewable design families. A Design Unit names its Screen Family, owns its screen membership, and can pin one or more upstream Product Contract references by exact repository revision + path + optional section/anchor. It is a design projection; it must not copy a mature upstream Product Contract merely to make Forge Design self-contained.
- `.design-harness/product.json` is the repository-native embedded Product Design Model for projects that model product semantics inside Forge Design. It also continues to carry the existing project-wide Golden gate. For projects with an external mature Product Contract, pinned Design Unit references identify that upstream authority instead of replacing it.
- `.design-harness/tokens.json` is the only design-token source of truth.
- `.design-harness/components.json` is the component contract available to ChatGPT.
- Each `screens/*.json` file is one independent artboard and reviewable Git artifact.
- `project.json` is the stable discovery entrypoint and declares the storage version.
- Browser memory may hold temporary editor state, but localStorage and IndexedDB are never canonical.
- `design.md` is an import/export transport, not canonical storage. Export is deterministic; import validates all included documents before publishing included assets and merges screens without implicit deletion.

The example under `workspace/metronome/` is a target repository fixture, not a second generated copy.

## Canonical model schema

`schemas/*.schema.json` is the only structural schema authority for persisted design documents. Runtime validation reads those schemas through `server/schema-validator.mjs`. TypeScript document types are generated mechanically into `src/core/schema.generated.ts` by `scripts/generate-schema-types.mjs`; `npm run check:schema-types` fails when generated types drift from canonical schemas. Hand-written validators are limited to cross-document or relational semantics JSON Schema cannot express cleanly, such as duplicate IDs, filename/document identity, and references to existing screens.

## Storage versions and migration

- `1.0.0`: Forge Design 0.4-era storage without canonical `design-units.json`.
- `1.1.0`: current storage with canonical Design Units.

Reading `1.0.0` is non-mutating. Forge Design synthesizes one in-memory `legacy-default` Design Unit so old projects remain inspectable, and context reports `migrationRequired: true`. Writes to Design Units fail closed until migration is explicit. `npm run --silent design -- migrate --project <id>` writes the compatible Design Unit document first and only then advances `project.json` to `1.1.0`, so a failed version bump cannot leave a manifest that claims assets which do not exist.

## Discovery

The local store discovers child repositories below `workspace/`, roots registered in Git-ignored `~/.forge-design/projects.json`, and temporary absolute roots from the platform-delimited `DESIGN_HARNESS_PROJECT_ROOTS` environment variable. Use `npm run --silent design -- register --project-root <absolute-path>` for normal persistent local discovery.

## Writes

All persisted JSON is validated against canonical schemas before persistence. New projects receive draft `product.json` and `design-units.json`; legacy projects without product modeling remain readable but are explicitly `unmodeled` and cannot be promoted to Golden. Product references and Design Unit screen references are checked before portable imports are persisted. Individual JSON writes use a same-directory temporary file and atomic rename. Whole-bundle transactional publication is a separate hardening step; prevalidation already prevents known-invalid bundles from beginning persistence, but P0-F owns crash-safe multi-file publication.
