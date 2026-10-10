# Daylight — Checkpoint 4I Audit

Date: 2026-10-04

## Scope

Verify the first account-backed session and repair a false cloud conflict after reloading the preview. Production remains on checkpoint 4A.

## Findings

- The invited account signed in and reached “Synced across your devices.” The session remained signed in after a full page reload.
- On reload, Daylight showed a plan-choice prompt. Its prior check compared `JSON.stringify(state)` with the database's JSONB result. JSONB can reorder object keys, so equivalent plans can appear different.
- Daylight now compares the full state, undo history, and conversation by value with sorted object keys. Real content differences still require an explicit choice.

## Verification

- Added a regression test for reordered nested keys, a changed plan, and a changed conversation. `npm test`, `npm run build`, and `git diff --check` passed.
- Deploy Preview #1 served commit `7b5990b`. A full reload stayed signed in and displayed “Synced across your devices” without a plan-choice prompt.
- Signed-in History loaded the server's saved versions, confirming that the account-scoped snapshot endpoint responds. A restore test remains pending: the browser confirmation prompt stalled automated control before a restore could be confirmed. A separate preview tab verified that version 3 is still synced and the temporary task remains absent.
- A temporary 30-minute task created cloud version 2. Undo removed it and created version 3; the account status returned to “Synced across your devices.” The current plan no longer contains the temporary task.
- An actual AI request remains pending on the draft preview.
