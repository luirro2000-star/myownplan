# Daylight — Milestone 3 Handoff Audit

Date: 2026-09-30

## Scope completed
This handoff turns the original “paste my whole life” idea into a first-class intake workflow instead of requiring the user to manually decide whether something is a task, event, habit, goal, or rule.

### Brain-dump intake
- new Inbox navigation/surface
- large unstructured-text capture field
- dedicated `/api/intake` Netlify Function for multi-object interpretation
- structured Anthropic schema for seven planning object types:
  - event
  - task
  - routine
  - rule
  - goal
  - metric
  - open loop
- original source wording retained on interpreted objects
- confidence score stored per interpretation
- materially ambiguous items can carry a clarification question
- ambiguous/low-confidence items start unchecked instead of being auto-applied
- “Here’s what I understood” review before planner mutation
- user can accept/reject individual interpretations
- user can correct type, title, day, start time, and duration before applying
- raw capture is stored in local Inbox history
- capture history records interpretation source and object counts

### Applying reviewed information
- fixed events enter the schedule as anchored commitments
- flexible tasks enter the deterministic planning engine
- untimed recurring routines remain schedulable instead of becoming fake fixed appointments
- recurring weekday routines are materialized as weekday instances and constrained to their intended day
- rules are stored in the planner rule layer
- goals remain outside the calendar
- metrics remain outside the calendar
- open loops remain visible without being forced into a time slot
- accepted intake triggers a deterministic planner pass
- unplaceable work remains unscheduled rather than breaking fixed commitments or protected free time
- the complete import is undoable as one planner transaction

### Offline/testing behavior
- local heuristic intake fallback exists so the review flow can still be exercised when `/api/intake` is unavailable
- fallback is deliberately conservative and labels itself as lower-quality interpretation
- production-quality brain-dump understanding still depends on the Anthropic Netlify Function

## Validation performed
- `site/app.js` passes Node syntax validation.
- `site/intake.js` passes Node syntax validation.
- `site/planner-engine.js` passes existing smoke/regression tests.
- `netlify/functions/assistant.mjs` passes Node syntax validation.
- `netlify/functions/intake.mjs` passes Node syntax validation.
- static server successfully returned `site/index.html`, `site/app.js`, and `site/intake.js`.
- all automated tests pass through `npm test`.
- no Anthropic API key is embedded in frontend code.
- API calls remain server-side through Netlify Functions.

## Intake regression cases explicitly tested
1. Low-confidence/ambiguous interpretations start unchecked.
2. High-confidence interpretations start selected.
3. A daily untimed routine creates five weekday instances.
4. Untimed routine instances remain flexible/schedulable.
5. Recurring routine instances receive same-day deadlines so the scheduler does not drift them into another weekday.
6. Rule, goal, metric, and open-loop objects are stored in separate non-calendar layers.
7. Offline fallback recognizes a weekday event, daily routine, and numeric points metric from messy text.
8. Existing Milestone 2 planner regression tests still pass.

## Known limitations
1. Intake currently supports the Monday–Friday prototype horizon rather than arbitrary real dates.
2. Review controls do not yet expose every structured field (deadline, recurrence, target, unit, priority, preferred window).
3. Applying a brain dump can create duplicates if the same commitments already exist; semantic duplicate detection is not implemented yet.
4. Daily routine statements are currently materialized as separate recurring items. The intake layer does not yet intelligently merge “make bed,” “brush teeth,” etc. into an existing Morning Reset checklist.
5. Clarification questions live in the current review session; there is not yet a persistent unresolved-question workflow.
6. Goal decomposition is represented in the product model but is not yet implemented. Goals are stored, not automatically expanded into milestones/next actions.
7. Inbox history remains localStorage-only and does not sync across devices.
8. Intake capture time labels are currently human/simple (“just now”), not persisted as a polished date/time history UI.
9. The offline fallback is only a testing convenience; it is not meant to match Anthropic interpretation quality.
10. Automated Chromium visual rendering timed out in this execution environment, so visual QA relied on source inspection and successful static-module serving rather than screenshot comparison.

## Blocking issues
None found for the Milestone 3 prototype scope.

## Recommended next milestone
Build the durable product foundation: authentication, Postgres persistence, cross-device sync, operation history, schedule snapshots, and durable Inbox/open-loop storage. Once the app has a reliable source of truth, add goal decomposition and then external calendar integrations.
