# Plugin contract

Forge Design is intentionally split into a transport-independent core, repository-native assets, and the Forge managed provider.

## Canonical asset boundary

Every target repository owns a tracked `.design-harness/` directory. The browser, CLI, local API, ChatGPT, and the Forge provider all read and write the same files:

- `project.json`: discovery, storage version, and active project metadata;
- `product.json`: embedded Product Design Model and project-wide Golden state for projects that model product semantics inside Forge Design;
- `design-units.json`: multiple design families, their Screen Family/screen membership, and pinned upstream Product Contract references;
- `tokens.json`: the only design-token source of truth;
- `components.json`: typed semantic component contracts ChatGPT may compose, including optional project-owned declarative preview trees; Forge core must not require business-specific renderer code for each component;
- `screens/<screen-id>.json`: one independent Screen identity per file, including its state variants when present.

No browser database or generated source mirror is authoritative. `schemas/*.schema.json` is the one structural model authority; runtime validation and generated TypeScript document types consume that authority rather than redefining the persisted model.

## Transport-independent capabilities

`src/core/api.ts` defines the stable capability names and pure context operations. The local transports currently are:

- Web workspace: `npm run dev`
- JSON CLI: `npm run --silent design -- <command>`
- Local HTTP API: `/api/design`

The official external provider is `design`. `design_get_context` returns Design Units + embedded Product Design Model + Golden Gate + visual assets. Ordinary ChatGPT design work uses granular typed provider actions for Design Units, tokens, component contracts, Screen Specs, and individual Product Flows. Provider argument schemas embed the same canonical repository JSON Schemas used by ProjectStore rather than maintaining provider-only field definitions. Product Flow writes update `product.json` through read-modify-validate-write; no separate flow authority exists. Provider writes accept registered project and semantic asset identities only, never arbitrary repository paths. Delete and Golden acceptance are deliberately excluded from this ordinary granular write surface.

## Responsibility split

1. Repository access, authorization, and execution evidence belong to Forge/provider integration.
2. Structural validation comes from canonical JSON Schemas; cross-asset design semantics and lint belong to the core/store.
3. Rendering and temporary editor state belong to the web application.
4. Production application source mutation is a separate explicit capability and review step.
5. Git remains responsible for review, history, branching, merge, and rollback.
