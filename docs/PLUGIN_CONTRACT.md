# Plugin contract

Forge Design is intentionally split into a transport-independent core, repository-native assets, and the Forge managed provider.

## Canonical asset boundary

Every target repository owns a tracked `.design-harness/` directory. The browser, CLI, local API, ChatGPT, and the Forge provider all read and write the same files:

- `project.json`: discovery, storage version, and active project metadata;
- `product.json`: embedded Product Design Model and project-wide Golden state for projects that model product semantics inside Forge Design;
- `design-units.json`: multiple design families, their Screen Family/screen membership, and pinned upstream Product Contract references;
- `tokens.json`: the only design-token source of truth;
- `components.json`: component contracts ChatGPT may compose;
- `screens/<screen-id>.json`: one independent Screen identity per file, including its state variants when present.

No browser database or generated source mirror is authoritative. `schemas/*.schema.json` is the one structural model authority; runtime validation and generated TypeScript document types consume that authority rather than redefining the persisted model.

## Transport-independent capabilities

`src/core/api.ts` defines the stable capability names and pure context operations. The local transports currently are:

- Web workspace: `npm run dev`
- JSON CLI: `npm run --silent design -- <command>`
- Local HTTP API: `/api/design`

The official external provider is `design`. `design_get_context` returns Design Units + embedded Product Design Model + Golden Gate + visual assets. Existing product-model actions remain bounded typed access to the embedded product layer. More granular provider mutation for Design Units/screens/components/tokens is intentionally deferred to P0-D; ordinary Web/CLI operations already use the same ProjectStore and canonical files.

## Responsibility split

1. Repository access, authorization, and execution evidence belong to Forge/provider integration.
2. Structural validation comes from canonical JSON Schemas; cross-asset design semantics and lint belong to the core/store.
3. Rendering and temporary editor state belong to the web application.
4. Production application source mutation is a separate explicit capability and review step.
5. Git remains responsible for review, history, branching, merge, and rollback.
