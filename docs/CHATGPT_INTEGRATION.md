# ChatGPT integration contract

ChatGPT and Forge adapters must use the same repository-owned asset model as the browser. `design.md` is the preferred portable AI/human transport; it is generated from and imported back into the same canonical JSON assets rather than becoming a second source of truth.

## Recommended read flow

Before composing UI, follow the product-design workflow in [`PRODUCT_DESIGN_WORKFLOW.md`](PRODUCT_DESIGN_WORKFLOW.md). A feature name or isolated screenshot is not sufficient context when the screen belongs to a larger create/read/edit/manage journey.

1. Discover projects with `npm run --silent design -- projects` or `GET /api/design/projects`.
   For a new external repository, first run `npm run --silent design -- register --project-root <absolute-path>` once.
2. Read `product.json` first (`get-product`, `design_get_product_model`, or the `product` field from context). Establish the user job and review the related product flow: management/list, create, detail, edit, destructive/archive actions, and other screens that define the same product logic. Identify the information model, meaningful states, interaction model, Screen Family, and relevant system patterns before choosing layout.
3. For structured agents, read one complete deterministic context with `npm run --silent design -- context --project <id>` or `GET /api/design/projects/<id>/context`.
4. For portable editing, export `design.md` with `npm run --silent design -- export-design-md --project <id> --file /tmp/design.md` or `GET /api/design/projects/<id>/design.md`.
5. Use approved Screen Family references and system interaction contracts first; only then use the returned component contracts and token document to implement or revise a Screen Spec.
6. Import an edited Markdown transport with `npm run --silent design -- import-design-md --project <id> --file /tmp/design.md` or `PUT /api/design/projects/<id>/design.md` using `text/markdown`.
7. Render and review the real screen and relevant interaction path, validate sibling consistency, then validate the project and review the resulting granular JSON Git diff.

`product.json` is now the canonical upstream Product Contract. If it is missing, the project is legacy visual-only: agents may read it for compatibility, but must create or complete the Product Contract before claiming a Golden candidate is ready for promotion.

The context payload contains the manifest, storage protocol, Product Contract, computed Golden Gate, tokens, components, and all independent screens. It is transport-independent and intentionally contains no browser-only state. The Markdown transport embeds deterministic fenced canonical JSON sections for project metadata, the Product Contract, tokens, component contracts, and each screen, so import is unambiguous and round-trippable.

## Write examples

```bash
npm run --silent design -- get-product --project metronome
npm run --silent design -- get-screen --project metronome --screen metronome-home
npm run --silent design -- put-screen --project metronome --file /tmp/metronome-home.json
npm run --silent design -- put-tokens --project metronome --file /tmp/tokens.json
npm run --silent design -- validate --project metronome
```

The browser's “Copy ChatGPT context” action calls the same context endpoint. This prevents prompt context, visual rendering, and repository state from drifting apart.

## Golden promotion gate

Do not approve or promote a Golden from a single attractive screen. `design_validate` computes the promotion gate from the Product Contract. Approved Golden requires a ready Product Brief, validated Golden flow, sibling-validated Interaction Patterns when promoted, concrete runtime evidence, `visual_reviewed`, and explicit user acceptance. `Captured` only means an artifact exists; `Model Visible` means the reviewer actually received the pixels; neither may be silently upgraded to `Visual Reviewed`.
