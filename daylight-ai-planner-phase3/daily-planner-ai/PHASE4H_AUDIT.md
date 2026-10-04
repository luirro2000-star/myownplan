# Daylight — Checkpoint 4H Audit

Date: 2026-10-04

## Scope

Repair the account session after an invited user creates their account on the Deploy Preview. Production remains on checkpoint 4A.

## Finding and fix

- Invitation acceptance succeeded and Daylight displayed the invited email, but the first cloud request returned 401, “Please sign in again.” The planner still held the device copy.
- The installed Netlify Identity SDK's `acceptInvite()` starts a browser session but does not set the `nf_jwt` cookie needed by Netlify Functions. Its `login()` method does set that cookie.
- Daylight now signs in with the newly accepted account inside the same invitation form submission, then loads the cloud copy. The password stays only in that submit handler; it is not logged, persisted, or added to the URL.

## Verification

- `npm test` passed all existing suites.
- `npm run build` passed outside the restricted sandbox; the sandbox itself blocks Vite's Windows child process with `spawn EPERM`.
- `git diff --check` passed.

## Pending live checks

- Deploy this commit to the draft preview and have the account owner sign in once using the password they chose. Confirm cloud status reaches “Synced across your devices.”
- Then check a disposable cloud save and AI response, followed by the remaining account-backed recovery flows. Do not publish production until those checks pass.
