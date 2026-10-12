# Event logging

Object ID Ninja records selected successful back-end changes in the `_log` array of the
app's consumption blob. For a simple app pool, all members use the same pool consumption
blob, named `{poolId}.json`; `_log` is a property of that JSON document, not a separate blob.

## Recorded events

The log covers committed next-ID reservations (`getNext`), added and removed assignments
(`addAssignment` and `removeAssignment`), synchronization (`syncMerge` and `syncFull`), and
authorization changes (`authorize` and `deauthorize`). Accepted synchronization operations
are logged even when the submitted IDs already match the stored consumption.

This is a change log, not an audit of every HTTP request. Read requests, next-ID previews,
denied requests, and failed operations do not create change events. Adding an already
reserved assignment or removing an absent assignment does not create an assignment event.
Simple-pool membership edits and managed-pool administration are not covered by this log.

## Entry fields

Each new event sent by the updated extension contains:

- `timestamp`: server time as Unix epoch milliseconds.
- `eventType`: the operation listed above.
- `user`: the reported username, stored **in plaintext**.
- `userEncoding`: `plain` for usernames sent by the updated extension.
- `sourceAppId`: the hash of the originating app, not the pool ID. This distinguishes
  members sharing the same consumption blob; it is not a human-readable app name.
- `data`: operation-specific details. Assignment events contain ID/type information;
  synchronization events contain `origin` (`manual` or `auto`) and submitted ID counts
  grouped by object type. Counts are not the number of newly reserved or changed IDs and
  can include duplicates in the submitted input.

For auto-synchronization, actor metadata is supplied independently for each folder, including
when several folders belong to one pool. Event and consumption changes are persisted in the
same optimistic blob update. Authorization keys and full synchronization ID arrays are not
included in the event data.

## Identity and privacy

`objectIdNinja.overrideUserName` controls the reported name; otherwise the extension uses
the operating-system username. These labels are client-supplied and can be changed. They
are **not verified authenticated identities**, and `sourceAppId` is attribution metadata,
not an authorization credential.

The updated extension always sends the event username, including for protected publishers
and when local app context is unavailable. `objectIdNinja.includeUserName` has been removed;
existing saved values are ignored and can be deleted from your settings. Encrypted Git
username/email is included in authorization information for eligible publishers, retaining
the protected-publisher exclusion. Older clients or direct API callers can still omit
actor metadata; the back end remains compatible with these requests.

This plaintext policy applies to event usernames for ordinary apps as well as simple pools.
It does not change encryption of authorization Git usernames or email addresses. Anyone
with access to the consumption blob or API responses containing its log may see the event
usernames. Review this personal-data exposure with your team before rollout.

`objectIdNinja.showEventLogNotifications` defaults to `false`. Enable it to receive team
notifications on your machine; an explicitly saved `true` preference is still respected.
It only controls notification display, not log storage or teammates' notification settings.
Notifications suppress your own events and do not show historical events on first observation.

## Retention and access

The back end retains entries newer than seven days and then keeps at most the newest
10,000 entries per app/pool. High-volume pools can therefore have less than seven days of
history. Pruning happens during subsequent logging calls; an idle blob can physically retain
older entries until another such write. There is no scheduled deletion job.

To inspect history, read `_log` in the app/pool consumption blob through your authorized
storage tooling. The log can also be included in consumption/change responses used by the
extension. The v2 `getLog` endpoint remains obsolete and returns HTTP 410; this change does
not add a historical-log viewer or restore that endpoint.

## Upgrading and legacy entries

Update the back end before updating the extension so the new actor metadata and retention
policy are supported. Older extensions cannot correctly display plaintext event usernames;
coordinate extension upgrades for team members who rely on notifications.

The updated back end still accepts legacy encrypted usernames. Entries with `userEncoding`
set to `encrypted`, or without an encoding marker, are treated as legacy ciphertext by the
updated extension. It attempts decryption using the originating app when available and
shows `Unknown user` if decryption is not possible. Pool members can have different app
encryption keys, so not every legacy pool entry can be decrypted locally.

Historical ciphertext is not rewritten to plaintext. Missing entries and entries already
pruned by the former four-hour retention policy cannot be recovered by this change.