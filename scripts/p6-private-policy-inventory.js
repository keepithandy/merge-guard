#!/usr/bin/env node
// P6C: local inventory and schema proof only. Content rights need owner review.
// No policies are uploaded, copied, disclosed or entitled by this utility.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validatePolicyPack } from '../src/policyPacks.js';

const directory = process.env.MERGE_GUARD_PRO_POLICY_DIRECTORY;
const publicCheckout = path.resolve(process.cwd());
const ID = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
if (!directory) throw new Error('Set MERGE_GUARD_PRO_POLICY_DIRECTORY to a separate private directory.');
const resolved = path.resolve(directory);
const relative = path.relative(publicCheckout, resolved);
if (!path.isAbsolute(relative) && !relative.startsWith('..' + path.sep) && relative !== '..') {
  throw new Error('Private paid policies must not come from inside the public checkout.');
}
const root = fs.lstatSync(resolved);
if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Private policy root must be a real directory.');
const files = fs.readdirSync(resolved).filter(name => name.endsWith('.json')).sort();
if (!files.length || files.length > 50) throw new Error('Private policy inventory must include 1–50 JSON policies.');
const policies = files.map(name => {
  const id = name.slice(0, -5);
  if (!ID.test(id)) throw new Error('Invalid policy filename.');
  const file = path.join(resolved, name);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) {
    throw new Error('Policy must be a bounded regular file.');
  }
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(file, flags);
  let data;
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Policy was replaced.');
    data = JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally { fs.closeSync(fd); }
  const validation = validatePolicyPack(data);
  if (!validation.valid || validation.policy?.identity?.id !== 'merge-guard.pro.' + id) {
    throw new Error('Invalid policy schema/identity.');
  }
  return Object.freeze({
    id, version: validation.policy.identity.version,
    sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex')
  });
});
console.log(JSON.stringify({
  schemaVersion: 1, kind: 'p6-private-policy-inventory',
  policies, count: policies.length,
  contentsUploaded: false, rightsCleared: false, productionEnabled: false
}, null, 2));
