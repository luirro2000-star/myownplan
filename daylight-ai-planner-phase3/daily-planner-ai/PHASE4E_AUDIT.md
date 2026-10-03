# Daylight — Checkpoint 4E Audit

Date: 2026-10-02

## Scope

Account-scoped cloud snapshot listing and restoration from History. The production site remains on checkpoint 4A to conserve deployment credits.

## Findings

- A signed-in account can request metadata for its last 20 saved planner versions. Snapshot labels and dates appear in History only after the user asks to show versions.
- Restoring a version requires a confirmation. The server checks account identity, request origin, input shape, and expected cloud revision. It locks the account plan, copies the chosen account-owned snapshot into a new current revision, saves the pre-restore Undo history, and trims older snapshots in one transaction.
- If another device changes the cloud revision, the restore stops with a conflict. If the selected version is missing, the current plan stays intact.
- The app writes the restored plan to local storage only after the server confirms success. The previous local plan remains in Undo. The current conversation is left intact.

## Verification

- `npm test` passed all engine, intake, goal, assistant, planner-state, and snapshot regressions. Snapshot tests cover unsigned denial, account-scoped listing, invalid origin, stale revision, missing snapshot, and successful restoration with Undo history.
- `npm run build` produced the production Vite bundle. `git diff --check` found no whitespace errors.
- The existing draft pull request's Netlify Deploy Preview reached **ready** for commit `d8c3713`. Production was not deployed.

## Remaining checks

- Signed-in end-to-end restore and Undo on the preview await owner account access. No invitation was sent as part of this checkpoint.
- Direct browser navigation to the preview API endpoint was blocked by the browser client, so the live endpoint response was not independently inspected. The preview build and local Function tests passed.

## Next checkpoint

Add a clear per-operation history and make unresolved planning questions persist until answered.
