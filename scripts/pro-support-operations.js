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
  if (!ticket || ticket.id !== id || !allowedStatus.has(ticket.status)
      || typeof ticket.receivedAt !== 'string'
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(ticket.receivedAt)
      || !Number.isFinite(Date.parse(ticket.receivedAt))
      || typeof ticket.contact !== 'string' || ticket.contact.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.contact)
      || CONTROL.test(ticket.contact)
      || typeof ticket.message !== 'string' || ticket.message.length > 4000
      || CONTROL.test(ticket.message)) {
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
function attestDelivery(id, referenceFile) {
  const ticket = readTicket(id);
  if (ticket.status === 'closed') throw new Error('Closed ticket cannot be attested.');
  regularFile(referenceFile, 512);
  const reference = fs.readFileSync(referenceFile, 'utf8').trim();
  // An operator-controlled provider reference, not a customer address or
  // message body; never claim the gateway itself transmitted a reply.
  if (reference.length < 4 || reference.length > 200
      || !/^[A-Za-z0-9][A-Za-z0-9._:/+\-]{3,199}$/.test(reference)) {
    throw new Error('Delivery reference must be 4–200 safe characters without personal contact details.');
  }
  const receipt = path.join(directory, id + '.delivery.json');
  writePrivate(receipt, JSON.stringify({
    ticketId: id, status: 'operator-attested-external-delivery',
    providerReference: reference, confirmedAt: new Date().toISOString(),
    nonce: randomUUID()
  }, null, 2) + '\n');
  console.log('Operator delivery attestation saved for ' + id + '. No email was sent by Merge Guard.');
}
function holdTicket(id, category) {
  readTicket(id);
  if (!['legal', 'incident', 'retention'].includes(category)) {
    throw new Error('Hold category must be legal, incident, or retention.');
  }
  writePrivate(path.join(directory, id + '.hold.json'), JSON.stringify({
    ticketId: id, status: 'hold-active', category,
    createdAt: new Date().toISOString(), nonce: randomUUID()
  }, null, 2) + '\n');
  console.log('Retention hold created for ticket ' + id + '. Release requires independent operator authorization.');
}
function purgeClosed(daysText, apply) {
  const days = Number(daysText);
  if (!/^[0-9]+$/.test(daysText || '') || !Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error('purge-closed requires an integer age of 1–3650 days.');
  }
  const now = Date.now();
  const expired = allTickets().filter(ticket => {
    if (ticket.status !== 'closed' || typeof ticket.updatedAt !== 'string') return false;
    // Any hold path, even invalid or dangling, blocks destructive removal
    // until it is independently inspected/released by the owner.
    const holdPath = path.join(directory, ticket.id + '.hold.json');
    if (fs.lstatSync(holdPath, { throwIfNoEntry: false })) return false;
    const at = Date.parse(ticket.updatedAt);
    return Number.isFinite(at) && at <= now && now - at >= days * DAY_MS;
  });
  for (const ticket of expired) {
    if (apply) {
      const primary = ticketFile(ticket.id);
      const reply = path.join(directory, ticket.id + '.draft.json');
      const receipt = path.join(directory, ticket.id + '.delivery.json');
      const hold = path.join(directory, ticket.id + '.hold.json');
      if (fs.lstatSync(hold, { throwIfNoEntry: false })) {
        throw new Error('Ticket is on retention hold.');
      }
      // Refuse to delete the ticket if an unexpected draft path is present.
      // lstat detects dangling symlinks; existsSync would treat them as absent.
      const draftStat = fs.lstatSync(reply, { throwIfNoEntry: false });
      if (draftStat && (!draftStat.isFile() || draftStat.isSymbolicLink()
          || draftStat.size > 16384)) {
        throw new Error('Not a regular bounded file.');
      }
      const deliveryStat = fs.lstatSync(receipt, { throwIfNoEntry: false });
      if (deliveryStat && (!deliveryStat.isFile() || deliveryStat.isSymbolicLink()
          || deliveryStat.size > 16384)) {
        throw new Error('Not a regular bounded file.');
      }
      regularFile(primary);
      if (draftStat) fs.unlinkSync(reply);
      if (deliveryStat) fs.unlinkSync(receipt);
      fs.unlinkSync(primary);
    }
    console.log((apply ? 'Purged' : 'Would purge') + ': ' + ticket.id);
  }
  console.log((apply ? 'Purged ' : 'Dry-run: ') + expired.length + ' closed ticket(s).');
}

privateDirectory();
const [command, value, flag, ...extra] = process.argv.slice(2);
if (extra.length || ((command === 'attest-delivery') && !flag)) {
  throw new Error('Unexpected or missing arguments.');
}
if (command === 'pending' && (!value || value === '--json') && !flag) pending(value === '--json');
else if (command === 'draft' && UUID.test(value || '') && flag) draft(value, flag);
else if (command === 'attest-delivery' && UUID.test(value || '') && flag) attestDelivery(value, flag);
else if (command === 'hold' && UUID.test(value || '') && flag) holdTicket(value, flag);
else if (command === 'purge-closed' && (flag === undefined || flag === '--apply')) purgeClosed(value, flag === '--apply');
else throw new Error('Usage: pending [--json] | draft <ticket-id> <reply-file> | attest-delivery <ticket-id> <reference-file> | hold <ticket-id> <legal|incident|retention> | purge-closed <days> [--apply]');
