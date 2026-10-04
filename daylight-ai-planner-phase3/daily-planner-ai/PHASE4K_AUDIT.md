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

- `npm test`, `npm run build`, and `git diff --check` passed after all changes. The weekday prompt has a regression assertion; a new live reply with that prompt has not been requested.
- Deploy Preview #1 served commit `ce25962`. The signed-in **Check AI connection** action passed, and a real AI conversation returned a tip without changing the schedule. A subsequent cloud save displayed “Synced across your devices.”
- The user accepted the earlier browser confirmation. Version 2 restored successfully as cloud version 6 and displayed its dedicated Undo point. Undo removed the temporary task and saved cloud version 7. The Monday plan again showed six blocks with no temporary task, and a full reload on another preview tab returned “Synced across your devices” without a conflict.
- Deploy Preview #1 served commit `ca55165` with the new in-app restore confirmation. Selecting version 3 displayed both “Keep current plan” and “Restore version 3”; keeping the current plan left version 7 marked Current. This verifies the new confirmation and cancel flow without changing the recovered plan.
- Production remains on checkpoint 4A. The draft preview has not been merged.
