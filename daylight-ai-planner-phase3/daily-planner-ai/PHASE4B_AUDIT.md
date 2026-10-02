# Daylight — Checkpoint 4B Audit

Date: 2026-10-01

## Scope

Invite-only accounts, account-scoped Postgres persistence, cross-device sync, conflicts, privacy controls, and migration from local browser data.

## Local audit

- Netlify Identity enabled; registration confirmed as **Invite only** in project settings.
- `npm test` passes engine, intake, assistant, and cloud storage regression checks. The cloud tests cover unsigned requests, origin checks, invalid data, first save, account separation, stale revisions, forced conflict resolution, snapshots, and deletion.
- `npm run build` succeeds with Vite and emits the `dist` frontend.
- Built app rendered in a browser with no console errors. Sign-in, Quick add, History, and AI controls were present.
- API key stays in Netlify Functions; no key is bundled into the frontend. AI endpoints reject unsigned requests.
- Database migration creates planner and snapshot tables keyed by Identity user ID. Save transactions use an account-scoped lock and revision check.

## Production verification

Pending deployment, database provisioning, account invitation acceptance, and signed-in sync test. Do not mark the checkpoint complete until these are verified.

## Known limits

- Browser speech recognition remains unavailable in the Codex in-app browser; microphone behavior needs a supported browser.
- Local changes made while offline remain on the device and retry when the browser comes online, returns to view, or the user edits again. A durable offline queue is future work.
- Database snapshots are retained for audit, but restoring an arbitrary old snapshot from the UI is future work. The last 20 undo checkpoints remain available in History.
- A database active period consumes Netlify credits. I made no change to automatic paid recharge; its current setting still needs a dashboard check.
- Netlify browser access was blocked by automatic approval review after the local audit, so the owner invitation, production deploy, and live sync checks remain pending.
