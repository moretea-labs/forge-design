# Plugin contract

Forge Design is intentionally split into a transport-independent core, repository-native assets, and the Forge managed provider.

## Canonical asset boundary

Every target repository owns a tracked `.design-harness/` directory. The browser, CLI, local API, ChatGPT, and the Forge provider all read and write the same files:

- `project.json`: discovery and active project metadata;
- `product.json`: Product Brief, flows, information/state/interaction model, Interaction Patterns, Golden status and runtime review evidence;
- `tokens.json`: the only design-token source of truth;
- `components.json`: component contracts ChatGPT may compose;
- `screens/<screen-id>.json`: one independent screen/artboard per file.

No browser database or generated source mirror is authoritative.

## Transport-independent capabilities

`src/core/api.ts` defines the stable capability names and pure context operations. The local transports currently are:

- Web workspace: `npm run dev`
- JSON CLI: `npm run --silent design -- <command>`
- Local HTTP API: `/api/design`

The official external provider is `design`. `design_get_context` returns Product Contract + Golden Gate + visual assets; `design_get_product_model` and `design_put_product_model` provide bounded typed access to the product layer without introducing a second persistence path.

## Responsibility split

1. Repository access, authorization, and execution evidence belong to Forge/provider integration.
2. Validation, design lint, and asset semantics belong to the core/store.
3. Rendering and temporary editor state belong to the web application.
4. Production application source mutation is a separate explicit capability and review step.
5. Git remains responsible for review, history, branching, merge, and rollback.
