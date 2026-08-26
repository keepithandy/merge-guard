# Accepted legacy risk

The v1 legacy-risk contract annotates explicitly accepted historical findings without removing them or changing scores. Each entry requires the stable finding identity, a reason, an owner, and a real UTC expiry date.

Entries match by exact `findingIdentity` only. Unrelated findings cannot inherit an acceptance. Expired, duplicate, malformed, or unsupported entries are ignored with structured warnings. New findings remain visible and retain their original score and threshold behavior.

Baseline metadata is local annotation data. It does not authorize a merge, prove remediation, upload reports, or authenticate the evidence. See `schemas/legacy-risk-v1.schema.json` and `src/legacyRisk.js`.

```bash
npm run test:legacy-risk
```
