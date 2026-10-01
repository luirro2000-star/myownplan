# Daylight — Milestone 2 Handoff Audit

Date: 2026-09-30

## Scope completed
This handoff adds the deterministic planning core beneath the conversational AI layer.

### Scheduling engine
- open-slot calculation inside a configurable day window
- fixed vs flexible distinction enforced by code
- fixed events and locked routines remain anchored
- overlap/conflict detection
- explicit prep/travel buffer support
- weekday deadline handling
- priority ordering for flexible work
- preferred time windows
- splittable tasks with minimum useful block size
- protected free-time budget per weekday
- daily capacity / open-time calculations
- overload and conflict diagnostics
- nearby-day placement when a task cannot fit its original day and its deadline permits it
- an item that already fits is preserved instead of being moved unnecessarily
- replanning from a weekday does not rewrite earlier weekdays

### Recovery / control
- Reality Mode replans uncompleted flexible work forward from the current time
- completed work remains historical
- fixed commitments remain anchored during Reality Mode
- planner change report explains moves/splits/unresolved items
- planner transactions can be undone during the current browser session
- impossible tasks are left unscheduled rather than violating fixed commitments or protected free time

### AI/planner separation
- Anthropic remains the interpretation layer
- flexible AI-created tasks can omit exact timestamps
- proposals now carry priority, deadline day, splitting preference, minimum block size, and preferred window
- the deterministic engine chooses feasible placement after an AI-created flexible task is applied
- AI-triggered `replan` proposals execute the deterministic planner

## Validation performed
- `site/app.js` passes Node syntax validation.
- `site/planner-engine.js` passes Node syntax validation.
- `netlify/functions/assistant.mjs` passes Node syntax validation.
- local static server returned the HTML, app module, and planner-engine module successfully.
- engine smoke test passes.
- engine regression suite passes.
- no API key is present in frontend code.
- Netlify Function remains the only Anthropic API caller.

## Regression cases explicitly tested
1. A feasible existing flexible task keeps its original time.
2. A flexible task colliding with a fixed event moves; the fixed event does not.
3. Replanning from Wednesday does not alter Monday/Tuesday history.
4. Reality Mode does not move completed past work and does not place missed work back into the past.
5. When protected free time makes a task impossible, the task remains unscheduled instead of overpacking the day.

## Known limitations
1. Deadlines are weekday-level, not exact date/time deadlines yet.
2. Task splitting currently completes a task within one selected day; it does not distribute one large task across several days.
3. Undo is in-memory for the active session and is not persisted after refresh.
4. Recurring routines are instantiated weekday objects, not generated from recurrence rules.
5. The engine supports explicit buffers but does not yet calculate travel time from locations.
6. Dependencies are represented in the master product model but are not yet enforced by the solver.
7. Free-time budgets are prototype defaults (2h Mon–Wed, 3h Thu, 5h Fri) rather than conversationally editable settings.
8. Cloud database/authentication are not implemented; planner state remains localStorage-only.
9. Browser screenshot automation was not reliable in this execution environment, so visual QA was performed by source/layout inspection plus static serving rather than automated screenshot comparison.

## Blocking issues
None found for the Milestone 2 prototype scope.

## Recommended next milestone
Build the conversational brain-dump onboarding + Inbox so Daylight can ingest a long, disorganized description of commitments, habits, rules, goals, metrics, and ambiguous intentions, show what it understood, then pass actionable objects into the planner engine.
