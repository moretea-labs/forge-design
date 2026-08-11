# Plugin contract

Forge Design is intentionally split into a transport-independent core, repository-native assets, and a future Forge adapter.

## Canonical asset boundary

Every target repository owns a tracked `.design-harness/` directory. The browser, CLI, local API, ChatGPT, and a future adapter all read and write the same files:

- `project.json`: discovery and active project metadata;
- `tokens.json`: the only design-token source of truth;
- `components.json`: component contracts ChatGPT may compose;
- `screens/<screen-id>.json`: one independent screen/artboard per file.

No browser database or generated source mirror is authoritative.

## Transport-independent capabilities

`src/core/api.ts` defines the stable capability names and pure context operations. The local transports currently are:

- Web workspace: `npm run dev`
- JSON CLI: `npm run --silent design -- <command>`
- Local HTTP API: `/api/design`

`Forge-plugin.json` remains `mode: standalone` with `repoHarnessAdapter: null`. When Forge finalizes its adapter interface, the adapter should translate typed calls into the existing store/core operations rather than introducing another persistence layer.

## Responsibility split

1. Repository access and authorization belong to the future adapter.
2. Validation, design lint, and asset semantics belong to the core/store.
3. Rendering and temporary editor state belong to the web application.
4. Production application source mutation is a separate explicit capability and review step.
5. Git remains responsible for review, history, branching, merge, and rollback.
