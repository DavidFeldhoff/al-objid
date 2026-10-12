# AL Object ID Ninja Back End

This folder contains the back-end serverless functionality for AL Object Ninja extension.

## Event logging

Selected successful changes are recorded in `_log` inside each app/pool consumption JSON
blob. Event usernames from the updated extension are stored in **plaintext**, along with an
encoding marker and the originating app hash. Automatic synchronization supplies actor
metadata per folder. The updated extension always sends the event username, independently
of notification settings or publisher. Receiving notifications defaults to off and can be
enabled locally. Legacy/API requests without a username remain supported and do not add
attributed log entries.

The rolling log retains entries newer than seven days, capped at the newest 10,000 entries
per app/pool. Pruning occurs on subsequent logging calls, not through scheduled deletion;
the cap can reduce history below seven days.

See the [event logging documentation](../vscode-extension/docs/event-logging.md) for the
supported events, schema, privacy settings, and compatibility requirements. This is not
all-request auditing or verified-user authentication. The v2 `getLog` endpoint remains
obsolete; inspect `_log` using authorized storage tooling. Deploy the updated back end
before rolling out the updated extension.
