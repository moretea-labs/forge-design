# Forge Design

A repository-native, token-driven design workspace intended to become a Forge plugin.

The project does **not** try to clone Figma. It gives ChatGPT and developers one deterministic design asset model that can be read, rendered, validated, edited, diffed, and later exposed through a Forge adapter.

## Source of truth

Every designed target repository owns:

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

- `tokens.json` is the only design-token source of truth.
- `components.json` constrains which components and Props ChatGPT may use.
- Every screen is an independent, reviewable JSON file.
- The browser is an editor/client; localStorage and IndexedDB are not canonical.
- Git provides history, review, branches, rollback, and later integration with Forge.

A tracked example lives at `workspace/metronome/.design-harness/`.

## Run the workspace

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

The workspace now supports:

- project discovery and switching;
- real Screens, Components, and Tokens views;
- one-click creation of an independent Screen Spec;
- Inspect, Spec, and Flow inspector tabs;
- repository-backed JSON editing and atomic saving;
- immediate visual application of saved Token changes;
- editable component contracts;
- complete ChatGPT context copying;
- repository refresh;
- interactive metronome, settings sheet, and practice summary Mock states.

## ChatGPT / CLI usage

The CLI emits JSON only when run with npm's silent flag:

```bash
npm run --silent design -- projects
npm run --silent design -- context --project metronome
npm run --silent design -- get-tokens --project metronome
npm run --silent design -- get-screen --project metronome --screen metronome-home
npm run --silent design -- validate --project metronome
```

Write operations accept a JSON file:

```bash
npm run --silent design -- put-screen --project metronome --file /tmp/screen.json
npm run --silent design -- put-tokens --project metronome --file /tmp/tokens.json
npm run --silent design -- put-components --project metronome --file /tmp/components.json
```

Initialize another target repository:

```bash
npm run --silent design -- init \
  --project-root /absolute/path/to/target-repository \
  --project target-app \
  --name "Target App"
```

Register an external target repository once, then launch normally:

```bash
npm run --silent design -- register --project-root /absolute/path/to/target-repository
npm run --silent design -- registered-roots
npm run dev
```

The local registry is stored in Git-ignored `~/.forge-design/projects.json`. `DESIGN_HARNESS_PROJECT_ROOTS` remains available as a temporary platform-delimited override.

## Local API

The Vite development server exposes:

```text
GET  /api/design/projects
GET  /api/design/projects/:projectId
GET  /api/design/projects/:projectId/context
GET  /api/design/projects/:projectId/design.md
PUT  /api/design/projects/:projectId/design.md
GET  /api/design/projects/:projectId/validate
GET  /api/design/projects/:projectId/paths
GET  /api/design/projects/:projectId/tokens
PUT  /api/design/projects/:projectId/tokens
GET  /api/design/projects/:projectId/components
PUT  /api/design/projects/:projectId/components
GET  /api/design/projects/:projectId/screens
POST /api/design/projects/:projectId/screens
GET  /api/design/projects/:projectId/screens/:screenId
PUT  /api/design/projects/:projectId/screens/:screenId
```

Writes validate bounded JSON and use a same-directory temporary file plus atomic rename. `design.md` is a deterministic import/export transport over the same canonical JSON model; import validates the complete bundle first and safely merges named screens without implicitly deleting omitted screens.

## Verify

```bash
npm run --silent design -- validate --project metronome
npm run validate:design
npm run typecheck
npm test
npm run build
```

## Architecture

```text
Target repository .design-harness assets
                 │
       ┌─────────┼─────────┐
       │         │         │
   JSON CLI   Local API   Future Forge adapter
       │         │         │
       └─────────┼─────────┘
                 │
       validation + design lint
                 │
       interactive code renderer
```

See `docs/STORAGE.md`, `docs/CHATGPT_INTEGRATION.md`, and `docs/PLUGIN_CONTRACT.md` for the stable boundaries.


## Forge plugin

Forge Design is an independent product and an official Forge external provider. A fresh Forge installation can install the provider from the official registry:

```bash
forge plugin install design
```

The provider uses a bounded managed-process JSONL protocol; Forge keeps authorization, resource claims, idempotency and execution evidence. The tracked `.design-harness/` directory remains the current repository asset format for compatibility and is not renamed mechanically.
