# Daylight — Checkpoint 4J Audit

Date: 2026-10-04

## Scope

Give the account owner a private, low-data way to check whether the Netlify AI setup is usable.

## Implementation

- The signed-in Account panel has a manual **Check AI connection** button.
- Its account-protected server endpoint checks the configured Anthropic key and selected model through the Models API. It sends no planner state, conversation, or personal details to the provider and does not return the key to the browser.
- The result distinguishes missing key, rejected key, unavailable model, account billing/usage, rate limit, and temporary connection errors. It does not claim that a full planning response has been tested.

## Verification

- Regression checks cover sign-in, origin rejection, absent key, model request without planner data, and unavailable model.
- `npm test`, `npm run build`, and `git diff --check` passed.
- Live check on the Deploy Preview remains pending. Production remains on checkpoint 4A.
