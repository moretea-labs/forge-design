# Repository-native design storage

Forge Design does not own project design data. Each target repository owns one tracked `.design-harness/` directory:

```text
<target-repository>/
└── .design-harness/
    ├── project.json
    ├── tokens.json
    ├── components.json
    ├── screens/
    │   └── <screen-id>.json
    └── README.md
```

## Authority

- `.design-harness/tokens.json` is the only token source of truth.
- `.design-harness/components.json` is the component contract available to ChatGPT.
- Each `screens/*.json` file is one independent artboard and reviewable Git artifact.
- `project.json` is the stable discovery entrypoint.
- Git supplies history, branches, review, merge, and rollback.
- Browser memory may hold temporary editor state, but localStorage and IndexedDB are never canonical.
- `design.md` is an import/export transport, not canonical storage. Export is deterministic; import validates all included documents before writing and merges screens without implicit deletion.

The example under `workspace/metronome/` is a target repository fixture, not a second generated copy.

## Discovery

The local store discovers child repositories below `workspace/`, roots registered in Git-ignored `~/.forge-design/projects.json`, and temporary absolute roots from the platform-delimited `DESIGN_HARNESS_PROJECT_ROOTS` environment variable. Use `npm run --silent design -- register --project-root <absolute-path>` for normal persistent local discovery.

## Writes

All persisted JSON is validated, written to a same-directory temporary file, and atomically renamed. IDs are restricted to safe filename characters, screen filenames must match their document IDs, and duplicate screen node IDs are rejected.
