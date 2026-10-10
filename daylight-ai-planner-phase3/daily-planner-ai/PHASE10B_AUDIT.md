# Checkpoint 10B audit — direct next-action controls

Audit date: 2026-10-10  
Scope: Today focus selection and non-conversational actions.

## Outcome

**PASS locally.** Held for the next batched preview deployment to conserve Netlify credits.

## Requirements checked

| Requirement | Evidence | Result |
| --- | --- | --- |
| Make the immediate next step obvious | Today renders one Now, Up next, or Still open card before summary details and the full timeline. | Pass |
| Work without typing or speaking | The card exposes Done and, for flexible work, Later. | Pass |
| Offer useful AI without making chat the product | Help me start sends a narrow request for one concrete first step and explicitly says not to change the schedule. | Pass |
| Select accurately | Active blocks win, then upcoming blocks, then the most recent missed block. Other weekdays use their first unfinished scheduled block. | Pass |
| Avoid misleading choices | Completed, skipped, and unscheduled blocks are excluded. Fixed commitments do not show Later. | Pass |
| Preserve reversibility | Done and Later use the existing completion/skip actions, operation history, cloud save, and Undo behavior. | Pass |
| Handle a clear day | The all-clear state offers a direct path to Inbox instead of inventing an action. | Pass |

## Verification

- `npm test`: pass, including active, upcoming, overdue, other-day, and all-clear focus-card cases.
- `npm run build`: pass with 18 transformed modules.
- `node --check site/app.js`: pass.
- Code review confirmed the card reuses existing planner event handlers rather than maintaining parallel state.

## Risks and follow-up

- The card uses scheduled time as its signal; it does not claim to know whether work actually began.
- The next batched preview should check card wrapping at phone width and the signed-in Help me start reply.
- A timer, snooze duration choices, and live task interruption are separate future decisions.
