#!/usr/bin/env node
import path from 'node:path';
import { createProGateway } from '../src/commercial/proGateway.js';
import { resolveCommercialConfig } from '../src/commercial/config.js';

const env = process.env;
const configuration = resolveCommercialConfig(env);
if (configuration.environment !== 'sandbox' && env.MERGE_GUARD_ALLOW_PRODUCTION_GATEWAY !== 'yes') {
  throw new Error('Gateway defaults to Sandbox. Production requires explicit owner approval and hardened HTTPS ingress.');
}
const policyDirectory = env.MERGE_GUARD_PRO_POLICY_DIRECTORY;
const supportDirectory = env.MERGE_GUARD_PRO_SUPPORT_DIRECTORY;
if (!policyDirectory || !supportDirectory) {
  throw new Error('Set MERGE_GUARD_PRO_POLICY_DIRECTORY and MERGE_GUARD_PRO_SUPPORT_DIRECTORY.');
}
const port = Number(env.MERGE_GUARD_PRO_GATEWAY_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MERGE_GUARD_PRO_GATEWAY_PORT must be a valid TCP port.');
}
const server = createProGateway({
  env,
  policyDirectory: path.resolve(policyDirectory),
  supportDirectory: path.resolve(supportDirectory)
});
// Intentionally loopback-only: production requires an owner-deployed TLS proxy,
// ingress rate limiting, retention controls, monitoring, and support staffing.
server.listen(port, '127.0.0.1', () => {
  console.log('Pro gateway listening on localhost:' + port + ' (' + configuration.environment + ').');
});
