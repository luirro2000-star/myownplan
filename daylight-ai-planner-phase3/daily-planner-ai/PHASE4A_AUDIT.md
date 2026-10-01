# Daylight — Checkpoint 4A Audit

Date: 2026-10-01

## Scope

This checkpoint improves the conversation flow and starts the durable-data work without provisioning a paid cloud database.

- Voice capture is available for Planner chat and Inbox in browsers exposing `SpeechRecognition` or `webkitSpeechRecognition`. Transcribed text stays editable and is never sent automatically.
- Spoken assistant replies are opt-in and can be turned off at any time.
- Planner chat sends recent turns so follow-up questions have context. The deterministic scheduler still decides placement and AI proposals still require review.
- The frontend now distinguishes missing key, rejected key, unavailable model, provider usage status, rate limit, unreachable function, and other provider failures instead of claiming every error is a missing key.
- A Quick add form places a task through the deterministic planner. For the current day, it plans forward from the current time.
- The last 20 undo checkpoints and recent conversation text survive a browser refresh. History can export a JSON backup and import one with validation and a confirmation step.

## Validation

- `npm test`: engine smoke/regression, intake regression, and new assistant request/error regression passed.
- `node --check` passed for the modified frontend and assistant Function.
- Local browser: Quick add placed a task without moving fixed commitments, and the current-day path scheduled it from the current time rather than in the past.
- Local browser: planner state and undo history persisted after reload; Undo restored the previous state.
- Local browser: Today and History screens rendered without runtime errors.
- Netlify: `ANTHROPIC_API_KEY` exists and is scoped to Functions. The production deploy has both `assistant` and `intake` Functions.
- A production chat request using a harmless greeting reached the `assistant` Function (confirmed by a matching function-log invocation), but the current deployed frontend returned its generic configuration message. The new frontend and Function diagnostics are prepared locally but have not yet been deployed, so the provider's actual failure reason remains unverified.

## Limits and next checkpoint

- Voice recognition and speech synthesis are unavailable in the Codex in-app browser used for visual QA. The feature is guarded and falls back to typing; a supported browser must be used for a live microphone check.
- The Anthropic key's validity and account billing status have not been verified through a live AI request. The previous generic frontend error hid the real failure; the new error path will identify it after deployment and use.
- History, conversation, and backups are still local to one browser. Authentication, Postgres, cross-device sync, server-side operation history, and durable Inbox storage remain Milestone 4 work.
- Netlify Database uses account credits while active. Provisioning it is a separate decision before cloud persistence can be activated.

## Checkpoint result

The local implementation meets the scoped behavior and regression checks. Cloud persistence remains pending.
