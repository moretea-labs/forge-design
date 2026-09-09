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
- `.design-harness/design-units.json` partitions a larger application into reviewable design families. A Design Unit names its Screen Family, owns its screen membership, and can pin one or more upstream Product Contract references by exact repository revision + path + optional section/anchor. It also owns review profiles and family review state. Human acceptance and whole-project freeze evidence are protected subdocuments that ordinary design writes cannot create, replace, or delete. It is a design projection; it must not copy a mature upstream Product Contract merely to make Forge Design self-contained.
- `.design-harness/product.json` is the repository-native embedded Product Design Model for projects that model product semantics inside Forge Design. It also continues to carry the existing project-wide Golden gate. For projects with an external mature Product Contract, pinned Design Unit references identify that upstream authority instead of replacing it.
- `.design-harness/tokens.json` is the only design-token source of truth. Optional `colorModes.light/dark` token overrides make color-scheme Review Profiles real visual projections rather than labels; a used dark Review Profile fails validation when no dark override exists.
- `.design-harness/components.json` is the component contract available to ChatGPT. Modern contracts may declare typed props, variants/states, semantic interaction role, layout/accessibility constraints, implementation binding metadata, and a constrained project-owned declarative preview tree. Legacy `allowedProps` contracts remain readable but do not define a full preview contract.
- Each `screens/*.json` file is one independent Screen identity and reviewable Git artifact. A Screen may contain named state variants; variants do not become separate pseudo-screens just to capture empty/error/degraded/etc. states.
- `project.json` is the stable discovery entrypoint and declares the storage version.
- Browser memory may hold temporary editor state, but localStorage and IndexedDB are never canonical.
- `design.md` is an import/export transport, not canonical storage. Export is deterministic; import validates all included documents before publishing included assets and merges screens without implicit deletion.

The example under `workspace/metronome/` is a target repository fixture, not a second generated copy.

## Canonical model schema

`schemas/*.schema.json` is the only structural schema authority for persisted design documents. Runtime validation reads those schemas through `server/schema-validator.mjs`. TypeScript document types are generated mechanically into `src/core/schema.generated.ts` by `scripts/generate-schema-types.mjs`; `npm run check:schema-types` fails when generated types drift from canonical schemas. Hand-written validators are limited to cross-document or relational semantics JSON Schema cannot express cleanly, such as duplicate IDs, filename/document identity, and references to existing screens.

## Review evidence and freeze

Review Profiles are repository-native review environments, not browser preferences. A profile specifies viewport/safe-area dimensions, light or dark color scheme, text scale, contrast review mode, and reduced-motion behavior. The Web workspace applies these values to the design preview; increased-contrast rendering is a review simulation rather than a claim of pixel-identical OS accessibility rendering.

A Design Unit moves through `draft / review / visual_reviewed / rejected`. Ordinary `putDesignUnits`, `putProductModel`, and portable Markdown import cannot manufacture human acceptance. Acceptance is recorded only through the dedicated strongly confirmed provider action after the Design Unit is `visual_reviewed`, required Review Profiles/artifacts exist, `.design-harness` is clean, and the candidate revision equals exact Git `HEAD`.

Acceptance records both the accepted Git revision and a deterministic SHA-256 design digest. The digest covers the unit's contract projection, profiles, tokens, component contracts, screens/states, and related flows/patterns but excludes acceptance/freeze metadata, so committing the evidence does not invalidate itself. Later design changes make the acceptance stale. Whole-project freeze is allowed only when every Design Unit has current acceptance and project validation succeeds; the resulting freeze is the implementation-handoff evidence for Phase D.

The legacy `product.json.golden.review.userDecision` remains readable for older embedded-product projects but ordinary design writes cannot change it. It is not the current family-aware Phase D handoff authority.

## Storage versions and migration

- `1.0.0`: Forge Design 0.4-era storage without canonical `design-units.json`.
- `1.1.0`: current storage with canonical Design Units.

Reading `1.0.0` is non-mutating. Forge Design synthesizes one in-memory `legacy-default` Design Unit so old projects remain inspectable, and context reports `migrationRequired: true`. Writes to Design Units fail closed until migration is explicit. `npm run --silent design -- migrate --project <id>` writes the compatible Design Unit document first and only then advances `project.json` to `1.1.0`, so a failed version bump cannot leave a manifest that claims assets which do not exist.

## Discovery

The local store discovers child repositories below `workspace/`, roots registered in Git-ignored `~/.forge-design/projects.json`, and temporary absolute roots from the platform-delimited `DESIGN_HARNESS_PROJECT_ROOTS` environment variable. Use `npm run --silent design -- register --project-root <absolute-path>` for normal persistent local discovery.

## Writes

All persisted JSON is validated against canonical schemas before persistence. New projects receive draft `product.json` and `design-units.json`; legacy projects without product modeling remain readable but are explicitly `unmodeled` and cannot be promoted to Golden. Product references and Design Unit screen references are checked before portable imports are persisted. Individual JSON writes use a same-directory temporary file and atomic rename. `design.md` imports and storage migrations use a repository-owned bundle transaction: current `.design-harness` is copied to a staged snapshot, the staged snapshot is structurally readable through the same ProjectStore, the old canonical directory is renamed to a rollback backup, and the staged directory is published as one canonical replacement. A transaction marker enables deterministic recovery after process interruption: an existing canonical snapshot wins, while an `old_moved` crash restores the backup before project discovery proceeds.
