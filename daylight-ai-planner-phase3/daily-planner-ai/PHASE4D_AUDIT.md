# Daylight — Checkpoint 4D Audit

Date: 2026-10-02

## Scope

Reviewable goal decomposition: goal or open loop → milestones → one concrete action → optional deterministic scheduling. The live Netlify site remains on checkpoint 4A to conserve production deployment credits.

## Findings

- Every goal and open loop can open an editable roadmap. Saving the roadmap alone does not put work on the calendar.
- Unsigned and offline users receive an editable starter. Signed-in users can request a tailored suggestion from a Netlify Function. The Function checks account identity and request origin; the Anthropic key stays on the server.
- Input from the AI or editor is normalized to short unique milestones, a valid weekday or no day, and a 10–180 minute next action.
- **Save & plan next step** creates one linked flexible task and calls the existing scheduling engine. Reopening a saved roadmap does not make another AI call. Editing its linked action updates the existing task instead of creating a duplicate.
- Roadmaps are embedded in goals and open loops, which the existing local storage, backup, and account-scoped cloud payload already preserve.

## Verification

- `npm test` passed engine, intake, goal-breakdown, assistant, and planner-state regressions. The new tests cover normalization, unsigned denial, invalid input, origin rejection, and a mocked provider response.
- `npm run build` produced the production Vite bundle. `git diff --check` found no whitespace errors.
- The Deploy Preview showed **Find next step** on a goal and an open loop. An unsigned open loop offered the editable starter instead of attempting an AI call.
- In the Deploy Preview, edited milestones, action title, and duration survived a full reload. Saving alone left the schedule unchanged. Scheduling the action placed it on Monday; editing its title and duration updated that same planner task.
- The goal cards and saved roadmap were visually inspected at desktop width. The Netlify Drawer overlays the bottom of the preview page but is not part of Daylight.

## Remaining checks

- Signed-in AI suggestions and cross-device roadmap sync await owner account access. No invitation was sent as part of this checkpoint.
- No production deployment until the planned release.

## Next checkpoint

Let signed-in users view and restore earlier server snapshots from History, with a clear confirmation and undo path.
