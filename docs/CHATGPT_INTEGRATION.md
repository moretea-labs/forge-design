# ChatGPT integration contract

ChatGPT and Forge adapters must use the same repository-owned asset model as the browser. `design.md` is the preferred portable AI/human transport; it is generated from and imported back into the same canonical JSON assets rather than becoming a second source of truth.

## Recommended read flow

1. Discover projects with `npm run --silent design -- projects` or `GET /api/design/projects`.
   For a new external repository, first run `npm run --silent design -- register --project-root <absolute-path>` once.
2. For structured agents, read one complete deterministic context with `npm run --silent design -- context --project <id>` or `GET /api/design/projects/<id>/context`.
3. For portable editing, export `design.md` with `npm run --silent design -- export-design-md --project <id> --file /tmp/design.md` or `GET /api/design/projects/<id>/design.md`.
4. Use the returned token document and component contracts before creating or changing a Screen Spec.
5. Import an edited Markdown transport with `npm run --silent design -- import-design-md --project <id> --file /tmp/design.md` or `PUT /api/design/projects/<id>/design.md` using `text/markdown`.
6. Validate the project, review the resulting granular JSON Git diff, and run project checks.

The context payload contains the manifest, storage protocol, tokens, components, and all independent screens. It is transport-independent and intentionally contains no browser-only state. The Markdown transport embeds deterministic fenced canonical JSON sections for project metadata, tokens, component contracts, and each screen, so import is unambiguous and round-trippable.

## Write examples

```bash
npm run --silent design -- get-screen --project metronome --screen metronome-home
npm run --silent design -- put-screen --project metronome --file /tmp/metronome-home.json
npm run --silent design -- put-tokens --project metronome --file /tmp/tokens.json
npm run --silent design -- validate --project metronome
```

The browser's “Copy ChatGPT context” action calls the same context endpoint. This prevents prompt context, visual rendering, and repository state from drifting apart.
