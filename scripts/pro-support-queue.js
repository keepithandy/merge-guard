#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const directory = process.env.MERGE_GUARD_PRO_SUPPORT_DIRECTORY;
if (!directory) throw new Error('Set MERGE_GUARD_PRO_SUPPORT_DIRECTORY to your private ticket queue.');
const [operation, id, desiredStatus] = process.argv.slice(2);
const allowedStatus = new Set(['queued', 'open', 'responded', 'closed']);
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assertPrivateDirectory() {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()
      || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
    throw new Error('Ticket queue must be a private, real directory.');
  }
}

assertPrivateDirectory();

function ticketPath(id) {
  if (!idPattern.test(id || '')) throw new Error('Invalid ticket ID.');
  return path.join(directory, id + '.json');
}

function readTicket(id) {
  const file = ticketPath(id);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024) {
    throw new Error('Invalid ticket file.');
  }
  const ticket = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ticket.id !== id || !allowedStatus.has(ticket.status)) throw new Error('Invalid ticket contents.');
  return ticket;
}

if (operation === 'list' && id === undefined) {
  for (const file of fs.readdirSync(directory).sort()) {
    if (!/^[0-9a-f-]{36}\.json$/.test(file)) continue;
    try {
      const ticket = readTicket(file.slice(0, -5));
      // No contact or message in list output.
      console.log(ticket.id + '  ' + ticket.status + '  ' + ticket.receivedAt);
    } catch { /* skip invalid files */ }
  }
} else if (operation === 'show' && id && desiredStatus === undefined) {
  // This is an owner-only command: output contains personal contact and message.
  const ticket = readTicket(id);
  console.log('Ticket: ' + ticket.id);
  console.log('Status: ' + ticket.status);
  console.log('Received: ' + ticket.receivedAt);
  console.log('Contact: ' + ticket.contact);
  console.log('Message:\n' + ticket.message);
} else if (operation === 'status' && id && ['open', 'responded', 'closed'].includes(desiredStatus)) {
  const ticket = readTicket(id);
  ticket.status = desiredStatus;
  ticket.updatedAt = new Date().toISOString();
  const file = ticketPath(id);
  const tmp = file + '.' + randomUUID() + '.tmp';
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(ticket, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
  }
  console.log('Ticket ' + id + ' updated to ' + desiredStatus);
} else {
  throw new Error('Usage: node scripts/pro-support-queue.js list | show <ticket-id> | status <ticket-id> <open|responded|closed>');
}
