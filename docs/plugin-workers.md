# Isolated plugin workers

`src/pluginWorker.js` runs an explicitly selected local plugin in a separate Node worker. The core scanner passes only the input fields permitted by the validated manifest through structured clone; plugin results return as a bounded data object.

The worker has memory resource limits, the manifest timeout terminates it, finding counts and serialized output are bounded, and crashes, malformed output, and limit breaches become quarantined results. A worker failure cannot mutate core scanner state. This is a failure-isolation boundary, not a claim that a compromised local Node installation is a security sandbox.

The worker never discovers or downloads modules. The caller must provide an absolute local plugin path after explicit installation and manifest validation.

```bash
npm run test:plugin-worker
```
