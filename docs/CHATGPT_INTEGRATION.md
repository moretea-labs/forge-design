# ChatGPT integration contract

ChatGPT and Forge adapters must use the same repository-owned asset model as the browser. `design.md` is a portable AI/human transport generated from and imported back into the same canonical JSON assets; it never becomes a second source of truth.

## Recommended read flow

Before composing UI, follow the product-design workflow in [`PRODUCT_DESIGN_WORKFLOW.md`](PRODUCT_DESIGN_WORKFLOW.md). A feature name or isolated screenshot is not sufficient context when the screen belongs to a larger create/read/edit/manage journey.

1. Discover projects with `npm run --silent design -- projects` or `GET /api/design/projects`.
   For a new external repository, first run `npm run --silent design -- register --project-root <absolute-path>` once.
2. Read one deterministic context with `npm run --silent design -- context --project <id>` or `GET /api/design/projects/<id>/context`. Inspect `designUnits` before choosing a screen to edit.
3. For each Design Unit, resolve its pinned `contractRefs` from the target repository at the exact referenced revision/path/section. Those upstream contracts remain semantic authority. Do not copy a mature external Product Contract into Forge Design simply to make the design workspace self-contained.
4. If the project uses the embedded `product.json`, read it as the Product Design Model and establish User Job, journey, information/state/interaction model, Screen Family and system patterns before composition. A missing embedded product model remains legacy/unmodeled for the existing project-wide Golden gate.
5. Read each relevant Screen as one identity with named state variants. Then read the Product Flow transition graph: `entry`, `from`, `trigger`, optional `guard`, `commitBoundary`, `result`, `to`, and `recovery`. Do not infer a user journey from component-node order, and do not create separate pseudo-screens for ordinary empty/error/degraded states.
6. Use approved Screen Family references and system interaction contracts first; only then use returned component contracts and tokens to implement or revise a Screen Spec. Prefer typed `props`, declared `variants`/`states`, semantic `interactionRole`, layout/accessibility metadata, and the component declarative `preview` tree. `allowedProps` is legacy compatibility, not the target authoring model.
7. Read `visualAssets` before making a visual claim. A typed MockScreen/component preview is semantic/component evidence, not a high-fidelity UI design by itself. `reference` assets are inputs, `design_artboard` assets are the current visual design authority, and `runtime_evidence` assets are implementation evidence. For portable batch editing, export `design.md` with `npm run --silent design -- export-design-md --project <id> --file /tmp/design.md`. Format v3 includes Design Units and Visual Assets; formats v1/v2 remain readable for backward compatibility.
8. Import an edited Markdown transport with `npm run --silent design -- import-design-md --project <id> --file /tmp/design.md` or `PUT /api/design/projects/<id>/design.md` using `text/markdown`.
9. Prefer granular Forge provider actions for ordinary ChatGPT design work: read/write Design Units, tokens, component contracts, individual Screen Specs, and individual Product Flows. These actions always target a registered `project_id` plus semantic asset ids; they do not accept repository file paths and they dispatch through the canonical ProjectStore validators. Use full `design.md` import/export only for deliberate portable batch transport. Bundle import is crash-safe and publishes through one staged `.design-harness` transaction rather than sequentially replacing canonical files.
10. Render and review the real design screen states under every Review Profile required by the current Design Unit, including text-scale and reduced-motion projections and any declared dark color mode. Validate sibling consistency, then validate the project and review the resulting granular JSON Git diff.
11. Read `design_get_review_status` before handoff. Human acceptance is never inferred from ChatGPT confidence or a successful validation. After the user explicitly accepts a visually reviewed family, `design_accept_unit` requires Forge strong confirmation and an exact clean candidate Git revision. After every family has current acceptance, `design_freeze_project` requires a second strong confirmation and records the project-wide Phase D handoff freeze.

The context payload contains manifest/storage migration state, Design Units, embedded Product Design Model, computed Golden Gate, tokens, components, independent screens, the canonical Visual Asset manifest, and resolved visual-asset content status/hashes. It is transport-independent and intentionally contains no browser-only state.

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

## Review and implementation handoff

The embedded Product Golden gate is retained for compatibility with self-contained projects and remains fail-closed: `Captured` only means an artifact exists; `Model Visible` means the reviewer actually received the pixels; neither may be silently upgraded to `Visual Reviewed`. Its legacy `userDecision` field is protected from ordinary writes and is not the family-aware implementation-handoff authority.

For current multi-family design work, Design Units own review lifecycle and Review Profiles. Ordinary `design.write` actions may edit design state but cannot add/change acceptance or freeze evidence. `design_accept_unit` requires `confirmation=strong_confirmation`, exact confirmation text `accept-design-unit`, a visually reviewed unit, concrete review profiles/artifacts, a clean `.design-harness`, and `candidate_revision == HEAD`. Acceptance stores the exact revision plus a deterministic design digest; later design changes make it stale.

`design_freeze_project` requires strong confirmation text `freeze-design-project`, successful project validation, and current acceptance for every Design Unit. Only a current whole-project freeze is Phase D implementation-handoff authority. ChatGPT must never claim a family or project is accepted merely because tests pass, the Web preview renders, or it believes the design is good.
