# Contributing

Contributions are welcome. Keep canonical design state repository-native and deterministic; browser-only state must not become the source of truth.

## Development

```bash
npm ci
npm run validate:design
npm run typecheck
npm test
npm run build
```

Pull requests should include focused tests for model/import/export changes, preserve atomic validated writes, and document any public CLI/API/provider contract changes. Do not commit local project registries or machine-specific paths.
