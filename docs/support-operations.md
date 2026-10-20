# Phase 5B — Priority Support owner operations

Owner-only local commands, not a hosted messaging service:

```powershell
node scripts/pro-support-operations.js pending --json
node scripts/pro-support-operations.js draft <ticket-id> <reply-file>
node scripts/pro-support-queue.js show <ticket-id>
node scripts/pro-support-queue.js status <ticket-id> responded
node scripts/pro-support-operations.js purge-closed 90
node scripts/pro-support-operations.js purge-closed 90 --apply
```

**Pending** reports ticket IDs/status/received timestamps without contact/message data. Owners may poll the command and configure their own scheduler, but the CLI itself sends no notification.

**Draft** stores a private, no-overwrite `<id>.draft.json` with the response text and customer reply address. It never sends an email, and does not mark a ticket as responded. A human operator or separately authorized outbound system must deliver the message and confirm delivery before updating the status.

**Retention** previews closed tickets whose last status update was at least the stated number of days ago. Only explicit `--apply` deletes records and local reply drafts. All unclosed tickets and missing timestamps are retained. Do not run `--apply` when a legal hold, backup/recovery policy or unresolved complaint requires preservation.

Protect the queue directory and any backups. POSIX permission modes are not sufficient evidence of Windows ACL security. No staffed support coverage, mail delivery, retention-law compliance or response SLA is implied by these tools.
