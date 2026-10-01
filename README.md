# Forge Design

<p align="center"><strong>Repository-native product and UI design workspace and official design provider for Forge.</strong></p>
<p align="center"><a href="https://github.com/moretea-labs/forge">Forge</a> · <a href="docs/PRODUCT_DESIGN_WORKFLOW.md">Product design workflow</a> · <a href="docs/CHATGPT_INTEGRATION.md">ChatGPT integration</a> · <a href="docs/STORAGE.md">Storage model</a> · <a href="SUPPORT.md">Support</a></p>
<p align="center"><img alt="CI" src="https://github.com/moretea-labs/forge-design/actions/workflows/ci.yml/badge.svg"> <img alt="Release" src="https://img.shields.io/github/v/release/moretea-labs/forge-design?sort=semver"> <img alt="Node" src="https://img.shields.io/badge/Node.js-20%2B-green"> <img alt="License" src="https://img.shields.io/github/license/moretea-labs/forge-design"></p>

Forge Design gives developers and AI assistants a **deterministic, Git-reviewable product-design model** instead of hiding canonical design state inside a browser or proprietary canvas. A screen is treated as the result of a product flow: user job, information hierarchy, state semantics, interaction model, Screen Family, system interaction patterns, composition, components, and tokens are reasoned about in that order. The canonical model — Product Contract, tokens, component contracts, screens, and `design.md` — live with the target repository and can be read, rendered, validated, edited, diffed, and reviewed like code.

## Install through Forge

```bash
forge plugin install design
forge plugin list --refresh
```

Forge owns trusted installation, authorization, resource claims, and execution evidence. Forge Design remains an independent product and owns the design model, renderer, validation, and release lifecycle.

## Design source of truth

Each target repository can own:

```text
<target-repository>/
└── .design-harness/
    ├── project.json
    ├── product.json
    ├── tokens.json
    ├── components.json
    ├── screens/
    │   └── <screen-id>.json
    └── README.md
```

- `product.json` is the upstream Product Contract: User Job, product goal, information/state/interaction models, flows, Interaction Patterns, and Golden review state.
- `tokens.json` is the canonical token source.
- `components.json` defines allowed component contracts and props.
- Every screen is an independent reviewable JSON file.
- `design.md` is a deterministic import/export representation over the same canonical model.
- Browser local storage is never the authority.
- Git provides history, review, branching, and rollback.

A maintained example lives at `workspace/metronome/.design-harness/`.

## Run standalone

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`.

The workspace opens in **Product** rather than Screens. It exposes the repository-native Product Contract, full flows, information/state/interaction decisions, Interaction Pattern promotion state, runtime review evidence, and Golden blockers before downstream Screens/Components/Tokens. A captured screenshot is not treated as reviewed: the gate distinguishes `Captured → Model Visible → Visual Reviewed → User Accepted`.

## CLI

```bash
npm run --silent design -- projects
npm run --silent design -- context --project metronome
npm run --silent design -- get-product --project metronome
npm run --silent design -- get-tokens --project metronome
npm run --silent design -- get-screen --project metronome --screen metronome-home
npm run --silent design -- validate --project metronome
```

Write operations accept bounded JSON files:

```bash
npm run --silent design -- put-product --project metronome --file /tmp/product.json
npm run --silent design -- put-screen --project metronome --file /tmp/screen.json
npm run --silent design -- put-tokens --project metronome --file /tmp/tokens.json
npm run --silent design -- put-components --project metronome --file /tmp/components.json
```

Initialize or register a target repository:

```bash
npm run --silent design -- init --project-root /absolute/path/to/repo --project target-app --name "Target App"
npm run --silent design -- register --project-root /absolute/path/to/repo
```

The local project registry is Git-ignored at `~/.forge-design/projects.json`.

## Architecture

```text
Target repository (.design-harness)
              │
      ┌───────┼────────┐
      │       │        │
     CLI   Local API   Forge provider
      │       │        │
      └───────┼────────┘
              │
      validation + design lint
              │
        interactive renderer
```

The official Forge plugin identity is `design`; the provider uses a bounded managed-process JSONL protocol. The `.design-harness/` directory remains the current repository asset format for compatibility and is not renamed mechanically. Screen/component assets compile into one platform-neutral Design IR before semantic rendering. The Studio runtime executes only bounded declarative preview actions; project JavaScript is never loaded as preview authority. Review Profiles provide viewport/platform semantics for iOS, Android, macOS, Windows, web, or other surfaces, while legacy `iphone-16-pro` Screen Specs remain readable.

## Verify

```bash
npm run validate:design
npm run typecheck
npm test
npm run build
```

See [Product Design Workflow](docs/PRODUCT_DESIGN_WORKFLOW.md), [Storage](docs/STORAGE.md), [ChatGPT Integration](docs/CHATGPT_INTEGRATION.md), [Plugin Contract](docs/PLUGIN_CONTRACT.md), and the Forge [Plugin Management guide](https://github.com/moretea-labs/forge/blob/main/docs/forge-plugin-management.md).

## Project

Latest published release: `v0.3.0`; current main is the `v0.6.0` candidate with Design Units, state/transition flows, a unified Design IR/Studio runtime, bounded declarative preview interactions, platform-neutral Review Profiles, baseline IR quality inspection, granular ChatGPT actions, human acceptance/freeze authority, and crash-safe bundle publication. Use Issues for reproducible design/provider bugs and feature requests. Cross-product Forge questions belong in [Forge Discussions](https://github.com/moretea-labs/forge/discussions). Security reports should use GitHub Private Vulnerability Reporting; see [SECURITY.md](SECURITY.md).

Licensed under the [MIT License](LICENSE).
