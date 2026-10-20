#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Local owner tool only. No network requests, mail sending, or ambient telemetry.
const directory = process.env.MERGE_GUARD_PRO_SUPPORT_DIRECTORY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const allowedStatus = new Set(['queued', 'open', 'responded', 'closed']);
const DAY_MS = 86400000;

function privateDirectory() {
  if (!directory) throw new Error('Set MERGE_GUARD_PRO_SUPPORT_DIRECTORY.');
  let stat;
  try { stat = fs.lstatSync(directory); }
  catch { throw new Error('Support directory is unavailable.'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()
      || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
    throw new Error('Support directory must be a private, real directory.');
  }
}
function ticketFile(id) {
  if (!UUID.test(id || '')) throw new Error('Invalid ticket ID.');
  return path.join(directory, id + '.json');
}
function regularFile(file, maxBytes = 16384) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error('Not a regular bounded file.');
  }
}
function readTicket(id) {
  const file = ticketFile(id);
  regularFile(file);
  const ticket = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!ticket || ticket.id !== id || !allowedStatus.has(ticket.status)) {
    throw new Error('Invalid ticket record.');
  }
  return ticket;
}
function allTickets() {
  return fs.readdirSync(directory).filter(name => UUID.test(name.slice(0, -5))
    && name.endsWith('.json')).sort().flatMap(name => {
    try { return [readTicket(name.slice(0, -5))]; }
    catch { return []; } // invalid records never enter purge eligibility
  });
}
function writePrivate(file, contents) {
  let fd;
  try {
    fd = fs.openSync(file, 'wx', 0o600);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
  } catch {
    // Do not overwrite or follow pre-existing files.
    throw new Error('Reply draft could not be created; an existing draft must not be overwritten.');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function pending(json) {
  const tickets = allTickets().filter(ticket => ticket.status === 'queued' || ticket.status === 'open')
    .map(ticket => ({ id: ticket.id, status: ticket.status, receivedAt: ticket.receivedAt }));
  if (json) console.log(JSON.stringify({ count: tickets.length, tickets }, null, 2));
  else {
    console.log('Pending priority support: ' + tickets.length);
    for (const item of tickets) console.log(item.id + '  ' + item.status + '  ' + item.receivedAt);
  }
}
function draft(id, source) {
  const ticket = readTicket(id);
  if (ticket.status === 'closed') throw new Error('Closed tickets cannot receive new drafts.');
  if (!source) throw new Error('A response message file is required.');
  regularFile(source, 4096);
  const message = fs.readFileSync(source, 'utf8').trim();
  if (!message || message.length > 4000 || CONTROL.test(message)) {
    throw new Error('Reply text must be 1–4000 characters without terminal controls.');
  }
  if (typeof ticket.contact !== 'string' || ticket.contact.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.contact)) {
    throw new Error('Ticket reply contact is invalid.');
  }
  const file = path.join(directory, id + '.draft.json');
  writePrivate(file, JSON.stringify({
    ticketId: id, status: 'draft-unsent', replyTo: ticket.contact,
    message, preparedAt: new Date().toISOString(), nonce: randomUUID()
  }, null, 2) + '\n');
  console.log('Unsent reply draft saved locally for ticket ' + id + '. No email sent.');
}
function purgeClosed(daysText, apply) {
  const days = Number(daysText);
  if (!/^[0-9]+$/.test(daysText || '') || !Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error('purge-closed requires an integer age of 1–3650 days.');
  }
  const now = Date.now();
  const expired = allTickets().filter(ticket => {
    if (ticket.status !== 'closed' || typeof ticket.updatedAt !== 'string') return false;
    const at = Date.parse(ticket.updatedAt);
    return Number.isFinite(at) && at <= now && now - at >= days * DAY_MS;
  });
  for (const ticket of expired) {
    if (apply) {
      const primary = ticketFile(ticket.id);
      const reply = path.join(directory, ticket.id + '.draft.json');
      // Refuse to delete the ticket if an unexpected draft path is present.
      if (fs.existsSync(reply)) regularFile(reply, 16384);
      regularFile(primary);
      if (fs.existsSync(reply)) fs.unlinkSync(reply);
      fs.unlinkSync(primary);
    }
    console.log((apply ? 'Purged' : 'Would purge') + ': ' + ticket.id);
  }
  console.log((apply ? 'Purged ' : 'Dry-run: ') + expired.length + ' closed ticket(s).');
}

privateDirectory();
const [command, value, flag, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Unexpected arguments.');
if (command === 'pending' && (!value || value === '--json') && !flag) pending(value === '--json');
else if (command === 'draft' && UUID.test(value || '') && flag) draft(value, flag);
else if (command === 'purge-closed' && (flag === undefined || flag === '--apply')) purgeClosed(value, flag === '--apply');
else throw new Error('Usage: pending [--json] | draft <ticket-id> <reply-file> | purge-closed <days> [--apply]');
