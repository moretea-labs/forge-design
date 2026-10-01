# Plugin contract

Forge Design is intentionally split into a transport-independent core, repository-native assets, and the Forge managed provider.

## Canonical asset boundary

Every target repository owns a tracked `.design-harness/` directory. The browser, CLI, local API, ChatGPT, and the Forge provider all read and write the same files:

- `project.json`: discovery, storage version, and active project metadata;
- `product.json`: embedded Product Design Model and project-wide Golden state for projects that model product semantics inside Forge Design;
- `design-units.json`: multiple design families, their Screen Family/screen membership, and pinned upstream Product Contract references;
- `tokens.json`: the only design-token source of truth;
- `components.json`: typed semantic component contracts ChatGPT may compose, including optional project-owned declarative preview trees; Forge core must not require business-specific renderer code for each component;
- `screens/<screen-id>.json`: one independent Screen identity per file, including its state variants when present;
- `visual-assets.json`: role/provenance/binding manifest for visual references, current high-fidelity design artboards, and runtime evidence;
- `artboards/**`: repository-owned current high-fidelity visual design files. Their file bytes, not merely manifest metadata, participate in Design Unit acceptance digests.

No browser database or generated source mirror is authoritative. `schemas/*.schema.json` is the one structural model authority; runtime validation and generated TypeScript document types consume that authority rather than redefining the persisted model.

## Transport-independent capabilities

`src/core/api.ts` defines the stable capability names and pure context operations. The local transports currently are:

- Web workspace: `npm run dev`
- JSON CLI: `npm run --silent design -- <command>`
- Local HTTP API: `/api/design`

The official external provider is `design`. `design_get_context` returns Design Units + embedded Product Design Model + Golden Gate + visual assets. Ordinary ChatGPT design work uses granular typed provider actions for Design Units, tokens, component contracts, Screen Specs, individual Product Flows, and `design_put_artboard` for current high-fidelity SVG authority. Provider argument schemas embed the same canonical repository JSON Schemas used by ProjectStore rather than maintaining provider-only field definitions. Product Flow writes update `product.json` through read-modify-validate-write; no separate flow authority exists. `design_put_artboard` accepts only registered project + Design Unit + Screen + State + Review Profile identities and SVG content; ProjectStore derives the canonical repository path and atomically publishes SVG bytes plus the visual-asset manifest. Provider writes never accept arbitrary repository paths. Delete and human acceptance are deliberately excluded from the ordinary authorization write surface. `design_get_review_status` is read-only and exposes derived Artboard coverage. `design_accept_unit` and `design_freeze_project` use Forge `strong_confirmation` with exact confirmation texts, then dispatch to canonical ProjectStore acceptance/freeze methods; the provider does not trust a writable `accepted` boolean supplied by ChatGPT.

## Responsibility split

1. Repository access, authorization, and execution evidence belong to Forge/provider integration.
2. Structural validation comes from canonical JSON Schemas; cross-asset design semantics and lint belong to the core/store.
3. Semantic component previews compile through the shared Design IR. Temporary interaction state belongs to the bounded Studio runtime; preview actions are declarative (`set_state`, `toggle`, `select`, `navigate`, overlays, mock submit, scroll, design-action emission) and never execute arbitrary project JavaScript. Semantic Preview is still not automatically high-fidelity visual authority.
4. Review Profiles own platform-neutral viewport semantics (device/desktop/web plus platform, dimensions, safe areas, color/text/contrast/motion). The legacy Screen `device` field remains compatibility-only; new Screen Specs may carry explicit viewport semantics or inherit a Review Profile.
5. Baseline structural quality inspection consumes the compiled Design IR and Review Profile so geometry, state coverage, interaction wiring, compile diagnostics, and token references use the same derived tree that is rendered.
6. High-fidelity visual authority is the unique current `design_artboard` for one exact Design Unit / Screen / State / Review Profile binding; historical/reference and runtime artifacts remain evidence even when visually similar. Semantic Preview is a derived inspection lane and may never replace a missing Artboard.
7. Production application source mutation is a separate explicit capability and review step.
8. Git remains responsible for review, history, branching, merge, and rollback. Multi-file design imports/migrations additionally use the repository-native storage transaction so a provider crash cannot leave mixed-version canonical assets.
