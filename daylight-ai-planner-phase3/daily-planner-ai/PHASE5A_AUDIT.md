# Daylight — Checkpoint 5A Audit

Date: 2026-10-02

## Scope

One-tap Minimum, Normal, and Ambitious planning intensity for each weekday. Production remains on checkpoint 4A; this work is in the draft Deploy Preview.

## Findings

- Each weekday stores its own mode. Minimum reserves three hours beyond the configured free-time floor; Normal reserves one; Ambitious uses the floor. The configured floor is never reduced.
- A mode change replans flexible work through the deterministic engine, keeps fixed commitments anchored, records an Undo point, and appears in operation history.
- Mode changes plan the selected weekday as a whole. **Reality mode** remains the separate action for replanning from the current time.
- The mode choice travels with local planner state, JSON backups, and account-scoped cloud sync.
- Today now labels its capacity figure **open in day**, avoiding the implication that the number counts only future minutes.

## Verification

- `npm test` passed all existing regressions and new mode tests. The mode tests prove a constrained task can fit under Ambitious but not Normal, while a fixed event remains anchored and the protected free-time floor remains intact.
- `npm run build` produced the production Vite bundle. `git diff --check` found no whitespace errors.
- The Netlify Deploy Preview reached **ready** for commit `5c96a37`. Production was not deployed.
- In the preview, switching Friday between Normal and Minimum updated the selected control and protected-free figure. The mode survived a full reload and appeared in History. Undo returned the day to Normal.
- The first preview test exposed that a mode change also ran the from-now rescheduler; this was corrected before the final preview check.

## Remaining checks

- Signed-in mode sync awaits acceptance of the site Identity invitation.
- Actual-versus-estimated time, skip patterns, learned preferences, and controls for learned assumptions remain future Milestone 5 checkpoints.

## Next checkpoint

Capture actual task duration and skipped-work signals, then offer user-controlled duration suggestions without silently changing task estimates.
