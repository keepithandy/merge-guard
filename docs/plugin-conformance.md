# Plugin conformance kit

`src/pluginConformance.js` and `scripts/plugin-conformance-contracts.js` provide the local plugin compatibility kit. It checks a plugin manifest against the supported core range, confirms an explicitly supplied local entry point, runs the lifecycle through the isolated worker, and verifies the bounded findings output shape.

The kit reports a concise JSON result with kit version, core version, plugin identity, supported core range, and named checks. Invalid manifests, missing local entry points, and incompatible core versions fail the report. Worker failure-quarantine behavior is covered by the plugin-worker contract fixtures.

The kit uses no network, external secrets, automatic discovery, or remote downloads. Plugin authors can run it locally without modifying Merge Guard core:

```bash
npm run test:plugin-conformance
```
