# Daylight — Checkpoint 5E Audit

Date: 2026-10-04

## Scope

Complete the adaptive-planning feedback loop with a useful completion signal that remains honest about limited personal history and does not silently modify the plan.

## Implementation

- A flexible block becomes eligible after five matching finished/skipped attempts. Matching uses the same normalized title logic as duration and preferred-window learning.
- The calculation uses the most recent twelve attempts and a small Beta(1,1) prior. This prevents a short all-finished or all-skipped history from being presented as certain success or failure.
- The rounded outlook is paired with **Promising**, **Mixed**, or **May need support** and an **early**, **growing**, or **stronger** evidence label.
- The interface always shows finished, skipped, and total attempt counts and says the signal is not a guarantee.
- The outlook is informational. It does not alter task duration, preferred windows, priority, day mode, or schedule.
- When an outlook is shown, Daylight avoids repeating the same finished/skipped count in the older work-pattern notice. A separate preferred-window suggestion can still appear when supported.

## Verification

- `node --check site/app.js`, `npm test`, `npm run build`, and `git diff --check` passed.
- Regression cases verify that four attempts are insufficient; five of five produces an 85% **Promising** outlook; three of five produces a 55% **Mixed** outlook; and one of five produces a 30% **May need support** outlook.
- A twelve-attempt test proves older records fall outside the recency window.
- In a clean browser origin, three Homework blocks were finished and two were skipped through the visible UI. Adding another Homework task displayed:
  - **Mixed outlook · about 55%**
  - **3 finished and 2 skipped across 5 recent attempts. This is an early signal, not a guarantee.**
- The outlook exposed the accessible name **Completion outlook for Homework**.

## Limits

- A repeated title is only a practical proxy for the same kind of work. Context, difficulty, health, deadlines, and actual start time are not yet modeled.
- The percentage is a transparent personal-history signal, not a calibrated prediction. Real longitudinal data is required before any stronger claim.

## Draft preview

- Netlify processed draft commit `94ea377` in Preview 1.
- The deployed JavaScript contained the completion-outlook label and explicit **not a guarantee** explanation; the deployed stylesheet contained all three outlook presentation states.
- Existing user planner data was not changed to manufacture five matching attempts on the account. The end-to-end history scenario remained isolated to a clean local browser origin.

Production remains on checkpoint 4A. Checkpoint 5E is preview-verified; real longitudinal data remains a release-learning requirement.
