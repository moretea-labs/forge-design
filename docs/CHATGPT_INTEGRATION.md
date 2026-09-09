# ChatGPT integration contract

ChatGPT and Forge adapters must use the same repository-owned asset model as the browser. `design.md` is a portable AI/human transport generated from and imported back into the same canonical JSON assets; it never becomes a second source of truth.

## Recommended read flow

Before composing UI, follow the product-design workflow in [`PRODUCT_DESIGN_WORKFLOW.md`](PRODUCT_DESIGN_WORKFLOW.md). A feature name or isolated screenshot is not sufficient context when the screen belongs to a larger create/read/edit/manage journey.

1. Discover projects with `npm run --silent design -- projects` or `GET /api/design/projects`.
   For a new external repository, first run `npm run --silent design -- register --project-root <absolute-path>` once.
2. Read one deterministic context with `npm run --silent design -- context --project <id>` or `GET /api/design/projects/<id>/context`. Inspect `designUnits` before choosing a screen to edit.
3. For each Design Unit, resolve its pinned `contractRefs` from the target repository at the exact referenced revision/path/section. Those upstream contracts remain semantic authority. Do not copy a mature external Product Contract into Forge Design simply to make the design workspace self-contained.
4. If the project uses the embedded `product.json`, read it as the Product Design Model and establish User Job, journey, information/state/interaction model, Screen Family and system patterns before composition. A missing embedded product model remains legacy/unmodeled for the existing project-wide Golden gate.
5. Use approved Screen Family references and system interaction contracts first; only then use returned component contracts and tokens to implement or revise a Screen Spec.
6. For portable batch editing, export `design.md` with `npm run --silent design -- export-design-md --project <id> --file /tmp/design.md`. Format v2 includes Design Units; format v1 remains readable for backward compatibility.
7. Import an edited Markdown transport with `npm run --silent design -- import-design-md --project <id> --file /tmp/design.md` or `PUT /api/design/projects/<id>/design.md` using `text/markdown`.
8. Render and review the real design screen and relevant interaction path, validate sibling consistency, then validate the project and review the resulting granular JSON Git diff.

The context payload contains manifest/storage migration state, Design Units, embedded Product Design Model, computed Golden Gate, tokens, components, and independent screens. It is transport-independent and intentionally contains no browser-only state.

## Write examples

```bash
npm run --silent design -- get-design-units --project metronome
npm run --silent design -- put-design-units --project metronome --file /tmp/design-units.json
npm run --silent design -- migrate --project legacy-project
npm run --silent design -- get-product --project metronome
npm run --silent design -- get-screen --project metronome --screen metronome-home
npm run --silent design -- put-screen --project metronome --file /tmp/metronome-home.json
npm run --silent design -- put-tokens --project metronome --file /tmp/tokens.json
npm run --silent design -- validate --project metronome
```

The browser's “Copy ChatGPT context” action calls the same context endpoint. This prevents prompt context, visual rendering, and repository state from drifting apart.

## Golden promotion gate

Do not approve or promote a Golden from a single attractive screen. `design_validate` computes the existing project-wide promotion gate from the embedded Product Design Model. Approved Golden requires a ready Product Brief, validated Golden flow, sibling-validated Interaction Patterns when promoted, concrete runtime evidence, `visual_reviewed`, and explicit user acceptance. `Captured` only means an artifact exists; `Model Visible` means the reviewer actually received the pixels; neither may be silently upgraded to `Visual Reviewed`.

Per-Design-Unit approval/freeze is intentionally a later P0-E capability. Until then, Design Units organize and pin design authority without pretending the current project-wide Golden gate is already family-aware.
