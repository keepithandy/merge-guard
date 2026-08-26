# Report trends and local retention

`src/reportTrends.js` summarizes compatible artifact/report pairs without inventing precision. It records reported risk score, finding count, schema version, configuration hash, artifact identity, and generation time. Gaps, invalid manifests, out-of-order history, and configuration/schema changes are surfaced as warnings; no missing point is interpolated.

Retention is an explicit local plan. Recent artifacts and protected release references are retained, old/unbounded artifacts are candidates for explicit deletion, and protected IDs are never returned for deletion. Immutable artifacts are never merged, rewritten, or silently compacted. The plan does not upload, delete, or alter files by itself.

```bash
npm run test:report-trends
```
