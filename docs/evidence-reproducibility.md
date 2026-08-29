# Durable review evidence reproducibility

Merge Guard release readiness requires identical current and prior evidence to produce byte-stable durable review artifacts. Run the gate with:

```bash
npm run test:evidence-reproducibility
```

The gate generates three isolated lanes named local, CI-style, and repeat. Each lane uses the same two cumulative diffs, repository/branch/commit identities, configuration, and explicit generation timestamp. It regenerates and compares these files byte for byte:

- previous and current JSON reports;
- current Markdown report;
- previous and current artifact manifests;
- annotation JSON and SARIF;
- comparison JSON and Markdown;
- review-projection JSON.

The gate also compares each file's SHA-256 digest with `test/snapshots/evidence-reproducibility-v1.json`. It runs across Node 18/20/22/24 on Ubuntu and Windows, so line endings, object ordering, array ordering, hashing, and rendering drift block the release.

## Generated metadata boundary

There is no generic field scrubber or recursive normalization step. With identical explicit inputs, every artifact byte must match.

Production manifest creation defaults `generated.at` to the current time. That timestamp and `artifactId`, which is derived from the complete manifest, are the only intentionally variable fields. The reproducibility fixture supplies `--generated-at` explicitly so the complete manifest is byte-stable. A separate assertion changes only the timestamp and proves that all manifest evidence and content hashes remain identical after excluding exactly `generated.at` and `artifactId`.

The gate does not weaken comparison verification, authenticate artifacts, upload evidence, inspect workflow history, or change findings, scores, readiness, and thresholds.
