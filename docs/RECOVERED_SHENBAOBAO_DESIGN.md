# Recovered 肾宝保 design lineage

The original 肾宝保 / transplant visual design work existed in Forge Design before the public 0.3.0 history reset. It was embedded directly in Forge Design source instead of stored as a standalone repository-native project, which made product design content vulnerable to tool history rewrites.

## Recovery authority

A durable local Git ref now preserves the full pre-reset chain:

`recovery/shenbaobao-design-pre-0.3 -> e61fd2073c279bf5ab8712be1a583cacf83d9131`

Do not depend on reflog retention for this design history.

## Recovered design sequence

- `fd94d3267c70187491336990723334f84f52ad7f` — transplant design-pack support.
- `26b854e6166dad1000e2412ecde1e71ed327388d` — source-faithful transplant Home design; introduced `OriginalTransplantHomeScreen.tsx` and `original-home.css`.
- `e338330db51a442c7c4e929bd3044b9fc05169fd` — grouped Record Data canvas; introduced `RecordDataScreen.tsx`.
- `96eac2cc25fdddbbefb939765fc7873390ffc41e` — aligned Record filters with the product model.
- `3fbac74770f62f25057370ff80412cc32b294d08` — transplant Trends canvas; introduced `TrendDataScreen.tsx`.
- `e76305872c55b1c7b0302a81a9409575f3010eff` — preserved single-day Record mode and cross-screen behavior.
- `0d8af453f5625705d93ace4d6624e912223d98b6` — transplant Plan workspace; introduced `PlanWorkspaceScreen.tsx` and `plan-workspace.css`.
- `e61fd2073c279bf5ab8712be1a583cacf83d9131` — latest pre-reset line after design markdown transport.

## Why it disappeared

On 2026-08-11, the Forge Design main branch reflog records `reset: moving to 141920ee6d9f9d9d57c9f27d484aec613dfef5b0`. Commit `141920e` is a parentless root commit titled `feat: publish Forge Design 0.3.0`. The pre-reset design chain therefore stopped being reachable from `main`. Later generic Forge Design work continued from the new root, so normal `git log --all` and the current project registry no longer exposed the old 肾宝保 screens.

## Architectural lesson

The recovered pages are product design assets, not Forge Design core behavior. They must not be restored by re-introducing product-specific React branches into `MockScreen`. The visual-authority workflow must migrate them into repository-native visual artifacts/references with exact Git provenance and bind them to Design Units / Screens / States. Tool releases or refactors must never be able to delete product design history by replacing tool implementation source.

## Migration rule

Before a new 肾宝保 visual direction is drawn, the recovered Home / Record / Trends / Plan designs must be reviewable in Forge Design as historical visual references. They are evidence and starting visual language, not automatic current Product Contract authority.
