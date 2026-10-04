# Daylight — Checkpoint 4K Audit

Date: 2026-10-04

## Scope

Verify an actual signed-in AI conversation in the draft preview and make cloud requests safer after a long-running session.

## Findings and changes

- After an earlier browser session, the app still showed an account while an AI request returned 401. A cloud save and snapshot restore also received an HTML response that the app had tried to parse as JSON. The cloud planner remained at the version without the temporary task.
- The client now refreshes the Identity session before account-protected requests and retries once on 401. Unexpected cloud responses report their HTTP status instead of showing a JSON parser error.
- Restore confirmation is now shown within Daylight. If the restore result is unreadable, the app reloads the cloud plan before allowing another save.
- A live AI tip described a Monday block as possibly over while the current day was Sunday. The assistant now receives the user's local weekday and is instructed not to describe another day's blocks as underway or past.

## Verification

- `npm test`, `npm run build`, and `git diff --check` passed after all changes. The weekday prompt has a regression assertion; its live reply is pending deployment.
- Deploy Preview #1 served commit `ce25962`. The signed-in **Check AI connection** action passed, and a real AI conversation returned a tip without changing the schedule. A subsequent cloud save displayed “Synced across your devices.”
- Deploy Preview #1 served commit `10386ff` with the in-app restore confirmation. The signed-in plan loaded after a full reload, but an older tab's browser confirmation stalled interaction before the new restore flow could be exercised. A backup was downloaded before the test. Live restore and Undo remain unverified.
- Production remains on checkpoint 4A. The draft preview has not been merged.
