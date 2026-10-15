# Changelog

Notable changes to the AL Object ID Ninja backend are documented here.

## 2026-10-15

- Require a nonblank `user` value on all state-changing v2 requests. Requests without a username are rejected before backend state is changed. Read-only requests remain exempt.
- For `autoSyncIds`, each folder may supply its own `user`; otherwise it inherits the root request's `user`. The entire batch is validated before any folder is written.
- The username is caller-supplied metadata, not a verified identity. Existing authentication, authorization, and signature checks remain in place.
